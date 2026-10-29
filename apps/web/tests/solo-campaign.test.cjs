'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const storage=new Map(),context={window:{},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)}};vm.createContext(context);
for(const file of ['data/definitions.js','core/engine.js','campaign/content.js','campaign/progress.js','campaign/solo.js','core/ai.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',file),'utf8'),context);
const {TacticsGame:G,SoloCampaign:S,CampaignProgress:P,GAME_DATA:D}=context.window;
const hero=g=>g.units.find(u=>u.id===S.HERO),enemy=g=>g.units.find(u=>u.team==='B');
const begin=(p=S.fresh(),level=1)=>{const g=new G();assert.equal(S.start(g,p,level),true);assert.equal(g.deploy(S.HERO,{x:2,y:1}),true);return g;};
const p=S.fresh(),g=begin(p),u=hero(g),foe=enemy(g);assert.equal(g.units.filter(u=>u.team==='A').length,1);assert.equal(u.hp,110);assert.equal(u.ap,2);assert.equal(u.mp,2);assert.equal(u.charge,0);
assert.equal(P.ALL.includes(S.HERO),false,'campaign hero never enters collection or competitive drafts');
assert.equal(S.start(new G(),p,2),false,'future encounters stay locked');
foe.x=u.x;foe.y=u.y+1;foe.hp=foe.maxHp=150;
assert.equal(g.useSkill(u.uid,'fireball',foe),true);assert.equal(foe.hp,128);assert.equal(g.canSkill(u.uid,'fireball'),false);
assert.equal(g.remainingCooldown(u,'fireball'),2,'the casting turn never adds an extra displayed cooldown turn');
for(let i=0;i<2;i++){g.endTurn();g.endTurn();assert.equal(g.canSkill(u.uid,'fireball'),false,'two complete hero turns are blocked');}g.endTurn();g.endTurn();assert.equal(g.canSkill(u.uid,'fireball'),true);
// Skill configuration is snapshotted, including cooldowns. Competitive definitions stay immutable.
const restored=new G();restored.restore(g.snapshot());assert.equal(restored.skill(hero(restored),'fireball').usage,'cooldown:2');assert.equal(D.skills.fireball.usage,'once');
g.phase='end';g.winner='A';assert.equal(S.complete(p,g),true);assert.equal(S.complete(p,g),false);assert.equal(S.points(p,'stat'),1);assert.equal(S.points(p,'skill'),1);
assert.equal(S.upgrade(p,'stat','attack'),true);assert.equal(S.upgrade(p,'stat','health'),false);assert.equal(S.upgrade(p,'skill','fireball'),true);assert.equal(S.skill('fireball',p.ranks.fireball).effects[0].damage,25);
const saved=S.load();assert.equal(saved.stats.attack,1);assert.equal(saved.ranks.fireball,1);assert.equal(P.load().cleared.length,0,'independent campaign saves');
S.respec(p);assert.equal(S.points(p,'stat'),1);assert.equal(S.points(p,'skill'),1);assert.equal(S.stats(p).attack,18);assert.equal(S.upgrade(p,'skill','nope'),false);
const dirty=S.normalize({cleared:[1,3,9],stats:{attack:99,defense:99},ranks:{fireball:99},active:['puppet','fireball','fireball'],passives:['guard','guard','bogus']});assert.equal(dirty.cleared.length,1);assert.equal(S.points(dirty,'stat'),0);assert.equal(dirty.active.length,3);assert.equal(dirty.passives.length,1);
// Charge casts consume an action too; unavailable casts do not spend either resource.
S.equip(p,'active','holy_light');p.passives=['reservoir','guard'];const healGame=begin(p),healer=hero(healGame);healer.hp-=60;healer.charge=4;healer.ap=0;
assert.equal(healGame.useSkill(healer.uid,'holy_light',healer),false);assert.equal(healer.charge,4);healer.ap=2;assert.equal(healGame.useSkill(healer.uid,'holy_light',healer),true);assert.equal(healer.ap,1);assert.equal(healer.charge,1);assert.equal(healer.hp,76);
const guardGame=begin(),guard=hero(guardGame);guard.shield=17;guardGame.endTurn();assert.equal(guard.shield,18);guardGame.endTurn();guard.mp=0;guardGame.endTurn();assert.equal(guard.shield,18);
const passiveBuild=S.fresh();passiveBuild.passives=['blood','stride'];const passiveGame=begin(passiveBuild),striker=hero(passiveGame),victim=enemy(passiveGame);victim.x=2;victim.y=4;victim.hp=victim.maxHp=200;victim.defense=0;striker.hp=40;
assert.equal(passiveGame.move(striker.uid,{x:2,y:3}),true);assert.equal(passiveGame.attack(striker.uid,victim.uid),true);assert.equal(victim.hp,176);assert.equal(striker.hp,46);assert.equal(passiveGame.attack(striker.uid,victim.uid),true);assert.equal(victim.hp,158);assert.equal(striker.hp,51,'stride triggers once, blood uses actual HP damage');
const frostBuild=S.fresh();frostBuild.cleared=[1,2];S.equip(frostBuild,'active','frost_nova');const frostGame=begin(frostBuild),frostHero=hero(frostGame),frozen=enemy(frostGame);frozen.x=2;frozen.y=3;
assert.equal(frostGame.useSkill(frostHero.uid,'frost_nova',frostHero),true);frostGame.endTurn();assert.equal(frozen.mp,0);assert.equal(frozen.ap,1,'slow affects free movement while preserving action-for-movement');
guardGame.round=25;guardGame.team='A';guardGame.beginTurn();assert.equal(guardGame.winner,'B');assert.equal(guardGame.phase,'end');
// Every first clear opens exactly one active skill, including the final replay capstone.
for(let cleared=0;cleared<=9;cleared++){
 const build=S.fresh();build.cleared=Array.from({length:cleared},(_,i)=>i+1);
 const available=S.unlocked(build);assert.equal(available.length,cleared+3);
 for(const [i,id] of S.skills.entries()){
  assert.equal(S.unlockLevel(id),Math.max(0,i-2));
  const copy=S.normalize(build),canEquip=S.equip(copy,'active',id,2);
  if(i>2)assert.equal(canEquip,i<cleared+3,`unlock ${id} after ${Math.max(0,i-2)} clears`);
  if(i>=cleared+3)assert.equal(S.upgrade(copy,'skill',id),false,'locked skills cannot consume points');
 }
}
const legacy=S.normalize({version:1,cleared:[1],active:['holy_light','life_drain','frost_nova'],ranks:{holy_light:1,life_drain:2,frost_nova:2},passives:['reservoir','guard'],stats:{}});
assert.deepEqual(Array.from(legacy.active),['holy_light','fireball','precise_shot']);assert.equal(legacy.ranks.holy_light,1);assert.equal(legacy.ranks.life_drain,undefined);assert.equal(S.points(legacy,'skill'),0,'future ranks cannot steal or mint progression budget');
const refunds=S.normalize({cleared:[1],ranks:{life_drain:2},active:['life_drain'],passives:[]});assert.equal(S.points(refunds,'skill'),1);assert.equal(refunds.active.includes('life_drain'),false);
const increments=S.fresh();increments.stats={health:1,attack:1,defense:1};assert.deepEqual(JSON.parse(JSON.stringify(S.stats(increments))),{hp:116,attack:19,defense:3,mp:2,ap:2});
for(const [id,field,delta] of [['fireball','damage',3],['precise_shot','value',4],['shield','value',4],['holy_light','value',4],['frost_nova','damage',2],['life_drain','value',3]])assert.equal(S.skill(id,1).effects[0][field]-S.skill(id,0).effects[0][field],delta);
// Reservoir is the only source of hero charge. No deployment bonus; the first turn restores one.
const chargeBuild=S.fresh();chargeBuild.cleared=[1,2,3];chargeBuild.active=['life_drain','holy_light','shield'];chargeBuild.passives=['reservoir'];
const chargeDeploy=new G();S.start(chargeDeploy,chargeBuild,4);const undeployed=chargeDeploy.spawn(S.HERO,'A',{x:0,y:0});assert.equal(undeployed.charge,0,'no two-charge entry bonus');
const chargeGame=begin(chargeBuild,4),charged=hero(chargeGame),drained=enemy(chargeGame);assert.equal(charged.charge,1);drained.x=charged.x;drained.y=charged.y+1;drained.hp=drained.maxHp=300;
charged.charge=5;charged.hp=30;assert.equal(chargeGame.skill(charged,'life_drain').usage,'repeat');assert.equal(chargeGame.skill(charged,'holy_light').usage,'repeat');
assert.equal(chargeGame.useSkill(charged.uid,'life_drain',drained),true);assert.equal(chargeGame.useSkill(charged.uid,'life_drain',drained),true);assert.equal(charged.charge,1);assert.equal(charged.ap,0);assert.equal(charged.cooldowns.life_drain,undefined);assert.equal(chargeGame.useSkill(charged.uid,'life_drain',drained),false,'no CD never bypasses action or resource requirements');
charged.ap=2;assert.equal(chargeGame.canSkill(charged.uid,'life_drain'),false,'insufficient charge still blocks');
charged.charge=5;chargeGame.endTurn();chargeGame.endTurn();assert.equal(charged.charge,5,'charge cap is five');
const without=S.normalize(chargeBuild);without.passives=[];const noChargeGame=begin(without,4),empty=hero(noChargeGame);assert.equal(empty.charge,0);empty.charge=5;assert.equal(noChargeGame.canSkill(empty.uid,'holy_light'),false,'even stale injected charge cannot activate reservoir-less casts');noChargeGame.endTurn();noChargeGame.endTurn();assert.equal(empty.charge,0);
const chargeCopy=new G();chargeCopy.restore(chargeGame.snapshot());assert.equal(hero(chargeCopy).charge,5);assert.equal(chargeCopy.skill(hero(chargeCopy),'life_drain').usage,'repeat');assert.equal(D.skills.life_drain.usage,'once');assert.equal(D.skills.holy_light.cost,2,'solo changes never mutate competitive data');

