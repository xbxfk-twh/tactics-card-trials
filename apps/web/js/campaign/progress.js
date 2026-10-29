/* Campaign progression. The adapter can later be replaced with TapTap cloud save. */
(function () {
  'use strict';
  const KEY = 'tactics-progress-v1';
  const INITIAL = 'treent_ancient';
  const ALL = Object.keys(window.GAME_DATA.cards).filter(id =>
    !window.GAME_DATA.cards[id].tags.includes('召唤物'));
  const ALL_SKILLS = Object.keys(window.GAME_DATA.skillCards);
  const PRICE = 30;
  const REWARD_GOLD = 10;
  // Party-only opening encounters. Global cards and the solo campaign stay independent.
  const OPENING = [
    [{id:'slime_small',hp:45,attack:12,x:2,y:4}],
    [{id:'skeleton',hp:48,attack:15,x:2,y:4},{id:'treant_small',hp:38,attack:12,x:4,y:5}],
    [{id:'treant_small',hp:70,attack:18,x:2,y:4},{id:'ranger',hp:60,attack:18,x:4,y:5}],
    [{id:'knight',hp:80,attack:20,defense:3,shield:15,x:2,y:4},{id:'ranger',hp:65,attack:20,x:4,y:5},{id:'pawn',hp:55,attack:17,x:0,y:5}],
    [{id:'slime',hp:75,attack:15,x:2,y:4},{id:'skeleton',hp:55,attack:17,x:4,y:5},{id:'treant_small',hp:60,attack:17,x:0,y:5},{id:'pawn',hp:60,attack:18,x:5,y:4}]
  ];
  function partySize(level){return [1,2,2,3][level-1]||4;}
  function encounter(level){return (OPENING[level-1]||opponents(level).map(id=>({id}))).map((s,i)=>{
    const c=window.GAME_DATA.cards[s.id];return {id:s.id,hp:c.health,attack:c.attack,defense:c.defense||0,shield:c.start_shield||0,x:c.boss?2:[0,4,5,1][i%4],y:c.boss?4:5,...s};
  });}
  function start(game,roster,level,training={},loadout={}){
    if(!Number.isInteger(level)||level<1||level>12||!Array.isArray(roster)||roster.length!==partySize(level)||new Set(roster).size!==roster.length||roster.some(id=>!ALL.includes(id)))return false;
    game.startCampaign(roster,opponents(level),level,training,{...loadout,enemies:encounter(level)});return true;
  }

  function fresh() {
    return {version:1, level:1, gold:0, owned:[INITIAL], ownedSkills:[], equippedSkills:[], pendingReward:false, cleared:[], experience:{}, stars:{}, equippedRelic:null};
  }
  function normalize(value) {
    if (!value || !Array.isArray(value.owned)) return fresh();
    return {
      version:1,
      equippedSkills:[...new Set((Array.isArray(value.equippedSkills)?value.equippedSkills:[]).filter(id=>ALL_SKILLS.includes(id)&&value.ownedSkills?.includes(id)))].slice(0,2),
      stars:Object.fromEntries(Object.entries(value.stars||{}).filter(([level,n])=>Number.isInteger(Number(level))&&Number(level)>=1&&Number(level)<=12&&Number.isInteger(n)&&n>=1&&n<=3)),
      equippedRelic:(window.CampaignContent?.relics||[]).some(r=>r.id===value.equippedRelic&&value.cleared?.includes(r.level))?value.equippedRelic:null,
      experience:Object.fromEntries(ALL.map(id=>[id,Math.max(0,Math.min(280,Math.floor(Number(value.experience?.[id])||0)))])),
      level:Math.max(1, Math.min(12, Math.floor(Number(value.level) || 1))),
      gold:Math.max(0, Math.floor(Number(value.gold) || 0)),
      owned:[...new Set([INITIAL, ...value.owned.filter(id => ALL.includes(id))])],
      ownedSkills:[...new Set((value.ownedSkills || []).filter(id => ALL_SKILLS.includes(id)))],
      pendingReward:!!value.pendingReward,
      cleared:Array.isArray(value.cleared) ? value.cleared.filter(n => Number.isInteger(n) && n >= 1 && n <= 12) : []
    };
  }
  function load() {
    try { return normalize(JSON.parse(localStorage.getItem(KEY))); }
    catch { return fresh(); }
  }
  function save(progress) {
    localStorage.setItem(KEY, JSON.stringify(normalize(progress)));
  }
  function available(progress) { return ALL.filter(id => !progress.owned.includes(id)); }
  function availableSkills(progress) { return ALL_SKILLS.filter(id => !progress.ownedSkills.includes(id)); }
  function count(progress) { return progress.owned.length + progress.ownedSkills.length; }
  function completeLevel(progress, level, roster = []) {
    if (progress.pendingReward || level !== progress.level || progress.cleared.includes(level)) return false;
    progress.experience ||= {};
    for(const id of new Set(roster)) if(progress.owned.includes(id)) progress.experience[id]=Math.min(280,(progress.experience[id]||0)+40);
    progress.gold += REWARD_GOLD;
    progress.cleared.push(level);
    progress.pendingReward = true;
    save(progress); return true;
  }
  function chooseReward(progress, id, kind = 'unit') {
    if (!progress.pendingReward) return false;
    const pool=progress.level<=4 ? available(progress) : [...available(progress),...availableSkills(progress)];
    if (pool.length && !pool.includes(id)) return false;
    if (!pool.length) progress.gold += PRICE;
    else if (kind === 'skill' && availableSkills(progress).includes(id)) progress.ownedSkills.push(id);
    else if (kind === 'unit' && available(progress).includes(id)) progress.owned.push(id);
    else return false;
    progress.pendingReward = false;
    if (progress.level < 12) progress.level++;
    save(progress); return true;
  }
  function buy(progress, id) {
    if (progress.gold < PRICE) return false;
    if (available(progress).includes(id)) progress.owned.push(id);
    else if (availableSkills(progress).includes(id)) progress.ownedSkills.push(id);
    else return false;
    progress.gold -= PRICE; save(progress); return true;
  }
  function onlineWin(progress, matchId) {
    if (!matchId) return false;
    const key = `${KEY}-matches`;
    let awards;
    try { awards = JSON.parse(localStorage.getItem(key)) || []; } catch { awards = []; }
    if (awards.includes(matchId)) return false;
    awards.push(matchId);
    localStorage.setItem(key, JSON.stringify(awards.slice(-100)));
    progress.gold += REWARD_GOLD; save(progress); return true;
  }
  function opponents(level) {
    if(level===6) return ['boss_warden','skeleton','treant_small','pawn'];
    if(level===9) return ['boss_furnace','ranger','slime_small','pawn'];
    if(level===12) return ['boss_crown','knight','mage','skeleton'];
    if (OPENING[level-1]) return OPENING[level-1].map(s=>s.id);
    const formations = [
      ['slime','skeleton','treant_small','pawn'],
      ['knight','ranger','treant_small','skeleton'],
      ['treent_ancient','ranger','berserker','necromancer'],
      ['knight','mage','puppet_master','angel'],
      ['slime','turret','assassin','cleric'],
      ['chessboard','ranger','mage','knight']
    ];
    return formations[(level - 5) % formations.length];
  }
  const TITLES=['林间初遇','骸骨哨站','树灵试炼','前线集结','荒野斥候','苔岩之门','暮色巡游','秘法防线','熔炉深处','棋局迷城','王庭前哨','虚空王座'];
  function unlockedRelics(progress) {return (window.CampaignContent?.relics||[]).filter(r=>progress.cleared.includes(r.level));}
  function equipRelic(progress,id) {
    if(id && !unlockedRelics(progress).some(r=>r.id===id)) return false;
    progress.equippedRelic=id||null;save(progress);return true;
  }
  function equipSkill(progress,id) {
    if(!progress.ownedSkills.includes(id)||!ALL_SKILLS.includes(id))return false;
    progress.equippedSkills ||= [];
    if(progress.equippedSkills.includes(id))progress.equippedSkills=progress.equippedSkills.filter(x=>x!==id);
    else if(progress.equippedSkills.length<2)progress.equippedSkills.push(id);else return false;
    save(progress);return true;
  }
  function recordVictory(progress,game) {
    if(game.mode!=='campaign'||game.phase!=='end'||game.winner!=='A'||!progress.cleared.includes(game.level)) return null;
    const party=game.picks.A.filter(c=>c.kind==='unit');if(!party.length)return null;
    const survivors=game.units.filter(u=>u.team==='A'&&u.hp>0&&u.campaignOriginal).length;
    const par=window.CampaignContent?.stage(game.level)?.parRounds||8;
    const stars=1+Number(survivors===party.length)+Number(game.round<=par);
    progress.stars ||= {};
    const previous=progress.stars[game.level]||0;
    const bonusGold=Math.max(0,stars-Math.max(1,previous))*5;
    progress.stars[game.level]=Math.max(previous,stars);progress.gold+=bonusGold;save(progress);
    return {stars,best:progress.stars[game.level],bonusGold,survivors,party:party.length,par};
  }
  function rank(progress,id) {return 1+[40,100,180,280].filter(n=>(progress.experience?.[id]||0)>=n).length;}
  function train(progress,id) {
    if(!progress.owned.includes(id) || progress.gold<10 || rank(progress,id)>=5) return false;
    progress.experience ||= {};progress.experience[id]=Math.min(280,(progress.experience[id]||0)+40);
    progress.gold-=10;save(progress);return true;
  }
  window.CampaignProgress = {normalize, unlockedRelics, equipRelic, equipSkill, recordVictory, TITLES, rank, train,ALL, ALL_SKILLS, PRICE, REWARD_GOLD, fresh, load, save, available, availableSkills, count,
    completeLevel, chooseReward, buy, onlineWin, opponents,partySize,encounter,start};
})();
