/* TapTap H5 build entry only. Native authorization is not a shared game account. */
(function(){
  'use strict';
  const server='https://guyuyizhang.top/tactics/';
  class HostedOnlineClient extends window.WebSocketOnlineClient {
    endpoint(){return window.WebSocketOnlineClient.normalize(localStorage.getItem('tactics-server')||server);}
  }
  // Keep the same authoritative rooms as web/Android, even when Tap room APIs exist.
  window.OnlineClient=HostedOnlineClient;
  const root=document.getElementById('app');
  let phase='ready',attempt=0,timer=null;
  root.innerHTML='<main class="tap-entry"><section><span class="sub">TACTICS / H5</span><h1>战棋试炼</h1><p class="tap-entry-lead">一步一策，落子成诗。</p><div class="tap-entry-modes"><span>古树试炼</span><span>余烬独行</span><span>双端棋局</span></div><button class="btn primary" type="button" data-tap-enter>进入游戏</button><p class="tap-entry-status" role="status" aria-live="polite"></p><small>战役进度保存在本机。平台授权不会自动同步其他设备或浏览器的存档。</small></section></main>';
  const button=root.querySelector('[data-tap-enter]'),status=root.querySelector('.tap-entry-status');
  function ready(message){clearTimeout(timer);phase='ready';button.disabled=false;button.textContent='重试进入';status.textContent=message;}
  function enter(){
    if(phase!=='ready')return;
    if(typeof window.tap?.login!=='function'){ready('请在 TapTap H5 测试入口打开此包；当前页面尚未提供平台授权接口。');return;}
    phase='authorizing';const request=++attempt;button.disabled=true;button.textContent='正在进入…';status.textContent='等待 TapTap 授权，请在平台提示中继续。';
    timer=setTimeout(()=>{if(request===attempt&&phase==='authorizing')ready('平台授权暂未响应，请确认网络后重试。');},60000);
    const current=()=>request===attempt&&phase==='authorizing';
    try{
      window.tap.login({
        success:result=>{
          if(!current())return;
          if(typeof result?.code!=='string'||!result.code.trim()){ready('平台未返回有效授权结果，请重试。');return;}
          // Do not persist, log or send the code to the guest room server. No account binding is implied.
          clearTimeout(timer);phase='loading';status.textContent='正在展开棋盘…';
          const script=document.createElement('script');script.src='js/ui/app.js';
          script.onerror=()=>{script.remove();ready('游戏资源加载失败，请确认网络后重试。');};
          script.onload=()=>{phase='started';};document.body.appendChild(script);
        },
        fail:()=>{if(current())ready('授权未完成，你可以再次进入。');}
      });
    }catch{if(current())ready('平台授权暂不可用，请通过 TapTap H5 测试入口重试。');}
  }
  button.addEventListener('click',enter);
  status.textContent='免费试玩 · 战役与练习可单人游玩';
})();
