'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const storage=new Map(),context={window:{},localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)}};
vm.createContext(context);
for(const file of ['data/definitions.js','core/engine.js','campaign/content.js','campaign/progress.js','core/ai.js'])
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',file),'utf8'),context);
const {TacticsGame:G,CampaignProgress:P,CampaignContent:C}=context.window;
assert.equal(C.stages.length,12);assert.equal(C.relics.length,3);
const p=P.fresh();assert.equal(P.equipRelic(p,'rootstone'),false);
p.cleared=[6,9,12];assert.equal(P.unlockedRelics(p).length,3);assert.equal(P.equipRelic(p,'rootstone'),true);assert.equal(P.load().equippedRelic,'rootstone');
const make=relic=>{const g=new G();g.startCampaign(['knight'],['boss_warden'],6,{}, {relic});g.deploy('knight',{x:0,y:0});return g;};
const root=make('rootstone'),knight=root.units.find(u=>u.team==='A');knight.hp-=10;root.team='B';root.endTurn();assert.equal(knight.hp,84);
const minion=root.spawn('skeleton','A',{x:1,y:0});minion.hp-=10;const hurt=minion.hp;root.team='B';root.endTurn();assert.equal(minion.hp,hurt,'relic healing only applies to the original party');
const restored=new G();restored.restore(root.snapshot());restored.team='B';restored.endTurn();assert.equal(restored.units.find(u=>u.uid===knight.uid).hp,90,'relic and party markers survive snapshot');
const crown=make('crown');assert.equal(crown.units.find(u=>u.team==='A').shield,45);
const hit=relic=>{const g=make(relic),a=g.units.find(u=>u.team==='A'),b=g.units.find(u=>u.team==='B');a.x=1;a.y=4;const hp=b.hp;g.attack(a.uid,b.uid);return hp-b.hp;};
assert.equal(hit('ember')-hit(null),5);
const online=make('crown');online.mode='online';assert.equal(online.spawn('knight','A',{x:1,y:0}).shield,30,'competitive units receive no relic shield');
// Challenge rewards track best stars, never repeat base rewards or lower a best result.
const progress=P.fresh(),win=new G();win.startCampaign(['treent_ancient'],['skeleton'],1);win.deploy('treent_ancient',{x:0,y:0});win.units=win.units.filter(u=>u.team==='A');win.phase='end';win.winner='A';win.round=20;
assert.equal(P.completeLevel(progress,1,['treent_ancient']),true);
assert.equal(P.recordVictory(progress,win).stars,2);assert.equal(progress.gold,15);
assert.equal(P.recordVictory(progress,win).bonusGold,0);
P.chooseReward(progress,P.available(progress)[0]);
win.round=3;assert.equal(P.completeLevel(progress,1),false);assert.equal(P.recordVictory(progress,win).bonusGold,5);assert.equal(progress.gold,20);assert.equal(progress.pendingReward,false);
assert.equal(progress.experience.treent_ancient,40,'replaying does not farm experience');
win.units=[];win.round=20;assert.equal(P.recordVictory(progress,win).stars,1);assert.equal(progress.stars[1],3);assert.equal(progress.gold,20);
win.mode='online';assert.equal(P.recordVictory(progress,win),null);
assert.equal(P.load().stars[1],3);assert.equal(P.equipRelic(progress,'unknown'),false);
for(const level of [6,9,12]) for(const relic of C.relics) {
 const battle=new G(),party=['treent_ancient','knight','ranger','mage'];
 battle.startCampaign(party,P.opponents(level),level,{}, {relic:relic.id});
 party.forEach((id,i)=>battle.deploy(id,{x:i,y:0}));
 for(let step=0;step<700&&battle.phase==='battle';step++)context.window.TacticsAI.step(battle,battle.team);
 assert.equal(battle.phase,'end',`Relic ${relic.id} stalled boss stage ${level}`);
}
console.log('Campaign relic, story and replay challenge tests passed');
