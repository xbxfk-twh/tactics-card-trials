'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),profile=fs.mkdtempSync(path.join(os.tmpdir(),'tactics-story-chrome-')),port=19264;
process.env.TACTICS_DATA_FILE=path.join(profile,'players.json');const {server}=require('../server/server.cjs');
let child,socket,seq=0;const pending=new Map(),errors=[],pause=ms=>new Promise(r=>setTimeout(r,ms));
function command(method,params={}){return new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const result=await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.result.exceptionDetails)throw Error(JSON.stringify(result.result.exceptionDetails));return result.result.result.value;}
async function until(expression){for(let n=0;n<100;n++){if(await evaluate(expression))return;await pause(100);}throw Error('Timed out: '+expression);}
async function click(selector){const p=await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);await command('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',clickCount:1});await command('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',clickCount:1});}
async function shot(name){await evaluate('Promise.all([...document.images].map(i=>i.decode().catch(()=>{})))');const r=await command('Page.captureScreenshot',{format:'png'});const out=path.join(root,'../../artifacts/screenshots/mobile');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(r.result.data,'base64'));}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}/`;
 child=spawn(process.env.CHROME_PATH||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',['--headless=new','--disable-gpu','--no-first-run',`--user-data-dir=${profile}`,`--remote-debugging-port=${port}`,base],{stdio:'ignore',windowsHide:true});
 let target;for(let n=0;n<80;n++){try{target=(await(await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t=>t.url===base);if(target)break;}catch{}await pause(100);}assert.ok(target);
 socket=new WebSocket(target.webSocketDebuggerUrl);socket.onmessage=event=>{const m=JSON.parse(event.data);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);};await new Promise(r=>socket.addEventListener('open',r,{once:true}));await command('Runtime.enable');await command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});

 await until('!!window.__TACTICS_TEST__');await click('[data-action=campaign]');await click('[data-action=solo-camp]');
 assert.ok(await evaluate("document.querySelector('.camp-resource').textContent.includes('无充能')"));
 await click('[data-action=camp-open][data-id=active]');
 assert.equal(await evaluate("document.querySelectorAll('[data-action=solo-active]').length"),12);
 assert.equal(await evaluate("document.querySelectorAll('.loadout-card.locked').length"),9);
 assert.ok(await evaluate("[...document.querySelectorAll('.loadout-card.locked button')].every(b=>b.disabled)"));
 await click('[data-action=camp-close]');
 // A genuine engine win drives the UI completion path. Larger encounters use a one-enemy fixture.
 for(let level=1;level<=9;level++){
  await evaluate(`(()=>{const t=__TACTICS_TEST__;Object.assign(t.solo,SoloCampaign.normalize({cleared:Array.from({length:${level-1}},(_,i)=>i+1),active:['fireball','precise_shot','shield'],passives:['guard','stride']}));SoloCampaign.save(t.solo);})()`);
  if(level>1)await click('[data-action=solo-camp]');
  await click('[data-action=solo-start]');await click('[data-action=cell][data-x="1"][data-y="1"]');
  await evaluate("(()=>{const t=__TACTICS_TEST__,g=t.game,a=g.units.find(u=>u.team==='A'),b=g.units.find(u=>u.team==='B');g.units=g.units.filter(u=>u.team==='A'||u===b);b.x=a.x;b.y=a.y+1;b.size=1;b.hp=1;b.shield=0;b.oneShield=false;b.defense=0;g.select(a.uid);t.render();t.cellClick(b.x,b.y);})()");
  await until("!!document.querySelector('.ember-cinematic')");assert.equal(await evaluate('__TACTICS_TEST__.solo.cleared.length'),level);
  assert.equal(await evaluate('SoloCampaign.unlocked(__TACTICS_TEST__.solo).length'),level+3);
  const saved=await evaluate('JSON.stringify(__TACTICS_TEST__.solo)');
  for(const [width,height] of [[320,568],[390,844],[1280,720],[844,390]]){
   await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<701});
   await evaluate('Promise.all([...document.images].map(i=>i.decode()))');
   for(let page=0;page<3;page++){
    const rect=await evaluate("(()=>{const r=document.querySelector('.ember-cinematic').getBoundingClientRect(),b=document.querySelector('[data-action=solo-story-next]').getBoundingClientRect();return {sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight,w:innerWidth,h:innerHeight,bottom:r.bottom,button:{left:b.left,top:b.top,right:b.right,bottom:b.bottom},image:document.querySelector('.ember-cinematic-art img').naturalWidth};})()");
    assert.ok(rect.sw<=width&&rect.sh<=height+1,JSON.stringify(rect));assert.ok(rect.button.left>=0&&rect.button.right<=width&&rect.button.top>=0&&rect.button.bottom<=height,JSON.stringify(rect));assert.ok(rect.image>0);
    if(page<2)await click('[data-action=solo-story-next]');
   }
   if(level===6&&width===390)await shot('47-ember-furnace-story');
   await click('[data-action=solo-story-prev]');await click('[data-action=solo-story-prev]');
  }
  assert.equal(await evaluate('JSON.stringify(__TACTICS_TEST__.solo)'),saved,'reading chapters never duplicates rewards');
  await command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await click('[data-action=solo-story-skip]');assert.ok(await evaluate("document.body.textContent.includes('1 属性点 + 1 技能点')"));
  await click('[data-action=solo-story-replay]');await until("!!document.querySelector('.ember-cinematic')");await click('[data-action=solo-story-skip]');
 }
 await click('[data-action=solo-camp]');await click('[data-action=solo-stage][data-id="6"]');await click('[data-action=camp-open][data-id=briefing]');await click('[data-action=camp-open][data-id=memory]');
 assert.equal(await evaluate("document.querySelectorAll('.memory-copy p').length"),3);await shot('48-ember-memory');await click('[data-action=camp-close]');
 await click('[data-action=camp-open][data-id=active]');assert.equal(await evaluate("document.querySelectorAll('.loadout-card.locked').length"),0);assert.ok(await evaluate("!document.querySelector('.camp-dialog').textContent.includes('undefined')"));await shot('49-ember-unlocked-skills');await click('[data-action=camp-close]');
 await click('[data-action=solo-start]');await click('[data-action=cell][data-x="1"][data-y="1"]');await evaluate("(()=>{const t=__TACTICS_TEST__;t.game.phase='end';t.game.winner='B';t.render();})()");assert.equal(await evaluate("document.querySelectorAll('.ember-cinematic').length"),0,'losses cannot play victory chapters');
 await command('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await evaluate("document.body.insertAdjacentHTML('beforeend',SoloView.ending(9,0,false))");assert.equal(await evaluate("getComputedStyle(document.querySelector('.ember-cinematic-art img')).animationName"),'none');
 assert.deepEqual(errors,[]);console.log('Nine victory chapters, all 27 pages on four viewport sizes, unlocks, non-duplicating replay, archive, loss exclusion and image loading passed');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{socket?.close();child?.kill();server.close();await pause(500);assert.ok(path.resolve(profile).startsWith(path.resolve(os.tmpdir())+path.sep+'tactics-story-chrome-'));fs.rmSync(profile,{recursive:true,force:true,maxRetries:15,retryDelay:200});});
