'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const c={window:{}};vm.createContext(c);for(const name of ['data/definitions','core/engine','ui/unit-state'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/'+name+'.js'),'utf8'),c);
const G=c.window.TacticsGame,UI=c.window.UnitPresentation;
const fresh=()=>{const g=new G();g.startCampaign(['assassin'],['knight','mage'],1);g.deploy('assassin',{x:0,y:0});return g;};
{
 const g=fresh(),a=g.units.find(u=>u.team==='A'),b=g.units.find(u=>u.id==='knight');b.x=0;b.y=1;
 assert.equal(g.useSkill(a.uid,'stealth',a),true);assert.equal(a.statuses.stealth,2);
 g.endTurn();assert.equal(g.attack(b.uid,a.uid),false);assert.ok(a.statuses.stealth,'first enemy turn is protected');
 g.endTurn();assert.equal(a.statuses.stealth,1);g.endTurn();assert.ok(a.statuses.stealth,'second enemy turn is protected');
 g.endTurn();assert.equal(a.statuses.stealth,undefined,'expires at second following friendly turn start');
 const other=fresh(),assassin=other.units.find(u=>u.team==='A'),target=other.units.find(u=>u.team==='B');target.x=0;target.y=1;other.useSkill(assassin.uid,'stealth',assassin);assert.equal(other.attack(assassin.uid,target.uid),true);assert.equal(assassin.statuses.stealth,undefined);
 const area=fresh(),hidden=area.units.find(u=>u.team==='A'),mage=area.units.find(u=>u.id==='mage');area.useSkill(hidden.uid,'stealth',hidden);const hp=hidden.hp;area.effect({type:'aoe_damage',radius:1,damage:5,magic:true},mage,hidden,[hidden]);assert.equal(hidden.hp,hp-5,'area damage can hit stealth');
}
{
 const g=fresh(),b=g.units.find(u=>u.team==='B');assert.equal(g.applyStun(b,1,'entangle'),true);
 assert.equal(UI.states(g,b)[0].id,'bound');g.endTurn();assert.equal(b.statuses.stun,undefined);assert.equal(b.turnStunned,true);assert.equal(UI.states(g,b)[0].id,'bound','vines remain visible during the final disabled turn');assert.equal(UI.states(g,b)[0].turns,1);assert.ok(UI.overlay(g,b).includes('unit-vines'));
 g.endTurn();assert.equal(UI.states(g,b).length,0,'vines leave when final disabled turn ends');
 b.statuses.slow=1;g.endTurn();assert.equal(b.statuses.slow,undefined);assert.equal(b.turnSlowed,true);assert.ok(UI.states(g,b).some(s=>s.id==='slow'),'slow graphic survives countdown removal during active slow turn');
 const snapshot=g.snapshot(),copy=new G();copy.restore(snapshot);assert.equal(copy.unit(b.uid).turnSlowed,true);
}
for(const phase of ['draft','deploy','battle']){const g={phase};for(const action of ['home','campaign','practice','shop','atlas','buy','solo-start','stage-start','create-room','practice-start'])assert.equal(UI.allowed(g,action),false,phase+': '+action);assert.equal(UI.allowed(g,'camp-open','items'),false);for(const action of ['cell','match-menu','match-exit-confirm','resume-room','info'])assert.equal(UI.allowed(g,action),true);}
assert.equal(UI.allowed({phase:'end'},'shop'),true);
console.log('Stealth lifespan, attack reveal, AoE, final-turn state artwork, snapshots and live-match navigation guard passed');
