'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const c={window:{}};vm.createContext(c);for(const f of ['data/definitions.js','core/engine.js','core/ai.js','practice/mode.js','network/ranks.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',f),'utf8'),c);
const {TacticsGame:G,PracticeMode:P,GAME_DATA:D,StarRanks:R}=c.window;
for(const preset of Object.keys(P.presets))for(const difficulty of ['guided','standard','tactical']){
 const g=new G();P.start(g,{preset,difficulty});assert.equal(g.mode,'practice');assert.equal(g.units.filter(u=>u.team==='B').length,4);assert.equal(g.relic,null);
 [...g.remaining('A')].forEach((card,i)=>assert.ok(g.deploy(card.id,{x:i,y:0})));assert.equal(g.phase,'battle');assert.equal(g.team,'A');assert.ok(g.units.filter(u=>u.team==='A').every(u=>u.rank===1&&u.attack===D.cards[u.id].attack));
 g.endTurn();let n=0;while(g.team==='B'&&g.phase==='battle'&&n++<150)P.step(g);assert.ok(n<150,'AI finishes its turn');
}
const draft=new G();P.start(draft,{format:'draft',difficulty:'tactical'});while(draft.phase==='draft'){if(draft.team==='A')draft.pick(0);else P.step(draft);}assert.equal(draft.deployTeam,'A');[...draft.remaining('A')].forEach((card,i)=>draft.deploy(card.id,{x:i,y:0}));while(draft.phase==='deploy')P.step(draft);assert.equal(draft.phase,'battle');
const guided=new G();P.start(guided,{difficulty:'guided'});guided.deployTeam='A';[...guided.remaining('A')].forEach((card,i)=>guided.deploy(card.id,{x:i,y:0}));const a=guided.units.find(u=>u.team==='A'),cat=guided.units.find(u=>u.id==='berserker');a.x=cat.x;a.y=cat.y-1;guided.endTurn();let n=0;while(guided.team==='B'&&guided.phase==='battle'&&n++<100)P.step(guided);assert.ok(!cat.used.includes('rage'),'guided bot never casts an active skill');
assert.equal(R.change({rating:1000,games:0},{rating:1000},1),24);assert.equal(R.change({rating:1000,games:5},{rating:1000},1),16);assert.equal(R.tier(1900).index,5);assert.equal(R.tier(1049).index,0);assert.equal(R.tier(1050).index,1);assert.equal(R.style({attack:2,move:1,skill:1}).values.join(','),'50,25,25');
console.log('Practice presets, draft/deployment AI, fair stats, guided behavior and star-chart rules passed');