// Newly earned active skills use hero resource rules while retaining isolated definitions.
function extraSkill(id){const build=S.fresh();build.cleared=Array.from({length:9},(_,i)=>i+1);build.active=[id,'fireball','shield'];build.passives=['reservoir'];const game=begin(build,1),unit=hero(game),target=enemy(game);target.x=unit.x;target.y=unit.y+1;target.hp=target.maxHp=200;target.defense=0;return {game,unit,target};}
{
 const {game,unit}=extraSkill('dispel');unit.statuses={mark:2,slow:2};assert.equal(game.useSkill(unit.uid,'dispel',unit),true);assert.equal(Object.keys(unit.statuses).length,0);assert.equal(unit.shield,10);assert.equal(unit.ap,1);assert.equal(game.remainingCooldown(unit,'dispel'),2);
}
{
 const {game,unit,target}=extraSkill('mark_target');assert.equal(game.useSkill(unit.uid,'mark_target',target),true);assert.equal(target.statuses.mark,2);assert.equal(target.hp,188,'mark applies before the twelve-point actual hit');assert.equal(game.remainingCooldown(unit,'mark_target'),3);
}
{
 const {game,unit}=extraSkill('blessing');assert.equal(game.useSkill(unit.uid,'blessing',unit),true);assert.equal(unit.attack,21);assert.equal(unit.defense,3);assert.equal(game.useSkill(unit.uid,'blessing',unit),false,'buff cannot stack through recasts');game.endTurn();game.endTurn();assert.equal(unit.attack,21);game.endTurn();game.endTurn();assert.equal(unit.attack,18);assert.equal(unit.defense,2);
}
{
 const {game,unit,target}=extraSkill('backstab');assert.equal(game.useSkill(unit.uid,'backstab',target),true);assert.equal(target.hp,168);assert.equal(unit.ap,1);
}
{
 const {game,unit,target}=extraSkill('entangle');assert.equal(game.useSkill(unit.uid,'entangle',target),true);assert.equal(target.hp,192);assert.equal(target.statuses.stun,1);game.endTurn();assert.equal(target.turnStunned,true);assert.equal(target.ap,0);
}
{
 const {game,unit}=extraSkill('bless');unit.hp=50;unit.charge=5;assert.equal(game.useSkill(unit.uid,'bless',unit),true);assert.equal(unit.hp,68);assert.equal(unit.shield,14);assert.equal(unit.charge,0);assert.equal(unit.ap,1);assert.equal(unit.cooldowns.bless,undefined);assert.equal(D.skills.bless.effects[0].type,'one_time_shield','campaign capstone never changes other game modes');
}

