/* Independent single-hero campaign. Save data and encounter definitions stay out of the UI. */
(function () {
  'use strict';
  const KEY='tactics-ember-v1', HERO='ember_hero';
  const skills=['fireball','precise_shot','shield','holy_light','frost_nova','life_drain','dispel','mark_target','blessing','backstab','entangle','bless'];
  const unlocked=p=>skills.slice(0,Math.min(skills.length,3+p.cleared.length));
  const unlockLevel=id=>Math.max(0,skills.indexOf(id)-2);
  const passives=[
    {id:'reservoir',name:'蓄能回路',icon:'charge',description:'开启充能：从 0 开始，每个己方回合开始恢复 1 点，上限 5。未装备时没有充能，充能技能不可使用。'},
    {id:'blood',name:'逆境血爪',icon:'bloodlust',description:'生命不高于一半时，普攻恢复实际生命伤害的 25%。护盾吸收的伤害不吸血。'},
    {id:'guard',name:'留步守势',icon:'shield_wall',description:'结束己方回合时若仍有移动点，获得 6 护盾；此效果最多补至 18 护盾。'},
    {id:'stride',name:'游击锋芒',icon:'queen_move',description:'本回合移动至少 2 格后，第一次普攻额外造成 6 点基础伤害。每回合一次。'}
  ];
  // [id, HP, attack, defense]. Each encounter is tuned independently, not by multiplying all stats.
  const stages=[
    {name:'拾起余烬',story:'边境的灯塔熄灭了。你捡起最后一块余烬，独自踏上重燃灯塔的路。',tip:'试着用火球开场，再保留行动点接近。每场重新补满生命。',enemies:[['skeleton',48,12,1]]},
    {name:'双影夹道',story:'两名守路者从岔口走来。一个人的力量有限，但你可以决定交锋的位置。',tip:'让敌人靠近再用范围技能；不要为了多打一刀耗尽撤退资源。',enemies:[['treant_small',48,13,1],['ranger',48,12,1]]},
    {name:'石门问心',story:'守门者要求你证明：没有军队的旅人，也能迈过这道石门。',tip:'整行预警优先锁定你。离开橙色行再输出；首领半血会狂暴。',enemies:[['boss_warden',145,17,3]]},
    {name:'冷灰巡猎',story:'工坊边缘的巡猎者追踪着余烬的温度。盾与火，必须轮流接过你的呼吸。',tip:'远程敌人会拉开距离。射击适合追猎，吸取可以把伤害转成恢复。',enemies:[['ranger',65,17,2],['knight',85,17,4]]},
    {name:'三面烽火',story:'三道脚步同时响起。你将学会让敌人的数量，成为自己法术的优势。',tip:'范围技能与减速可同时影响多人。也可用精准射击先消灭后排。',enemies:[['skeleton',60,17,2],['treant_small',65,16,2],['ranger',58,16,2]]},
    {name:'熔心试炼',story:'旧炉心要吞掉你手里的火种。你第一次明白，守护也需要锋芒。',tip:'2×2 预警可向最近边缘撤离。选择蓄能回路后，治疗与吸取共享充能；也可选无充能搭配。',enemies:[['boss_furnace',205,21,4]]},
    {name:'镜城伏兵',story:'镜子映出一支不存在的援军。你收起目光，把信任交给自己练熟的招式。',tip:'高护甲敌人适合用法伤处理；留步守势适合在近战时轮换攻防。',enemies:[['knight',100,21,6],['mage',72,18,2],['ranger',64,17,2]]},
    {name:'最后的守夜人',story:'灯塔之前，最后一队守夜人举起武器。他们等待一个能够接班的人。',tip:'优先解决脆弱的远程。此处检验的是搭配与目标顺序，可以免费重配再试。',enemies:[['berserker',100,21,3],['ranger',75,18,2],['treant_small',80,17,3]]},
    {name:'一个人的黎明',story:'王后问：当再没有人与你并肩，你会怎样落下最后一步？你举起了余烬。',tip:'十字预警需要同时离开行与列。预留至少 2 移动，不要在狂暴期站桩换血。',enemies:[['boss_crown',330,28,6]]}
  ].map((s,i)=>({...s,level:i+1}));
  const integer=(v,max)=>Math.min(max,Math.max(0,Math.floor(Number(v)||0)));
  const fresh=()=>({version:2,cleared:[],stats:{health:0,attack:0,defense:0},ranks:{},active:skills.slice(0,3),passives:['guard','stride']});
  function normalize(raw) {
    const p=fresh();if(!raw||typeof raw!=='object')return p;
    // Progress is sequential; corrupt or future chapters cannot mint upgrade points.
    while(p.cleared.length<9 && Array.isArray(raw.cleared) && raw.cleared.includes(p.cleared.length+1))p.cleared.push(p.cleared.length+1);
    let budget=p.cleared.length;
    for(const key of Object.keys(p.stats)){p.stats[key]=integer(raw.stats?.[key],Math.min(budget,key==='defense'?3:9));budget-=p.stats[key];}
    budget=p.cleared.length;
    for(const id of unlocked(p)){p.ranks[id]=integer(raw.ranks?.[id],Math.min(2,budget));budget-=p.ranks[id];}
    if(Array.isArray(raw.active)){const a=[...new Set(raw.active.filter(id=>unlocked(p).includes(id)))].slice(0,3);p.active=[...a,...unlocked(p).filter(id=>!a.includes(id))].slice(0,3);}
    if(Array.isArray(raw.passives))p.passives=[...new Set(raw.passives.filter(id=>passives.some(x=>x.id===id)))].slice(0,2);
    return p;
  }
  function load(){try{return normalize(JSON.parse(localStorage.getItem(KEY)));}catch{return fresh();}}
  function save(p){localStorage.setItem(KEY,JSON.stringify(normalize(p)));}
  const points=(p,kind)=>p.cleared.length-Object.values(kind==='stat'?p.stats:p.ranks).reduce((a,b)=>a+b,0);
  function upgrade(p,kind,id){const values=kind==='stat'?p.stats:p.ranks,valid=kind==='stat'?Object.hasOwn(p.stats,id):unlocked(p).includes(id),max=kind==='stat'?(id==='defense'?3:9):2;
    if(!valid||points(p,kind)<1||(values[id]||0)>=max)return false;values[id]=(values[id]||0)+1;save(p);return true;}
  function respec(p){p.stats={health:0,attack:0,defense:0};p.ranks={};save(p);}
  function equip(p,kind,id,slot=0){if(kind==='active'){if(!unlocked(p).includes(id)||p.active.includes(id)||!Number.isInteger(slot)||slot<0||slot>2)return false;p.active[slot]=id;}
    else {if(!passives.some(x=>x.id===id))return false;p.passives=p.passives.includes(id)?p.passives.filter(x=>x!==id):[...p.passives.slice(-1),id];}save(p);return true;}
  function stats(p){return {hp:110+p.stats.health*6,attack:18+p.stats.attack,defense:2+p.stats.defense,mp:2,ap:2};}
  function skill(id,rank=0){
    const s=JSON.parse(JSON.stringify(window.GAME_DATA.skills[id]));if(!skills.includes(id))return s;
    const n=1+integer(rank,2);s.usage='cooldown:2';s.heroSkill=true;
    if(id==='fireball'){s.effects[0].damage=22+(n-1)*3;s.description=`对目标及周围 1 格敌人造成 ${s.effects[0].damage} 法术伤害。冷却 2 回合。`;}
    if(id==='precise_shot'){s.effects[0].value=30+(n-1)*4;s.description=`对 4 格内目标造成 ${s.effects[0].value} 物理伤害。冷却 2 回合。`;}
    if(id==='shield'){s.effects[0].value=22+(n-1)*4;s.description=`获得 ${s.effects[0].value} 护盾，护盾总量最多 45。冷却 2 回合。`;s.range=0;s.selfOnly=true;}
    if(id==='holy_light'){s.usage='repeat';s.cost=3;s.range=0;s.selfOnly=true;s.effects[0].value=26+(n-1)*4;s.description=`消耗 3 充能和 1 行动，恢复 ${s.effects[0].value} 生命。无冷却。`;}
    if(id==='frost_nova'){s.usage='cooldown:3';s.effects=[{type:'aoe_damage',radius:2,damage:12+(n-1)*2,magic:true},{type:'slow',radius:2,duration:1}];s.description=`周围 2 格敌人受到 ${s.effects[0].damage} 法伤，下次行动移动点减半（向下取整，仍可用行动点移动）。冷却 3 回合。`;s.selfOnly=true;}
    if(id==='life_drain'){s.usage='repeat';s.cost=2;s.requires='charge';s.effects[0].value=18+(n-1)*3;s.description=`消耗 2 充能和 1 行动，吸取 2 格内敌人 ${s.effects[0].value} 生命（法伤），恢复实际生命伤害。无冷却。`;}
    if(id==='dispel'){s.selfOnly=true;s.range=0;s.effects=[{type:'remove_debuffs'},{type:'shield',value:10+(n-1)*2}];s.description=`净化自身负面状态并获得 ${s.effects[1].value} 护盾（总量上限 45）。冷却 2 回合。`;}
    if(id==='mark_target'){s.range=4;s.usage='cooldown:3';s.effects=[{type:'debuff',duration:2},{type:'damage',value:10+(n-1)*2,magic:true}];s.description=`先标记 2 个敌方回合（受到伤害 +20%），再造成 ${s.effects[1].value} 基础法伤。射程 4，冷却 3 回合。`;}
    if(id==='blessing'){s.selfOnly=true;s.range=0;s.usage='cooldown:4';s.effects=[{type:'buff',stats:{attack:3+(n-1),defense:1},duration:2}];s.description=`自身攻击 +${s.effects[0].stats.attack}、护甲 +1，持续至下下个己方回合开始。冷却 4 回合，不叠加。`;}
    if(id==='backstab'){s.effects=[{type:'damage',value:32+(n-1)*3}];s.description=`对相邻敌人造成 ${s.effects[0].value} 物理伤害。冷却 2 回合。`;}
    if(id==='entangle'){s.range=2;s.usage='cooldown:4';s.effects=[{type:'stun',duration:1},{type:'damage',value:8+(n-1)*2,magic:true}];s.description=`造成 ${s.effects[1].value} 法伤并束缚 1 个敌方回合。射程 2，冷却 4 回合；首领受控后获得韧性。`;}
    if(id==='bless'){s.selfOnly=true;s.range=0;s.cost=5;s.usage='repeat';s.effects=[{type:'heal',value:18+(n-1)*3},{type:'shield',value:14+(n-1)*2}];s.description=`消耗 5 充能与 1 行动，恢复 ${s.effects[0].value} 生命并获得 ${s.effects[1].value} 护盾（总量上限 45）。无冷却，可回访关卡使用。`;}
    s.name+=` · ${n}级`;return s;
  }
  function start(game,p,level){
    if(!Number.isInteger(level)||level<1||level>Math.min(9,p.cleared.length+1))return false;
    const stage=stages[level-1];game.startCampaign([HERO],stage.enemies.map(e=>e[0]),level);
    game.campaignId='solo';game.soloBuild=JSON.parse(JSON.stringify(normalize(p)));
    const build=game.soloBuild;
    game.heroSpec={...stats(build),skills:build.active,passives:build.passives,book:Object.fromEntries(build.active.map(id=>[id,skill(id,build.ranks[id])]))};
    for(const [i,u] of game.units.entries()){const spec=stage.enemies[i];u.hp=u.maxHp=spec[1];u.attack=spec[2];u.defense=spec[3];if(window.GAME_DATA.cards[u.id].boss)u.threatDamage=({3:18,6:23,9:28})[level];}
    game.note('余烬独行：第 13 回合起敌军每回合攻击 +2；第 25 回合裂隙坍塌。');return true;
  }
  function complete(p,game){if(game.mode!=='campaign'||game.campaignId!=='solo'||game.phase!=='end'||game.winner!=='A'||game.level!==p.cleared.length+1||game.level>9)return false;p.cleared.push(game.level);save(p);return true;}
  window.SoloCampaign={HERO,skills,unlocked,unlockLevel,passives,stages,fresh,normalize,load,save,points,upgrade,respec,equip,stats,skill,start,complete};
})();
