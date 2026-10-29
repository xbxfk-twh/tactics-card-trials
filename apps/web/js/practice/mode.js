/* Local practice uses the same draft, deployment and combat rules, with no progression rewards. */
(function(){
  'use strict';
  const D=window.GAME_DATA;
  const presets={balanced:{name:'均衡小队',units:['knight','ranger','mage','angel']},summon:{name:'召唤协作',units:['treent_ancient','puppet_master','necromancer','cleric']},chess:{name:'棋阵推演',units:['rook','pawn','knight_piece','queen']}};
  const difficulties=[{id:'guided',name:'初识',description:'电脑练习走位与普攻，不主动施法，适合熟悉棋子。'},{id:'standard',name:'标准',description:'完整角色技能与远程拉扯，练习阵容配合。'},{id:'tactical',name:'谋略',description:'择时使用手牌，移动考虑敌方威胁；双方基础属性相同。'}];
  function start(game,options={}){const difficulty=difficulties.some(x=>x.id===options.difficulty)?options.difficulty:'standard';const format=options.format==='draft'?'draft':'quick';const preset=presets[options.preset]?options.preset:'balanced';
    if(format==='draft')game.start(null,Date.now());
    else{game.startCampaign(presets[preset].units,['knight','ranger','cleric','berserker'],1);game.practiceQuick=true;}
    game.mode='practice';game.practiceOptions={difficulty,format,preset};game.practiceStats={attack:0,move:0,skill:0};game.note('练习不消耗资源，也不影响战役与段位。');return true;
  }
  function choose(game){const units=game.picks.B.filter(c=>c.kind==='unit').map(c=>c.id);let best=0,score=-Infinity;game.candidates.forEach((c,i)=>{let n;if(c.kind==='skill')n=units.length>=3?70:5;else{const card=D.cards[c.id];n=30+card.health/10+card.attack+(card.attack_range>1&&!units.some(id=>D.cards[id].attack_range>1)?15:0)+(card.skills.includes('holy_light')&&!units.includes('angel')?15:0);}if(n>score){score=n;best=i;}});return game.pick(best);}
  function step(game){if(game.mode!=='practice'||game.team!=='B')return false;
    if(game.phase==='draft')return choose(game);
    if(game.phase==='deploy'){const card=game.remaining('B')[0];if(!card)return false;for(const y of [4,5])for(const x of [1,4,0,5,2,3])if(!game.at({x,y}).length&&game.deploy(card.id,{x,y}))return true;return false;}
    if(game.phase!=='battle')return false;
    const difficulty=game.practiceOptions.difficulty;
    if(difficulty!=='guided'){
      for(const id of [...game.hands.B]){
        const foes=game.units.filter(u=>u.team==='A');
        if(id==='heal_aura'){const ally=game.units.filter(u=>u.team==='B'&&!u.aura).sort((a,b)=>b.maxHp-a.maxHp)[0];if(ally&&game.playHand(id,ally,ally.uid))return true;}
        else{const target=foes.map(u=>({u,score:foes.filter(t=>Math.abs(t.x-u.x)<=1&&Math.abs(t.y-u.y)<=1).length*20+(u.hp<35?20:0)})).sort((a,b)=>b.score-a.score)[0];if(target&&(difficulty!=='tactical'||id==='demon_meteor'||target.score>=40||foes.length===1)&&game.playHand(id,target.u,target.u.uid))return true;}
      }
    }
    return window.TacticsAI.step(game,'B',{skills:difficulty!=='guided',tactical:difficulty==='tactical'});
  }
  function tip(game){if(game.phase==='draft')return '先保证角色数量，再考虑技能卡；远程、前排与辅助各有价值。';if(game.phase==='deploy')return '部署在上方两排。近战在前，脆弱的远程与治疗在后。';return '移动点用完后会消耗行动点移动，记得为攻击和施法留出行动。';}
  window.PracticeMode={presets,difficulties,start,step,tip};
})();