// Real owned skill cards can now be carried into the original campaign, replenished next match.
const party=P.fresh();party.ownedSkills=['fire_rain','heal_aura','demon_meteor'];assert.equal(P.equipSkill(party,'fire_rain'),true);assert.equal(P.equipSkill(party,'heal_aura'),true);assert.equal(P.equipSkill(party,'demon_meteor'),false);
const cards=new G();cards.startCampaign(['knight'],['skeleton'],1,{}, {skills:party.equippedSkills});cards.deploy('knight',{x:0,y:0});assert.equal(cards.hands.A.length,2);assert.equal(cards.playHand('fire_rain',{x:0,y:5}),true);assert.equal(cards.hands.A.length,1);assert.equal(party.ownedSkills.length,3);
cards.startCampaign(['knight'],['skeleton'],1,{}, {skills:party.equippedSkills});assert.equal(cards.hands.A.length,2);
// Summon bait no longer redirects boss telegraphs away from the original party.
const bossGame=new G();bossGame.startCampaign(['puppet_master'],['boss_warden'],6);bossGame.deploy('puppet_master',{x:0,y:0});const master=bossGame.units.find(u=>u.id==='puppet_master'),boss=enemy(bossGame),puppet=bossGame.spawn('puppet','A',{x:1,y:4});puppet.ownerUid=master.uid;
bossGame.round=2;bossGame.planBossThreats();assert.ok(bossGame.threats[0].cells.every(p=>p.y===master.y));
master.x=1;master.y=4;bossGame.team='B';bossGame.beginTurn();assert.equal(bossGame.attack(boss.uid,puppet.uid),true);assert.equal(bossGame.unit(puppet.uid),undefined,'boss sweep clears a full-health puppet');assert.ok(master.hp<master.maxHp,'all adjacent targets are hit, not just the summoned blocker');
assert.equal(bossGame.applyStun(boss,4),true);assert.equal(boss.statuses.stun,1);bossGame.beginTurn();assert.equal(boss.turnStunned,true);assert.equal(bossGame.applyStun(boss,4),false);bossGame.beginTurn();assert.equal(bossGame.applyStun(boss,4),false);bossGame.beginTurn();assert.equal(bossGame.applyStun(boss,4),false);bossGame.beginTurn();assert.equal(bossGame.applyStun(boss,4),true);
const onlineBoss=new G();onlineBoss.phase='battle';onlineBoss.mode='online';const target=onlineBoss.spawn('boss_warden','B',{x:2,y:4});assert.equal(onlineBoss.applyStun(target,4),true);assert.equal(target.statuses.stun,4,'campaign boss resistance never changes competitive rules');
console.log('Solo loadout, upgrades, save isolation, item carry and anti-summon boss rules passed');
