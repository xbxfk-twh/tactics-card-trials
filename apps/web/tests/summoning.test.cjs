'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const c={window:{}};vm.createContext(c);for(const name of ['data/definitions','core/engine','core/ai','ui/stacking','ui/unit-state'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/'+name+'.js'),'utf8'),c);
const {TacticsGame:G,TacticsAI:AI,StackingConfirmation:Stack,UnitPresentation:UI}=c.window;
function field(){const g=new G();g.phase='battle';g.team='A';g.mode='online';return g;}
function puppet(g,master,pos){master.ap=1;assert.equal(g.useSkill(master.uid,'puppet',pos),true);return g.puppetsOf(master).at(-1);}
{
 const g=field(),m=g.spawn('puppet_master','A',{x:0,y:0}),p=puppet(g,m,{x:1,y:0}),enemy=g.spawn('necromancer','B',{x:2,y:1});
 assert.equal(p.mp,0);assert.equal(p.ap,1);assert.equal(p.hp,35);assert.equal(p.attack,10);
 assert.equal(g.move(p.uid,{x:1,y:1}),true);assert.equal(p.ap,0);assert.equal(p.mp,0);const hp=enemy.hp;
 assert.equal(g.attack(p.uid,enemy.uid),false,'a puppet cannot move and attack in the same turn');assert.equal(enemy.hp,hp);
 g.endTurn();g.endTurn();assert.equal(p.mp,0,'no free movement appears on later turns');assert.equal(p.ap,1);
 assert.equal(g.attack(p.uid,enemy.uid),true);assert.equal(p.ap,0);assert.equal(g.move(p.uid,{x:1,y:0}),false,'attacking also consumes the only action');
}
{
 const g=field(),m=g.spawn('puppet_master','A',{x:0,y:0}),enemy=g.spawn('necromancer','B',{x:1,y:1}),p=puppet(g,m,{x:1,y:0});assert.equal(p.ap,1);assert.equal(p.mp,0);assert.equal(p.summonSkill,'puppet');
 m.ap=m.mp=10;assert.equal(g.move(m.uid,{x:5,y:2}),true);const hp=enemy.hp,ap=p.ap;
 assert.equal(g.attack(p.uid,enemy.uid),false);assert.equal(enemy.hp,hp);assert.equal(p.ap,ap,'invalid remote attacks cannot spend AP');assert.ok(UI.states(g,p).some(s=>s.id==='unlinked'));
 assert.equal(g.canTarget('move',p.uid,null,{x:2,y:0}),true);assert.equal(g.move(p.uid,{x:2,y:0}),true,'out-of-range puppets can take a closer step');assert.equal(p.mp,0);assert.equal(p.ap,0,'moving spends the sole action point');
 const budget=p.mp+p.ap;assert.equal(g.move(p.uid,{x:1,y:0}),false,'cannot walk farther from owner');assert.equal(p.mp+p.ap,budget);
 for(let round=0;round<4&&!g.controlState(p).inRange;round++){p.ap=1;p.mp=0;const next=g.followPosition(p.uid);assert.ok(next);assert.equal(g.move(p.uid,next),true);}
 assert.equal(g.controlState(p).inRange,true);assert.ok(!UI.states(g,p).some(s=>s.id==='unlinked'));
 enemy.x=p.x;enemy.y=p.y+1;if(enemy.y>=6)enemy.y=p.y-1;p.ap=1;assert.equal(g.attack(p.uid,enemy.uid),true,'attacks work again after reconnecting to owner');
 const restored=new G();restored.restore(g.snapshot());assert.equal(restored.unit(p.uid).ownerUid,m.uid);assert.equal(restored.controlState(restored.unit(p.uid)).inRange,true);
}
{
 const g=field(),m=g.spawn('puppet_master','A',{x:0,y:0}),p=puppet(g,m,{x:1,y:0});p.x=2;g.spawn('knight','B',{x:1,y:0});p.ap=p.mp=10;
 assert.equal(g.pathLength('A',p,{x:0,y:1}),Infinity,'a puppet cannot route outside the leash to bypass a blocker, even if endpoint is inside');
 assert.equal(g.canTarget('move',p.uid,null,{x:0,y:1}),false);
}
{
 const g=field(),m=g.spawn('puppet_master','A',{x:0,y:0}),other=g.spawn('puppet_master','A',{x:4,y:0});g.spawn('knight','B',{x:5,y:5});
 for(const pos of [{x:0,y:0},{x:0,y:0},{x:1,y:0},{x:0,y:1}])puppet(g,m,pos);
 m.ap=3;const ap=m.ap,count=g.units.length;assert.equal(g.canSkill(m.uid,'puppet'),false);assert.equal(g.useSkill(m.uid,'puppet',{x:1,y:0}),false);assert.equal(m.ap,ap);assert.equal(g.units.length,count);assert.match(g.log[0],/4\/4/);
 assert.ok(puppet(g,other,{x:4,y:1}),'each owner has its own four-puppet cap');
 g.damage(g.puppetsOf(m)[0],999,null,true);assert.equal(g.canSkill(m.uid,'puppet'),true);puppet(g,m,{x:1,y:0});assert.equal(g.puppetsOf(m).length,4);
 other.ap=1;const before=g.snapshot(),proposal=Stack.proposal(g,'skill',{uid:other.uid,id:'puppet',x:4,y:0});assert.ok(proposal);assert.equal(JSON.stringify(g.snapshot()),JSON.stringify(before),'stack preview cannot create real puppets or spend AP');
}
{
 const g=field(),m=g.spawn('puppet_master','A',{x:0,y:0}),p1=puppet(g,m,{x:0,y:0}),p2=puppet(g,m,{x:1,y:0}),n=g.spawn('necromancer','B',{x:1,y:1});g.select(p1.uid);
 const targets=[m,p1,p2];for(const target of targets)g.damage(target,999,n,true);
 assert.equal(g.units.filter(u=>u.id==='skeleton').length,1,'one actual owner kill yields one skeleton; linked removal is not additional kills');assert.equal(g.puppetsOf(m).length,0);assert.equal(g.selected,null);assert.equal(g.phase,'end');assert.equal(g.winner,'B');
 const seq=g.visualSeq,count=g.units.length;assert.equal(g.damage(p1,999,n,true),0);g.kill(p1,n);assert.equal(g.visualSeq,seq);assert.equal(g.units.length,count,'duplicate stale AoE targets cannot resurrect kill rewards');
}
{
 const g=field(),tree=g.spawn('treent_ancient','A',{x:0,y:0});g.spawn('knight','B',{x:5,y:5});assert.equal(g.useSkill(tree.uid,'summon_treant',{x:0,y:0}),true);const minion=g.units.find(u=>u.id==='treant_small');assert.equal(minion.summonerUid,tree.uid);assert.equal(minion.ownerUid,null);g.damage(tree,999,null,true);assert.equal(g.unit(minion.uid),minion,'independent tree summons survive their creator');assert.equal(g.phase,'battle');
}
{
 const g=field();for(let y=1;y<=3;y++)for(let x=1;x<=3;x++){if(x===3&&y===1)continue;g.spawn('knight','B',{x,y});}
 const spawned=g.spawnNearby('golem','A',{x:2,y:2},null,'demon_meteor');assert.ok(spawned);assert.equal(spawned.x,3);assert.equal(spawned.y,1,'nearby placement checks the formerly missing north-east diagonal');
}
{
 const g=field(),m=g.spawn('puppet_master','A',{x:0,y:0});for(const pos of [{x:0,y:0},{x:1,y:0},{x:0,y:1}])while(g.canOccupy('A',pos))g.spawn('knight','A',pos);g.spawn('knight','B',{x:5,y:5});m.ap=2;
 assert.equal(g.canSkill(m.uid,'puppet'),false);assert.match(g.summonBlockReason(m,g.skill(m,'puppet')),/没有可用格子/);const before=g.units.length;assert.equal(g.useSkill(m.uid,'puppet',{x:0,y:0}),false);assert.equal(m.ap,2);assert.equal(g.units.length,before);
 const invalid={x:.5,y:0};assert.equal(g.spawn('puppet','A',invalid),null);assert.equal(g.useSkill(m.uid,'puppet',invalid),false);assert.equal(m.ap,2);
 const meteor=field();for(let y=1;y<=3;y++)for(let x=1;x<=3;x++)for(let n=0;n<3;n++)meteor.spawn('knight','A',{x,y});meteor.spawn('knight','B',{x:5,y:5});meteor.hands.A=['demon_meteor'];assert.equal(meteor.playHand('demon_meteor',{x:2,y:2}),false);assert.equal(meteor.hands.A.length,1,'a completely ineffective meteor cannot consume a summon card');
}
{
 const g=field();g.team='B';const m=g.spawn('puppet_master','B',{x:5,y:5});g.spawn('knight','A',{x:0,y:0});const p=puppet(g,m,{x:5,y:4});m.x=1;m.y=2;m.ap=m.mp=0;p.ap=1;p.mp=0;const before=g.controlState(p).distance;AI.step(g,'B');assert.ok(g.controlState(p).distance<before,'AI sends stranded puppets toward their owner instead of repeating invalid attacks/moves');assert.equal(p.ap,0);
}
console.log('Puppet control/recovery/follow paths, caps, ownership cleanup, duplicate AoE deaths, independent summons and safe placement passed');
