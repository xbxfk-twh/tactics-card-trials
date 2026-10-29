/* Short local interaction and combat cues; one persisted Web Audio mixer. */
(function(){
  'use strict';
  const families={archery:['precise_shot'],nature:['entangle','fertilizer','warden_slam','boss_warden'],summon:['summon_treant','puppet','finisher','mitosis','scatter'],heal:['holy_light','heal_aura','life_drain','bloodlust'],shield:['shield','shield_wall','bless','dispel'],fire:['fireball','fire_rain','demon_meteor','furnace_blast','boss_furnace'],frost:['frost_nova'],shadow:['stealth','backstab','dart','mark_target'],buff:['blessing','rage','boss_enrage','charge','piece_charge'],chess:['duel','rook_charge','pawn_act','queen_move','queen_orb','knight_leap','knight_orb','crown_cross','boss_crown']};
  function profile(id){let hash=0;for(const c of id)hash=(hash*31+c.charCodeAt(0))>>>0;return {id,family:Object.keys(families).find(k=>families[k].includes(id))||'strike',pitch:2**((hash%7-3)/12),variant:hash%4};}
  // Movement/casts are sounded only after rule acceptance, never on a button tap.
  function actionCue(action){
    if(['cell','target-choice','follow-owner','skill','hand','info','info-close','state-info','state-close','pick','end-turn','stack-confirm'].includes(action))return null;
    if(/cancel|close|dismiss|prev|resume/.test(action))return 'close';
    if(/select|option|slot|active|passive|relic|mode|filter|lineup|equip|ready/.test(action))return 'select';
    if(['buy','train','reward-choose','solo-stat','solo-skill'].includes(action))return 'confirm';
    if(/camp-open|match-menu/.test(action))return 'open';
    return 'tap';
  }
  class SkillAudio {
    constructor(){
      let saved;try{saved=JSON.parse(localStorage.getItem('tactics-sound-effects'));}catch{}
      this.enabled=saved?.enabled!==false;this.volume=Number.isFinite(saved?.volume)?Math.max(0,Math.min(1,saved.volume)):.8;
      this.context=null;this.master=null;this.voices=new Set();this.last=0;this.session=null;this.played=0;this.cueCounts={};this.onChange=()=>{};
      const unlock=()=>this.unlock();document.addEventListener('pointerdown',unlock,{capture:true});document.addEventListener('click',unlock,{capture:true});document.addEventListener('keydown',unlock,{capture:true});
      document.addEventListener('click',event=>{
        if(!event.isTrusted)return;
        const path=event.composedPath();if(!path.some(node=>node?.id==='app'))return;
        const button=path.find(node=>node?.matches?.('button,summary,[role="button"]'));
        if(!button||button.disabled||button.getAttribute('aria-disabled')==='true')return;
        const cue=actionCue(button.dataset.action||'');if(cue)this.feedback(cue);
      });
      document.addEventListener('visibilitychange',()=>{if(document.hidden){this.silence();this.context?.suspend().catch(()=>{});}else if(this.context&&this.enabled)this.context.resume().catch(()=>{});});
      window.addEventListener('pagehide',()=>{this.silence();this.context?.suspend().catch(()=>{});});
    }
    save(){try{localStorage.setItem('tactics-sound-effects',JSON.stringify({enabled:this.enabled,volume:this.volume}));}catch{}this.onChange();}
    silence(){for(const voice of this.voices){try{voice.stop();voice.disconnect();}catch{}}this.voices.clear();}
    setEnabled(value){this.enabled=value;if(this.master)this.master.gain.value=value?this.volume:0;if(value)this.unlock();else{this.silence();this.context?.suspend().catch(()=>{});}this.save();}
    setVolume(value){this.volume=Math.max(0,Math.min(1,Number(value)||0));if(this.master)this.master.gain.value=this.enabled?this.volume:0;this.save();}
    unlock(){
      if(!this.enabled||document.hidden)return;
      try{
        if(!this.context){const AudioContext=window.AudioContext||window.webkitAudioContext;if(!AudioContext)return;this.context=new AudioContext({latencyHint:'interactive'});this.master=this.context.createGain();this.master.gain.value=this.volume;const limiter=this.context.createDynamicsCompressor();limiter.threshold.value=-14;limiter.ratio.value=5;this.master.connect(limiter);limiter.connect(this.context.destination);}
        if(this.context.state==='suspended')this.context.resume().catch(()=>{});
      }catch{}
    }
    tone(frequency,end,start,duration,gain=.12,type='sine'){
      const ctx=this.context,voice=ctx.createOscillator(),envelope=ctx.createGain();voice.type=type;voice.frequency.setValueAtTime(frequency,start);voice.frequency.exponentialRampToValueAtTime(Math.max(25,end),start+duration);
      envelope.gain.setValueAtTime(.0001,start);envelope.gain.exponentialRampToValueAtTime(gain,start+.012);envelope.gain.exponentialRampToValueAtTime(.0001,start+duration);
      voice.connect(envelope);envelope.connect(this.master);this.voices.add(voice);voice.start(start);voice.stop(start+duration+.02);voice.onended=()=>{this.voices.delete(voice);voice.disconnect();envelope.disconnect();};
    }
    noise(start,duration,frequency,end,gain=.1,kind='bandpass'){
      const ctx=this.context;if(!this.noiseBuffer){this.noiseBuffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*.9),ctx.sampleRate);const data=this.noiseBuffer.getChannelData(0);let seed=456789;for(let i=0;i<data.length;i++){seed=(seed*1664525+1013904223)>>>0;data[i]=seed/2147483648-1;}}
      const voice=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),envelope=ctx.createGain();voice.buffer=this.noiseBuffer;filter.type=kind;filter.Q.value=1.6;filter.frequency.setValueAtTime(frequency,start);filter.frequency.exponentialRampToValueAtTime(end,start+duration);
      envelope.gain.setValueAtTime(.0001,start);envelope.gain.exponentialRampToValueAtTime(gain,start+.025);envelope.gain.exponentialRampToValueAtTime(.0001,start+duration);
      voice.connect(filter);filter.connect(envelope);envelope.connect(this.master);this.voices.add(voice);voice.start(start);voice.stop(start+duration+.01);voice.onended=()=>{this.voices.delete(voice);voice.disconnect();filter.disconnect();envelope.disconnect();};
    }
    feedback(kind){
      this.unlock();const now=this.context?.currentTime||0;
      if(this.lastFeedback?.kind===kind&&now-this.lastFeedback.time<.045)return false;
      const played=this.cue(kind);if(played)this.lastFeedback={kind,time:now};return played;
    }
    cue(kind,delay=0,steps=1){
      if(!this.enabled||this.volume<=0||document.hidden||this.context?.state!=='running')return false;
      const t=this.context.currentTime+.008+delay;
      if(kind==='move'){
        for(let n=0;n<Math.min(3,Math.max(1,steps));n++){this.noise(t+n*.085,.065,720,260,.045);this.tone(155-n*8,90,t+n*.085,.065,.025,'triangle');}
      }else if(kind==='deploy'){
        this.noise(t,.10,850,300,.055);this.tone(210,125,t,.12,.045,'triangle');this.tone(620,820,t+.035,.15,.035);
      }else if(kind==='victory'){
        [440,550,660,880].forEach((f,n)=>this.tone(f,f,t+n*.07,.28,n===3?.04:.03));
      }else if(kind==='defeat'){
        this.tone(330,220,t,.3,.04,'triangle');this.tone(220,165,t+.16,.32,.03);
      }else if(kind==='turn'){
        this.tone(330,330,t,.22,.045);this.tone(495,495,t+.06,.20,.03);
      }else if(kind==='confirm'){
        this.tone(620,660,t,.10,.045);this.tone(930,990,t+.065,.14,.035);
      }else if(kind==='select'){
        this.tone(540,810,t,.085,.045,'triangle');this.tone(270,400,t,.065,.02);
      }else if(kind==='target'){
        this.tone(700,950,t,.12,.04);this.tone(350,475,t+.025,.10,.025);
      }else if(kind==='open'){
        this.tone(480,640,t,.075,.03);this.tone(720,780,t+.035,.095,.025);
      }else if(kind==='close')this.tone(480,310,t,.075,.03,'triangle');
      else if(kind==='error')this.tone(190,140,t,.12,.035,'triangle');
      else if(kind==='block'){this.noise(t,.10,3800,1800,.04,'highpass');this.tone(880,440,t,.13,.025);}
      else this.tone(640,460,t,.05,.03,'triangle');
      this.played++;this.cueCounts[kind]=(this.cueCounts[kind]||0)+1;return true;
    }
    play(id,delay=0){
      if(!this.enabled||this.volume<=0||document.hidden||this.context?.state!=='running')return false;
      const p=profile(id),t=this.context.currentTime+.008+delay,f=p.pitch;
      if(p.family==='nature'){this.noise(t,.48,1600,420,.19);this.tone(190*f,90*f,t,.42,.12,'triangle');for(let n=0;n<3;n++)this.noise(t+.07*n,.10,2200,650,.055);}
      else if(p.family==='fire'){this.noise(t,.58,170,1800,.23,'lowpass');this.tone(105*f,35,t,.52,.21,'triangle');this.noise(t+.16,.32,3000,550,.09);}
      else if(p.family==='frost'){this.noise(t,.28,6000,2400,.09,'highpass');for(let n=0;n<4;n++)this.tone((1400+n*360)*f,(1050+n*220)*f,t+n*.045,.38,.045);}
      else if(p.family==='heal'||p.family==='shield'){const root=(p.family==='heal'?440:330)*f;[1,1.25,1.5].forEach((ratio,n)=>this.tone(root*ratio,root*ratio,t+n*.075,.55,.075));if(p.family==='shield')this.noise(t,.17,2500,4000,.06,'highpass');}
      else if(p.family==='summon'){this.noise(t,.6,280,1600,.13);this.tone(150*f,600*f,t,.58,.12,'triangle');this.tone(225*f,900*f,t+.07,.52,.055);}
      else if(p.family==='shadow'){this.noise(t,.32,3200,650,.12);this.tone(260*f,65*f,t,.32,.09,'triangle');if(p.variant%2)this.noise(t+.1,.15,4500,1800,.065);}
      else if(p.family==='buff'){this.tone(175*f,350*f,t,.34,.10,'triangle');this.tone(262.5*f,525*f,t+.045,.38,.07,'triangle');}
      else if(p.family==='chess'){for(let n=0;n<2+p.variant%2;n++){this.tone((260+n*90)*f,120*f,t+n*.07,.12,.10,'triangle');this.noise(t+n*.07,.07,900,650,.10);}}
      else if(p.family==='archery'){this.tone(940*f,310*f,t,.14,.09,'triangle');this.noise(t,.10,6000,2300,.13,'highpass');this.noise(t+.14,.09,1600,700,.09);}
      else {this.noise(t,.17,/ranger|turret/.test(id)?4300:1600,650,.13);this.tone(180*f,75*f,t+.03,.16,.09,'triangle');}
      this.played++;return true;
    }
    rebase(game){this.session=[game.mode,game.visualEpoch,game.matchId||''].join(':');this.last=game.visualSeq||0;this.phase=game.phase;this.silence();}
    sync(game,visible,seat='A'){
      const session=[game.mode,game.visualEpoch,game.matchId||''].join(':');if(session!==this.session){this.session=session;this.last=game.mode==='online'?(game.visualSeq||0):0;this.phase=game.phase;}
      const finished=this.phase==='battle'&&game.phase==='end';this.phase=game.phase;
      const fresh=(game.visualEvents||[]).filter(e=>e.seq>this.last);this.last=Math.max(this.last,game.visualSeq||0);
      if(!visible||document.hidden)return;
      const combat=fresh.filter(e=>['attack','skill','boss','passive'].includes(e.type)).slice(-4);
      combat.forEach((event,index)=>this.play(event.id||'attack',index*.035));
      // A batch may contain several AI actions or AoE recipients. Keep at most two
      // short action cues, and one block chime instead of one sound per victim.
      const cues={move:'move',deploy:'deploy',pick:'confirm',turn:'turn'};
      const actions=fresh.filter(e=>cues[e.type]).slice(-2);
      actions.forEach((event,index)=>this.cue(cues[event.type],index*.065,event.steps));
      if(fresh.some(e=>e.type==='hit'&&e.blocked))this.cue('block',.075);
      if(finished)this.cue(game.winner===seat?'victory':'defeat',.16);
    }
  }
  SkillAudio.profile=profile;SkillAudio.actionCue=actionCue;window.SkillAudio=SkillAudio;
})();
