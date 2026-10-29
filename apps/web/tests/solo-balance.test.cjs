/* Reproducible encounter probes: finite movement, real AI and real combat rules.
   This compares a resource-aware player that dodges telegraphs with an attack-only player.
   It is a balance baseline, not a claim that every player or every build wins. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const ctx={window:{},localStorage:{getItem:()=>null,setItem(){}}};vm.createContext(ctx);
for(const file of ['data/definitions.js','core/engine.js','campaign/solo.js','core/ai.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',file),'utf8'),ctx);
const {TacticsGame:G,SoloCampaign:S,TacticsAI:AI,GAME_DATA:D}=ctx.window;
const dist=(a,b)=>Math.max(0,a.x-b.x-((b.size||1)-1),b.x-a.x-((a.size||1)-1))+Math.max(0,a.y-b.y-((b.size||1)-1),b.y-a.y-((a.size||1)-1));
const cells=Array.from({length:36},(_,i)=>({x:i%6,y:Math.floor(i/6)}));
function configured(level,variant='spell'){
  const p=S.fresh();p.cleared=Array.from({length:level-1},(_,i)=>i+1);
  p.stats.health=Math.floor((level-1)/2);p.stats.attack=level-1-p.stats.health;
  p.active=variant==='frost'?['fireball','frost_nova','life_drain']:variant==='drain'?['fireball','life_drain','shield']:variant==='guard'?['fireball','precise_shot','shield']:['fireball','precise_shot','holy_light'];
  if(variant==='bulwark'){p.stats.defense=Math.min(3,level-1);p.stats.health=level-1-p.stats.defense;p.stats.attack=0;p.active=['fireball','life_drain','shield'];}
  if(variant==='blood'){p.stats.defense=Math.min(3,level-1);p.stats.health=level-1-p.stats.defense;p.stats.attack=0;p.active=['fireball','precise_shot','shield'];}
  p.active=p.active.filter(id=>S.unlocked(p).includes(id));p.active=[...p.active,...S.unlocked(p).filter(id=>!p.active.includes(id))].slice(0,3);
  p.passives=variant==='blood'?['blood','guard']:['reservoir','guard'];let budget=level-1;
  for(const id of p.active){p.ranks[id]=Math.min(2,budget);budget-=p.ranks[id];}
  const legal=S.normalize(p);assert.ok(legal.active.every(id=>S.unlocked(legal).includes(id)));assert.ok(S.points(legal,'stat')>=0&&S.points(legal,'skill')>=0);return legal;
}
function play(level,tactical,variant='spell',dodge=true,probe={}){
  const g=new G(),p=configured(level,variant);S.start(g,p,level);
  // Probe overrides affect only this local match, never production stage definitions.
  for(const u of g.units){const spec=probe.enemyStats?.[u.id];if(spec){u.hp=u.maxHp=spec[0];u.attack=spec[1];u.defense=spec[2];}}
  g.deploy(S.HERO,{x:2,y:1});let iterations=0;
  while(g.phase==='battle'&&iterations++<600){
    if(g.team==='B'){AI.step(g);continue;}
    const u=g.units.find(u=>u.team==='A'),foes=g.units.filter(u=>u.team==='B');
    const danger=p=>g.threats.some(t=>t.cells.some(c=>c.x===p.x&&c.y===p.y));
    if(tactical&&dodge&&danger(u)&&u.mp+u.ap>0){
      const escapes=cells.filter(c=>!danger(c)&&g.canOccupy('A',c)).map(c=>({...c,path:g.pathLength('A',u,c),near:Math.min(...foes.map(f=>dist(c,f)))})).filter(c=>c.path>0&&c.path<=u.mp+u.ap).sort((a,b)=>a.path-b.path||a.near-b.near);
      if(escapes[0]&&g.move(u.uid,escapes[0]))continue;
    }
    if(tactical){
      const heal=g.skill(u,'holy_light');if(g.canSkill(u.uid,'holy_light')&&u.maxHp-u.hp>=heal.effects[0].value&&g.useSkill(u.uid,'holy_light',u))continue;
      const options=[];
      for(const id of g.skillIds(u).filter(id=>g.canSkill(u.uid,id))){
        const skill=g.skill(u,id),effect=skill.effects[0];
        if(id==='shield'){if(u.shield<12&&foes.some(f=>dist(u,f)<=2)&&g.useSkill(u.uid,id,u))break;continue;}
        if(id==='holy_light')continue;
        if(id==='frost_nova'){const score=foes.filter(f=>dist(f,u)<=effect.radius).reduce((sum,f)=>sum+Math.min(f.hp,effect.damage),0);options.push({id,target:u,score});continue;}
        for(const target of foes.filter(f=>dist(u,f)<=skill.range)){
          const score=effect.type==='aoe_damage'?foes.filter(f=>dist(f,target)<=effect.radius).reduce((sum,f)=>sum+Math.min(f.hp,effect.damage),0):Math.min(target.hp,effect.value-(effect.magic?0:target.defense));
          options.push({id,target,score});
        }
      }
      options.sort((a,b)=>b.score-a.score);let cast=false;
      for(const o of options)if(o.score>=12&&g.useSkill(u.uid,o.id,o.target)){cast=true;break;}if(cast)continue;
    }
    const targets=foes.filter(f=>dist(u,f)<=1).sort((a,b)=>a.hp-b.hp);if(targets[0]&&g.attack(u.uid,targets[0].uid))continue;
    const nearest=[...foes].sort((a,b)=>dist(u,a)-dist(u,b))[0],current=dist(u,nearest);
    if(current>1&&u.mp+u.ap>0){const moves=cells.filter(c=>(!tactical||!dodge||!danger(c))&&g.canOccupy('A',c)).map(c=>({...c,path:g.pathLength('A',u,c),d:dist(c,nearest)})).filter(c=>c.path>0&&c.path<=u.mp+u.ap&&c.d<current).sort((a,b)=>a.d-b.d||a.path-b.path);if(moves[0]&&g.move(u.uid,moves[0]))continue;}
    g.endTurn();
  }
  const u=g.units.find(u=>u.team==='A');return {level,policy:tactical?(variant+(dodge?'':'-no-dodge')):'attack-only',win:g.winner==='A',rounds:g.round,hp:u?.hp||0,enemyHp:g.units.filter(u=>u.team==='B').reduce((a,u)=>a+u.hp,0)};
}
if(require.main===module){
const results=[];for(let n=1;n<=9;n++){results.push(play(n,true));results.push(play(n,true,'drain'));results.push(play(n,true,'guard'));results.push(play(n,true,'bulwark'));results.push(play(n,true,'blood'));results.push(play(n,true,'frost'));results.push(play(n,false));}
for(const n of [3,6,9])for(const variant of ['spell','drain','guard','bulwark','blood','frost'])results.push(play(n,true,variant,false));
console.table(results);
if(process.argv.includes('--report')){const out=path.join(__dirname,'../../../artifacts/balance/独行战役087-2026-10-28.json');fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify({version:'0.8.7',scope:'Deterministic legal-build AI probes; not human win rates',results},null,2)+'\n');}
assert.ok(S.stages.every(s=>results.some(r=>r.level===s.level&&r.policy!=='attack-only'&&r.win)),'each encounter needs a winning grown build that uses real skills and movement');
assert.ok(results.filter(r=>r.level===9&&r.policy.endsWith('-no-dodge')).every(r=>!r.win),'even a skill-using player cannot ignore the final boss telegraphs');
assert.ok(results.filter(r=>r.policy==='attack-only'&&[3,6,9].includes(r.level)).some(r=>!r.win),'ignoring boss telegraphs must carry a meaningful cost');
console.log('Nine-stage tactical difficulty baseline passed');
}
module.exports={play,configured};
