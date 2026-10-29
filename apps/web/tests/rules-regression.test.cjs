const assert=require('node:assert/strict');
const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
const context={window:{},console};vm.createContext(context);
for(const file of ['data/definitions.js','core/engine.js']) vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js',file),'utf8'),context);
const Game=context.window.TacticsGame;

// The last stunned turn must also block free skills.
const stun=new Game();stun.phase='battle';stun.team='A';
const assassin=stun.spawn('assassin','A',{x:0,y:0});stun.spawn('angel','B',{x:1,y:0});
assassin.statuses.stun=1;stun.beginTurn();
assert.equal(stun.useSkill(assassin.uid,'stealth',{x:0,y:0}),false);
stun.endTurn();stun.endTurn();
assert.equal(stun.useSkill(assassin.uid,'stealth',{x:0,y:0}),true);

// The frost nova is centered on its caster, not a movable second area.
const frost=new Game();frost.phase='battle';frost.team='A';
const mage=frost.spawn('mage','A',{x:0,y:0});const enemy=frost.spawn('angel','B',{x:2,y:0});
assert.equal(frost.useSkill(mage.uid,'frost_nova',{x:2,y:0}),false);
assert.equal(frost.useSkill(mage.uid,'frost_nova',{x:0,y:0}),true);
assert.ok(enemy.statuses.slow);

// Puppet movement stays within its owner's leash.
const puppet=new Game();puppet.phase='battle';puppet.team='A';
const master=puppet.spawn('puppet_master','A',{x:0,y:0});puppet.spawn('angel','B',{x:5,y:5});
assert.equal(puppet.useSkill(master.uid,'puppet',{x:1,y:0}),true);
const minion=puppet.units.find(u=>u.ownerUid===master.uid);
minion.mp=4;minion.ap=2;
assert.equal(puppet.move(minion.uid,{x:4,y:0}),false);

// Queen orb is a ray: a diagonal target behind another unit is blocked.
const chess=new Game();chess.phase='battle';chess.team='A';
const queen=chess.spawn('queen','A',{x:0,y:0});queen.charge=1;
const blocker=chess.spawn('pawn','B',{x:1,y:1});const far=chess.spawn('angel','B',{x:2,y:2});
assert.equal(chess.useSkill(queen.uid,'queen_orb',{x:2,y:2}),false);
assert.equal(far.hp,far.maxHp);
assert.equal(chess.useSkill(queen.uid,'queen_orb',{x:1,y:1}),true);
assert.ok(blocker.hp<blocker.maxHp);

// Stacked allies can be targeted individually by a healing spell.
const stacked=new Game();stacked.phase='battle';stacked.team='A';
const healer=stacked.spawn('angel','A',{x:0,y:0});healer.charge=2;
const ally1=stacked.spawn('knight','A',{x:1,y:0});
const ally2=stacked.spawn('ranger','A',{x:1,y:0});
stacked.spawn('assassin','B',{x:5,y:5});ally1.hp=30;ally2.hp=10;
assert.equal(stacked.useSkill(healer.uid,'holy_light',{x:1,y:0},ally2.uid),true);
assert.equal(ally1.hp,30);assert.equal(ally2.hp,40);

// Duel exchanges up to three basic attacks per side, with no extra AP cost.
const duel=new Game();duel.phase='battle';duel.team='A';
const board=duel.spawn('chessboard','A',{x:0,y:0});
const opponent=duel.spawn('angel','B',{x:1,y:0});
assert.equal(duel.useSkill(board.uid,'duel',{x:1,y:0}),true);
assert.ok(opponent.hp<opponent.maxHp-board.attack);
assert.ok(board.hp<board.maxHp-opponent.attack);
console.log('Rules regression tests passed');

// Free dagger damage is twenty, still physical, once per game and blocked while stunned.
{
 const g=new Game();g.phase='battle';g.team='A';const a=g.spawn('assassin','A',{x:1,y:1}),b=g.spawn('angel','B',{x:1,y:2});b.hp=b.maxHp=100;b.defense=2;
 assert.equal(g.useSkill(a.uid,'dart',b),true);assert.equal(b.hp,82);assert.equal(a.ap,1);assert.equal(g.useSkill(a.uid,'dart',b),false);
 assert.ok(context.window.GAME_DATA.skills.dart.description.includes('20'));
}
// Permanent enhancements survive the same JSON roundtrip used by online snapshots.
{
 const g=new Game();g.phase='battle';g.team='A';const a=g.spawn('knight','A',{x:1,y:1});g.spawn('skeleton','B',{x:5,y:5});
 assert.equal(g.useSkill(a.uid,'shield_wall',a),true);assert.equal(a.defense,8);
 const copy=new Game();copy.restore(JSON.parse(JSON.stringify(g.snapshot())));const saved=copy.unit(a.uid);assert.equal(saved.buffs[0].turns,'permanent');
 for(let n=0;n<5;n++)copy.beginTurn();assert.equal(saved.defense,8);assert.equal(saved.buffs.length,1);
}
