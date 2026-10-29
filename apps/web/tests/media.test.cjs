'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),os=require('node:os');
const source=fs.readFileSync(path.join(__dirname,'../js/ui/music.js'),'utf8');
const listeners={},timers=[],frames=[];let stored=null;
class AudioStub {constructor(){this.paused=true;this.starts=0;this.reject=false;}addEventListener(){}pause(){this.paused=true;}async play(){this.starts++;if(this.reject)throw Object.assign(Error('gesture required'),{name:'NotAllowedError'});this.paused=false;}}
const document={hidden:false,addEventListener:(type,fn)=>{(listeners[type]||=[]).push(fn);}};
const context={window:{addEventListener(){}},Audio:AudioStub,document,localStorage:{getItem:()=>stored,setItem:(key,value)=>{stored=value;}},performance:{now:()=>0},requestAnimationFrame:fn=>{frames.push(fn);return frames.length;},cancelAnimationFrame(){},setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout(){}};
vm.runInNewContext(source,context);const music=new context.window.GameMusic();
const tick=()=>new Promise(r=>setImmediate(r));
process.env.TACTICS_DATA_FILE=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'tactics-media-')),'players.json');
const {server}=require('../server/server.cjs');
(async()=>{
 assert.equal(music.player.starts,0,'no unsolicited autoplay or audio fetch');music.unlock();await tick();assert.equal(music.loaded,'journey');assert.equal(music.player.loop,true);
 music.player.volume=0;music.fade(.32);frames.pop()(-5);assert.equal(music.player.volume,0,'a frame timestamp before fade start cannot produce an invalid negative volume');
 const starts=music.player.starts;music.sync('journey');assert.equal(music.player.starts,starts,'rendering the same scene does not restart music');
 music.sync('battle');timers.pop()();await tick();assert.equal(music.loaded,'battle');
 document.hidden=true;listeners.visibilitychange[0]();assert.equal(music.player.paused,true);
 document.hidden=false;listeners.visibilitychange[0]();await tick();assert.equal(music.player.paused,false);
 music.setEnabled(false);const mutedStarts=music.player.starts;music.unlock();assert.equal(music.player.starts,mutedStarts);assert.equal(music.player.paused,true);
 music.setVolume(.17);assert.equal(JSON.parse(stored).volume,.17);const restored=new context.window.GameMusic();assert.equal(restored.enabled,false);assert.equal(restored.volume,.17);
 music.player.reject=true;music.setEnabled(true);await tick();assert.equal(music.blocked,true);music.player.reject=false;music.unlock();await tick();assert.equal(music.blocked,false);
 music.setEnabled(false);
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 for(const name of ['moonlit-grove-v1','starlit-tactics-v1']){
   const file=fs.readFileSync(path.join(__dirname,`../assets/audio/${name}.mp3`));const url=base+`/assets/audio/${name}.mp3`;
   const full=await fetch(url);assert.equal(full.headers.get('content-type'),'audio/mpeg');assert.equal(Number(full.headers.get('content-length')),file.length);assert.deepEqual(Buffer.from(await full.arrayBuffer()),file);
   const start=await fetch(url,{headers:{Range:'bytes=0-31'}});assert.equal(start.status,206);assert.equal(start.headers.get('content-range'),`bytes 0-31/${file.length}`);assert.deepEqual(Buffer.from(await start.arrayBuffer()),file.subarray(0,32));
   const tail=await fetch(url,{headers:{Range:'bytes=-12'}});assert.equal(tail.status,206);assert.deepEqual(Buffer.from(await tail.arrayBuffer()),file.subarray(-12));
   assert.equal((await fetch(url,{headers:{Range:'bytes=999999999-'}})).status,416);
 }
 console.log('Scene music, gesture recovery, mute/volume persistence, background pause and mobile MP3 ranges passed');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
