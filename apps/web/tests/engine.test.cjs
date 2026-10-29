const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const context = {window:{}, console};
vm.createContext(context);
for (const file of ['data/definitions.js','core/engine.js']) vm.runInContext(fs.readFileSync(path.join(root,'js',file),'utf8'),context);
const Game = context.window.TacticsGame;
const skillCardIds = new Set(Object.keys(context.window.GAME_DATA.skillCards));
assert.deepEqual([...skillCardIds].sort(), ['demon_meteor','fire_rain','heal_aura']);

// Full phase transition, with a guaranteed role for each side.
const g = new Game(); g.start();
assert.equal(g.phase,'draft');
for (let n=0;n<8;n++) {
  const candidates=g.candidates;
  assert.equal(candidates.length,3);
  assert.ok(candidates.every(c=>c.kind==='unit'||skillCardIds.has(c.id)));
  const pick=candidates.findIndex(c=>c.kind==='unit');
  assert.equal(g.pick(Math.max(0,pick)),true);
}
assert.equal(g.phase,'deploy');
for (const team of ['A','B']) {
  while(g.remaining(team).length) {
    const id=g.remaining(team)[0].id;
    const pos={x:g.units.filter(u=>u.team===team).length,y:team==='A'?0:5};
    assert.equal(g.deploy(id,pos),true);
  }
}
assert.equal(g.phase,'battle');
assert.ok(g.units.some(u=>u.team==='A'));
assert.ok(g.units.some(u=>u.team==='B'));
const first=g.units.find(u=>u.team==='A'&&u.mp+u.ap>0);
assert.ok(first);
assert.equal(g.move(first.uid,{x:first.x,y:1}),true);
g.endTurn();assert.equal(g.team,'B');
g.endTurn();assert.equal(g.round,2);

// Damage resolves shield, armor, death and victory.
const duel=new Game();duel.phase='battle';duel.team='A';
const attacker=duel.spawn('assassin','A',{x:0,y:0});
const defender=duel.spawn('angel','B',{x:1,y:0});
defender.shield=12;defender.oneShield=true;
assert.equal(duel.attack(attacker.uid,defender.uid),true);
assert.equal(defender.hp,80);
assert.equal(defender.oneShield,false);
attacker.ap=1;assert.equal(duel.attack(attacker.uid,defender.uid),true);
assert.equal(defender.shield,0);assert.equal(defender.hp,72);
duel.damage(defender,999,attacker);
assert.equal(duel.phase,'end');assert.equal(duel.winner,'A');

// Summoning and charge use the same exported skill data as the desktop build.
const summon=new Game();summon.phase='battle';summon.team='A';
const tree=summon.spawn('treent_ancient','A',{x:0,y:0});
summon.spawn('angel','B',{x:5,y:5});
assert.equal(summon.useSkill(tree.uid,'summon_treant',{x:1,y:0}),true);
assert.ok(summon.units.some(u=>u.id==='treant_small'));
const angel=summon.spawn('angel','A',{x:0,y:1});
summon.beginTurn();assert.equal(angel.charge,1);
summon.beginTurn();assert.equal(angel.charge,2);
angel.hp=30;
assert.equal(summon.useSkill(angel.uid,'holy_light',{x:0,y:1}),true);
assert.equal(angel.hp,60);assert.equal(angel.charge,0);

// Only the three standalone cards enter the hand; each resolves its own effect.
const hand=new Game();hand.phase='battle';hand.team='A';
const friend=hand.spawn('angel','A',{x:0,y:0});
const enemy=hand.spawn('knight','B',{x:3,y:3});
hand.hands.A=['heal_aura','fire_rain','demon_meteor'];
assert.equal(hand.playHand('heal_aura',{x:3,y:3}),false);
assert.equal(hand.hands.A.length,3);
assert.equal(hand.playHand('heal_aura',{x:0,y:0}),true);
assert.equal(friend.aura,true);
assert.equal(hand.playHand('fire_rain',{x:3,y:3}),true);
assert.ok(enemy.hp<90);
assert.equal(hand.playHand('demon_meteor',{x:3,y:3}),true);
assert.ok(hand.units.some(u=>u.id==='golem'&&u.team==='A'));

console.log('Engine tests passed');
