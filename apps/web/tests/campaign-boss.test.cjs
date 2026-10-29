const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const storage=new Map(),ctx={window:{},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)}};
vm.createContext(ctx);
for(const name of ['data/definitions.js','core/engine.js','campaign/progress.js','core/ai.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',name),'utf8'),ctx);
const {TacticsGame:G,CampaignProgress:P}=ctx.window;
// Four cells represent one unit. Border checks, pathfinding and attacks use its full footprint.
const g=new G();g.startCampaign(['knight'],['boss_warden'],6);
const boss=g.units[0];assert.equal(boss.size,2);
for(const p of [{x:2,y:4},{x:3,y:4},{x:2,y:5},{x:3,y:5}])assert.equal(g.at(p)[0].uid,boss.uid);
assert.equal(g.canOccupy('B',{x:3,y:5}),false);
assert.equal(g.spawn('boss_crown','B',{x:5,y:4}),null);
assert.equal(g.deploy('knight',{x:3,y:0}),true);
const knight=g.units.find(u=>u.team==='A');knight.x=4;knight.y=5;
assert.equal(g.attack(knight.uid,boss.uid),true,'attack the far edge of a large unit');
g.team='B';g.beginTurn();assert.equal(g.move(boss.uid,{x:1,y:4}),true,'large units can overlap their former footprint');
assert.equal(g.move(boss.uid,{x:5,y:4}),false,'no clipping beyond the board');
// A telegraph gives the entire player turn to escape and resolves only once.
g.endTurn();assert.equal(g.team,'A');assert.equal(g.threats.length,1);
const hp=knight.hp+knight.shield;g.endTurn();assert.equal(knight.hp+knight.shield,hp-22);assert.equal(g.threats.length,0);
boss.hp=Math.floor(boss.maxHp/2);const attack=boss.attack;g.planBossThreats();g.planBossThreats();assert.equal(boss.attack,attack+6);
// Leaving the marked row avoids damage; removing its source cancels a pending strike.
const escape=new G();escape.startCampaign(['knight'],['boss_warden','skeleton'],6);escape.deploy('knight',{x:0,y:0});
escape.team='B';escape.beginTurn();escape.endTurn();const runner=escape.units.find(u=>u.team==='A');assert.equal(escape.move(runner.uid,{x:0,y:1}),true);
const safe=runner.hp+runner.shield;escape.endTurn();assert.equal(runner.hp+runner.shield,safe);
escape.planBossThreats();const source=escape.units.find(u=>u.size===2);escape.damage(source,999,null,true);escape.team='A';const safeAgain=runner.hp+runner.shield;escape.endTurn();assert.equal(runner.hp+runner.shield,safeAgain);
// One large target is hit once per AOE wave, never once for each occupied tile.
const a=new G();a.startCampaign(['knight'],['boss_crown'],12);a.deploy('knight',{x:0,y:0});a.hands.A=['fire_rain'];const crown=a.units.find(u=>u.size===2),old=crown.hp;
a.playHand('fire_rain',{x:3,y:5});assert.equal(old-crown.hp,3*Math.max(0,20-crown.defense));
// Experience is granted once, survives storage and never leaks into competitive stats.
const p=P.fresh();assert.equal(P.completeLevel(p,1,['treent_ancient']),true);assert.equal(P.rank(p,'treent_ancient'),2);
assert.equal(P.completeLevel(p,1,['treent_ancient']),false);assert.equal(P.load().experience.treent_ancient,40);
const trained=new G();trained.startCampaign(['treent_ancient'],['skeleton'],1,{treent_ancient:2});trained.deploy('treent_ancient',{x:0,y:0});assert.equal(trained.units.find(u=>u.team==='A').attack,17);
trained.mode='online';assert.equal(trained.spawn('treent_ancient','A',{x:1,y:0}).attack,15);
assert.ok(!P.ALL.includes('boss_crown'));assert.equal(P.train(p,'boss_crown'),false);
console.log('Boss footprint, telegraph and growth tests passed');
