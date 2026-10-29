'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const context={window:{}};vm.createContext(context);
for(const file of ['data/definitions.js','core/engine.js','ui/stacking.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',file),'utf8'),context);
const G=context.window.TacticsGame,proposal=context.window.StackingConfirmation.proposal;
const g=new G();g.startCampaign(['knight','ranger','mage','angel'],['skeleton'],5);g.deploy('knight',{x:0,y:0});
const before=JSON.stringify(g.snapshot());const plan=proposal(g,'deploy',{id:'ranger',x:0,y:0});assert.equal(plan.arrivals[0].count,2);assert.equal(JSON.stringify(g.snapshot()),before,'previews never mutate the actual match');
g.deploy('ranger',{x:0,y:0});g.deploy('mage',{x:0,y:0});assert.equal(proposal(g,'deploy',{id:'angel',x:0,y:0}),null,'full stacks cannot produce a confirmation');g.deploy('angel',{x:1,y:0});
const ranger=g.units.find(u=>u.id==='ranger');assert.equal(proposal(g,'move',{uid:ranger.uid,x:1,y:0}).arrivals[0].count,2);
assert.equal(proposal(g,'move',{uid:ranger.uid,x:5,y:0}),null,'unreachable movement cannot ask to stack');
const mage=g.units.find(u=>u.id==='mage');const enemy=g.units.find(u=>u.team==='B');enemy.x=1;enemy.y=1;enemy.hp=100;
const state=JSON.stringify(g.snapshot());assert.equal(g.canTarget('skill',mage.uid,'fireball',enemy),true);assert.equal(JSON.stringify(g.snapshot()),state,'target hints cannot emit real events');
assert.equal(g.useSkill(mage.uid,'fireball',enemy),true);assert.ok(g.visualEvents.some(e=>e.type==='skill'&&e.id==='fireball'));assert.ok(g.visualEvents.some(e=>e.type==='hit'));
const restored=new G();restored.restore(g.snapshot());assert.equal(restored.visualSeq,g.visualSeq);assert.equal(JSON.stringify(restored.visualEvents),JSON.stringify(g.visualEvents));
for(let i=0;i<60;i++)g.emitVisual('hit',{to:{x:0,y:0},amount:1});assert.equal(g.visualEvents.length,32);
const knight=g.units.find(u=>u.id==='knight');knight.ap=1;assert.equal(g.attack(knight.uid,enemy.uid),false,'invalid attacks emit no attack event');
const summon=new G();summon.startCampaign(['treent_ancient','knight'],['skeleton'],5);summon.deploy('treent_ancient',{x:0,y:0});summon.deploy('knight',{x:1,y:0});
const tree=summon.units.find(u=>u.id==='treent_ancient'),summonBefore=JSON.stringify(summon.snapshot());
assert.equal(proposal(summon,'skill',{uid:tree.uid,id:'summon_treant',x:1,y:0}).arrivals[0].id,'treant_small');
assert.equal(JSON.stringify(summon.snapshot()),summonBefore,'summon confirmation cannot spend a once-per-game skill');
const chess=new G();chess.startCampaign(['queen','knight'],['skeleton'],5);chess.deploy('queen',{x:0,y:0});chess.deploy('knight',{x:1,y:0});const queen=chess.units.find(u=>u.id==='queen');queen.charge=3;
assert.equal(proposal(chess,'skill',{uid:queen.uid,id:'queen_move',x:1,y:0}).arrivals[0].count,2);assert.equal(queen.charge,3);
// Deselect only the unit that just successfully acted, and only when both pools are empty.
const actionGame=()=>{const game=new G();game.startCampaign(['mage'],['skeleton'],1);game.deploy('mage',{x:0,y:0});const unit=game.units.find(u=>u.team==='A'),target=game.units.find(u=>u.team==='B');target.x=0;target.y=1;target.hp=target.maxHp=200;game.select(unit.uid);return {game,unit,target};};
{
 const {game,unit}=actionGame();unit.mp=1;unit.ap=1;
 assert.equal(game.move(unit.uid,{x:1,y:0}),true);assert.equal(game.selected,unit.uid,'remaining AP keeps the unit selected');
 game.intent={type:'skill',id:'fireball'};
 assert.equal(game.move(unit.uid,{x:2,y:0}),true);assert.equal(unit.mp,0);assert.equal(unit.ap,0);assert.equal(game.selected,null);assert.equal(game.intent,null);
 assert.equal(game.select(unit.uid),true);assert.equal(game.selected,unit.uid,'exhausted units can still be inspected');
 assert.equal(game.move(unit.uid,{x:3,y:0}),false);assert.equal(game.selected,unit.uid,'failed actions do not clear inspection');
}
{
 const {game,unit,target}=actionGame();unit.mp=1;unit.ap=1;
 assert.equal(game.attack(unit.uid,target.uid),true);assert.equal(game.selected,unit.uid,'remaining MP keeps the unit selected');
 unit.ap=1;unit.mp=0;assert.equal(game.attack(unit.uid,target.uid),true);assert.equal(game.selected,null);
}
{
 const {game,unit,target}=actionGame();unit.mp=0;unit.ap=1;game.intent={type:'skill',id:'fireball'};
 assert.equal(game.useSkill(unit.uid,'fireball',target),true);assert.equal(game.selected,null);assert.equal(game.intent,null);
}
{
 const {game,unit}=actionGame();const other=game.spawn('knight','A',{x:2,y:0});game.select(other.uid);unit.mp=1;unit.ap=0;
 assert.equal(game.move(unit.uid,{x:1,y:0}),true);assert.equal(game.selected,other.uid,'another unit acting cannot clear the inspected unit');
}
{
 const game=new G();game.startCampaign(['angel'],['skeleton'],1);game.deploy('angel',{x:0,y:0});const angel=game.units.find(u=>u.team==='A');angel.hp-=20;angel.mp=0;angel.ap=0;angel.charge=5;game.select(angel.uid);
 assert.equal(game.useSkill(angel.uid,'holy_light',angel),true);assert.equal(game.selected,null,'charge-based casts also finish the unit selection');
}
console.log('Stacking, visual events and exhausted-unit selection passed');
