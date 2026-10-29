/* Shared, deterministic star-chart rating rules. No browser or storage dependencies. */
(function(){
  'use strict';
  const tiers=[
    {name:'微光旅人',min:0,color:'#90a99a',motto:'让第一颗星亮起'},
    {name:'翠枝行者',min:1050,color:'#67a780',motto:'每一步，都生出新的枝叶'},
    {name:'赤曜先锋',min:1200,color:'#cb965a',motto:'在交锋中寻找自己的光'},
    {name:'星辉策士',min:1400,color:'#7c9ec9',motto:'让彼此遥远的星连成棋局'},
    {name:'王庭执棋者',min:1650,color:'#a18dc0',motto:'胜负之外，仍有新的推演'},
    {name:'天穹织星者',min:1900,color:'#d5b55d',motto:'以整片星空，回应下一手'}
  ];
  function tier(rating=1000){const index=tiers.reduce((n,t,i)=>rating>=t.min?i:n,0),current=tiers[index],next=tiers[index+1];const floor=index===0?900:current.min;return {...current,index,next:next?.min||null,progress:next?Math.max(0,Math.min(1,(rating-floor)/(next.min-floor))):1};}
  function change(a,b,result){const expected=1/(1+Math.pow(10,(b.rating-a.rating)/400)),k=a.games<5?48:32;return Math.round(k*(result-expected));}
  function style(counts={}){const values=['attack','move','skill'].map(key=>Math.max(0,Number(counts[key])||0)),total=values.reduce((a,b)=>a+b,0);return {names:['强攻','机动','咏法'],values:values.map(n=>total?Math.round(n/total*100):0),total};}
  const api={tiers,tier,change,style};if(typeof module!=='undefined')module.exports=api;else window.StarRanks=api;
})();
