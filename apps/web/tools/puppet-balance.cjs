/* Deterministic local bot comparison; never connects to a server or changes player data. */
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
function runtime(mp){const c={window:{}};vm.createContext(c);for(const file of ['data/definitions','core/engine','core/ai'])vm.runInContext(fs.readFileSync(path.join(root,'js/'+file+'.js'),'utf8'),c);c.window.GAME_DATA.cards.puppet.move_points=mp;return c.window;}
const old=runtime(1),current=runtime(0),supports=['knight','ranger','cleric'];
const opponents={balanced:['knight','ranger','mage','angel'],rush:['assassin','berserker','ranger','knight'],area:['mage','treent_ancient','berserker','cleric'],ranged:['ranger','mage','necromancer','knight'],guard:['knight','angel','cleric','treent_ancient'],death:['necromancer','slime','berserker','knight'],chess:['queen','rook','pawn','knight_piece'],siege:['turret','knight','mage','angel']};
const layouts=[[{x:0,y:0},{x:1,y:0},{x:3,y:0},{x:5,y:0}],[{x:5,y:1},{x:3,y:0},{x:1,y:1},{x:0,y:0}],[{x:1,y:1},{x:2,y:0},{x:3,y:0},{x:4,y:1}],[{x:2,y:1},{x:0,y:1},{x:5,y:1},{x:3,y:0}]];
const groups=[{id:'old_mp1',runtime:old,subject:'puppet_master'},{id:'new_mp0',runtime:current,subject:'puppet_master'},{id:'frontliner_control',runtime:current,subject:'berserker'}];
const records=[];
for(const group of groups){
 for(const [name,enemy] of Object.entries(opponents))for(let layout=0;layout<layouts.length;layout++)for(const seat of ['A','B']){
  const g=new group.runtime.TacticsGame();g.phase='battle';g.mode='local';g.team='A';g.seed=20261028+layout*991+Object.keys(opponents).indexOf(name)*17;
  const subject=[group.subject,...supports];for(const team of ['A','B']){const ids=team===seat?subject:enemy;ids.forEach((id,i)=>{const p=layouts[layout][i];assert.ok(g.spawn(id,team,team==='A'?p:{x:5-p.x,y:5-p.y}),id);});}
  let spawned=0,peak=0,actions=0,turnActions=0,previousTurn='',maxPuppetHits=0;const summon=g.summonUnit.bind(g);g.summonUnit=(id,team,...args)=>{const unit=summon(id,team,...args);if(unit&&id==='puppet'&&team===seat)spawned++;return unit;};
  const attack=g.attack.bind(g);g.attack=(uid,target)=>{const u=g.unit(uid),ok=attack(uid,target);if(ok&&u?.id==='puppet'&&u.team===seat)maxPuppetHits++;return ok;};
  g.beginTurn();
  while(g.phase==='battle'&&g.round<=40){
   const turn=g.round+g.team;if(turn!==previousTurn){turnActions=0;previousTurn=turn;}assert.ok(++turnActions<180,'AI exceeded action guard');
   const before=g.team;group.runtime.TacticsAI.step(g,g.team,{tactical:true});actions++;
   peak=Math.max(peak,g.units.filter(u=>u.id==='puppet'&&u.team===seat).length);
   assert.ok(actions<14000,'match exceeded action guard');
  }
  records.push({group:group.id,opponent:name,layout,seat,result:g.phase==='end'?(g.winner===seat?'win':g.winner?'loss':'draw'):'draw',round:g.round,actions,spawned,peak,puppetAttacks:maxPuppetHits});
 }
 console.log(group.id+': '+records.filter(r=>r.group===group.id).length+' matches completed');
}
function summary(rows){const counts={matches:rows.length,wins:rows.filter(r=>r.result==='win').length,losses:rows.filter(r=>r.result==='loss').length,draws:rows.filter(r=>r.result==='draw').length};return {...counts,winPercent:Number((100*counts.wins/rows.length).toFixed(1)),scorePercent:Number((100*(counts.wins+.5*counts.draws)/rows.length).toFixed(1)),averageRounds:Number((rows.reduce((n,r)=>n+r.round,0)/rows.length).toFixed(1)),averagePuppetsSpawned:Number((rows.reduce((n,r)=>n+r.spawned,0)/rows.length).toFixed(2)),averagePuppetAttacks:Number((rows.reduce((n,r)=>n+r.puppetAttacks,0)/rows.length).toFixed(2))};}
const report={date:'2026-10-28',method:'Deterministic tactical AI on both sides; 8 opponent squads, 4 deployments, swapped first/second seat; 40-round cap counts as draw. Bot diagnostics, not human win rates.',subjectSupports:supports,opponents,groups:Object.fromEntries(groups.map(g=>[g.id,summary(records.filter(r=>r.group===g.id))])),byOpponent:Object.fromEntries(Object.keys(opponents).map(name=>[name,Object.fromEntries(groups.map(g=>[g.id,summary(records.filter(r=>r.group===g.id&&r.opponent===name))]))])),bySeat:Object.fromEntries(groups.map(g=>[g.id,Object.fromEntries(['A','B'].map(seat=>[seat,summary(records.filter(r=>r.group===g.id&&r.seat===seat))]))])),records};
const out=path.join(root,'../../artifacts/balance');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'傀儡移动削弱-2026-10-28.json'),JSON.stringify(report,null,2)+'\n');
console.table(report.groups);console.table(Object.fromEntries(Object.entries(report.byOpponent).map(([name,r])=>[name,{oldScore:r.old_mp1.scorePercent,newScore:r.new_mp0.scorePercent,controlScore:r.frontliner_control.scorePercent}])));
