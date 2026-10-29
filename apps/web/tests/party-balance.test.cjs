/* Real-rule opening probes; deterministic policies are a baseline, not human win rates. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const c={window:{},localStorage:{getItem:()=>null,setItem(){}}};vm.createContext(c);
for(const file of ['data/definitions','core/engine','campaign/content','campaign/progress','core/ai'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/'+file+'.js'),'utf8'),c);
const {CampaignProgress:P,TacticsGame:G,TacticsAI:AI,GAME_DATA:D}=c.window;
function play(level,roster,skills=true,offset=0,legacy=false){
 const g=new G(),party=roster.slice(0,legacy&&level<=4?1:P.partySize(level)),training=Object.fromEntries(party.map((id,i)=>[id,i===0?1+[40,100,180,280].filter(n=>(level-1)*40>=n).length:1]));
 if(legacy)g.startCampaign(party,level<=4?[['slime_small'],['skeleton'],['treant_small'],['pawn']][level-1]:P.opponents(level),level,training);
 else assert.equal(P.start(g,party,level,training),true);
 party.forEach((id,i)=>assert.ok(g.deploy(id,{x:(offset+i)%6,y:1})));
 for(let n=0;g.phase==='battle'&&n<700;n++)AI.step(g,g.team,{skills:g.team==='A'?skills:true,tactical:g.team==='A'&&skills});
 assert.equal(g.phase,'end',`level ${level} stalled`);
 const alive=g.units.filter(u=>u.team==='A'&&u.campaignOriginal),max=party.reduce((sum,id)=>sum+Math.round(D.cards[id].health*(1+(training[id]-1)*.12)),0);
 return {win:g.winner==='A',rounds:g.round,health:Math.min(100,Math.round(alive.reduce((sum,u)=>sum+u.hp,0)/max*100)),survivors:alive.length};
}
const rosters={ranged:['treent_ancient','ranger','knight','mage'],healing:['treent_ancient','angel','knight','ranger'],magic:['treent_ancient','mage','cleric','ranger'],summon:['treent_ancient','necromancer','puppet_master','angel']};
const rows=[];
for(let level=1;level<=6;level++)for(const [build,roster] of Object.entries(rosters))for(const skills of [true,false]){
 const results=[0,1,2].map(offset=>play(level,roster,skills,offset));
 rows.push({level,build,policy:skills?'skills':'attack-only',wins:results.filter(r=>r.win).length,rounds:+(results.reduce((s,r)=>s+r.rounds,0)/3).toFixed(1),health:Math.round(results.reduce((s,r)=>s+r.health,0)/3)});
}
console.table(rows);
const baseline=[1,2,3,4].map(level=>({level,...play(level,rosters.ranged,false,1,true)}));console.log('Legacy attack-only opening:');console.table(baseline);
assert.deepEqual([1,2,3,4,5].map(P.partySize),[1,2,2,3,4]);
for(let level=1;level<=6;level++)assert.ok(rows.some(r=>r.level===level&&r.policy==='skills'&&r.wins>0),'a tested skill-using build must clear stage '+level);
assert.ok(rows.filter(r=>r.level===1&&r.policy==='attack-only').every(r=>r.wins===3&&r.health<=80),'the opening remains winnable but a basic attack duel costs health');
for(let level=2;level<=5;level++)assert.ok(rows.filter(r=>r.level===level&&r.policy==='skills').every(r=>r.wins>=2),'tested mixed builds must not encounter an opening hard lock');
assert.ok(rows.some(r=>r.level>=3&&r.level<=5&&r.policy==='attack-only'&&r.wins<3),'blind attacking should not always clear later opening encounters');
assert.ok(rows.some(r=>r.level>=3&&r.level<=5&&r.policy==='skills'&&r.health<85),'the opening is not a sequence of full-health tactical wins');
const invalid=new G();assert.equal(P.start(invalid,['treent_ancient'],2),false);assert.equal(invalid.phase,'menu','an undersized roster cannot begin a party encounter');
assert.equal(P.start(invalid,['treent_ancient'],0),false);
const journey=P.fresh();for(let level=1;level<=5;level++){assert.ok(journey.owned.length>=P.partySize(level),'normal first-clear rewards support the next roster size');if(level<=4){assert.equal(P.completeLevel(journey,level,journey.owned.slice(0,P.partySize(level))),true);assert.equal(P.chooseReward(journey,P.available(journey)[0]),true);}}
const before=JSON.stringify(D.cards);const snap=new G();P.start(snap,rosters.ranged.slice(0,2),3);const actual=snap.units[0],expected=P.encounter(3)[0];assert.equal(actual.hp,expected.hp);assert.equal(actual.attack,expected.attack);assert.equal(actual.x,expected.x);assert.equal(JSON.stringify(D.cards),before,'encounters never mutate shared card definitions');const restored=new G();restored.restore(snap.snapshot());assert.equal(restored.units[0].hp,expected.hp);
console.log('Party opening balance and preview/state isolation baseline passed');
