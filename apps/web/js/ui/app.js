(function () {
  'use strict';
  const game = new window.TacticsGame();
  const DATA = window.GAME_DATA;
  const Progress = window.CampaignProgress;
  const progress = Progress.load();
  const Content = window.CampaignContent;
  const Solo=window.SoloCampaign, solo=Solo.load();
  let soloStage=Math.min(9,solo.cleared.length+1), soloSlot=0, soloStoryPage=0;
  let selectedStage = null, campPanel=null, campOpener=null, campFocus=null;
  const effects=new window.BattleEffects();
  const UnitUI=window.UnitPresentation,sfx=new window.SkillAudio();
  const music=new window.GameMusic(sfx);
  let matchMenu=false,matchExit=false;
  let stackConfirm=null, finishing=false, finishTimer=null, pendingActor=null;
  const app = document.getElementById('app');
  let infoId=null, infoContext=null, infoOpener=null, stateInfo=null, held=false, pressTimer=null;
  let view = 'home', deployCard = null, lineup = [], onlineMessage = '', onlineError = '', onlineConnected = null,
    aiTimer = null, targetChoices = null;
  const online = new window.OnlineClient(onOnline);
  const Practice=window.PracticeMode;
  let roomList=[],roomFilter='all',lobbyCount=0,resetOnlineAudio=false;
  const hubForm={mode:'casual',title:'',description:'',server:'',nickname:localStorage.getItem('tactics-nickname')||'',code:''};
  const practiceOptions={difficulty:'standard',format:'quick',preset:'balanced'};
  let lobbyTimer=null;
  const tapOnline = !!window.TapOnlineClient?.supported();

  const h = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const art = id => `assets/characters/${h(DATA.cards[id]?.image || 'angel.webp')}`;
  const CardUI=window.CardPresentation;
  const ability = (id,context=null) => {
    if(id?.startsWith('hero-passive:')){const p=Solo.passives.find(p=>p.id===id.slice(13));return p?{...p,type:'passive',icon:DATA.skills[p.icon].icon}:null;}
    const unit=context?.uid!==undefined?game.unit(context.uid):!context?.card&&view==='game'?game.unit(game.selected):null;
    return unit?.skillBook?.[id]||(context?.card==='ember_hero'&&game.campaignId==='solo'?game.heroSpec?.book?.[id]:null)||DATA.skills[id]||DATA.skillCards[id]||DATA.bossSkills?.[id];
  };
  const skillArt = id => `assets/icons/${h(ability(id)?.icon || 'orb.png')}`;
  const skillIcon = id => `<img class="skill-icon" data-skill-icon="${h(id)}" src="${skillArt(id)}" alt="" aria-hidden="true" width="32" height="32" decoding="async">`;
  const skillKind = s => s?.type==='active'?'主动':s?.type==='passive'?'被动':s?.type==='boss'?'首领蓄力':'技能卡';
  const cardSkillIds = card => [...(card===DATA.cards.ember_hero&&game.campaignId==='solo'?(game.heroSpec?.skills||[]):card.skills),...(card.displaySkills||[])];
  const skillEntry = id => `<div class="skill-entry">${skillIcon(id)}<div><b>${h(ability(id)?.name||id)}</b><span class="skill-kind">${skillKind(ability(id))}</span><p>${h(ability(id)?.description||'')}</p></div></div>`;
  const turnClock=()=>game.mode==='online'&&online.metadata?.deadline?`<span class="turn-clock" data-deadline="${online.metadata.deadline}">${Math.max(0,Math.ceil((online.metadata.deadline-Date.now())/1000))} 秒</span>`:'';
  setInterval(()=>{for(const el of app.querySelectorAll('.turn-clock')){const seconds=Math.max(0,Math.ceil((Number(el.dataset.deadline)-Date.now())/1000));el.textContent=seconds+' 秒';el.classList.toggle('urgent',seconds<=15);}},1000);
  const teamName = team => team === 'A' ? '蓝方' : '红方';
  const isMyTurn = () => game.mode === 'online' ? game.team === online.seat : !['campaign','practice'].includes(game.mode) || game.team === 'A';
  const stats=(id,options={})=>CardUI.stats(DATA.cards[id],{...options,spec:id==='ember_hero'&&game.campaignId==='solo'?game.heroSpec:null});
  const skillGrid=(id,uid=null)=>CardUI.skills(cardSkillIds(DATA.cards[id]),{cardId:id,uid});
  const statusName = {stun:'眩晕',slow:'减速',stealth:'隐匿',mark:'易伤'};
  const campaignLevel = () => selectedStage || progress.level;
  const rosterSize = () => Progress.partySize(campaignLevel());
  function presentState() {
    syncResult(false);
    if(game.phase==='end'&&view==='game') {
      finishing=true;clearTimeout(finishTimer);const epoch=game.visualEpoch;
      render();finishTimer=setTimeout(()=>{finishing=false;if(game.visualEpoch===epoch&&view==='game'){syncResult();render();}},700);
    } else render();
  }
  function send(action, payload, local, confirmed=false) {
    if(!confirmed){const plan=window.StackingConfirmation.proposal(game,action,payload);if(plan){stackConfirm={...plan,action,payload,local};sfx.feedback('open');render();return false;}}
    if(action==='deploy')deployCard=null;
    if (game.mode === 'online') {
      const previous=pendingActor;
      if(['move','attack','skill'].includes(action))pendingActor=payload.uid;
      const sent=online.send(action,payload);
      if(!sent)pendingActor=previous;
      return sent;
    }
    const done = local();
    if (done) {if(game.mode==='practice'&&game.practiceStats){const kind=action==='attack'?'attack':action==='move'?'move':['skill','hand'].includes(action)?'skill':null;if(kind)game.practiceStats[kind]++;}presentState(); scheduleAI();}
    else {sfx.feedback('error');render();}
    return done;
  }
  function onOnline(data) {
    if(data.type==='rooms'){roomList=(data.rooms||[]).map(r=>r.code?r:{...r,code:r.id,title:r.name,phase:'menu',mode:'casual',canJoin:(r.players?.length||0)<2});lobbyCount=data.online||0;if(view==='online')render();return;}
    if(['welcome','profile','connection'].includes(data.type)){if(data.profile)online.profile=data.profile;if(data.type==='connection'&&data.status==='connected')onlineError='';if(view==='online')render();return;}
    if(data.type==='left'||data.type==='room_closed'){clearTimeout(finishTimer);finishing=false;campPanel=null;matchMenu=matchExit=false;if(game.mode==='online')game.reset();view='online';onlineMessage=data.message||'已离开房间。';onlineError='';render();return;}
    if(data.type==='joined'){campPanel=null;resetOnlineAudio=true;if(data.metadata)online.metadata=data.metadata;}

    if (data.type === 'joined') onlineMessage = `房间 ${data.room} · 你是${teamName(data.seat)}`;
    if (data.type === 'presence') onlineConnected=data.connected;
    if (data.type === 'state') {
      stackConfirm=null;
      targetChoices=null;
      const selected=game.selected, actor=pendingActor;pendingActor=null;
      if(data.metadata)online.metadata=data.metadata;
      game.restore(data.state); game.mode='online'; game.matchId=data.matchId;
      if(resetOnlineAudio){sfx.rebase(game);resetOnlineAudio=false;}
      const inspected=game.unit(selected);
      if (selected && inspected?.team===online.seat && game.team===online.seat &&
          !(selected===actor&&inspected.mp<=0&&inspected.ap<=0)) game.selected=selected;
      onlineConnected=data.connected;onlineError='';
      if (game.phase !== 'menu') view='game';
      if (game.phase === 'end' && game.winner === online.seat) Progress.onlineWin(progress,data.matchId);
    }
    if (data.type === 'error' || data.type === 'disconnected') {pendingActor=null;onlineMessage=data.message;onlineError=data.message;}
    if(data.type==='state')presentState();else render();
  }
  function syncResult(reveal=true) {
    if(game.campaignId==='solo'){if(game.phase==='end'&&game.winner==='A'&&game.soloReward===null)game.soloReward=Solo.complete(solo,game);return;}
    if (game.mode === 'campaign' && game.phase === 'end' && game.winner === 'A') {
      Progress.completeLevel(progress,game.level,game.picks.A.map(c=>c.id));
      if(!game.campaignResult)game.campaignResult=Progress.recordVictory(progress,game);
      if (progress.pendingReward&&reveal) view='reward';
    }
  }
  function scheduleAI() {
    clearTimeout(aiTimer);
    if(game.mode==='practice'){if(game.team!=='B'||!['draft','deploy','battle'].includes(game.phase))return;aiTimer=setTimeout(()=>{Practice.step(game);presentState();scheduleAI();},260);return;}
    if (game.mode !== 'campaign' || game.phase !== 'battle' || game.team !== 'B') return;
    aiTimer=setTimeout(() => {
      window.TacticsAI.step(game); presentState(); scheduleAI();
    }, 220);
  }
  function header() {
    if(UnitUI.active(game))return `<header class="top match-header"><div><div class="brand">战棋 · 卡牌试炼</div><div class="sub">${game.phase==='draft'?'选卡推演':game.phase==='deploy'?'部署阵容':'对局进行中'}</div></div><nav class="nav">${view!=='game'?'<button class="btn" data-action="continue">返回对局</button>':''}${game.mode==='online'&&online.status!=='connected'?'<button class="btn primary" data-action="resume-room">断线重连</button>':''}<button class="btn" data-action="match-menu">本局菜单</button></nav></header>`;
    return `<header class="top"><div><div class="brand">战棋 · 卡牌试炼</div><div class="sub">TACTICS & CARD DUEL</div></div>
      <nav class="nav"><button class="btn ${view==='home'?'active':''}" data-action="home">主页</button>
      <button class="btn ${['campaign','campaigns','solo'].includes(view)?'active':''}" data-action="campaign">战役</button>
      <button class="btn ${view==='online'?'active':''}" data-action="online">联机</button><button class="btn ${view==='practice'?'active':''}" data-action="practice">练习</button><button class="btn ${view==='shop'?'active':''}" data-action="shop">商店</button>
      <button class="btn ${view==='atlas'?'active':''}" data-action="atlas">图鉴</button>
      ${game.phase !== 'menu' ? '<button class="btn" data-action="continue">继续对局</button>' : ''}</nav></header>`;
  }
  function cardTile(id, action='', label='') {
    const c=DATA.cards[id],rank=progress.owned.includes(id)?Progress.rank(progress,id):1;
    return `<article class="card"><img src="${art(id)}" alt="${h(c.name)}"><div class="body"><strong>${h(c.name)}</strong>
      <p class="card-description">${h(c.description)}</p>${stats(id,{rank})}${skillGrid(id)}
      ${progress.owned.includes(id)?`<span class="card-growth">Lv.${rank} · ${progress.experience?.[id]||0} 经验</span><button class="btn train" data-action="train" data-id="${id}" ${progress.gold<10||rank>=5?'disabled':''}>训练 · 10 金币</button>`:''}
      ${action ? `<button class="btn primary card-main-action" data-action="${action}" data-id="${h(id)}" ${action==='buy'&&progress.gold<Progress.PRICE?'disabled':''}>${h(label)}</button>` : ''}</div></article>`;
  }
  function skillTile(id, action='', label='') {
    const c=DATA.skillCards[id];
    return `<article class="card skill-card"><img src="${skillArt(id)}" alt="${h(c.name)}"><div class="body"><strong>${h(c.name)}</strong><span class="tag">纯技能卡</span>${CardUI.skills([id])}
      ${progress.ownedSkills.includes(id)?'<span class="tag">已拥有</span>':''}
      ${action?`<button class="btn primary card-main-action" data-action="${action}" data-id="${id}" data-kind="skill" ${action==='buy'&&progress.gold<Progress.PRICE?'disabled':''}>${h(label)}</button>`:''}</div></article>`;
  }
  function home() {
    const bosses=['boss_warden','boss_furnace','boss_crown'];
    return `<main class="panel hero illustrated-home"><section class="hero-scene">
      <picture class="hero-landscape"><source media="(max-width:600px)" srcset="assets/backgrounds/campaign-hero-mobile-v1.webp"><img src="assets/backgrounds/campaign-hero-v1.webp" alt="古树、骑士与游侠站在云海森林中的古老棋盘上，远方是熔炉火山与紫晶王城" fetchpriority="high" width="1536" height="1024"></picture>
      <div class="hero-copy"><span class="hero-eyebrow">THE ANCIENT TRIALS / 古树试炼</span><h1>从一棵古树开始</h1>
      <p>集结你的棋子，走向更远的战场。<br>集结队伍，或让专属主角独自成长。</p>
      <div class="home-actions"><button class="btn primary" data-action="campaign">选择战役 <span>队伍 / 独行 →</span></button><button class="btn" data-action="online">星海会馆 ↗</button></div>
      <div class="hero-progress"><span>收集 ${Progress.count(progress)} / ${Progress.ALL.length+Progress.ALL_SKILLS.length}</span><span>首通 ${progress.cleared.length} / 12</span><span>金币 ${progress.gold}</span></div></div></section>
      <div class="home-features"><div><strong>01 / 收集与成长</strong><span>从一名伙伴到四人队伍。收集新棋子，培养至 5 级，搭配彼此的技能。</span></div><div><strong>02 / 观察与应对</strong><span>阅读首领的蓄力预警，用走位与协作破解 2×2 巨型敌人的攻势。</span></div><div><strong>03 / 好友对弈</strong><span>房间码邀请，公平基础属性。手机长按技能，即可查看完整说明。</span></div></div>
      <section class="boss-showcase"><div class="showcase-heading"><div><span class="sub">GUARDIANS OF THE REALM</span><h2>前路的守关者</h2></div><button class="btn" data-action="campaign">查看战役 →</button></div>
      <div class="boss-gallery">${bosses.map((id,i)=>`<article class="boss-portrait boss-theme-${i}"><div class="boss-portrait-art"><span class="boss-chapter">CHAPTER ${String([6,9,12][i]).padStart(2,'0')}</span><img src="${art(id)}" alt="${h(DATA.cards[id].name)}独立立绘" width="512" height="512" loading="lazy"></div><div class="boss-caption"><small>${['苔岩之门 / 森林守卫','熔炉深处 / 炽热铁甲','虚空王座 / 紫晶王权'][i]}</small><h3>${h(DATA.cards[id].name)}</h3><span class="boss-ability-label">${skillIcon(DATA.cards[id].bossAbility)}${h(DATA.cards[id].ability)} · 2×2 首领</span></div></article>`).join('')}</div></section></main>`;
  }
  function relicPicker() {
    const relics=Progress.unlockedRelics(progress);if(!relics.length)return '';
    return `<section class="relic-section"><h2 class="section-title">首领遗物 <span class="tag">点击装备 · 每场一件 · 自动生效</span></h2><div class="relic-grid"><button class="relic-card ${!progress.equippedRelic?'active':''}" data-action="relic" data-id=""><b>不携带</b><span>按基础阵容迎战。</span></button>${relics.map(r=>`<button class="relic-card ${progress.equippedRelic===r.id?'active':''}" data-action="relic" data-id="${r.id}"><img src="${art(r.art)}" alt=""><div><b>${h(r.name)}</b><span>${h(r.description)}</span><small>“${h(r.memory)}”</small></div></button>`).join('')}</div></section>`;
  }
  function itemPicker() {
    return `<section class="relic-section"><h2>战役道具 <span class="tag">技能卡 ${progress.equippedSkills.length}/2</span></h2><p class="muted">先在这里携带；战斗时点击手牌，再点高亮格施放。每张每场可用一次，拥有权不会消失，下场重新补齐。ⓘ 或长按可查看说明。</p><div class="relic-grid">${progress.ownedSkills.map(id=>`<div class="relic-card ${progress.equippedSkills.includes(id)?'active':''}">${skillIcon(id)}<div><b>${h(DATA.skillCards[id].name)}</b><p>${h(DATA.skillCards[id].description)}</p><button class="btn" data-action="equip-skill" data-id="${id}" ${!progress.equippedSkills.includes(id)&&progress.equippedSkills.length>=2?'disabled':''}>${progress.equippedSkills.includes(id)?'已携带 · 卸下':'携带进战斗'}</button></div></div>`).join('')||'<p class="muted">还没有技能卡，可在商店购买或第 5 关起的首通奖励中选择。</p>'}</div><details><summary>地上的 ✦ 养料怎么用？</summary><p>将棋子移动到 ✦ 所在格自动拾取，本场生命与生命上限各 +5；战后不保留，不需要在背包使用。</p></details></section>`;
  }
  function lineupPicker() {
    const needed=rosterSize();
    return `<h2 class="section-title">选择出战角色 · ${lineup.length}/${needed}</h2><p class="camp-help">${lineup.map(id=>h(DATA.cards[id].name)).join('、')}。本关需要 ${needed} 人；前四关按 1→2→2→3 人扩编，第五关起 4 人。点已选角色可卸下。</p><div class="mini-grid">${progress.owned.map(id=>`<article class="roster-card ${lineup.includes(id)?'active':''}"><button class="roster" data-action="lineup" data-id="${id}"><img src="${art(id)}" alt=""><span>${h(DATA.cards[id].name)} · Lv.${Progress.rank(progress,id)}</span></button>${stats(id,{rank:Progress.rank(progress,id)})}${skillGrid(id)}</article>`).join('')}</div>`;
  }
  function campaignModal() {
    if(!campPanel)return '';
    if(view==='game')return battleModal();
    if(view==='online')return window.RoomView.modal(hubState(),campPanel);
    if(view==='solo')return window.SoloView.modal(solo,soloStage,soloSlot,campPanel);
    if(view!=='campaign')return '';
    const level=campaignLevel(),chapter=Content.stage(level);
    if(campPanel==='lineup')return window.SoloView.dialog('出战阵容',lineupPicker(),'lineup');
    if(campPanel==='items')return window.SoloView.dialog('遗物与战役道具',`<p class="camp-help">遗物装备后自动生效；技能卡携带进战斗后，从手牌使用，每张每场一次，下场补齐。</p>${relicPicker()||'<p class="camp-help">首领遗物尚未解锁，第 6 / 9 / 12 关首通后获得。</p>'}${itemPicker()}`,'items');
    if(campPanel==='briefing')return window.SoloView.dialog('关卡档案 · '+Progress.TITLES[level-1],`<section class="story-briefing"><h2>${h(chapter.subtitle)}</h2><p>${h(chapter.story)}</p><p>${h(chapter.tip)}</p><p>★ 获得胜利　★ 出战角色全部生还　★ 在 ${chapter.parRounds} 回合内获胜</p><small>额外星级每颗奖励 5 金币，只能领取一次；回访不重复发放首通卡牌、金币与经验。</small></section>${Progress.opponents(level).filter(id=>DATA.cards[id].boss).map(id=>`<h3>${h(DATA.cards[id].name)}</h3>${cardSkillIds(DATA.cards[id]).map(skillEntry).join('')}<p class="camp-help">${h(DATA.cards[id].description)}</p>`).join('')}`,'briefing',true);
    return '';
  }
  function campaign() {
    if (progress.pendingReward) return reward();
    const level=campaignLevel(), chapter=Content.stage(level), needed=rosterSize(), replay=progress.cleared.includes(level);
    lineup=lineup.filter(id => progress.owned.includes(id)).slice(0,needed);
    if (!lineup.length) lineup=[...progress.owned.slice(0,needed)];
    const relic=Content.relics.find(r=>r.id===progress.equippedRelic);
    return `<main class="panel stage compact-camp party-camp"><header class="camp-heading"><div><span class="sub">ANCIENT TRIALS / 古树试炼</span><h1>${progress.cleared.includes(12)?'森林已重获新生':'队伍的营地'}</h1></div><button class="btn" data-action="campaign">切换战役</button></header><div class="camp-dashboard"><section class="camp-character party-character"><div class="camp-route-label"><b>当前出战阵容</b><span>${lineup.length}/${needed} 人</span></div><div class="camp-party">${Array.from({length:needed},(_,i)=>lineup[i]?`<button data-action="camp-open" data-id="lineup"><img src="${art(lineup[i])}" alt=""><b>${h(DATA.cards[lineup[i]].name)}</b><small>Lv.${Progress.rank(progress,lineup[i])}</small></button>`:'<button data-action="camp-open" data-id="lineup"><span>＋</span><small>选择角色</small></button>').join('')}</div><div class="camp-config-grid party-config"><button class="camp-config-button" data-action="camp-open" data-id="lineup">${skillIcon('summon_treant')}<span>调整阵容<small>选择出战角色</small></span><b>↗</b></button><button class="camp-config-button" data-action="camp-open" data-id="items">${skillIcon('shield')}<span>遗物与道具<small>${relic?h(relic.name):'未携带遗物'} · 技能卡 ${progress.equippedSkills.length}/2</small></span><b>↗</b></button></div><div class="camp-party-summary"><span>收集 ${progress.owned.length} 名角色</span><span>金币 ${progress.gold}</span></div></section>
      <section class="camp-expedition"><div class="camp-route-label"><b>章节路线</b><span>第 ${level} / 12 关 · ${replay?'回访挑战':'首次挑战'}</span></div><div class="camp-route party-route">${Progress.TITLES.map((title,i)=>{const n=i+1,open=n===progress.level||progress.cleared.includes(n);return `<button class="camp-chapter ${n===level?'current':''} ${progress.cleared.includes(n)?'cleared':''}" data-action="stage-select" data-id="${n}" ${open?'':'disabled'} title="${h(title)}" aria-label="第 ${n} 关 ${h(title)}" aria-current="${n===level?'step':'false'}"><b>${progress.cleared.includes(n)?'✓':String(n).padStart(2,'0')}</b><span>${h(title)}</span><small>${[6,9,12].includes(n)?'BOSS':'★'.repeat(progress.stars?.[n]||0)}</small></button>`;}).join('')}</div>
      <section class="camp-mission"><div class="camp-mission-title"><span class="tag">${Progress.TITLES[level-1]}</span><button class="btn" data-action="camp-open" data-id="briefing">关卡档案 ⓘ</button></div><h2>${h(chapter.subtitle)}</h2><p class="camp-lore">${h(chapter.story)}</p><p class="camp-tip"><b>战术提示</b>${h(chapter.tip)}</p></section><section class="camp-enemies"><div class="camp-route-label"><b>敌方情报</b><small>星级目标：生还 / ${chapter.parRounds} 回合</small></div><div class="camp-enemy-grid">${Progress.encounter(level).map(({id,hp,attack})=> `<article><img src="${art(id)}" alt=""><div><b>${h(DATA.cards[id].name)}</b><small>生命 ${hp} · 攻击 ${attack}</small></div>${DATA.cards[id].boss?'<span class="tag">2×2</span>':''}</article>`).join('')}</div></section></section></div>
      <footer class="camp-launch"><p><b>${replay?'回访挑战':'首通奖励'}</b><span>${replay?'提升星级可补领金币':'新卡 + 10 金币 + 出战经验'}</span></p><button class="btn" data-action="shop">商店</button><button class="btn primary" data-action="stage-start" ${lineup.length===needed?'':'disabled'}>${replay?'回访':'进入'}第 ${level} 关 →</button></footer></main>`;
  }
  function reward() {
    const available=[...Progress.available(progress).map(id=>({id,kind:'unit'})),
      ...(progress.level<=4?[]:Progress.availableSkills(progress).map(id=>({id,kind:'skill'})))];
    const catalog=[...Progress.ALL,...Progress.ALL_SKILLS];
    const ordered=available.sort((a,b) => ((catalog.indexOf(a.id)+progress.level*5)%catalog.length)-
      ((catalog.indexOf(b.id)+progress.level*5)%catalog.length));
    return `<main class="panel stage"><h1>第 ${progress.level} 关胜利</h1>${victoryMemory(progress.level)}${challengeResult()}<p>已获得 10 金币，每名出战角色获得 40 经验。选择一张新卡：</p>
      <div class="card-grid">${ordered.slice(0,3).map(item => item.kind==='skill'?skillTile(item.id,'reward-choose','领取此卡'):cardTile(item.id,'reward-choose','领取此卡')).join('')}</div>
      ${!available.length ? '<button class="btn primary" data-action="reward-choose">已集齐全部角色，卡牌奖励改为 30 金币</button>' : ''}</main>`;
  }
  function shop() {
    return `<main class="panel stage"><div class="gameinfo"><h2 class="section-title">角色商店</h2><span class="pill">金币 ${progress.gold}</span></div>
      <p class="muted">每张未拥有的卡 ${Progress.PRICE} 金币；闯关胜利每关获得 10 金币，联机胜利也获得 10 金币。</p>
      <div class="card-grid">${Progress.ALL.map(id => cardTile(id,progress.owned.includes(id)?'':'buy',progress.gold>=Progress.PRICE?`购买 · ${Progress.PRICE} 金币`:`需要 ${Progress.PRICE} 金币`)).join('')}
        ${Progress.ALL_SKILLS.map(id => skillTile(id,progress.ownedSkills.includes(id)?'':'buy',progress.gold>=Progress.PRICE?`购买 · ${Progress.PRICE} 金币`:`需要 ${Progress.PRICE} 金币`)).join('')}</div></main>`;
  }
  function atlas() {
    return `<main class="panel stage"><h2 class="section-title">卡牌图鉴 · ${Progress.count(progress)}/${Progress.ALL.length+Progress.ALL_SKILLS.length}</h2>
      <details class="ability-catalog"><summary>技能图标与说明 · ${Object.keys(DATA.skills).length+Object.keys(DATA.skillCards).length+Object.keys(DATA.bossSkills).length} 项</summary><div class="ability-grid">${[...Object.keys(DATA.skills),...Object.keys(DATA.skillCards),...Object.keys(DATA.bossSkills)].map(id=>`<button class="ability-tile" data-action="info" data-info="${id}" data-id="${id}">${skillIcon(id)}<span>${h(ability(id).name)}<small>${skillKind(ability(id))}</small></span></button>`).join('')}</div></details><div class="card-grid">${Progress.ALL.map(id => cardTile(id)).join('')}${Progress.ALL_SKILLS.map(id=>skillTile(id)).join('')}</div></main>`;
  }
  function hubState(){return {online,rooms:roomList,filter:roomFilter,onlineCount:lobbyCount,form:hubForm,message:onlineMessage,error:onlineError};}
  function onlineLobby(){
    if(tapOnline)return `<main class="panel stage tap-lobby"><span class="sub">TAPTAP / 平台棋局</span><h1>与朋友下一局</h1><p class="camp-help">当前使用 TapTap 房间。收集至少十张卡与四名角色后，可按平台房间 ID 加入。平台对局不参与自有服务器的星图排位。</p><div class="home-actions"><button class="btn primary" data-action="create-room" ${Progress.count(progress)>=10?'':'disabled'}>创建平台房间</button><button class="btn" data-action="match-room" ${Progress.count(progress)>=10?'':'disabled'}>随机匹配</button><button class="btn" data-action="refresh-rooms">刷新房间</button></div><div class="social-bottom"><label>房间 ID<input id="room-code" data-hub-field="code" value="${h(hubForm.code)}" placeholder="朋友分享的房间 ID"></label><button class="btn" data-action="join-room">加入</button><button class="btn" data-action="leave-room">离开</button></div><p class="camp-help">当前房间：${h(online.room||'未加入')} · ${h(onlineMessage)}</p><div class="room-list">${roomList.map(r=>`<article class="public-room"><h3>${h(r.title||'平台棋局')}</h3><p>${h(r.code)}</p><button class="btn" data-action="join-listed" data-id="${h(r.code)}">加入</button></article>`).join('')||'<p class="camp-help">暂无可加入的房间，可以创建并分享房间 ID。</p>'}</div>${onlineError?`<p class="social-error">${h(onlineError)}</p>`:''}</main>`;
    return window.RoomView.lobby(hubState());
  }
  function draft() {
    return `<div class="layout"><main class="panel"><div class="gameinfo"><span class="pill">选卡 ${game.draftCount+1}/8</span>
      <span class="pill">${teamName(game.team)}选择</span>${turnClock()}</div><h2 class="section-title">三选一</h2>
      <div class="card-grid draft-grid">${game.candidates.map((item,index) => {
        const c=item.kind==='skill'?DATA.skillCards[item.id]:DATA.cards[item.id];
        return `<article class="card"><img src="${item.kind==='skill'?skillArt(item.id):art(item.id)}" alt="${h(c.name)}">
          <div class="body"><strong>${h(c.name)}</strong><span class="tag">${item.kind==='skill'?'纯技能卡':'角色卡'}</span>
          ${item.kind==='unit'?`${stats(item.id)}${skillGrid(item.id)}`:CardUI.skills([item.id])}
          <button class="btn primary card-main-action" data-action="pick" data-index="${index}" ${isMyTurn()?'':'disabled'}>选择此卡</button></div></article>`;
      }).join('')}</div></main><aside class="panel side"><h2 class="section-title">已选阵容</h2>
        ${['A','B'].map(team => `<p><b>${teamName(team)}</b>：${game.picks[team].map(c=>h(game.cardName(c))).join('、')||'暂无'}</p>`).join('')}
        ${battleLog()}</aside></div>`;
  }
  function targetCandidates(type,id,uid,pos,stack) {
    if (type==='attack') return stack.filter(u=>u.team!==game.team &&
      game.canTarget('attack',uid,null,pos,u.uid));
    if (type==='hand' && id==='heal_aura') return stack.filter(u=>u.team===game.team &&
      game.canTarget('hand',uid,id,pos,u.uid));
    if (type!=='skill') return [];
    const kind=DATA.skills[id]?.effects[0]?.type;
    const ally=['heal','shield','one_time_shield','remove_debuffs','buff'].includes(kind);
    const enemy=['damage','drain','stun','debuff','duel','queen_orb','knight_orb'].includes(kind);
    if (!ally && !enemy) return [];
    return stack.filter(u=>(ally?u.team===game.team:u.team!==game.team) &&
      game.canTarget('skill',uid,id,pos,u.uid));
  }
  function cellOptions(pos,stack=game.at(pos)) {
    if (game.phase!=='battle' || !isMyTurn()) return {};
    const uid=game.selected, unit=game.unit(uid), intent=game.intent;
    if (intent?.type==='hand') {
      const cast=intent.id==='fire_rain' ? game.units.some(u=>u.team!==game.team &&
        u.x<=pos.x+1 && u.x+(u.size||1)-1>=pos.x-1 && u.y<=pos.y+1 && u.y+(u.size||1)-1>=pos.y-1) : true;
      return {cast:cast && (game.canTarget('hand',uid,intent.id,pos) ||
        targetCandidates('hand',intent.id,uid,pos,stack).length>0)};
    }
    if (!unit || unit.team!==game.team) return {};
    if (intent?.type==='skill') {
      const kind=DATA.skills[intent.id]?.effects[0]?.type;
      if (['heal','shield','one_time_shield','remove_debuffs','buff'].includes(kind) &&
          !stack.some(u=>u.team===game.team)) return {};
      return {cast:game.canTarget('skill',uid,intent.id,pos) ||
        targetCandidates('skill',intent.id,uid,pos,stack).length>0};
    }
    return {
      move:game.canTarget('move',uid,null,pos),
      attack:stack.some(u=>u.team!==game.team && game.canTarget('attack',uid,null,pos,u.uid))
    };
  }
  function board() {
    const cells=[];
    const inspected=game.unit(game.selected),controlOwner=inspected?.ownerUid?game.unit(inspected.ownerUid):inspected?.id==='puppet_master'?inspected:null;
    for (let y=0;y<6;y++) for (let x=0;x<6;x++) {
      const pos={x,y}, stack=game.at(pos), top=stack.find(u=>u.uid===game.selected)||stack.at(-1);
      let cls='cell';
      if(controlOwner&&Math.abs(x-controlOwner.x)+Math.abs(y-controlOwner.y)<=2)cls+=' control-zone';
      if(game.threats.some(t=>game.unit(t.uid)&&t.cells.some(p=>p.x===x&&p.y===y))) cls+=' threatened';
      if(top?.size===2) cls+=' boss-cell';
      if(stack.length>1)cls+=' has-stack';
      if (game.phase==='deploy' && deployCard && isMyTurn() &&
          (game.deployTeam==='A'?y<=1:y>=4) && game.canOccupy(game.deployTeam,pos)) cls+=' valid';
      if (game.phase==='battle' && isMyTurn() && (game.selected || game.intent?.type==='hand')) {
        const options=cellOptions(pos,stack);
        if (options.move) cls+=' valid';
        else if (options.attack) cls+=' attackable';
        else if (options.cast) cls+=' castable';
        if (stack.some(u=>u.uid===game.selected)) cls+=' chosen';
      }
      const figure=top && top.size!==2 ? `<span class="unit ${top.team} ${top.uid===game.selected?'selected':''} ${UnitUI.classes(game,top)}"><img src="${art(top.id)}" alt="${h(DATA.cards[top.id].name)}">${UnitUI.overlay(game,top)}</span><span class="unit-state-badges">${UnitUI.badges(game,top,true)}</span>
        <span class="cell-hp">${top.hp}${top.shield?` <span class="cell-shield" aria-label="护盾 ${top.shield}">+${top.shield}</span>`:""}</span><span class="hp"><i style="width:${Math.max(0,100*top.hp/top.maxHp)}%"></i></span>${stack.length>1?`<span class="stack">${stack.length}</span><span class="stack-members" aria-label="其他叠放成员">${stack.filter(u=>u.uid!==top.uid).map(u=>`<span class="stack-member ${UnitUI.classes(game,u)}" data-member="${u.uid}" title="${h(DATA.cards[u.id].name)}：生命 ${u.hp}/${u.maxHp}，护盾 ${u.shield}，行动 ${u.ap}，移动 ${u.mp}；${h(UnitUI.detail(game,u))}"><img src="${art(u.id)}" alt="${h(DATA.cards[u.id].name)}"><small>${u.hp}</small><i class="member-life" style="--member-hp:${Math.max(0,100*u.hp/u.maxHp)}%"></i><span class="member-state">${UnitUI.states(game,u)[0]?.glyph||''}</span><span class="member-points"><i class="${u.ap?'has-ap':''}"></i><i class="${u.mp?'has-mp':''}"></i></span></span>`).join('')}</span>`:''}` : '';
      cells.push(`<button class="${cls}" data-action="cell" data-x="${x}" data-y="${y}" title="${'ABCDEF'[x]}${y+1}">
        <span class="coord">${'ABCDEF'[x]}${y+1}</span>${figure}${game.pickups?.some(p=>p.x===x&&p.y===y)?'<span class="pickup">✦</span>':''}</button>`);
    }
    const tether=inspected?.ownerUid&&controlOwner?`<svg class="control-tether ${game.controlState(inspected).inRange?'':'broken'}" viewBox="0 0 600 600" aria-hidden="true"><path d="M${controlOwner.x*100+50} ${controlOwner.y*100+50} L${inspected.x*100+50} ${inspected.y*100+50}"/><circle cx="${controlOwner.x*100+50}" cy="${controlOwner.y*100+50}" r="10"/></svg>`:'';
    return `<div class="board-wrap"><div class="board">${cells.join('')}${tether}${game.units.filter(u=>u.size===2).map(u=>`<div class="boss-figure ${UnitUI.classes(game,u)}" style="left:${u.x/6*100}%;top:${u.y/6*100}%;"><img src="${art(u.id)}" alt="${h(DATA.cards[u.id].name)}">${UnitUI.overlay(game,u)}<span class="unit-state-badges">${UnitUI.badges(game,u,true)}</span><b>${h(DATA.cards[u.id].name)} ${u.enraged?'· 狂暴':''}<br>生命 ${u.hp}/${u.maxHp}</b></div>`).join('')}</div></div>`;
  }
  function deploy() {
    const team=game.deployTeam;
    return `<div class="layout battle-layout deploy-layout"><main class="panel battle-field"><div class="gameinfo"><span class="pill">部署阶段</span><span class="pill">${teamName(team)}</span>${turnClock()}
      <span class="muted">${team==='A'?'上方':'下方'}两排</span></div><div class="battle-board-space">${board()}</div></main>
      <aside class="panel side battle-side"><h2 class="section-title">待部署角色</h2><div class="side-list">
        ${game.remaining(team).map(c => `<article class="roster-card ${deployCard===c.id?'active':''}"><button class="roster" data-action="deploy-select" data-id="${c.id}" ${isMyTurn()?'':'disabled'}><img src="${art(c.id)}" alt=""><span>${h(DATA.cards[c.id].name)}</span></button>${stats(c.id,{rank:game.training[c.id]||1})}${skillGrid(c.id)}</article>`).join('') || '<p class="muted">等待对手部署</p>'}</div>
        <p class="muted">先选角色，再点绿色格子。友军同格最多叠放三名。</p></aside></div>`;
  }
  function battleLog() {return `<details class="battle-log"><summary>战报</summary><div class="log">${game.log.map(line=>`<div>${h(line)}</div>`).join('')}</div></details>`;}
  function battleHand() {
    const hand=game.hands[game.team].map(id=>`<button class="roster ${game.intent?.type==='hand'&&game.intent.id===id?'active':''}" data-action="hand" data-info="${id}" data-id="${id}" ${isMyTurn()?'':'disabled'}>
      <img src="${skillArt(id)}" alt=""><span>${h(DATA.skillCards[id].name)}<small>本场一次 · 长按说明</small></span></button><button class="btn" data-action="info" data-id="${id}">ⓘ ${h(DATA.skillCards[id].name)}说明</button>`).join('');

    return hand||'<p class="camp-help">本场没有可用手牌。队伍战役的技能卡需要战前携带；独行战役使用主角自身技能。</p>';
  }
  function battleModal() {
    const u=game.unit(game.selected),c=u&&DATA.cards[u.id];
    let title='',body='';
    if(campPanel==='hand'){title='本场手牌';body=`<p class="camp-help">点卡牌后，再点棋盘高亮目标。每张每场一次；长按或点 ⓘ 读取说明。</p><div class="side-list">${battleHand()}</div>`;}
    if(campPanel==='log'){title='本场战报';body=`<div class="log">${game.log.map(line=>`<p>${h(line)}</p>`).join('')}</div>`;}
    if(campPanel==='unit'){title=c?c.name+' · 技能档案':'单位档案';body=c?`<p class="camp-help">${h(c.description)}</p>${stats(u.id,{unit:u})}<div class="inspected-states">${UnitUI.badges(game,u)}</div><p class="camp-help">${h(UnitUI.summonDetail(game,u))}</p>${skillGrid(u.id,u.uid)}${u.heroPassives?`<h3>已装备被动</h3><div class="skill-icon-grid">${u.heroPassives.map(id=>{const t=Solo.passives.find(t=>t.id===id);return `<button class="skill-chip" data-action="info" data-id="hero-passive:${id}" data-uid="${u.uid}">${skillIcon(t.icon)}<span>${h(t.name)}</span></button>`;}).join('')}</div><p class="camp-help">${u.heroPassives.includes('reservoir')?'充能从 0 开始，每个己方回合 +1，上限 5。':'未装备蓄能回路：没有充能，充能技能不可使用。'}充能技能无冷却，同时消耗 1 行动。</p>`:''}`:'<p class="camp-help">先点击棋盘上的角色，即可查看其属性与技能。</p>';}
    if(campPanel==='help'){title='棋盘信息与操作';body=`<p class="camp-help">${game.mode==='online'?'联机选卡 45 秒、部署 90 秒、行动回合 120 秒；超时由服务器自动完成当前阶段。':''}选中己方棋子后，点击绿色格子移动、红色目标普攻。移动先消耗移动点，不足时消耗行动点；移动和行动点都用完后自动取消选中。点击技能，再点紫色高亮目标；长按或点 ⓘ 查看技能。</p><p class="camp-help">橙色条纹是首领预警，下次红方行动开始结算。移动到 ✦ 自动拾取养料，本场生命与生命上限 +5。</p>${game.relic?`<p class="camp-help">已装备 ${h(Content.relics.find(r=>r.id===game.relic)?.name)}：${h(Content.relics.find(r=>r.id===game.relic)?.description)}，自动生效。</p>`:''}${game.campaignId==='solo'?'<p class="camp-help">第 13 回合起敌军每回合攻击 +2；第 25 回合裂隙坍塌。冷却 N 回合表示接下来的 N 个己方回合不可使用。</p>':''}`;}
    return title?window.SoloView.dialog(title,body,campPanel,true):'';
  }
  function battle() {
    const unit=game.unit(game.selected), card=unit && DATA.cards[unit.id];
    const canAct=isMyTurn() && unit?.team===game.team;
    const skills=canAct ? game.skillIds(unit).filter(id=>DATA.skills[id]?.type==='active').map(id=>{
      const s=game.skill(unit,id);return `<div class="skill-action-group"><button class="btn skill-cast ${game.intent?.type==='skill'&&game.intent.id===id?'active':''}" data-action="skill" data-id="${id}"
        data-info="${id}" data-uid="${unit.uid}" aria-disabled="${!game.canSkill(unit.uid,id)}">${skillIcon(id)}<span class="skill-button-text"><b>${h(s.heroSkill?DATA.skills[id].name:s.name)}</b><small>${s.cost||0}${s.requires==='charge'?(s.heroSkill?'充能 +1行动':'充能'):'行动'}${unit.cooldowns[id]>0?` · 冷却 ${game.remainingCooldown(unit,id)}`:unit.used.includes(id)?' · 已用':!game.canSkill(unit.uid,id)?(s.heroSkill&&s.requires==='charge'&&!unit.heroPassives.includes('reservoir')?' · 需蓄能':' · 不可用'):''}</small></span></button><button class="skill-info-btn" data-action="info" data-id="${id}" data-uid="${unit.uid}" aria-label="查看${h(s.name)}说明">ⓘ</button></div>`;
    }).join('') : '';
    const control=unit&&game.controlState(unit),follow=canAct&&unit.ownerUid?`<button class="btn follow-owner" data-action="follow-owner" ${game.followPosition(unit.uid)?'':'disabled'}>跟随主人 <small>${unit.mp>0?'优先消耗移动点':'每步消耗 1 行动'}</small></button>`:'';

    return `<div class="layout battle-layout"><main class="panel battle-field"><div class="gameinfo"><span class="pill">第 ${game.round} 回合</span><span class="pill">${teamName(game.team)}行动</span>${turnClock()}<span class="battle-brief">${game.intent?'点击紫色高亮目标':'绿格移动 · 红色攻击 · 长按技能说明'}</span></div><div class="battle-board-space">${board()}</div><div class="battle-alerts">${game.mode==='practice'?`<p class="solo-pressure">陪练 · ${Practice.difficulties.find(d=>d.id===game.practiceOptions?.difficulty)?.name} · ${Practice.tip(game)}</p>`:''}${game.campaignId==='solo'?`<p class="solo-pressure">${game.round<13?'裂隙升温还有 '+(13-game.round)+' 回合':'裂隙已升温'} · 25 回合坍塌</p>`:''}${game.threats.filter(t=>game.unit(t.uid)).map(t=>`<div class="boss-warning">${skillIcon(DATA.cards[game.unit(t.uid).id].bossAbility)}${h(DATA.cards[game.unit(t.uid).id].ability)}：下次红方行动时橙色格受到 ${t.damage} 法伤</div>`).join('')}</div></main>
      <aside class="panel side battle-side"><div class="battle-controls"><b>${unit?h(card.name):'选择己方棋子'}</b><button class="btn primary end-turn" data-action="end-turn" ${isMyTurn()?'':'disabled'}>结束回合 ⏭</button></div>
      ${unit?`<div class="unit-info"><img class="info-art" src="${art(unit.id)}" alt=""><div class="unit-inspection">${stats(unit.id,{unit})}<div class="inspected-states">${UnitUI.badges(game,unit)}</div>${control?`<p class="unit-control-note">主人距离 ${Number.isFinite(control.distance)?control.distance:'—'}/2 格 · ${control.inRange?'操控正常':'仅能靠近主人'}</p>`:unit.id==='puppet_master'?`<p class="unit-control-note">傀儡 ${game.puppetsOf(unit).length}/4</p>`:''}</div></div>${canAct?`<div class="actions">${skills}${follow}</div>`:''}`:'<p class="battle-idle">点击己方角色，再点高亮格移动或攻击；叠放底部缩略图可打开成员状态。</p>'}
      <div class="battle-tools"><button class="btn" data-action="camp-open" data-id="unit" ${unit?'':'disabled'}>技能档案</button><button class="btn" data-action="camp-open" data-id="hand">手牌 ${game.hands[game.team].length}</button><button class="btn" data-action="camp-open" data-id="log">战报</button><button class="btn" data-action="camp-open" data-id="help">操作 ⓘ</button></div></aside></div>`;
  }
  function victoryMemory(level) {
    const relic=Content.relics.find(r=>r.level===level);
    return `<section class="story-briefing"><p>${h(Content.stage(level)?.ending||'')}</p>${relic?`<div class="relic-found"><img src="${art(relic.art)}" alt=""><div><b>首领遗物 · ${h(relic.name)}</b><p>${h(relic.description)}</p><small>已收藏。可在战前遗物栏装备，每次携带一件。</small></div></div>`:''}</section>`;
  }
  function challengeResult() {
    const r=game.campaignResult;if(!r)return '';
    return `<div class="challenge-result"><b>${'★'.repeat(r.stars)}${'☆'.repeat(3-r.stars)}</b><span>本次 ${r.stars} 星 · 生还 ${r.survivors}/${r.party} · ${game.round}/${r.par} 回合</span><span>${r.bonusGold?`新星级奖励 +${r.bonusGold} 金币`:'已达成的星级保留，重复挑战不重复发奖'}</span></div>`;
  }
  function winStoryVisible(){return game.winner==='A'&&soloStoryPage<(window.SoloStory.chapter(game.level)?.lines.length||0);}
  function end() {
    const win=game.winner==='A';
    if(game.mode==='practice')return `<main class="panel hero"><span class="sub">CLOCKWORK COURTYARD / 本场训练</span><h1>${win?'这次落子，更有底气':'好棋，留给下一次'}</h1><p>${win?'练习获胜':'练习结束'} · ${game.round} 回合 · 普攻 ${game.practiceStats?.attack||0} 次 / 移动 ${game.practiceStats?.move||0} 次 / 施法 ${game.practiceStats?.skill||0} 次</p><p>本场不影响战役、金币与星图积分。</p><div class="home-actions"><button class="btn primary" data-action="practice-retry">相同配置再练一局</button><button class="btn" data-action="practice">调整陪练与阵容</button><button class="btn" data-action="online">前往星海会馆</button></div>${battleLog()}</main>`;
    if(game.mode==='online'){const r=online.metadata?.rankResult?.[online.seat];return `<main class="panel hero"><span class="sub">THE CELESTIAL LODGE / 棋局落定</span><h1>${game.winner===online.seat?'你的星光，又亮了一些':game.winner?'下一手，仍有新的可能':'一局和棋，各有所得'}</h1><p>${r?`星图积分 ${r.before} → ${r.after}（${r.delta>=0?'+':''}${r.delta}）`:'休闲切磋不改变星图积分。'}</p>${online.metadata?.rankResult?.reason?`<p>${h(online.metadata.rankResult.reason)}</p>`:''}<div class="home-actions"><button class="btn primary" data-action="online">返回星海会馆</button><button class="btn" data-action="practice">去练一手</button></div>${battleLog()}</main>`;}

    if(game.campaignId==='solo'&&win&&soloStoryPage<window.SoloStory.chapter(game.level).lines.length)return window.SoloView.ending(game.level,soloStoryPage,game.soloReward);
    if(game.campaignId==='solo')return `<main class="panel hero"><span class="sub">余烬独行 · 第 ${game.level} 关</span><h1>${win?'火种仍在前行':'在营地，重新出发'}</h1><p>${win?(game.soloReward?'首次胜利：已获得 1 属性点 + 1 技能点，解锁「'+h(DATA.skills[Solo.skills[game.level+2]].name)+'」。':'回访胜利。成长奖励已领取，不重复发放。'):'本次失败不扣成长点；可免费重配属性和技能后重试。'}</p><p>本场 ${game.round} 回合 · ${h(Solo.stages[game.level-1].name)}</p><div class="home-actions"><button class="btn primary" data-action="solo-camp">返回营地 · 强化与搭配</button>${win?'<button class="btn" data-action="solo-story-replay">重看本关剧情</button>':''}<button class="btn" data-action="solo-retry" data-id="${game.level}">重试本关</button><button class="btn" data-action="campaign">选择战役</button></div>${battleLog()}</main>`;
    return `<main class="panel hero"><h1>${game.winner?`${teamName(game.winner)}获胜`:'平局'}</h1>
      ${game.mode==='campaign'&&win?`${victoryMemory(game.level)}${challengeResult()}`:''}<p>对局结束，共进行 ${game.round} 回合。${game.mode==='campaign'&&!win?'可以重新挑战当前关卡。':''}</p>
      <div class="home-actions">${game.mode==='campaign'?'<button class="btn primary" data-action="campaign">选择战役</button>':
        game.mode==='online'?'<button class="btn primary" data-action="online">返回联机</button>':'<button class="btn primary" data-action="start">再来一局</button>'}
        <button class="btn" data-action="home">返回主页</button></div>${battleLog()}</main>`;
  }
  function targetModal() {
    if (!targetChoices) return '';
    return `<div class="target-backdrop"><div class="panel target-dialog"><h2 class="section-title">${targetChoices.type==='select'?'选择棋子':'选择目标单位'}</h2>
      ${targetChoices.units.map(u=>`<article class="roster-card"><button class="roster" data-action="target-choice" data-uid="${u.uid}"><img src="${art(u.id)}" alt=""><span><b>${h(DATA.cards[u.id].name)}</b><small>${teamName(u.team)}</small></span></button>${stats(u.id,{unit:u})}<div class="inspected-states">${UnitUI.badges(game,u)}</div></article>`).join('')}
      <button class="btn" data-action="target-cancel">取消</button></div></div>`;
  }
  function stackModal() {
    if(!stackConfirm)return '';
    return `<div class="target-backdrop stack-backdrop"><section role="dialog" aria-modal="true" aria-label="叠放确认" class="panel target-dialog"><span class="sub">FORMATION / 阵型调整</span><h2 class="section-title">是否叠放棋子？</h2>${stackConfirm.arrivals.map(a=>`<div class="stack-preview"><img src="${art(a.id)}" alt=""><div><b>${h(DATA.cards[a.id].name)} → ${'ABCDEF'[a.pos.x]}${a.pos.y+1}</b><p>与 ${a.residents.map(id=>h(DATA.cards[id].name)).join('、')} 同格，合计 ${a.count}/3 名。</p></div></div>`).join('')}<p class="muted">同格棋子仍可分别选中。范围攻击可能同时命中同格成员。</p><div class="stack-actions"><button autofocus class="btn" data-action="stack-cancel">取消</button><button class="btn primary" data-action="stack-confirm">确认叠放</button></div></section></div>`;
  }
  function infoModal() {
    const s=ability(infoId,infoContext);if(!s)return '';
    const u=infoContext?.uid!==undefined?game.unit(infoContext.uid):!infoContext?.card&&view==='game'?game.unit(game.selected):null;
    const summonReason=u?game.summonBlockReason(u,s):'';
    const detail=s.type==='active'?`消耗 ${s.cost||0} ${s.requires==='charge'?(s.heroSkill?'充能 + 1 行动':'充能'):'行动'} · 范围 ${s.range||'按技能规则'}<br>冷却 ${h(s.usage==='once'?'整局一次':s.usage?.startsWith('cooldown:')?s.usage.split(':')[1]+' 回合':'无')}${u?` · 当前冷却 ${game.remainingCooldown(u,infoId)}`:''}<br>冷却 N 回合：接下来的 N 个己方回合不可用。`:s.type==='passive'?'自动触发，无需点击施放。':s.type==='boss'?'橙色区域为预警，下次红方回合开始结算。':'一次性技能卡，使用后消耗。';
    return `<div class="target-backdrop skill-detail-backdrop"><section role="dialog" aria-modal="true" aria-label="技能说明" class="panel target-dialog"><span class="sub">技能档案 / 长按查看</span><div class="skill-modal-heading">${skillIcon(infoId)}<div><h2>${h(s.name)}</h2><span class="skill-kind">${skillKind(s)}</span></div></div><p>${h(s.description)}</p><p>${detail}</p>${summonReason?`<p class="camp-help">${h(summonReason)}</p>`:''}${u&&infoId==='puppet'?`<p class="camp-help">${h(UnitUI.summonDetail(game,u))}</p>`:''}<button autofocus class="btn primary" data-action="info-close">知道了</button></section></div>`;
  }
  function stateModal(){
    if(!stateInfo)return '';
    const u=game.unit(stateInfo.uid),state=u&&UnitUI.states(game,u).find(s=>s.id===stateInfo.id);
    return `<div class="target-backdrop state-detail-backdrop"><section class="panel target-dialog" role="dialog" aria-modal="true" aria-label="状态说明"><span class="sub">当前状态</span><h2>${h(state?.label||'状态已结束')}</h2><p class="state-detail-owner">${h(u?DATA.cards[u.id].name:'该棋子已离场')}</p><p class="state-detail-copy">${h(state?.hint||'该状态已失效，当前无需处理。')}</p><button autofocus class="btn primary" data-action="state-close">知道了</button></section></div>`;
  }
  function openInfo(id,el){infoId=id;stateInfo=null;infoContext=el?.dataset.uid!==undefined?{uid:Number(el.dataset.uid)}:el?.dataset.card?{card:el.dataset.card}:null;infoOpener=el?{...el.dataset}:null;sfx.feedback('open');render();}
  function closeInfo(){infoId=null;infoContext=null;stateInfo=null;sfx.feedback('close');render();if(infoOpener){const d=infoOpener;[...app.querySelectorAll('[data-action]')].find(el=>el.dataset.action===d.action&&el.dataset.id===d.id&&el.dataset.uid===d.uid&&el.dataset.card===d.card)?.focus({preventScroll:true});}infoOpener=null;}
  function render() {
    const previousPanel=app.querySelector('.camp-dialog')?.dataset.panel;
    const previousScroll=app.querySelector('.camp-dialog-body')?.scrollTop||0;
    const focused=document.activeElement?.dataset;
    const focusKey=focused?.action?{action:focused.action,id:focused.id}:null;
    const hubFocus=document.activeElement?.dataset?.hubField;
    const caret=hubFocus?{start:document.activeElement.selectionStart,end:document.activeElement.selectionEnd}:null;
    if(!['solo','campaign','game','online'].includes(view)||progress.pendingReward&&view==='campaign'||view==='game'&&game.phase!=='battle')campPanel=null;
    const scene=view==='home'?home():view==='practice'?window.RoomView.practice(practiceOptions):view==='campaigns'?window.SoloView.hub(progress,solo):view==='solo'?window.SoloView.camp(solo,soloStage,soloSlot):view==='campaign'?campaign():view==='reward'?reward():view==='shop'?shop():
      view==='atlas'?atlas():view==='online'?onlineLobby():
      (game.phase==='end'&&finishing?battle:({menu:home,draft,deploy,battle,end}[game.phase]||home))();
    const banner=game.mode==='online' && view==='game' ? `<div class="online-banner">房间 ${h(online.room)} · 你是${teamName(online.seat)}
      ${onlineConnected&&!onlineConnected[online.seat==='A'?'B':'A']?' · 对手已断线，等待重连':''}
      ${onlineError?`<strong> · ${h(onlineError)}</strong>`:''}</div>` : '';
    const battleScreen=view==='game'&&(['battle','deploy'].includes(game.phase)||game.phase==='end'&&finishing);
    const compact=battleScreen||view==='game'&&game.phase==='end'&&game.campaignId==='solo'&&winStoryVisible()||['solo','campaigns','online','practice'].includes(view)||(view==='campaign'&&!progress.pendingReward);
    app.innerHTML=`<div class="app ${compact?'compact-campaign':''} ${battleScreen?'compact-battle':''}">${header()}${banner}${scene}${targetModal()}${infoModal()}${stateModal()}${stackModal()}${campaignModal()}${matchMenu?matchDialog():''}<div class="footer">战棋 · 卡牌试炼 · 浏览器试玩版</div></div>`;
    document.body.classList.toggle('camp-modal-open',!!campPanel||!!infoId||!!stateInfo);
    const dialog=app.querySelector('.camp-dialog');
    if(dialog){
      if(previousPanel===campPanel)dialog.querySelector('.camp-dialog-body').scrollTop=previousScroll;
      const key=previousPanel===campPanel?focusKey:null;
      const match=key?[...dialog.querySelectorAll('[data-action]')].find(el=>el.dataset.action===key.action&&el.dataset.id===key.id&&!el.disabled):null;
      const input=hubFocus?dialog.querySelector('[data-hub-field="'+hubFocus+'"]'):null;
      (input||match||dialog.querySelector('[data-action=camp-close]')).focus({preventScroll:true});if(input&&caret)input.setSelectionRange(caret.start,caret.end);
    }else if(hubFocus){const input=app.querySelector('[data-hub-field="'+hubFocus+'"]');input?.focus({preventScroll:true});if(input&&caret)input.setSelectionRange(caret.start,caret.end);}
    else if(campFocus){const key=campFocus;campFocus=null;[...app.querySelectorAll('[data-action]')].find(el=>el.dataset.action===key.action&&el.dataset.id===key.id)?.focus({preventScroll:true});}
    if(infoId)app.querySelector('[data-action=info-close]')?.focus({preventScroll:true});
    if(stateInfo)app.querySelector('[data-action=state-close]')?.focus({preventScroll:true});
    effects.sync(game,view==='game');
    sfx.sync(game,view==='game',game.mode==='online'?online.seat:'A');
    music.mount(app.querySelector('.nav'));music.sync(view==='game'&&game.phase==='battle'?'battle':'journey');
    if(stackConfirm)app.querySelector('[data-action=stack-cancel]')?.focus({preventScroll:true});
    if(matchMenu)app.querySelector('[data-action=match-resume], [data-action=match-exit-cancel]')?.focus({preventScroll:true});
  }
  function matchDialog(){return `<div class="target-backdrop match-menu-backdrop"><section class="panel target-dialog" role="dialog" aria-modal="true" aria-label="本局菜单"><span class="sub">CURRENT MATCH</span><h2>${matchExit?'确认离开本局？':'本局菜单'}</h2><p class="camp-help">${matchExit?(game.mode==='online'?'离开进行中的联机棋局将按认输结算。':'本场未完成的对局将结束，已获得的战役成长保留。'):'对局中暂不开放商店、战役和练习入口。可继续本局，或确认离开后再切换。'}</p><div class="stack-actions">${matchExit?'<button class="btn" data-action="match-exit-cancel">返回菜单</button><button class="btn danger" data-action="match-exit-confirm">确认离开</button>':'<button autofocus class="btn primary" data-action="match-resume">继续对局</button><button class="btn" data-action="match-exit">离开本局</button>'}</div></section></div>`;}
  function cellClick(x,y) {
    const pos={x,y}, stack=game.at(pos);
    if (game.phase==='deploy') {
      if (deployCard && isMyTurn()) {
        const id=deployCard;
        send('deploy',{id,...pos},()=>game.deploy(id,pos));
      } else render();
      return;
    }
    if (game.phase!=='battle') return;
    const uid=game.selected, intent=game.intent, options=cellOptions(pos,stack);
    const type=intent?.type || (options.attack?'attack':options.move?'move':null);
    const id=intent?.id;
    if ((options.move || options.attack || options.cast) && type) {
      const choices=targetCandidates(type,id,uid,pos,stack);
      if (choices.length>1) {targetChoices={type,id,uid,pos,units:choices};sfx.feedback('open');render();return;}
      const targetUid=choices[0]?.uid ?? null;
      game.intent=null;
      if (type==='attack') send('attack',{uid,targetUid},()=>game.attack(uid,targetUid));
      else if (type==='move') send('move',{uid,...pos},()=>game.move(uid,pos));
      else if (type==='skill') send('skill',{uid,id,...pos,targetUid},()=>game.useSkill(uid,id,pos,targetUid));
      else if (type==='hand') send('hand',{id,...pos,targetUid},()=>game.playHand(id,pos,targetUid));
      return;
    }
    if (stack.length) {
      if (stack.some(u=>u.uid===game.selected)) {game.selected=null;game.intent=null;sfx.feedback('close');}
      else if (stack.length>1) {targetChoices={type:'select',pos,units:stack};sfx.feedback('open');render();return;}
      else if(game.select(stack[0].uid))sfx.feedback('select');
    }
    render();
  }
  app.addEventListener('input',event=>{const field=event.target.dataset.hubField;if(field&&Object.hasOwn(hubForm,field)){hubForm[field]=event.target.value;if(field==='description'){const count=event.target.parentElement.querySelector('small');if(count)count.textContent=event.target.value.length+'/160';}}});
  app.addEventListener('pointerdown',event=>{
    held=false;
    const el=event.target.closest('[data-info]'); if(!el) return;
    const x=event.clientX,y=event.clientY;
    pressTimer=setTimeout(()=>{held=true;openInfo(el.dataset.info,el);},450);
    const cancel=()=>clearTimeout(pressTimer);
    const move=e=>{if(Math.abs(e.clientX-x)+Math.abs(e.clientY-y)>12) cancel();};
    document.addEventListener('pointermove',move);
    document.addEventListener('pointerup',()=>{cancel();document.removeEventListener('pointermove',move);setTimeout(()=>{held=false;},350);},{once:true});
    document.addEventListener('pointercancel',cancel,{once:true});
  });
  app.addEventListener('contextmenu',e=>{if(e.target.closest('[data-info]'))e.preventDefault();});
  app.addEventListener('click',event=>{
    const button=event.target.closest('[data-action]');if(!button||button.disabled)return;
    const {action,id}=button.dataset;
    if(!UnitUI.allowed(game,action,id))return;
    if(action==='match-menu'){matchMenu=true;matchExit=false;render();return;}
    if(action==='match-resume'){matchMenu=matchExit=false;view='game';render();return;}
    if(action==='match-exit'){matchExit=true;render();return;}
    if(action==='match-exit-cancel'){matchExit=false;render();return;}
    if(action==='match-exit-confirm'){
      if(!matchMenu||!matchExit)return;matchMenu=matchExit=false;campPanel=null;targetChoices=null;infoId=null;stackConfirm=null;clearTimeout(aiTimer);clearTimeout(finishTimer);finishing=false;
      if(game.mode==='online'){online.leave();render();return;}
      const destination=game.mode==='practice'?'practice':game.campaignId==='solo'?'solo':game.mode==='campaign'?'campaign':'home';game.reset();view=destination;render();return;
    }
    if(matchMenu)return;
    if(held) {held=false;return;}
    if(action==='camp-open'){if(id==='edit-room'){hubForm.title=online.metadata?.title||'';hubForm.description=online.metadata?.description||'';}if(id==='create-room'&&online.room)return;campPanel=id;campOpener={action,id};render();return;}
    if(action==='camp-close'||action==='camp-dismiss'){if(action==='camp-dismiss'&&event.target!==button)return;campPanel=null;campFocus=campOpener;render();return;}
    if(action==='stack-cancel') {stackConfirm=null;render();return;}
    if(action==='stack-confirm') {const request=stackConfirm;stackConfirm=null;if(request&&request.fingerprint===JSON.stringify(game.snapshot()))send(request.action,request.payload,request.local,true);else render();return;}
    if(stackConfirm||finishing)return;
    if(action==='info-close'||action==='state-close') {closeInfo();return;}
    if(action==='info') {openInfo(id,button);return;}
    if(action==='state-info') {stateInfo={uid:Number(button.dataset.uid),id};infoId=null;infoContext=null;infoOpener={...button.dataset};sfx.feedback('open');render();return;}
    if(infoId||stateInfo) return;
    if(action==='skill'&&!game.canSkill(game.selected,id)) {openInfo(id,button);return;}
    if (action==='target-cancel') {targetChoices=null;render();return;}
    if (action==='target-choice' && targetChoices) {
      const {type,id:skillId,pos,uid}=targetChoices, targetUid=Number(button.dataset.uid);
      targetChoices=null;game.intent=null;
      if (type==='select') {if(game.select(targetUid))sfx.feedback('select');render();}
      else if (type==='attack') send('attack',{uid,targetUid},()=>game.attack(uid,targetUid));
      else if (type==='skill') send('skill',{uid,id:skillId,...pos,targetUid},()=>game.useSkill(uid,skillId,pos,targetUid));
      else if (type==='hand') send('hand',{id:skillId,...pos,targetUid},()=>game.playHand(skillId,pos,targetUid));
      return;
    }
    if(action==='party-campaign'){selectedStage=null;view='campaign';render();return;}
    if(action==='solo-story-next'||action==='solo-story-prev'||action==='solo-story-skip'||action==='solo-story-replay'){if(view==='game'&&game.campaignId==='solo'&&game.phase==='end'&&game.winner==='A'){const count=window.SoloStory.chapter(game.level).lines.length;soloStoryPage=action==='solo-story-replay'?0:action==='solo-story-skip'?count:Math.max(0,Math.min(count,soloStoryPage+(action==='solo-story-next'?1:-1)));render();app.querySelector('.ember-cinematic-copy')?.focus({preventScroll:true});}return;}
    if(action==='solo-camp'){soloStage=Math.min(9,solo.cleared.length+1);view='solo';render();return;}
    if(action==='solo-stage'){const n=Number(id);if(n>=1&&n<=Math.min(9,solo.cleared.length+1)){soloStage=n;render();}return;}
    if(action==='solo-slot'){const slot=Number(id);if(Number.isInteger(slot)&&slot>=0&&slot<3)soloSlot=slot;render();return;}
    if(action==='solo-stat'||action==='solo-skill'){Solo.upgrade(solo,action==='solo-stat'?'stat':'skill',id);render();return;}
    if(action==='solo-active'||action==='solo-passive'){Solo.equip(solo,action==='solo-active'?'active':'passive',id,soloSlot);render();return;}
    if(action==='solo-respec'){Solo.respec(solo);render();return;}
    if(action==='solo-start'||action==='solo-retry'){if(Solo.start(game,solo,Number(id))){clearTimeout(aiTimer);soloStoryPage=0;deployCard=Solo.HERO;view='game';render();}return;}
    if(action==='equip-skill'){Progress.equipSkill(progress,id);render();return;}
    if (['home','campaign','shop','atlas','online','practice'].includes(action)) {targetChoices=null;if(action==='campaign')selectedStage=null;view=action==='campaign'?'campaigns':action;render();if(action==='online'){online.list?.();clearInterval(lobbyTimer);lobbyTimer=setInterval(()=>{if(view==='online')online.list?.();},20000);}else{clearInterval(lobbyTimer);lobbyTimer=null;}return;}
    if (action==='continue') {view='game';render();return;}
    if (action==='start') {game.start();view='game';deployCard=null;render();return;}
    if(action==='stage-select') {const n=Number(id);if(n===progress.level||progress.cleared.includes(n)){selectedStage=n;lineup=[];render();}return;}
    if(action==='relic') {Progress.equipRelic(progress,id);render();return;}
    if (action==='lineup') {
      lineup=lineup.includes(id)?lineup.filter(x=>x!==id):lineup.length<rosterSize()?[...lineup,id]:[...lineup.slice(1),id];
      render();return;
    }
    if (action==='stage-start') {
      if (lineup.length!==rosterSize()) return;
      const level=campaignLevel();if(level!==progress.level&&!progress.cleared.includes(level))return;
      if(!Progress.start(game,lineup,level,Object.fromEntries(lineup.map(id=>[id,Progress.rank(progress,id)])),{relic:progress.equippedRelic,skills:progress.equippedSkills}))return;
      view='game';deployCard=null;render();return;
    }
    if (action==='train') {Progress.train(progress,id);render();return;}
    if (action==='buy') {Progress.buy(progress,id);render();return;}
    if (action==='reward-choose') {if (Progress.chooseReward(progress,id,button.dataset.kind||'unit')) {lineup=[];selectedStage=null;view='campaign';}render();return;}
    if(action==='practice-option'){const option=button.dataset.option;if(['difficulty','format','preset'].includes(option))practiceOptions[option]=id;render();return;}
    if(action==='practice-start'||action==='practice-retry'){clearTimeout(aiTimer);const options=action==='practice-retry'?game.practiceOptions||practiceOptions:practiceOptions;Practice.start(game,options);view='game';campPanel=null;deployCard=game.phase==='deploy'?game.remaining('A')[0]?.id:null;render();scheduleAI();return;}
    if(action==='room-filter'){roomFilter=id;render();return;}
    if(action==='create-mode'){hubForm.mode=id;render();return;}
    if(action==='match-room'){online.match?.(progress);render();return;}
    if(action==='refresh-rooms'){onlineError='';online.list?.();render();return;}
    if(action==='create-room'){onlineError='';online.create(progress,{title:hubForm.title,description:hubForm.description,mode:hubForm.mode,pool:'open'});render();return;}
    if(action==='update-room'){online.update?.({title:hubForm.title,description:hubForm.description});campPanel=null;render();return;}
    if(action==='room-ready'){online.ready?.(id==='true');return;}
    if(action==='room-start'){online.start?.();return;}
    if(action==='join-room'||action==='join-listed'){onlineError='';online.join(action==='join-listed'?id:hubForm.code||document.getElementById('room-code')?.value,progress);render();return;}
    if(action==='leave-room'){online.leave();onlineMessage=tapOnline?'已离开房间。':'正在离开房间…';view='online';render();return;}
    if(action==='resume-room'){online.resume();render();return;}
    if(action==='save-server'){try{online.setEndpoint?online.setEndpoint(hubForm.server||document.getElementById('server-url').value):localStorage.setItem('tactics-server',hubForm.server);roomList=[];onlineError='';online.list?.();}catch(err){onlineError=err.message;}render();return;}
    if(action==='save-nickname'){online.rename?.(hubForm.nickname||online.profile?.name||'');render();return;}
    if(action==='copy-room'){navigator.clipboard?.writeText(online.room).then(()=>{onlineMessage='房间码已复制。';render();}).catch(()=>{onlineMessage='房间码：'+online.room;render();});return;}
    if (action==='pick') {send('pick',{index:Number(button.dataset.index)},()=>game.pick(Number(button.dataset.index)));return;}
    if (action==='deploy-select') {deployCard=deployCard===id?null:id;render();return;}
    if (action==='cell') {const pos={x:Number(button.dataset.x),y:Number(button.dataset.y)};if(event.target.closest('.stack-member')&&game.phase==='battle'&&!game.intent){targetChoices={type:'select',pos,units:game.at(pos)};sfx.feedback('open');render();return;}cellClick(pos.x,pos.y);return;}
    if (action==='end-turn') {game.intent=null;send('end-turn',{},()=>{game.endTurn();return true;});return;}
    if(action==='follow-owner'){const uid=game.selected,pos=game.followPosition(uid);if(pos)send('move',{uid,...pos},()=>game.move(uid,pos));return;}
    if (action==='skill' && (['rage','stealth','shield_wall','frost_nova'].includes(id)||game.skill(game.unit(game.selected),id)?.selfOnly)) {
      const unit=game.unit(game.selected);
      if (unit) send('skill',{uid:unit.uid,id,x:unit.x,y:unit.y},()=>game.useSkill(unit.uid,id,{x:unit.x,y:unit.y}));
      return;
    }
    if (['skill','hand'].includes(action)) {
      campPanel=null;
      game.intent=game.intent?.type===action && game.intent.id===id ? null : {type:action,id};
      sfx.feedback(game.intent?'target':'close');
      render();
    }
  });
  document.addEventListener('keydown',event=>{
    if(event.target.matches?.('[data-action=state-info]')&&['Enter',' '].includes(event.key)){event.preventDefault();event.stopPropagation();event.target.click();return;}
    if(infoId||stateInfo){if(event.key==='Escape'){event.preventDefault();closeInfo();}else if(event.key==='Tab'){event.preventDefault();app.querySelector(stateInfo?'[data-action=state-close]':'[data-action=info-close]')?.focus();}return;}
    if(matchMenu){if(event.key==='Escape'){matchMenu=matchExit=false;render();}else if(event.key==='Tab'){const buttons=[...app.querySelectorAll('.match-menu-backdrop button')],first=buttons[0],last=buttons.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}return;}
    if(campPanel){
      if(event.key==='Escape'){event.preventDefault();campPanel=null;campFocus=campOpener;render();return;}
      if(event.key==='Tab'){const nodes=[...app.querySelectorAll('.camp-dialog button:not(:disabled),.camp-dialog [href],.camp-dialog input')].filter(el=>el.getClientRects().length);const first=nodes[0],last=nodes.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}return;
    }
    if(stackConfirm){if(event.key==='Escape'){stackConfirm=null;render();}return;}
    if(finishing)return;
    if (event.target.matches?.('input,textarea')) return;
    if(app.querySelector('.ember-cinematic')&&['ArrowRight','ArrowLeft'].includes(event.key)){event.preventDefault();app.querySelector('[data-action='+ (event.key==='ArrowRight'?'solo-story-next':'solo-story-prev') +']')?.click();return;}
    if (event.key==='Escape' && view==='game') {game.intent=null;game.selected=null;render();}
    if (event.code==='Space' && view==='game') {
      event.preventDefault();targetChoices=null;deployCard=null;game.intent=null;game.selected=null;render();
    }
  });
  render();
  window.__TACTICS_TEST__={game,progress,solo,render,cellClick,online,effects,music,sfx,practiceOptions};
})();
