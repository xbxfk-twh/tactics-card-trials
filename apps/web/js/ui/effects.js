/* Layered local Canvas VFX. Deterministic particles, cached glow sprites and bounded budgets. */
(function () {
  'use strict';
  const palette={fire:'#ff7935',frost:'#63d8ff',heal:'#78e9ae',shield:'#6bc9ff',nature:'#87ca58',shadow:'#b879ff',summon:'#51ddc8',arcane:'#b394ff',buff:'#ffd775'};
  const tau=Math.PI*2,clamp=n=>Math.max(0,Math.min(1,n));
  const rand=(seed,n=0)=>{const f=Math.sin(seed*127.1+n*311.7)*43758.5453;return f-Math.floor(f);};
  function theme(id) {
    if(/fire|meteor|furnace/.test(id))return 'fire';
    if(/frost|ice/.test(id))return 'frost';
    if(/heal|holy|bless|fertilizer|drain/.test(id))return 'heal';
    if(/shield|dispel/.test(id))return 'shield';
    if(/entangle|warden/.test(id))return 'nature';
    if(/stealth|backstab|dart|assassin/.test(id))return 'shadow';
    if(/summon|puppet/.test(id))return 'summon';
    if(/rage|mark|blood/.test(id))return 'buff';
    return 'arcane';
  }
  class BattleEffects {
    constructor() {
      this.canvas=document.createElement('canvas');this.canvas.className='battle-effects';
      this.canvas.setAttribute('aria-hidden','true');this.canvas.style.pointerEvents='none';document.body.appendChild(this.canvas);
      this.ctx=this.canvas.getContext('2d');this.active=[];this.session=null;this.last=0;this.frame=0;
      this.reduced=matchMedia('(prefers-reduced-motion: reduce)');this.glows=new Map();
      this.tints=new Map();this.atlas=new Image();this.textureReady=false;
      this.atlas.onload=()=>{this.textureReady=true;};
      this.atlas.src='assets/effects/kenney-particles-v1.webp';
    }
    duration(e){return this.reduced.matches?300:e.type==='attack'?(e.ranged?760:620):e.type==='boss'?1250:e.type==='skill'?(/backstab|dart|stealth/.test(e.id)?820:1100):820;}
    sync(game,visible) {
      const session=[game.mode,game.visualEpoch,game.matchId||''].join(':');
      if(session!==this.session){this.session=session;this.last=game.mode==='online'?(game.visualSeq||0):0;this.active=[];}
      const events=(game.visualEvents||[]).filter(e=>e.seq>this.last&&['attack','skill','boss','hit','heal'].includes(e.type));
      this.last=Math.max(this.last,game.visualSeq||0);
      if(!visible||document.hidden){this.active=[];return;}
      const now=performance.now();
      for(const e of events){
        let delay=0;
        if(!this.reduced.matches&&['hit','heal'].includes(e.type)){
          const near=(a,b)=>a&&b&&Math.hypot(a.x-b.x,a.y-b.y)<.8,origins=events.filter(v=>['attack','skill','boss'].includes(v.type));
          const origin=origins.findLast(v=>v.type==='boss'?v.cells?.some(p=>near(p,e.to)):near(v.to,e.to))||origins.reduce((best,v)=>!best||Math.abs(v.seq-e.seq)<Math.abs(best.seq-e.seq)?v:best,null);
          if(origin)delay=this.duration(origin)*(origin.type==='boss'?.16:origin.type==='attack'?(origin.ranged?.28:.12):Math.hypot((origin.from?.x||0)-(origin.to?.x||0),(origin.from?.y||0)-(origin.to?.y||0))>.3?.28:.12);
        }
        this.active.push({...e,start:now+delay,duration:this.duration(e)});
      }
      this.active=this.active.slice(-24);
      if(this.active.length&&!this.frame)this.frame=requestAnimationFrame(time=>this.draw(time));
    }
    // CC0 texture masks by Kenney, packed into eight 128px cells. Tint once;
    // rendering never creates a new image/filter for each particle or frame.
    sprite(name,x,y,size,color,alpha=1,rotation=0,stretch=1,blend='lighter'){
      if(!this.textureReady||size<=0||alpha<=0)return;
      const names=['smoke','flame','spark','star','slash','mist','ring','flare'],index=names.indexOf(name);if(index<0)return;
      const key=name+color;let tinted=this.tints.get(key);
      if(!tinted){if(this.tints.size>=64)this.tints.delete(this.tints.keys().next().value);tinted=document.createElement('canvas');tinted.width=tinted.height=128;const g=tinted.getContext('2d');g.drawImage(this.atlas,index%4*128,Math.floor(index/4)*128,128,128,0,0,128,128);g.globalCompositeOperation='source-in';g.fillStyle=color;g.fillRect(0,0,128,128);this.tints.set(key,tinted);}
      const c=this.ctx;c.save();c.globalCompositeOperation=blend;c.globalAlpha*=clamp(alpha);c.translate(x,y);c.rotate(rotation);c.drawImage(tinted,-size/2,-size*stretch/2,size,size*stretch);c.restore();
    }
    impact(x,y,size,color,p,seed,weight=1){
      if(p<0||p>1)return;const c=this.ctx,flash=Math.pow(clamp(1-p/.22),2),expand=1-Math.pow(1-p,3);
      // Dark, textured residue supplies contrast on the pale board. It follows
      // the hot core instead of covering it with a long-lived flat glow.
      for(let i=0;i<Math.round(4*this.quality);i++){
        const a=rand(seed,i+60)*tau,r=size*(.12+.45*expand),life=Math.min(1,p*14)*(1-p)*.38;
        this.sprite('smoke',x+Math.cos(a)*r,y+Math.sin(a)*r*.5-size*p*.17,size*(.55+p*.8),'#293c45',life,rand(seed,i)*tau,1,'source-over');
      }
      this.sprite('flare',x,y,size*(.8+1.1*flash)*weight,color,flash*.95,seed,1,'source-over');
      this.glow(x,y,size*(.18+.32*flash)*weight,color,flash*.55,.8);
      c.save();c.globalCompositeOperation='lighter';
      this.sprite('star',x,y,size*(.18+.6*flash)*weight,'#fff4d7',flash,seed*.2);
      this.glow(x,y,size*(.12+.22*flash)*weight,'#fff3cb',flash*.8,.7);
      const rays=Math.round(9*this.quality);
      for(let i=0;i<rays;i++){const a=rand(seed,i)*tau,d=size*(.08+.6*expand)*( .5+rand(seed,i+20));c.strokeStyle=i%3===0?'#fff5d7':color;c.globalAlpha=clamp(1-p*2)*.75;c.lineWidth=Math.max(.7,size*.018*(1-p));c.beginPath();c.moveTo(x+Math.cos(a)*d*.45,y+Math.sin(a)*d*.45);c.lineTo(x+Math.cos(a)*d,y+Math.sin(a)*d);c.stroke();}
      this.sprite('ring',x,y,size*(.25+expand*1.5),color,Math.pow(1-p,3)*.55,seed,.55);c.restore();
    }
    glow(x,y,r,color,alpha=1,stretch=1,rotation=0) {
      if(r<=0||alpha<=0)return;
      let sprite=this.glows.get(color);
      if(!sprite){
        sprite=document.createElement('canvas');sprite.width=sprite.height=96;const ctx=sprite.getContext('2d'),g=ctx.createRadialGradient(48,48,0,48,48,48);
        g.addColorStop(0,'#ffffff');g.addColorStop(.09,color+'f0');g.addColorStop(.28,color+'88');g.addColorStop(.62,color+'24');g.addColorStop(1,color+'00');ctx.fillStyle=g;ctx.fillRect(0,0,96,96);this.glows.set(color,sprite);
      }
      const c=this.ctx;c.save();c.globalAlpha*=clamp(alpha);c.translate(x,y);c.rotate(rotation);c.drawImage(sprite,-r,-r*stretch,r*2,r*2*stretch);c.restore();
    }
    ring(x,y,r,color,width=2) {
      const c=this.ctx;c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.arc(x,y,Math.max(0,r),0,tau);c.stroke();
    }
    // A broken, rippling pressure front; no repeated polygon or full magic-circle stamp.
    ripple(x,y,r,color,p,seed) {
      const c=this.ctx;c.save();c.strokeStyle=color;c.lineWidth=Math.max(.5,2*(1-p));c.globalAlpha*=Math.sin(clamp(p)*Math.PI)*.6;
      for(let j=0;j<2;j++){c.beginPath();const start=rand(seed,j)*tau,span=1.1+rand(seed,j+8)*1.9;for(let i=0;i<=18;i++){const a=start+span*i/18,rr=r*(.91+.06*Math.sin(a*7+seed)+.035*Math.sin(a*13));const px=x+Math.cos(a)*rr,py=y+Math.sin(a)*rr*.58;i?c.lineTo(px,py):c.moveTo(px,py);}c.stroke();}c.restore();
    }
    particles(x,y,r,color,p,seed,count=24,rise=false) {
      const c=this.ctx,n=Math.max(4,Math.round(count*this.quality));c.save();c.globalCompositeOperation='lighter';
      for(let i=0;i<n;i++){
        const t=clamp((p-rand(seed,i)*.16)/(.7+rand(seed,i+100)*.3));if(t<=0||t>=1)continue;
        const a=rand(seed,i+200)*tau,v=.3+rand(seed,i+300)*.85,life=Math.sin(t*Math.PI)*(1-t*.5),travel=(1-Math.exp(-t*3))/.95,dx=Math.cos(a)*r*v*travel,dy=rise?-r*(.2+v)*t:Math.sin(a)*r*v*travel+r*.35*t*t;
        const px=x+dx,py=y+dy,size=(.7+rand(seed,i+400)*2.2)*(.5+this.cell/100);
        c.globalAlpha=life*.9;c.strokeStyle=i%4===0?'#fff8dd':color;c.lineWidth=size*.65;c.beginPath();c.moveTo(px-dx*.055,py-dy*.055);c.lineTo(px,py);c.stroke();
        if(i%4===0)this.sprite('spark',px,py,size*9,i%8===0?'#fff9dc':color,life*.7,a+Math.PI/2,1.7);
      }c.restore();
    }
    slash(x,y,size,color,p,seed,direction=0) {
      const c=this.ctx,t=1-Math.pow(1-clamp(p*3.5),3),fade=Math.pow(clamp(1-p/.55),1.5);if(!fade)return;
      this.sprite('slash',x,y,size*2.1,color,fade*.85,direction-.4,.7);
      c.save();c.translate(x,y);c.rotate(direction-.8+(rand(seed,7)-.5)*.6);c.globalAlpha*=fade;
      const g=c.createLinearGradient(-size,0,size,0);g.addColorStop(0,color+'00');g.addColorStop(.35,color+'a0');g.addColorStop(.65,'#fff8dc');g.addColorStop(1,color+'00');c.fillStyle=g;
      c.beginPath();c.moveTo(-size*.85,-size*.15);c.bezierCurveTo(-size*.1,-size*.5,size*.55,-size*.44,size*t,size*.15);c.bezierCurveTo(size*.2,-size*.17,-size*.2,-size*.28,-size*.85,-size*.15);c.fill();
      c.strokeStyle='#fff9e2';c.lineWidth=Math.max(.6,size*.014);c.beginPath();c.moveTo(-size*.55,-size*.25);c.bezierCurveTo(0,-size*.43,size*.45,-size*.3,size*t,size*.15);c.stroke();c.restore();
    }
    trail(a,b,size,color,p,seed,arc=.3) {
      if(p>.34)return;
      const c=this.ctx,t=clamp(p/.28),dx=b.x-a.x,dy=b.y-a.y;
      const at=q=>({x:a.x+dx*q,y:a.y+dy*q-Math.sin(q*Math.PI)*size*arc});
      c.save();c.globalCompositeOperation='lighter';
      const tail=at(Math.max(0,t-.25)),head=at(t),g=c.createLinearGradient(tail.x,tail.y,head.x+.01,head.y+.01);g.addColorStop(0,color+'00');g.addColorStop(.6,color+'a0');g.addColorStop(1,'#fff7df');c.strokeStyle=g;c.lineWidth=Math.max(2,size*.085);c.beginPath();
      for(let i=0;i<=12;i++){const pos=at(Math.max(0,t-.25+i*.25/12));i?c.lineTo(pos.x,pos.y):c.moveTo(pos.x,pos.y);}c.stroke();
      this.sprite('spark',head.x,head.y,size*.62,'#fff7d9',.95,Math.atan2(dy,dx)+Math.PI/2,1.7);this.glow(head.x,head.y,size*.17,color,.85);c.restore();
      this.particles(head.x,head.y,size*.28,color,clamp(p*2),seed,10);
    }
    skill(kind,a,b,size,p,seed,id) {
      const c=this.ctx,color=palette[kind],travel=Math.hypot(a.x-b.x,a.y-b.y)>size*.3,hitTime=travel?.28:.12,impact=clamp((p-hitTime)/(1-hitTime)),burst=Math.sin(Math.PI*clamp(impact*1.5)),fade=1-impact;
      // Brief emitter bloom, then the projectile and impact share one visual language.
      this.sprite('ring',a.x,a.y,size*(.55+Math.min(1,p*7)*.4),color,Math.max(0,1-p*6)*.6,seed,.5);
      this.glow(a.x,a.y,size*.27,color,Math.max(0,1-p*6)*.4,.5);
      if(travel)this.trail(a,b,size,color,p,seed,kind==='fire'?.6:.2);
      if(p<hitTime)return;
      if(['fire','frost','shadow','arcane','summon'].includes(kind))this.impact(b.x,b.y,size,color,impact,seed,kind==='fire'?1.5:1.15);
      this.glow(b.x,b.y,size*(.2+.4*burst),color,fade*.28,.7);
      this.ripple(b.x,b.y,size*(.15+impact*.9),color,impact,seed);
      if(kind==='fire'){
        c.save();c.globalCompositeOperation='lighter';
        const n=Math.round(15*this.quality);
        for(let i=0;i<n;i++){
          const t=clamp((impact-rand(seed,i)*.23)*1.25),sx=(rand(seed,i+25)-.5)*size*.85,sy=(rand(seed,i+60)-.5)*size*.35;
          const x=b.x+sx+Math.sin(t*7+i)*size*.12*t,y=b.y+sy-size*t*(.4+rand(seed,i+80)*.8),r=size*(.08+rand(seed,i+90)*.13)*Math.sin(t*Math.PI);
          this.sprite('flame',x,y,r*4.8,i%3===0?'#ffc352':'#f15822',Math.sin(t*Math.PI)*.9,Math.sin(i)*.25,1.55,'source-over');
          if(i%3===0)this.glow(x,y,r*.75,'#ffe4aa',Math.sin(t*Math.PI)*.4);
        }c.restore();this.particles(b.x,b.y,size*1.35,'#ffb052',impact,seed,32,true);
        if(id==='fire_rain'||id==='demon_meteor'){
          for(let i=0;i<Math.round(7*this.quality);i++){const t=clamp((p-rand(seed,i)*.3)*2),x=b.x+(rand(seed,i+1)-.5)*size*1.7,y=b.y+(rand(seed,i+2)-.5)*size;this.trail({x:x-size*.5,y:y-size*1.4},{x,y},size*.7,'#ffb052',t*.5,seed+i,.1);}
        }
      }else if(kind==='frost'){
        const n=Math.round(11*this.quality);c.save();
        for(let i=0;i<n;i++){
          const a=rand(seed,i)*tau,t=clamp((impact-rand(seed,i+100)*.18)*1.7),r=size*(.25+rand(seed,i+10)*.7)*t,x=b.x+Math.cos(a)*r,y=b.y+Math.sin(a)*r*.7,h=size*(.16+rand(seed,i+20)*.27)*Math.sin(t*Math.PI*.8);
          c.save();c.translate(x,y);c.rotate(a+.6);c.globalAlpha=fade*.85;const g=c.createLinearGradient(0,-h,0,h*.25);g.addColorStop(0,'#efffff');g.addColorStop(.35,'#93efff');g.addColorStop(1,'#268acc00');c.fillStyle=g;c.beginPath();c.moveTo(0,-h);c.lineTo(h*.22,-h*.18);c.lineTo(h*.08,h*.3);c.lineTo(-h*.18,0);c.closePath();c.fill();c.restore();
        }c.restore();this.sprite('mist',b.x,b.y-size*impact*.3,size*(.8+impact),'#a2edff',Math.sin(impact*Math.PI)*.28,seed,.65);this.particles(b.x,b.y,size*1.1,'#a2edff',impact,seed,20);
      }else if(kind==='shield'){
        this.sprite('ring',b.x,b.y,size*(.7+impact*.55),color,fade*.7,seed,.6);
        c.save();c.translate(b.x,b.y);c.scale(1,.85);c.globalAlpha=fade*.8;
        const g=c.createLinearGradient(-size*.5,0,size*.5,0);g.addColorStop(0,color+'00');g.addColorStop(.2,color+'60');g.addColorStop(.5,'#e0faff20');g.addColorStop(.8,color+'90');g.addColorStop(1,color+'00');c.fillStyle=g;c.beginPath();c.ellipse(0,0,size*(.43+.06*burst),size*.62,0,-Math.PI*.95,Math.PI*.1);c.quadraticCurveTo(-size*.1,size*.4,-size*.45,-size*.12);c.fill();
        c.strokeStyle='#b7f0ff';c.lineWidth=1.5;c.beginPath();c.ellipse(0,0,size*.47,size*.62,-.12,-2.8,-.5);c.stroke();c.restore();this.particles(b.x,b.y,size*.85,color,impact,seed,22,true);
      }else if(kind==='heal'||kind==='buff'){
        c.save();c.globalCompositeOperation='lighter';
        for(let i=0;i<Math.round(8*this.quality);i++){
          const x=b.x+(rand(seed,i)-.5)*size*.9,y=b.y+size*.28-size*impact*(.35+rand(seed,i+30)*.7);this.sprite('spark',x,y,size*(.25+rand(seed,i+80)*.18),i%3===0?'#ffe2a4':color,Math.sin(impact*Math.PI)*.55,0,2.8);if(i%2===0)this.sprite('star',x,y,size*.2,'#fff2c8',Math.sin(impact*Math.PI)*.7,impact);
        }c.restore();this.particles(b.x,b.y,size*.85,color,impact,seed,24,true);
      }else if(kind==='nature'){
        c.save();c.globalAlpha=fade*.8;
        for(let i=0;i<Math.round(5*this.quality);i++){
          const x=b.x+(rand(seed,i)-.5)*size*.8,reach=size*(.4+rand(seed,i+30)*.5)*Math.min(1,impact*3),bend=(rand(seed,i+50)-.5)*size*.75;
          c.strokeStyle=i%2?'#acd871':'#4e9652';c.lineWidth=1.5+rand(seed,i+10)*2;c.beginPath();c.moveTo(x,b.y+size*.35);c.bezierCurveTo(x+bend,b.y+size*.1,x-bend,b.y-reach*.7,x+bend*.35,b.y-reach);c.stroke();
          c.fillStyle='#b4e98c';c.beginPath();c.ellipse(x-bend*.12,b.y-reach*.6,size*.055,size*.12,i,0,tau);c.fill();
        }c.restore();this.particles(b.x,b.y,size*.9,'#c4eaa0',impact,seed,18,true);
      }else if(kind==='shadow'){
        c.save();c.globalAlpha=fade*.8;c.translate(b.x,b.y);
        for(let i=0;i<3;i++){const a=rand(seed,i)*tau+impact*1.3,r=size*(.2+i*.12);c.rotate(a);const g=c.createLinearGradient(-r,0,r,0);g.addColorStop(0,color+'00');g.addColorStop(.55,color+'90');g.addColorStop(1,'#eee1ff00');c.fillStyle=g;c.beginPath();c.moveTo(-r,r*.15);c.bezierCurveTo(-r*.3,-r*1.3,r*.8,-r*.75,r,r*.2);c.bezierCurveTo(r*.2,-r*.2,-r*.4,-r*.35,-r,r*.15);c.fill();c.rotate(-a);}c.restore();this.slash(b.x,b.y,size*.8,'#e1c3ff',impact,seed);this.particles(b.x,b.y,size,color,impact,seed,20);
      }else{
        c.save();c.globalAlpha=fade*.7;
        for(let i=0;i<Math.round(6*this.quality);i++){
          const a=rand(seed,i)*tau,r=size*(.2+rand(seed,i+80)*.4),t=impact*2+a,x=b.x+Math.cos(t)*r,y=b.y+Math.sin(t)*r*.4-size*impact*.5;
          this.glow(x,y,size*.15,color,fade,2.8,-t*.4);c.strokeStyle=color;c.lineWidth=1;c.beginPath();c.moveTo(x,y);c.bezierCurveTo(x-r*.5,y+size*.2,b.x+r*.3,b.y-size*.1,b.x,b.y+size*.2);c.stroke();
        }c.restore();this.particles(b.x,b.y,size*1.1,color,impact,seed,26,true);
      }
    }
    floating(e,b,cell,p) {
      const c=this.ctx,labels=e.type==='heal'?[{text:`+${e.amount}`,color:'#72e694'}]:e.blocked?[{text:'格挡',color:'#b9e9ff'}]:[
        ...(e.amount?[{text:`-${e.amount}`,color:'#ff6464'}]:[]),...(e.shield?[{text:`-${e.shield}`,color:'#68c7ff'}]:[])
      ];
      c.shadowColor='#193629';c.shadowBlur=4;c.font=`800 ${Math.max(13,cell*.23)}px system-ui`;c.textAlign='left';
      const gap=Math.max(4,cell*.07),widths=labels.map(label=>c.measureText(label.text).width),total=widths.reduce((sum,width)=>sum+width,0)+gap*Math.max(0,labels.length-1);
      let left=b.x-total/2;const baseline=b.y-cell*(.12+p*.6);c.strokeStyle='#18342dcc';c.lineWidth=3;
      labels.forEach((label,index)=>{c.strokeText(label.text,left,baseline);c.fillStyle=label.color;c.fillText(label.text,left,baseline);left+=widths[index]+gap;});
    }
    draw(now) {
      this.frame=0;const board=document.querySelector('.board'),c=this.ctx;
      const ratio=Math.min(devicePixelRatio||1,1.5),w=innerWidth,h=innerHeight;
      if(this.canvas.width!==Math.round(w*ratio)||this.canvas.height!==Math.round(h*ratio)){this.canvas.width=Math.round(w*ratio);this.canvas.height=Math.round(h*ratio);}
      c.setTransform(ratio,0,0,ratio,0,0);c.clearRect(0,0,w,h);
      if(!board||document.hidden){this.active=[];return;}
      const rect=board.getBoundingClientRect(),cell=board.clientWidth/6;this.cell=cell;
      this.active=this.active.filter(e=>now-e.start<e.duration);this.quality=(w<701?.7:1)*(this.active.length>10?.55:1);
      const point=p=>({x:rect.left+board.clientLeft+(p.x+.5)*cell,y:rect.top+board.clientTop+(p.y+.5)*cell});
      // Numbers are always the last layer so impacts cannot cover combat information.
      const ordered=[...this.active.filter(e=>e.type!=='hit'&&e.type!=='heal'),...this.active.filter(e=>e.type==='hit'||e.type==='heal')];
      for(const e of ordered){
        if(now<e.start)continue;
        const p=clamp((now-e.start)/e.duration),a=point(e.from||e.to||{x:0,y:0}),b=point(e.to||e.from||{x:0,y:0}),seed=(e.seq||1)*13.31+(e.id||'').length*7;
        c.save();c.globalAlpha=Math.min(1,(1-p)*3);c.lineCap='round';
        if(e.type==='hit'||e.type==='heal')this.floating(e,b,cell,p);
        else if(this.reduced.matches){this.glow(b.x,b.y,cell*.48,palette[theme(e.id||'')],.38);this.ring(b.x,b.y,cell*.32,palette[theme(e.id||'')],2);}
        else if(e.type==='attack'){
          const color=e.ranged?(e.id==='turret'?'#ffc66b':/mage|necro|chess|queen/.test(e.id)?'#bf9cff':'#9ee1ff'):'#ffdc94';
          if(e.ranged)this.trail(a,b,cell,color,p,seed,.12);else this.slash(b.x,b.y,cell*.8,color,p,seed,Math.atan2(b.y-a.y,b.x-a.x)*.3);
          const hitTime=e.ranged?.28:.12;
          if(p>hitTime){const impact=(p-hitTime)/(1-hitTime);this.impact(b.x,b.y,cell,color,impact,seed,e.id==='turret'?1.3:.75);this.particles(b.x,b.y,cell*.8,color,impact,seed,16);}
        }else if(e.type==='skill')this.skill(theme(e.id),a,b,cell,p,seed,e.id);
        else if(e.type==='boss'){
          const color=palette[theme(e.id)],cells=e.cells||[];
          for(let i=0;i<cells.length;i++){const at=point(cells[i]),t=(p-.16-rand(seed,i)*.035)/.8;if(t<0)continue;this.impact(at.x,at.y,cell,color,clamp(t),seed+i,1.25);this.glow(at.x,at.y,cell*.4,color,(1-t)*.4,.6);this.particles(at.x,at.y,cell*.7,color,clamp(t),seed+i,10,true);}
        }
        c.restore();
      }
      if(this.active.length)this.frame=requestAnimationFrame(t=>this.draw(t));
    }
  }
  window.BattleEffects=BattleEffects;
})();
