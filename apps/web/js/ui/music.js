/* Bundled instrumental loops. One player, persisted controls, no background playback. */
(function(){
  'use strict';
  const tracks={journey:{name:'月下林间',src:'assets/audio/moonlit-grove-v1.mp3'},battle:{name:'星棋交锋',src:'assets/audio/starlit-tactics-v1.mp3'}};
  class GameMusic {
    constructor(sfx=null){
      this.sfx=sfx;if(sfx)sfx.onChange=()=>this.update();
      let saved;try{saved=JSON.parse(localStorage.getItem('tactics-music'));}catch{}
      this.enabled=saved?.enabled!==false;this.volume=Number.isFinite(saved?.volume)?Math.max(0,Math.min(1,saved.volume)):.32;
      this.scene='journey';this.loaded=null;this.unlocked=false;this.blocked=false;this.failed=false;this.frame=0;this.swap=0;this.generation=0;
      this.player=new Audio();this.player.loop=true;this.player.preload='none';this.player.volume=0;
      this.player.addEventListener('error',()=>{this.failed=true;this.update();});
      const gesture=event=>{if(event.target?.closest?.('.music-control'))return;this.unlock();};
      document.addEventListener('click',gesture,{capture:true});document.addEventListener('keydown',gesture,{capture:true});
      document.addEventListener('visibilitychange',()=>{if(document.hidden){this.cancel();this.player.pause();this.update();}else this.playTrack();});
      window.addEventListener('pagehide',()=>{this.cancel();this.player.pause();});window.addEventListener('pageshow',()=>this.playTrack());
    }
    persist(){try{localStorage.setItem('tactics-music',JSON.stringify({enabled:this.enabled,volume:this.volume}));}catch{}}
    cancel(){clearTimeout(this.swap);cancelAnimationFrame(this.frame);this.frame=0;this.generation++;}
    fade(value,duration=450){
      cancelAnimationFrame(this.frame);const start=performance.now(),from=this.player.volume;
      const tick=now=>{const p=Math.max(0,Math.min(1,(now-start)/duration));this.player.volume=Math.max(0,Math.min(1,from+(value-from)*p));this.frame=p<1?requestAnimationFrame(tick):0;};
      this.frame=requestAnimationFrame(tick);
    }
    unlock(){this.unlocked=true;if(this.enabled&&(this.player.paused||this.blocked))this.playTrack();}
    async playTrack(){
      if(!this.enabled||!this.unlocked||document.hidden)return;
      this.cancel();const generation=this.generation;
      if(this.loaded!==this.scene||this.failed){this.loaded=this.scene;this.player.src=tracks[this.scene].src;this.player.volume=0;this.failed=false;}
      try{await this.player.play();if(generation!==this.generation)return;this.blocked=false;this.fade(this.volume);}
      catch(error){if(generation!==this.generation)return;this.blocked=error?.name==='NotAllowedError';if(!this.blocked&&error?.name!=='AbortError')this.failed=true;}
      this.update();
    }
    sync(scene){
      scene=scene==='battle'?'battle':'journey';if(this.scene===scene)return;this.scene=scene;this.update();
      if(!this.enabled||!this.unlocked||document.hidden)return;
      this.cancel();this.fade(0,180);this.swap=setTimeout(()=>this.playTrack(),190);
    }
    setEnabled(enabled){this.enabled=enabled;this.persist();this.unlocked=true;this.cancel();if(enabled)this.playTrack();else this.player.pause();this.update();}
    setVolume(value){this.volume=Math.max(0,Math.min(1,Number(value)||0));this.persist();cancelAnimationFrame(this.frame);this.frame=0;this.player.volume=this.volume;if(this.enabled){this.unlocked=true;if(this.player.paused)this.playTrack();}this.update();}
    mount(nav){
      if(!this.control){
        const root=document.createElement('details');root.className='music-control';
        root.innerHTML='<summary class="btn music-summary" aria-label="音乐设置" title="音乐设置"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M9 17V5l11-2v12M9 8l11-2"/><ellipse cx="6" cy="18" rx="3" ry="2.5"/><ellipse cx="17" cy="16" rx="3" ry="2.5"/></svg><i></i></summary><div class="music-panel"><b>背景音乐</b><span class="music-track"></span><small class="music-status" aria-live="polite"></small><button type="button" class="btn music-switch"></button><label>音量 <output></output><input type="range" min="0" max="100" step="1" aria-label="背景音乐音量"></label><small class="music-hint">原创器乐循环 · 切到后台自动暂停</small></div>';
        root.querySelector('button').addEventListener('click',()=>this.setEnabled(!this.enabled));
        root.querySelector('input').addEventListener('input',event=>this.setVolume(Number(event.target.value)/100));
        if(this.sfx){const panel=root.querySelector('.music-panel');panel.querySelector('.music-hint').remove();panel.insertAdjacentHTML('beforeend','<div class="sound-divider"></div><b>操作与战斗音效</b><button type="button" class="btn sfx-switch"></button><label>音效音量 <output class="sfx-volume"></output><input class="sfx-range" type="range" min="0" max="100" step="1" aria-label="音效音量"></label><small class="music-hint">配乐与音效分别保存 · 后台自动暂停</small>');panel.querySelector('.sfx-switch').addEventListener('click',()=>this.sfx.setEnabled(!this.sfx.enabled));panel.querySelector('.sfx-range').addEventListener('input',event=>this.sfx.setVolume(Number(event.target.value)/100));root.querySelector('summary').setAttribute('aria-label','声音设置');root.querySelector('summary').title='声音设置';}
        const position=()=>root.style.setProperty('--music-top',Math.max(8,root.querySelector('summary').getBoundingClientRect().bottom+8)+'px');
        root.addEventListener('toggle',position);window.addEventListener('resize',position);this.position=position;
        document.addEventListener('click',event=>{if(!root.contains(event.target))root.open=false;});
        root.addEventListener('keydown',event=>{if(event.key==='Escape'){root.open=false;root.querySelector('summary').focus();event.stopPropagation();}});
        this.control=root;
      }
      if(nav&&!nav.contains(this.control))nav.appendChild(this.control);if(this.control.open)this.position();this.update();
    }
    update(){
      if(!this.control)return;const root=this.control,playing=this.enabled&&!this.player.paused&&!document.hidden;
      root.classList.toggle('music-playing',playing);root.querySelector('.music-track').textContent=tracks[this.scene].name+(this.scene==='battle'?' · 战斗':' · 旅途 / 会馆');
      root.querySelector('.music-status').textContent=!this.enabled?'音乐已关闭':this.failed?'音乐暂不可用，可关闭后重试':document.hidden?'后台已暂停':playing?'正在播放':this.blocked||!this.unlocked?'点击页面后播放':'准备播放';
      const button=root.querySelector('.music-switch');button.textContent=this.enabled?'关闭音乐':'开启音乐';button.setAttribute('aria-pressed',String(this.enabled));
      root.querySelector('input').value=String(Math.round(this.volume*100));root.querySelector('output').textContent=Math.round(this.volume*100)+'%';
      if(this.sfx){const toggle=root.querySelector('.sfx-switch');toggle.textContent=this.sfx.enabled?'关闭音效':'开启音效';toggle.setAttribute('aria-pressed',String(this.sfx.enabled));root.querySelector('.sfx-range').value=String(Math.round(this.sfx.volume*100));root.querySelector('.sfx-volume').textContent=Math.round(this.sfx.volume*100)+'%';}
    }
  }
  window.GameMusic=GameMusic;
})();
