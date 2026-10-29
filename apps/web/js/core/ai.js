/* Deterministic turn planner. All actions still pass through Game validation. */
(function () {
  'use strict';
  const DATA = window.GAME_DATA;
  const dist = (a,b) => Math.max(0,a.x-b.x-((b.size||1)-1),b.x-a.x-((a.size||1)-1))+Math.max(0,a.y-b.y-((b.size||1)-1),b.y-a.y-((a.size||1)-1));
  const cells = () => Array.from({length:36}, (_,i) => ({x:i%6,y:Math.floor(i/6)}));
  const enemies = (game, team) => game.units.filter(u => u.hp > 0 && u.team !== team);
  const allies = (game, team) => game.units.filter(u => u.hp > 0 && u.team === team);

  function skillTargets(game, unit, id) {
    const skill = game.skill(unit,id);
    if (!game.canSkill(unit.uid, id)) return [];
    const kind = skill.effects[0]?.type;
    const range = skill.range || 0;
    const inRange = target => range === 0 || dist(unit,target) <= range;
    if (['rage','stealth','shield_wall','frost_nova'].includes(id)) {
      const nearby=enemies(game,unit.team).filter(e=>dist(unit,e)<=2).length;
      return [{x:unit.x,y:unit.y,score:id==='frost_nova'?nearby*25:
        id==='stealth'?(unit.statuses.stealth?0:10):id==='shield_wall'?20:16}];
    }
    if (['heal','shield','one_time_shield','remove_debuffs','buff'].includes(kind)) {
      return allies(game,unit.team).filter(inRange).map(target => ({x:target.x,y:target.y,score:
        kind === 'heal' ? (target.maxHp-target.hp) * 2 :
        kind === 'shield' ? Math.max(0,25-target.shield) :
        kind === 'one_time_shield' ? (target.oneShield ? 0 : 30) :
        kind === 'remove_debuffs' ? Object.keys(target.statuses).length*25 :
        (unit.used.includes(id) ? 0 : 20)}));
    }
    if (kind === 'self_status') return [{x:unit.x,y:unit.y,score:unit.statuses.stealth ? 0 : 10}];
    if (kind === 'summon' || kind === 'summon_puppet') return cells().filter(p => dist(unit,p) === 1 && game.canOccupy(unit.team,p))
      .map(p => ({...p,score:20 - Math.min(...enemies(game,unit.team).map(e => dist(p,e))) - game.at(p).length*3}));
    if (kind === 'aoe_damage' || kind === 'slow') return cells().filter(inRange).map(p => ({...p,score:
      enemies(game,unit.team).filter(e => dist(e,p) <= (skill.effects[0].radius || 0)).length * 25}));
    if (['damage','drain','stun','debuff','duel','queen_orb','knight_orb','rook_charge','pawn_act','queen_move','knight_leap'].includes(kind)) {
      return enemies(game,unit.team).filter(inRange).map(e => ({x:e.x,y:e.y,score:
        Math.min(e.hp, skill.effects[0].value || unit.attack) + (e.hp <= unit.attack ? 35 : 0)}));
    }
    return [];
  }

  function step(game, team = 'B', options = {}) {
    if (game.phase !== 'battle' || game.team !== team) return false;
    const foes = enemies(game,team);
    if (!foes.length) return false;
    for (const unit of allies(game,team)) {
      if (unit.turnStunned) continue;
      const control=game.controlState(unit);
      if(control&&!control.inRange){const follow=game.followPosition(unit.uid);if(follow&&game.move(unit.uid,follow))return true;continue;}
      const attackRange=DATA.cards[unit.id].attack_range;
      if (unit.ap>0 && attackRange>0) {
        const lethal=foes.find(e => !e.statuses.stealth && dist(unit,e)<=attackRange && !e.oneShield &&
          e.hp+e.shield<=Math.max(0,unit.attack-e.defense));
        if (lethal && game.attack(unit.uid,lethal.uid)) return true;
      }
      const skills = (options.skills===false?[]:game.skillIds(unit)).filter(id => DATA.skills[id]?.type === 'active' && game.canSkill(unit.uid,id));
      const skillOptions = skills.flatMap(id => skillTargets(game,unit,id).map(target => ({id,...target})))
        .sort((a,b) => b.score-a.score);
      for (const option of skillOptions) if (option.score >= 12 && game.useSkill(unit.uid,option.id,option)) return true;
      if (unit.ap > 0) {
        const targets = foes.filter(e => dist(unit,e) <= DATA.cards[unit.id].attack_range && !e.statuses.stealth)
          .sort((a,b) => (a.hp <= unit.attack ? -100 : a.hp) - (b.hp <= unit.attack ? -100 : b.hp));
        if (targets[0] && game.attack(unit.uid,targets[0].uid)) return true;
      }
      if (unit.mp + unit.ap > 0) {
        const nearest = [...foes].sort((a,b) => dist(unit,a)-dist(unit,b))[0];
        const current = dist(unit,nearest);
        const retreat=attackRange>=2 && current<=1;
        const moves = cells().filter(p => dist(unit,p) > 0 && game.canOccupy(team,p,unit.size||1,unit.uid))
          .map(p => ({...p, path:game.pathLength(team,unit,p), distance:dist({...p,size:unit.size||1},nearest)}))
          .filter(p => Number.isFinite(p.path) && p.path <= unit.mp + unit.ap && (retreat ? p.distance>current && p.distance<=attackRange :
            current>attackRange && p.distance<current))
          .map(p=>({...p,risk:options.tactical?foes.reduce((sum,e)=>sum+(dist(p,e)<=DATA.cards[e.id].attack_range+DATA.cards[e.id].move_points?Math.max(0,e.attack-unit.defense):0),0):0}))
          .sort((a,b) => options.tactical&&unit.hp<unit.maxHp*.6?a.risk-b.risk||a.distance-b.distance||a.path-b.path:retreat ? b.distance-a.distance || a.path-b.path : a.distance-b.distance || a.path-b.path);
        if (moves[0] && game.move(unit.uid,moves[0])) return true;
      }
    }
    game.endTurn(); return false;
  }
  window.TacticsAI = {step};
})();
