/* Turn rules and state transitions. No DOM access in this file. */
(function () {
  'use strict';
  const DATA = window.GAME_DATA;
  const SIZE = 6;
  const MAX_STACK = 3;
  const PLAYABLE = () => Object.entries(DATA.cards).filter(([, c]) => !c.tags.includes('召唤物'));
  const distance = (a, b) => Math.max(0,a.x-b.x-((b.size||1)-1),b.x-a.x-((a.size||1)-1)) + Math.max(0,a.y-b.y-((b.size||1)-1),b.y-a.y-((a.size||1)-1));
  const within = p => p && Number.isInteger(p.x) && Number.isInteger(p.y) && p.x >= 0 && p.x < SIZE && p.y >= 0 && p.y < SIZE;
  const other = team => team === 'A' ? 'B' : 'A';

  class Game {
    constructor() { this.reset(); }
    reset() {
      this.visualEpoch=(this.visualEpoch||0)+1;this.visualSeq=0;this.visualEvents=[];
      this.phase = 'menu'; this.mode = 'local'; this.team = 'A'; this.round = 1;
      this.picks = {A: [], B: []}; this.hands = {A: [], B: []};
      this.units = []; this.pickups = []; this.selected = null; this.intent = null; this.candidates = [];
      this.log = ['欢迎来到战棋。']; this.nextId = 1; this.winner = null;
      this.draftCount = 0; this.deployTeam = 'A'; this.usedCards = new Set();
      this.level = 0; this.allowed = null; this.training = {}; this.threats = []; this.relic = null;
      this.practiceQuick=false;this.practiceOptions=null;this.practiceStats=null;
      this.campaignId='party';this.heroSpec=null;this.soloBuild=null;this.campaignResult=null;this.soloReward=null;
      this.seed = 0x6d2b79f5;
    }
    snapshot() {
      const {allowed, ...state}=this;
      return JSON.parse(JSON.stringify({...state, usedCards: [...this.usedCards]}));
    }
    restore(state) {
      Object.assign(this, {campaignId:'party',heroSpec:null,soloBuild:null,campaignResult:null,soloReward:null}, state);
      this.usedCards = new Set(state.usedCards || []);
    }
    startCampaign(playerIds, enemyIds, level, training = {}, loadout = {}) {
      this.reset(); this.mode = 'campaign'; this.level = level; this.training = training;
      this.relic=['rootstone','ember','crown'].includes(loadout.relic)?loadout.relic:null;
      this.seed = (Math.imul(level, 0x9e3779b1) ^ 0xa53c9657) >>> 0;
      this.picks.A = playerIds.map(id => ({kind:'unit', id}));
      this.picks.B = enemyIds.map(id => ({kind:'unit', id}));
      this.hands.A=[...new Set((loadout.skills||[]).filter(id=>DATA.skillCards[id]))].slice(0,2);
      this.phase = 'deploy'; this.deployTeam = 'A'; this.team = 'A';
      enemyIds.forEach((id, index) => {
        const spec=loadout.enemies?.[index],custom=spec?.id===id?spec:null;
        const u=this.spawn(id,'B',custom?{x:custom.x,y:custom.y}:DATA.cards[id].boss?{x:2,y:4}:{x:[0,4,5,1][index%4],y:5});
        if(u&&custom){u.hp=u.maxHp=custom.hp;u.attack=custom.attack;u.defense=custom.defense;u.shield=custom.shield;}
      });
      this.note(`第 ${level} 关：部署队伍并迎战敌人。`);
    }
    visualPoint(u) {return {x:u.x+((u.size||1)-1)/2,y:u.y+((u.size||1)-1)/2};}
    emitVisual(type, detail) {
      this.visualSeq=(this.visualSeq||0)+1;
      this.visualEvents ||= [];
      this.visualEvents.push({seq:this.visualSeq,type,...detail});
      if(this.visualEvents.length>32)this.visualEvents.splice(0,this.visualEvents.length-32);
    }
    note(message) { this.log.unshift(message); this.log.length = Math.min(12, this.log.length); }
    start(allowed = null, seed = Date.now()) { this.reset(); this.seed=seed>>>0; this.allowed = allowed;
      this.phase = 'draft'; this.refreshCandidates(); }
    random() {
      let x=this.seed || 0x6d2b79f5;
      x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
      this.seed=x>>>0;return this.seed/0x100000000;
    }
    refreshCandidates() {
      const owned = new Set(this.picks[this.team].filter(x => x.kind === 'unit').map(x => x.id));
      const units = PLAYABLE().filter(([id]) => !owned.has(id) && (!this.allowed || this.allowed[this.team].units.includes(id)))
        .map(([id]) => ({kind: 'unit', id}));
      const pickedSkills = new Set(this.picks[this.team].filter(x => x.kind === 'skill').map(x => x.id));
      const skills = Object.keys(DATA.skillCards).filter(id => !pickedSkills.has(id) && (!this.allowed || this.allowed[this.team].skills.includes(id)))
        .map(id => ({kind: 'skill', id}));
      const pool = this.draftCount < 2 ? units : [...units, ...skills];
      for (let i=pool.length-1;i>0;i--) {
        const j=Math.floor(this.random()*(i+1));
        [pool[i],pool[j]]=[pool[j],pool[i]];
      }
      this.candidates = pool.slice(0, 3);
    }
    pick(index) {
      if (this.phase !== 'draft') return false;
      const card = this.candidates[index]; if (!card) return false;
      this.picks[this.team].push(card); this.note(`${this.team === 'A' ? '蓝方' : '红方'}选择了${this.cardName(card)}`);
      this.emitVisual('pick',{id:card.id,team:this.team});
      this.draftCount++;
      if (this.draftCount >= 8) {
        this.phase = 'deploy'; this.deployTeam = 'A'; this.team = 'A';
        this.hands.A = this.picks.A.filter(x => x.kind === 'skill').map(x => x.id);
        this.hands.B = this.picks.B.filter(x => x.kind === 'skill').map(x => x.id);
        this.note('选卡结束。蓝方先部署。');
      } else { this.team = other(this.team); this.refreshCandidates(); }
      return true;
    }
    cardName(c) { return (c.kind === 'unit' ? DATA.cards[c.id] : DATA.skillCards[c.id])?.name || c.id; }
    remaining(team = this.deployTeam) { return this.picks[team].filter(c => c.kind === 'unit' && !this.usedCards.has(`${team}:${c.id}`)); }
    deploy(cardId, pos) {
      if (this.phase !== 'deploy' || !within(pos)) return false;
      const team = this.deployTeam;
      if (!(team === 'A' ? pos.y <= 1 : pos.y >= 4)) return this.fail('只能部署在己方两排。');
      if (!this.remaining(team).some(c => c.id === cardId)) return false;
      if (!this.canOccupy(team, pos)) return this.fail('目标格不可叠放。');
      const deployed=this.spawn(cardId, team, pos); if (!deployed) return false;
      if(this.mode==='campaign'&&team==='A') {deployed.campaignOriginal=true;if(this.relic==='crown')deployed.shield+=15;}
      this.usedCards.add(`${team}:${cardId}`);
      this.emitVisual('deploy',{id:cardId,team,to:this.visualPoint(deployed)});
      this.note(`${team === 'A' ? '蓝方' : '红方'}部署${DATA.cards[cardId].name}`);
      if (!this.remaining(team).length) {
        if (team === 'A' && (this.mode === 'campaign'||this.mode==='practice'&&this.practiceQuick)) {
          this.phase = 'battle'; this.team = 'A'; this.round = 1; this.beginTurn(); this.note('战斗开始。');
        }
        else if (team === 'A') { this.deployTeam = 'B'; this.team = 'B'; this.note('轮到红方部署。'); }
        else { this.phase = 'battle'; this.team = 'A'; this.round = 1; this.beginTurn(); this.note('战斗开始。'); }
      }
      return true;
    }
    fail(message) { this.note(message); return false; }
    at(pos) { return this.units.filter(u => u.hp > 0 && pos.x >= u.x && pos.x < u.x+(u.size||1) && pos.y >= u.y && pos.y < u.y+(u.size||1)); }
    canOccupy(team, pos, size = 1, ignoreUid = null) {
      if (!within(pos) || pos.x+size>SIZE || pos.y+size>SIZE) return false;
      for(let y=pos.y;y<pos.y+size;y++) for(let x=pos.x;x<pos.x+size;x++) {
        const stack=this.at({x,y}).filter(u=>u.uid!==ignoreUid);
        if(stack.length>=MAX_STACK || stack.some(u=>u.team!==team || size>1 || (u.size||1)>1)) return false;
      }
      return true;
    }
    pathLength(team, from, to) {
      const size=from.size||1, ignoreUid=from.uid||null;
      if (!this.canOccupy(team, to,size,ignoreUid)) return Infinity;
      const queue = [{x:from.x,y:from.y,d:0}], seen = new Set([`${from.x},${from.y}`]);
      for (let i=0;i<queue.length;i++) {
        const p=queue[i]; if (p.x===to.x && p.y===to.y) return p.d;
        for (const delta of [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}]) {
          const next={x:p.x+delta.x,y:p.y+delta.y,d:p.d+1}, key=`${next.x},${next.y}`;
          if (within(next) && !seen.has(key) && this.canOccupy(team,next,size,ignoreUid) && this.controlStepAllowed(from,p,next)) {seen.add(key);queue.push(next);}
        }
      }
      return Infinity;
    }
    puppetsOf(owner) {return this.units.filter(u=>u.ownerUid===(typeof owner==='number'?owner:owner.uid)&&u.hp>0);}
    controlState(u) {if(!u?.ownerUid)return null;const owner=this.unit(u.ownerUid);return {owner,distance:owner?distance(owner,u):Infinity,inRange:!!owner&&owner.team===u.team&&distance(owner,u)<=2};}
    controlStepAllowed(u,from,to) {
      if(!u.ownerUid)return true;const control=this.controlState(u);if(!control?.owner||control.owner.team!==u.team)return false;
      const before=distance(control.owner,from),after=distance(control.owner,to);return before>2?after<before:after<=2;
    }
    followPosition(uid) {
      const u=this.unit(uid),control=this.controlState(u);if(!this.ready(u)||!control?.owner||control.distance<=1||u.mp+u.ap<=0)return null;
      const choices=[];
      for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
        const pos={x,y},d=distance(control.owner,pos);if(d>=control.distance)continue;
        const path=this.pathLength(u.team,u,pos);if(!Number.isFinite(path)||path<=0||path>u.mp+u.ap)continue;
        choices.push({...pos,d,path,ap:Math.max(0,path-u.mp),occupied:this.at(pos).filter(t=>t.uid!==u.uid).length});
      }
      choices.sort((a,b)=>Number(b.d<=2)-Number(a.d<=2)||(a.d<=2?a.ap-b.ap||a.path-b.path||a.occupied-b.occupied||a.d-b.d:a.d-b.d||a.ap-b.ap||a.path-b.path)||a.y-b.y||a.x-b.x);
      const best=choices[0];return best?{x:best.x,y:best.y}:null;
    }
    summonBlockReason(u,skill) {
      if(!u||!skill)return '';const effect=skill.effects?.find(e=>['summon','summon_puppet'].includes(e.type));if(!effect)return '';
      if(effect.type==='summon_puppet'&&this.puppetsOf(u).length>=4)return '已达到操控上限：4/4。傀儡阵亡后才能补召。';
      const size=DATA.cards[effect.unit||'puppet']?.size||1;
      for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++)if(distance(u,{x,y})<=(skill.range||0)&&this.canOccupy(u.team,{x,y},size))return '';
      return '召唤范围内没有可用格子；友军每格最多三名，不能与敌人或首领重叠。';
    }
    summonUnit(id,team,pos,source=null,skillId='',linked=false) {
      if(linked&&(!source||this.unit(source.uid)!==source||source.team!==team))return null;
      const unit=this.spawn(id,team,pos);if(!unit)return null;
      unit.summonerUid=source?.uid||null;unit.summonerId=source?.id||null;unit.summonSkill=skillId;unit.summonedRound=this.round;
      if(linked)unit.ownerUid=source.uid;return unit;
    }
    spawn(id, team, pos) {
      const c = DATA.cards[id]; if (!c || !within(pos) || !this.canOccupy(team, pos,c.size||1)) return null;
      const rank=this.mode==='campaign' && team==='A' ? Math.min(5,Math.max(1,Number(this.training[id])||1)) : 1;
      const u = {size:c.size||1, rank, uid: this.nextId++, id, team, x: pos.x, y: pos.y, hp: c.health, maxHp: c.health,
        attack: c.attack, defense: c.defense || 0, shield: c.start_shield || 0,
        oneShield: false, ap: c.action_points, mp: c.move_points, charge: 0, statuses: {},
        cooldowns: {}, used: [], buffs: [], aura: false, ownerUid: null, turnStunned: false};
      u.maxHp=u.hp=Math.round(c.health*(1+(rank-1)*.12)); u.attack+=(rank-1)*2;
      if(this.campaignId==='solo'&&id==='ember_hero'&&team==='A'&&this.heroSpec){
        const spec=this.heroSpec;u.hp=u.maxHp=spec.hp;u.attack=spec.attack;u.defense=spec.defense;
        u.skills=[...spec.skills];u.skillBook=JSON.parse(JSON.stringify(spec.book));u.heroPassives=[...spec.passives];
        u.rank=(this.soloBuild?.cleared.length||0)+1;
        u.charge=0;u.moved=0;u.strideUsed=false;
      }
      this.units.push(u); return u;
    }
    skillIds(u) {return u.skills||DATA.cards[u.id].skills;}
    skill(u,id) {return u?.skillBook?.[id]||DATA.skills[id];}
    remainingCooldown(u,id) {return Math.max(0,(u.cooldowns[id]||0)-Number(u.cooldownSetRound?.[id]===this.round));}
    unit(uid) { return this.units.find(u => u.uid === uid && u.hp > 0); }
    select(uid) { const u = this.unit(uid); if (!u) return false; this.selected = uid; this.intent = null; return true; }
    beginTurn() {
      if(this.campaignId==='solo'&&this.team==='A'&&this.round>=25){this.phase='end';this.winner='B';this.note('裂隙坍塌。回营地重配技能，尝试更有效的进攻。');return;}
      if(this.campaignId==='solo'&&this.team==='B'&&this.round>=13){for(const u of this.units.filter(u=>u.team==='B'))u.attack+=2;this.note('裂隙升温：敌军攻击 +2。');}
      if(this.mode==='campaign' && this.team==='B') {
        const threats=this.threats; this.threats=[];
        for(const threat of threats) {
          const boss=this.unit(threat.uid); if(!boss) continue;
          this.emitVisual('boss',{id:boss.id,from:this.visualPoint(boss),cells:threat.cells});
          const victims=this.units.filter(u=>u.team==='A' && threat.cells.some(p=>this.at(p).some(t=>t.uid===u.uid)));
          for(const u of victims) this.damage(u,threat.damage,boss,true);
          this.note(`${DATA.cards[boss.id].ability}结算，命中 ${victims.length} 名角色。`);
        }
        if(this.phase==='end') return;
      }
      for (const u of this.units.filter(u => u.team === this.team && u.hp > 0)) {
        const c = DATA.cards[u.id];
        if(this.mode==='campaign'&&this.team==='A'&&this.relic==='rootstone'&&u.campaignOriginal) this.heal(u,4);
        u.ap = c.action_points; u.mp = c.move_points;
        u.turnStunned = !!u.statuses.stun;
        u.turnSlowed = !!u.statuses.slow;
        if (u.turnStunned) { u.ap = 0; u.mp = 0; }
        if (u.statuses.slow) u.mp = Math.max(0, Math.floor(u.mp / 2));
        if(this.mode==='campaign'&&c.boss){if(u.turnStunned)u.controlWard=3;else u.controlWard=Math.max(0,(u.controlWard||0)-1);}
        if(u.heroPassives){u.moved=0;u.strideUsed=false;u.charge=u.heroPassives.includes('reservoir')?Math.min(5,u.charge+1):0;}
        for (const [key, value] of Object.entries(u.cooldowns)) u.cooldowns[key] = Math.max(0, value - 1);
        for (const key of Object.keys(u.statuses)) { u.statuses[key]--; if (u.statuses[key] <= 0) delete u.statuses[key]; }
        for (const buff of [...u.buffs]) { if (buff.turns !== 'permanent' && --buff.turns <= 0) this.expireBuff(u, buff); }
        const chargeId=this.skillIds(u).find(k=>this.skill(u,k)?.effects?.some(e=>e.type==='charge'));
        const charge=chargeId&&this.skill(u,chargeId).effects.find(e=>e.type==='charge');
        if (charge) {const old=u.charge;u.charge = Math.min(charge.max_charge || 5, u.charge + (charge.per_turn || 1));if(u.charge>old)this.emitVisual('passive',{id:chargeId,from:this.visualPoint(u)});}
      }
      this.selected = null; this.intent = null;
    }
    expireBuff(u, buff) {
      if (buff.stat === 'health') { u.maxHp -= buff.value; u.hp = Math.min(u.hp, u.maxHp); }
      else u[buff.stat] -= buff.value;
      u.buffs.splice(u.buffs.indexOf(buff), 1);
    }
    endTurn() {
      if (this.phase !== 'battle') return;
      for(const u of this.units.filter(u=>u.team===this.team&&u.heroPassives?.includes('guard')&&u.mp>0))u.shield=Math.max(u.shield,Math.min(18,u.shield+6));
      for (const u of this.units.filter(u => u.team === this.team && u.aura && u.hp > 0)) if(this.heal(u,5)>0)this.emitVisual('passive',{id:'heal_aura',from:this.visualPoint(u)});
      if(this.mode==='campaign' && this.team==='B') this.planBossThreats();
      this.team = other(this.team); if (this.team === 'A') this.round++;
      this.beginTurn(); this.note(`第 ${this.round} 回合：${this.team === 'A' ? '蓝方' : '红方'}行动。`);
      if(this.phase==='battle')this.emitVisual('turn',{team:this.team});
    }
    planBossThreats() {
      this.threats=[];
      const originals=this.units.filter(u=>u.team==='A'&&u.campaignOriginal);
      const targets=originals.length?originals:this.units.filter(u=>u.team==='A'); if(!targets.length) return;
      for(const boss of this.units.filter(u=>DATA.cards[u.id].boss)) {
        if(!boss.enraged && boss.hp<=boss.maxHp/2) {boss.enraged=true;boss.attack+=6;this.note(`${DATA.cards[boss.id].name}进入狂暴！`);}
        const t=targets[(this.round-1)%targets.length], cells=[];
        for(let y=0;y<SIZE;y++) for(let x=0;x<SIZE;x++) {
          const hit=boss.id==='boss_warden'?y===t.y:boss.id==='boss_furnace'?x>=Math.min(4,t.x)&&x<=Math.min(4,t.x)+1&&y>=Math.min(4,t.y)&&y<=Math.min(4,t.y)+1:x===t.x||y===t.y;
          if(hit) cells.push({x,y});
        }
        this.threats.push({uid:boss.uid,cells,damage:(boss.threatDamage??({boss_warden:22,boss_furnace:26,boss_crown:30}[boss.id]))+(boss.enraged?6:0)});
        this.note(`${DATA.cards[boss.id].ability}蓄力：请在下次红方行动前离开危险格。`);
      }
    }
    move(uid, pos) {
      const u = this.unit(uid); if (!this.ready(u) || !within(pos) || !this.canOccupy(u.team, pos,u.size||1,u.uid)) return false;
      if (u.ownerUid) {
        const control=this.controlState(u);if(!control?.owner)return this.fail('主人已不在场，傀儡无法行动。');
        if(!this.controlStepAllowed(u,u,pos))return this.fail(control.inRange?'傀儡不能离主人超过两格。':'傀儡已失联，只能逐步向主人靠拢。');
      }
      const d = this.pathLength(u.team, u, pos); if (d < 1 || d > u.mp + u.ap) return this.fail('无法到达，或移动点不足。');
      const from=this.visualPoint(u),fromMp = Math.min(d, u.mp); u.mp -= fromMp; u.ap -= d - fromMp;
      u.x = pos.x; u.y = pos.y;
      this.emitVisual('move',{id:u.id,from,to:this.visualPoint(u),steps:d});
      if(u.heroPassives)u.moved=(u.moved||0)+d;
      this.pickups = this.pickups.filter(item => {
        if (item.x !== pos.x || item.y !== pos.y) return true;
        u.maxHp += 5; u.hp = Math.min(u.maxHp, u.hp + 5);this.emitVisual('passive',{id:'fertilizer',from:this.visualPoint(u)});this.note('拾取养料：本场生命与生命上限 +5。'); return false;
      });
      this.note(`${DATA.cards[u.id].name}移动至${pos.x + 1},${pos.y + 1}`); this.finishUnitAction(u); return true;
    }
    finishUnitAction(u) {
      if(this.selected===u.uid && (!this.unit(u.uid)||(u.mp<=0&&u.ap<=0))) {
        this.selected=null;this.intent=null;
      }
    }
    ready(u) { return this.phase === 'battle' && u && u.team === this.team && !u.turnStunned; }
    attack(uid, targetUid) {
      const u = this.unit(uid), t = this.unit(targetUid);
      if (!this.ready(u) || !t || t.team === u.team || u.ap < 1 || distance(u, t) > DATA.cards[u.id].attack_range || DATA.cards[u.id].attack_range < 1) return false;
      if(u.ownerUid&&!this.controlState(u)?.inRange)return this.fail('傀儡超出主人两格的操控范围，靠近主人后才能攻击。');
      if (t.statuses.stealth) return this.fail('隐身目标无法被攻击。');
      if(this.mode==='campaign'&&DATA.cards[u.id].boss){
        u.ap--;this.emitVisual('attack',{id:u.id,from:this.visualPoint(u),to:this.visualPoint(t)});
        const victims=this.units.filter(v=>v.team!==u.team&&distance(u,v)<=1);
        for(const v of victims)this.damage(v,u.attack+(v.campaignOriginal?0:15),u);
        this.note(`${DATA.cards[u.id].name}横扫 ${victims.length} 个目标；召唤物额外承受 15 基础伤害。`);this.finishUnitAction(u);return true;
      }
      this.emitVisual('attack',{id:u.id,from:this.visualPoint(u),to:this.visualPoint(t),ranged:DATA.cards[u.id].attack_range>1});
      const stride=u.heroPassives?.includes('stride')&&u.moved>=2&&!u.strideUsed?6:0;if(stride)u.strideUsed=true;
      u.ap--; delete u.statuses.stealth; const relicBonus=this.mode==='campaign'&&this.relic==='ember'&&u.campaignOriginal&&DATA.cards[t.id].boss?5:0; const dealt = this.damage(t, u.attack+relicBonus+stride, u);
      if(u.hp>0&&u.heroPassives?.includes('blood')&&u.hp<=u.maxHp/2&&dealt>0)this.heal(u,Math.round(dealt*.25));
      if (DATA.cards[u.id].skills.includes('bloodlust') && u.hp <= u.maxHp / 2 && dealt > 0) {if(this.heal(u,Math.round(dealt*.5))>0)this.emitVisual('passive',{id:'bloodlust',from:this.visualPoint(u)});}
      this.note(`${DATA.cards[u.id].name}攻击${DATA.cards[t.id].name}，造成${dealt}伤害。`);
      this.finishUnitAction(u);
      return true;
    }
    // A preview runs the real rule on a disposable copy, so target hints stay in
    // sync with movement costs, range, stealth, stacks and individual skills.
    canTarget(action, uid, id, pos, targetUid = null) {
      if (!within(pos)) return false;
      const probe = new Game();
      probe.restore(this.snapshot());
      if (action === 'move') return probe.move(uid,pos);
      if (action === 'attack') return probe.attack(uid,targetUid);
      if (action === 'skill') return probe.useSkill(uid,id,pos,targetUid);
      if (action === 'hand') return probe.playHand(id,pos,targetUid);
      return false;
    }
    damage(t, raw, source = null, magic = false) {
      if(!t||t.hp<=0||!this.units.includes(t))return 0;
      if (t.oneShield) { t.oneShield = false;this.emitVisual('hit',{to:this.visualPoint(t),amount:0,blocked:true}); return 0; }
      let amount = Math.max(0, Math.round(raw * (t.statuses.mark ? 1.2 : 1)) - (magic ? 0 : t.defense));
      if (t.aura && amount > 0) amount = Math.max(1, Math.round(amount * 0.8));
      const absorb = Math.min(t.shield, amount); t.shield -= absorb; amount -= absorb;
      const dealt = Math.min(t.hp, amount); t.hp -= amount;
      if(dealt||absorb)this.emitVisual('hit',{to:this.visualPoint(t),amount:dealt,shield:absorb,dead:t.hp<=0});
      if (t.hp <= 0) this.kill(t, source);
      return dealt;
    }
    heal(u, amount) { const old = u.hp; u.hp = Math.min(u.maxHp, u.hp + amount); const gained=u.hp-old;if(gained)this.emitVisual('heal',{to:this.visualPoint(u),amount:gained});return gained; }
    kill(u, killer) {
      if(!u||!this.units.includes(u))return;
      this.note(`${DATA.cards[u.id].name}被击败。`);
      const pos = {x: u.x, y: u.y}, team = u.team;
      this.units = this.units.filter(x => x !== u && x.hp > 0);
      const linked=this.puppetsOf(u);if(linked.length){this.units=this.units.filter(t=>t.ownerUid!==u.uid);this.note(`主人离场，${linked.length} 名傀儡一并退场，不触发额外击杀。`);}
      if (killer && this.unit(killer.uid)===killer && DATA.cards[killer.id].skills.includes('finisher')) {if(this.spawnNearby('skeleton', killer.team, pos,killer,'finisher'))this.emitVisual('passive',{id:'finisher',from:this.visualPoint(killer),to:pos});}
      if (u.id === 'slime') {for (let i = 0; i < 3; i++) this.spawnNearby('slime_small', team, pos,u,'mitosis');this.emitVisual('passive',{id:'mitosis',from:pos});}
      if (u.id === 'slime_small') {this.pickups.push(pos);this.emitVisual('passive',{id:'fertilizer',from:pos});}
      if (u.id === 'chessboard') {this.spawnNearby(['rook','pawn','knight_piece'][Math.floor(this.random()*3)], team, pos,u,'scatter');this.emitVisual('passive',{id:'scatter',from:pos});}
      if(this.selected&&!this.unit(this.selected)){this.selected=null;this.intent=null;}
      const alive = {A: this.units.some(x => x.team === 'A'), B: this.units.some(x => x.team === 'B')};
      if (!alive.A || !alive.B) { this.phase = 'end'; this.winner = alive.A ? 'A' : alive.B ? 'B' : null; this.note(this.winner ? `${this.winner === 'A' ? '蓝方' : '红方'}获胜！` : '平局'); }
    }
    nearbySpawnCell(id,team,pos) {
      const cells = [pos, ...[{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1},{x:1,y:1},{x:-1,y:-1},{x:1,y:-1},{x:-1,y:1}].map(d => ({x:pos.x+d.x,y:pos.y+d.y}))];
      return cells.find(p => within(p) && this.canOccupy(team,p,DATA.cards[id]?.size||1))||null;
    }
    spawnNearby(id, team, pos,source=null,skillId='') {
      const cell=this.nearbySpawnCell(id,team,pos);return cell?this.summonUnit(id,team,cell,source,skillId):null;
    }
    canSkill(uid, skillId) {
      const u = this.unit(uid), s = this.skill(u,skillId); if (!this.ready(u) || !s || s.type !== 'active') return false;
      if (!this.skillIds(u).includes(skillId)) return false;
      if(s.heroSkill&&(u.ap<1||s.requires==='charge'&&!u.heroPassives?.includes('reservoir')))return false;
      if (s.usage === 'once' && u.used.includes(skillId)) return false;
      if (u.cooldowns[skillId] > 0) return false;
      if(this.summonBlockReason(u,s))return false;
      return s.requires === 'charge' ? u.charge >= (s.cost || 0) : u.ap >= (s.cost || 0);
    }
    useSkill(uid, skillId, pos, targetUid = null) {
      const u = this.unit(uid), s = this.skill(u,skillId); if (!within(pos))return false;if(!this.canSkill(uid,skillId)){const reason=this.summonBlockReason(u,s);return reason?this.fail(reason):false;}
      if(s.selfOnly&&distance(u,pos)!==0)return this.fail('该技能只能以自身为目标。');
      if (['rage','stealth','shield_wall','frost_nova'].includes(skillId) && distance(u,pos) !== 0)
        return this.fail('该技能以自身为中心释放。');
      const range = s.range ?? 0;
      if (range && distance(u, pos) > range) return this.fail('技能范围不足。');
      if (!range && distance(u, pos) > 5 && !['rook_charge','queen_orb'].some(k => s.effects.some(e => e.type === k))) return this.fail('目标太远。');
      const castFrom=this.visualPoint(u);
      const targets = this.at(pos);
      if (targetUid !== null) {
        const index=targets.findIndex(t=>t.uid===targetUid);
        if (index<0) return false;
        targets.unshift(...targets.splice(index,1));
      }
      let affected = false;
      for (const effect of s.effects) affected = this.effect(effect, u, pos, targets,skillId) || affected;
      if (!affected) return this.fail('技能目标无效。');
      this.emitVisual('skill',{id:skillId,from:castFrom,to:{x:pos.x,y:pos.y}});
      if (s.requires === 'charge') {u.charge -= s.cost || 0;if(s.heroSkill)u.ap--;} else u.ap -= s.cost || 0;
      if (s.usage === 'once') u.used.push(skillId);
      if (s.usage?.startsWith('cooldown:')) {u.cooldowns[skillId] = Number(s.usage.split(':')[1]) + 1;u.cooldownSetRound ||= {};u.cooldownSetRound[skillId]=this.round;}
      this.note(`${DATA.cards[u.id].name}使用${s.name}。`); this.finishUnitAction(u); return true;
    }
    effect(e, u, pos, targets,sourceId='') {
      const enemies = targets.filter(t => t.team !== u.team && !t.statuses.stealth), allies = targets.filter(t => t.team === u.team);
      const firstEnemy = enemies[0], firstAlly = allies[0];
      switch (e.type) {
        case 'damage': if (!firstEnemy) return false; this.damage(firstEnemy, e.value || u.attack * (e.multiplier || 1), u, e.magic); return true;
        case 'aoe_damage': { const victims = this.units.filter(t => t.team !== u.team && distance(t,pos) <= (e.radius || 0)); victims.forEach(t => this.damage(t,e.damage,u,e.magic)); return victims.length > 0; }
        case 'drain': if (!firstEnemy) return false; this.heal(u,this.damage(firstEnemy,e.value,u,e.magic)); return true;
        case 'heal': if (!firstAlly || firstAlly.hp >= firstAlly.maxHp) return false; this.heal(firstAlly,e.value); return true;
        case 'shield': if (!firstAlly) return false;if(firstAlly.heroPassives&&firstAlly.shield>=45)return false; firstAlly.shield = firstAlly.heroPassives?Math.min(45,firstAlly.shield+e.value):firstAlly.shield+e.value; return true;
        case 'one_time_shield': if (!firstAlly) return false; firstAlly.oneShield = true; return true;
        case 'remove_debuffs': if (!firstAlly) return false; firstAlly.statuses = {}; return true;
        case 'stun': if (!firstEnemy) return false; return this.applyStun(firstEnemy,e.duration,sourceId);
        case 'slow': { const victims = this.units.filter(t => t.team !== u.team && distance(t,pos) <= (e.radius || 0)); victims.forEach(t => t.statuses.slow = e.duration); return victims.length > 0; }
        case 'debuff': if (!firstEnemy) return false; firstEnemy.statuses.mark = e.duration || 3; return true;
        case 'self_status': u.statuses[e.status] = e.duration || 1; return true;
        case 'buff': {
          const recipients = e.target === 'adjacent' ? this.units.filter(t => t.team === u.team && distance(t,u) <= 1) : [firstAlly || u];
          for (const t of recipients) for (const [stat,value] of Object.entries(e.stats || {[e.stat]:e.value})) { t[stat === 'health' ? 'maxHp' : stat] += value; if (stat === 'health') t.hp += value; t.buffs.push({stat,value,turns:e.duration === 'permanent' ? 'permanent' : Number(e.duration) || 1}); }
          return recipients.length > 0;
        }
        case 'summon': return !!this.summonUnit(e.unit,u.team,pos,u,sourceId);
        case 'summon_puppet': {
          if (this.puppetsOf(u).length >= 4) return this.fail('每位傀儡师最多同时操控四名傀儡。');
          const puppet = this.summonUnit('puppet',u.team,pos,u,sourceId,true);
          return !!puppet;
        }
        case 'duel': {
          if (!firstEnemy) return false;
          for (let strike=0;strike<6 && u.hp>0 && firstEnemy.hp>0;strike++) {
            const attacker=strike%2?firstEnemy:u, defender=strike%2?u:firstEnemy;
            const dealt=this.damage(defender,attacker.attack,attacker);
            if (DATA.cards[attacker.id].skills.includes('bloodlust') && attacker.hp<=attacker.maxHp/2 && dealt>0)
              this.heal(attacker,Math.round(dealt*.5));
            this.note(`对弈：${DATA.cards[attacker.id].name}造成${dealt}伤害。`);
          }
          return true;
        }
        case 'rook_charge': return this.chessMove(u,pos,'rook');
        case 'pawn_act': return this.chessMove(u,pos,'pawn');
        case 'queen_move': return this.chessMove(u,pos,'queen');
        case 'knight_leap': return this.chessMove(u,pos,'knight');
        case 'queen_orb': {
          const dx = pos.x-u.x, dy = pos.y-u.y;
          if (!firstEnemy || !((dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy)) && (dx || dy))) return false;
          const steps = Math.max(Math.abs(dx),Math.abs(dy));
          for (let i=1;i<steps;i++) if (this.at({x:u.x+Math.sign(dx)*i,y:u.y+Math.sign(dy)*i}).length) return false;
          this.damage(firstEnemy,20,u,true); return true;
        }
        case 'knight_orb': if (!firstEnemy || Math.abs(pos.x-u.x)*Math.abs(pos.y-u.y) !== 2) return false;
          this.damage(firstEnemy,20,u,true); return true;
        default: return false;
      }
    }
    chessMove(u, pos, type) {
      const dx = pos.x-u.x, dy = pos.y-u.y, ax = Math.abs(dx), ay = Math.abs(dy);
      const valid = type === 'rook' ? (dx === 0) !== (dy === 0) : type === 'pawn' ? dy === (u.team === 'A' ? 1 : -1) && ax <= 1 : type === 'queen' ? dx === 0 || dy === 0 || ax === ay : ax*ay === 2;
      if (!valid || (!ax && !ay)) return false;
      if (type === 'rook' || type === 'queen') {
        const steps=Math.max(ax,ay), stepX=Math.sign(dx),stepY=Math.sign(dy);
        for (let i=1;i<steps;i++) if(this.at({x:u.x+stepX*i,y:u.y+stepY*i}).length) return false;
      }
      const enemy = this.at(pos).find(t => t.team !== u.team);
      if (type === 'pawn' && ((enemy && ax !== 1) || (!enemy && ax !== 0))) return false;
      if (enemy) {
        if (type === 'queen' || type === 'knight') return false;
        this.damage(enemy,u.attack,u);
        if (type === 'rook') {
          const previous={x:pos.x-Math.sign(dx),y:pos.y-Math.sign(dy)};
          if (this.canOccupy(u.team,previous)) {u.x=previous.x;u.y=previous.y;}
        }
        return true;
      }
      if (!this.canOccupy(u.team,pos)) return false;
      u.x = pos.x; u.y = pos.y;
      if (type === 'pawn' && (u.y === 0 || u.y === 5)) { const c = DATA.cards.queen; u.id = 'queen'; u.hp = u.maxHp = c.health; }
      return true;
    }
    playHand(skillId, pos, targetUid = null) {
      if (this.phase !== 'battle' || !this.hands[this.team].includes(skillId) || !within(pos)) return false;
      const card = DATA.skillCards[skillId]; if (!card) return false;
      const stack = this.at(pos);
      if (skillId === 'heal_aura') {
        const target = targetUid === null ? [...stack].reverse().find(u => u.team === this.team)
          : stack.find(u => u.uid === targetUid && u.team === this.team);
        if (!target) return this.fail('治愈光环需要一个己方角色。');
        target.aura = true;
      } else if (skillId === 'fire_rain') {
        for (let wave = 0; wave < 3; wave++) {
          const victims = [...this.units].filter(u => u.team !== this.team && u.x<=pos.x+1 && u.x+(u.size||1)-1>=pos.x-1 && u.y<=pos.y+1 && u.y+(u.size||1)-1>=pos.y-1);
          for (const target of victims) this.damage(target, this.at(pos).some(u=>u.uid===target.uid) ? 20 : 10);
        }
      } else if (skillId === 'demon_meteor') {
        if(!stack.some(u=>u.team!==this.team)&&!this.nearbySpawnCell('golem',this.team,pos))return this.fail('附近没有石魔落点，也没有可命中的敌人；未消耗手牌。');
        for (const target of [...stack].filter(u => u.team !== this.team)) {
          this.damage(target, 30);
          if (target.hp > 0) this.applyStun(target,2);
        }
        if(!this.spawnNearby('golem', this.team, pos,null,'demon_meteor'))this.note('陨石已命中；附近满员，石魔未能生成。');
      } else return false;
      this.emitVisual('skill',{id:skillId,from:{x:pos.x,y:this.team==='A'?0:5},to:{x:pos.x,y:pos.y}});
      this.hands[this.team].splice(this.hands[this.team].indexOf(skillId),1);
      this.note(`${this.team === 'A' ? '蓝方' : '红方'}打出${card.name}。`); return true;
    }
    applyStun(target,duration,sourceId='') {
      if(!target||target.hp<=0||!this.units.includes(target))return false;
      if(this.mode==='campaign'&&DATA.cards[target.id].boss){
        if(target.controlWard>0)return this.fail('首领韧性生效：暂时免疫眩晕。');
        duration=Math.min(1,duration);
      }
      if(duration>=(target.statuses.stun||0))target.controlSource=sourceId;
      target.statuses.stun=Math.max(target.statuses.stun||0,duration);return true;
    }
  }
  window.TacticsGame = Game;
})();
