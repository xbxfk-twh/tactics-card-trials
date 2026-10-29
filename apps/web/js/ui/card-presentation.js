/* Compact, shared card information. Gameplay mutations remain in app/engine. */
(function(){
  'use strict';
  const D=window.GAME_DATA,h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function stats(card,{unit=null,spec=null,rank=1,compact=false}={}){
    const hp=unit?`${unit.hp}/${unit.maxHp}`:spec?.hp??Math.round(card.health*(1+(rank-1)*.12));
    const armor=unit?.defense??spec?.defense??card.defense??0;
    const values=[['health','❤️','生命',hp],['attack','⚔️','攻击',unit?.attack??spec?.attack??card.attack+(rank-1)*2],...(armor>0?[['defense','🪖','护甲',armor]]:[]),['range','🎯','射程',card.attack_range],['move','👣','移动',unit?.mp??spec?.mp??card.move_points],['action','⚡','行动',unit?.ap??spec?.ap??card.action_points]];
    const shield=unit?unit.shield:card.start_shield;
    if(shield>0)values.push(['shield','🔷','护盾',shield]);
    if(unit?.charge>0)values.push(['charge','💠','充能',unit.charge]);
    return `<div class="stat-grid ${compact?'stat-grid-compact':''}" aria-label="棋子属性">${values.map(([id,glyph,label,value])=>`<span class="stat-token stat-${id}" data-stat="${id}" title="${label}" aria-label="${label} ${h(value)}"><i aria-hidden="true">${glyph}</i><b>${h(value)}</b></span>`).join('')}</div>`;
  }
  function skills(ids,{cardId='',uid=null}={}){
    return `<div class="skill-icon-grid" aria-label="技能，点击查看详情">${ids.map(id=>{const s=D.skills[id]||D.skillCards[id]||D.bossSkills[id];if(!s)return '';return `<button type="button" class="skill-chip" data-action="info" data-info="${h(id)}" data-id="${h(id)}" ${cardId?`data-card="${h(cardId)}"`:''} ${uid!==null?`data-uid="${h(uid)}"`:''} aria-label="查看${h(s.name)}详情"><img class="skill-icon" data-skill-icon="${h(id)}" src="assets/icons/${h(s.icon)}" alt="" width="28" height="28"><span>${h(s.name)}</span></button>`;}).join('')||'<span class="no-skills">无技能</span>'}</div>`;
  }
  window.CardPresentation={stats,skills};
})();
