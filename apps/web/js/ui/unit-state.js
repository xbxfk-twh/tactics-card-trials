/* State descriptions and vector overlays are shared by the board and stack inspector. */
(function(){
  'use strict';
  const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const statNames={health:'生命上限',maxHp:'生命上限',attack:'攻击',defense:'护甲',mp:'移动点',ap:'行动点',move_points:'移动点',action_points:'行动点',attack_range:'射程',charge:'充能'};
  function buffDetail(buffs){
    return buffs.map(buff=>{
      const value=Number(buff.value),amount=Number.isFinite(value)?`${value>=0?'+':''}${value}`:'数值见技能说明';
      const duration=buff.turns==='permanent'?'永久':Number.isFinite(buff.turns)?`剩余 ${Math.max(0,buff.turns)} 次己方回合开始后到期`:'持续时间见技能说明';
      return `${statNames[buff.stat]||buff.stat} ${amount}（${duration}）`;
    }).join('；');
  }
  function states(game,u){
    const result=[],s=u.statuses||{},current=game.team===u.team;
    const add=(id,label,glyph,turns,hint)=>result.push({id,label,glyph,turns,hint});
    const control=game.controlState?.(u);if(control&&!control.inRange)add('unlinked','失联','离',null,'超出主人两格操控范围：只能向主人靠拢，回到范围后才能攻击。');
    if(s.stun||current&&u.turnStunned){const bound=u.controlSource==='entangle',turns=(s.stun||0)+Number(current&&u.turnStunned);add(bound?'bound':'stun',bound?'缠绕':'眩晕',bound?'缠':'晕',turns,`${bound?'藤蔓束缚':'眩晕'}：${current&&u.turnStunned?'本回合无法移动或行动；':''}尚含 ${turns} 次受控的己方行动。`);}
    if(s.slow||current&&u.turnSlowed){const turns=(s.slow||0)+Number(current&&u.turnSlowed);add('slow','减速','缓',turns,'受影响的己方回合，移动点减半并向下取整；行动点不减少，仍可用行动点移动。');}
    if(s.stealth)add('stealth','隐匿','隐',s.stealth,`还剩 ${s.stealth} 次己方回合开始计时；普攻提前解除，范围伤害仍可命中。`);
    if(s.mark)add('mark','易伤','靶',s.mark,'受到的基础伤害提高 20%，再按护甲、免伤与护盾结算。');
    if(u.oneShield)add('ward','庇护','御',null,'抵挡下一次受到的伤害，触发后消失。');
    if(u.buffs?.length)add('buff','强化','↑',null,buffDetail(u.buffs));
    if(u.aura)add('aura','光环','✧',null,'治愈光环：本角色每个己方回合结束时恢复 5 生命；承受的伤害在护甲结算后降低 20%，按规则取整，正伤害至少为 1。只作用于宿主，持续至本场结束。');
    return result;
  }
  function badges(game,u,small=false){return states(game,u).map(s=>`<span class="state-badge state-${s.id}" role="button" tabindex="0" aria-haspopup="dialog" data-action="state-info" data-uid="${escape(u.uid)}" data-id="${s.id}" title="${escape(s.label+'：'+s.hint)}" aria-label="${escape(s.label+' '+s.hint)}">${small?s.glyph:s.label}${s.turns?`<sup>${s.turns}</sup>`:''}</span>`).join('');}
  function overlay(game,u){const active=states(game,u).map(s=>s.id);return active.map(id=>{
    if(id==='bound')return '<svg class="unit-status-art unit-vines" viewBox="0 0 100 100" aria-hidden="true"><g fill="none" stroke-linecap="round"><path class="vine-stem" d="M7 103C-3 77 34 77 24 54S-1 28 16 10M93 103C107 77 65 75 77 52S105 24 87 7M15 75C37 89 67 88 88 72M17 47C35 61 69 60 85 44"/><path class="vine-tendril" d="M19 22c16-14 24 7 8 7M79 26c-16-14-21 8-7 8M25 58c15-13 25 8 11 10M76 66c-12-14-24 6-10 10"/></g><g class="vine-leaves" fill="#62b94c" stroke="#245a36" stroke-width="1"><path d="M18 26Q-1 12 8 5Q24 9 18 26M25 58Q5 58 10 43Q25 44 25 58M82 24Q102 11 91 3Q77 7 82 24M78 58Q97 54 94 40Q76 41 78 58M38 83Q42 65 52 71Q52 84 38 83M61 83Q64 67 74 72Q73 88 61 83"/></g></svg>';
    if(id==='stun')return '<span class="unit-status-art stun-orbit" aria-hidden="true"><i>✦</i><i>✦</i><i>✦</i></span>';
    if(id==='slow')return '<svg class="unit-status-art frost-lock" viewBox="0 0 100 100" aria-hidden="true"><path d="M4 94L15 68L24 91L33 73L44 94L55 68L64 93L78 72L88 94L96 75M8 92H94M18 94V73M55 95V75M82 94V79"/></svg>';
    if(id==='mark')return '<span class="unit-status-art mark-reticle" aria-hidden="true"></span>';
    if(id==='ward')return '<span class="unit-status-art ward-ring" aria-hidden="true"></span>';
    if(id==='aura')return '<svg class="unit-status-art aura-halo" viewBox="0 0 100 100" aria-hidden="true"><g class="aura-halo-float"><ellipse class="aura-halo-glow" cx="50" cy="11" rx="24" ry="6.5"/><ellipse class="aura-halo-ring" cx="50" cy="11" rx="23" ry="6"/><path class="aura-halo-shine" d="M29 11c4-7 34-8 42-1"/><g class="aura-halo-motes"><path d="M23 14v5m-2.5-2.5h5M75 4v5m-2.5-2.5h5"/><circle cx="42" cy="3" r="1"/><circle cx="63" cy="22" r="1"/></g></g></svg>';
    return '';
  }).join('');}
  function classes(game,u){return states(game,u).map(s=>'is-'+s.id).join(' ');}
  function detail(game,u){return states(game,u).map(s=>s.label+(s.turns?' '+s.turns:'')+'：'+s.hint).join('；')||'无异常状态';}
  function summonDetail(game,u){
    if(u.ownerUid){const control=game.controlState(u);return `主人：${control?.owner?window.GAME_DATA.cards[control.owner.id].name:'已离场'} · 距离 ${Number.isFinite(control?.distance)?control.distance:'—'}/2 格。${control?.inRange?'操控正常。':'失联：仅能向主人靠拢，回到范围才能攻击。'}`;}
    if(u.id==='puppet_master')return `已操控 ${game.puppetsOf(u).length}/4 名傀儡。傀儡每回合 0 移动、1 行动；移动、跟随与攻击共用行动点。`;
    if(u.summonSkill)return `召唤来源：${window.GAME_DATA.skills[u.summonSkill]?.name||window.GAME_DATA.skillCards[u.summonSkill]?.name||u.summonSkill}。独立作战，不随召唤者阵亡退场。`;
    return '';
  }
  const matchActions=new Set(['camp-open','camp-close','camp-dismiss','info','info-close','state-info','state-close','stack-cancel','stack-confirm','target-cancel','target-choice','pick','deploy-select','cell','end-turn','skill','hand','follow-owner','continue','match-menu','match-resume','match-exit','match-exit-cancel','match-exit-confirm','resume-room','copy-room']);
  function active(game){return ['draft','deploy','battle'].includes(game.phase);}
  function allowed(game,action,id){if(!active(game))return true;if(!matchActions.has(action))return false;return action!=='camp-open'||['unit','hand','log','help'].includes(id);}
  window.UnitPresentation={states,badges,overlay,classes,detail,summonDetail,active,allowed};
})();
