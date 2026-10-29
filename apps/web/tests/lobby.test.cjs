'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {WebSocket}=require('ws');
process.env.TACTICS_DATA_FILE=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'tactics-lobby-')),'players.json');
const {server,rooms,store,wss,expireTurn,heartbeat}=require('../server/server.cjs');
const {RankStore}=require('../server/rank-store.cjs');
const clients=[];
async function connect(url){const socket=new WebSocket(url),queue=[],pending=[];socket.on('message',raw=>{const value=JSON.parse(raw);queue.push(value);for(const waiter of [...pending]){const i=queue.findIndex(waiter.test);if(i>=0){pending.splice(pending.indexOf(waiter),1);clearTimeout(waiter.timer);waiter.resolve(queue.splice(i,1)[0]);}}});await new Promise((resolve,reject)=>{socket.once('open',resolve);socket.once('error',reject);});clients.push(socket);return {socket,send:data=>socket.send(JSON.stringify(data)),next:(type,test=()=>true)=>{const predicate=x=>x.type===type&&test(x),i=queue.findIndex(predicate);if(i>=0)return Promise.resolve(queue.splice(i,1)[0]);return new Promise((resolve,reject)=>{const waiter={test:predicate,resolve,timer:setTimeout(()=>reject(Error('Timed out waiting for '+type)),4000)};pending.push(waiter);});}};}
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`,url=base.replace('http:','ws:')+'/ws';
  const health=await fetch(base+'/health');assert.ok((await health.json()).capabilities.includes('ranked'));assert.equal(health.headers.get('access-control-allow-origin'),'*');
  const a=await connect(url),b=await connect(url),observer=await connect(url);
  const ping=new Promise(resolve=>a.socket.once('ping',resolve));heartbeat();await ping;
  await new Promise(resolve=>setTimeout(resolve,20));assert.ok([...wss.clients].every(s=>s.alive),'browser protocol pongs preserve idle connections');
  a.send({type:'hello',name:'青枝'});b.send({type:'hello',name:'晚星'});const ia=(await a.next('welcome')).identity,ib=(await b.next('welcome')).identity;
  observer.send({type:'list'});assert.equal((await observer.next('rooms')).rooms.length,0);
  a.send({type:'create',pool:'open',mode:'ranked',title:'星光第一局',description:'欢迎新棋手，慢慢想。',manualStart:true});const joined=await a.next('joined');const room=rooms.get(joined.room);assert.equal(room.game.phase,'menu');
  const lobby=await observer.next('rooms',x=>x.rooms.some(r=>r.code===joined.room));assert.equal(lobby.rooms[0].description,'欢迎新棋手，慢慢想。');assert.ok(lobby.rooms[0].canJoin);assert.ok(!JSON.stringify(lobby).includes('token'));assert.ok(!JSON.stringify(lobby).includes('hash'));
  b.send({type:'join',room:joined.room});await b.next('joined');await b.next('state',x=>x.metadata.players.length===2);assert.equal(room.game.phase,'menu','both players explicitly prepare before host starts');
  b.send({type:'room_update',description:'修改房主简介'});assert.match((await b.next('error')).message,/房主/);
  a.send({type:'start'});assert.match((await a.next('error')).message,/准备/);
  b.send({type:'ready',ready:true});await a.next('state',x=>x.metadata.players[1]?.ready);
  a.send({type:'start'});const draft=await a.next('state',x=>x.state.phase==='draft');assert.equal(draft.state.team,'A');assert.ok(draft.state.candidates.length);
  const before=JSON.stringify(room.game.snapshot());b.send({type:'action',action:'pick',index:0});await b.next('error');assert.equal(JSON.stringify(room.game.snapshot()),before);
  a.send({type:'surrender'});const result=await b.next('state',x=>x.state.phase==='end');assert.equal(result.state.winner,'B');assert.equal(result.metadata.rankResult.B.delta,24);assert.equal(room.players.B.profile.rating,1024);assert.equal(room.players.A.profile.rating,976);
  a.send({type:'surrender'});a.send({type:'leave'});await a.next('left');assert.equal(store.data.matches.length,1,'results are settled once');
  const restored=new RankStore(process.env.TACTICS_DATA_FILE);assert.equal(restored.authenticate(ib).player.rating,1024);assert.equal(restored.authenticate(ia).player.games,1);const database=fs.readFileSync(process.env.TACTICS_DATA_FILE,'utf8');assert.ok(!database.includes(ia.token),'raw identity tokens never enter the database');
  b.send({type:'leave'});await b.next('left');
  a.send({type:'create',pool:'open',mode:'casual',manualStart:true,title:'友好练棋',description:'最初的简介'});const casual=await a.next('joined');const casualRoom=rooms.get(casual.room);
  a.send({type:'room_update',title:'新的棋桌',description:'新的房间简介'});await a.next('state',x=>x.metadata.description==='新的房间简介');
  const listing=await(await fetch(base+'/api/lobby')).json();assert.equal(listing.rooms.find(r=>r.code===casual.room).title,'新的棋桌');
  b.send({type:'join',room:casual.room});await b.next('joined');a.send({type:'leave'});await b.next('room_closed');assert.equal(rooms.has(casual.room),false);assert.equal(casualRoom.players.B.socket.room,null);
  // A forged identity cannot impersonate a player, and self-opponents cannot enter ranked rooms.
  observer.send({type:'hello',identity:{id:ia.id,token:'wrong'}});assert.match((await observer.next('error')).message,/身份/);
  const duplicate=await connect(url);duplicate.send({type:'hello',identity:ia});await duplicate.next('welcome');
  a.send({type:'create',pool:'open',mode:'ranked',manualStart:true});const self=await a.next('joined');duplicate.send({type:'join',room:self.room});assert.match((await duplicate.next('error')).message,/同一身份/);a.send({type:'leave'});await a.next('left');
  assert.equal((await fetch(base+'/server-data/players.json')).status,403);
  const audit=await require('../tools/probe-server.cjs').probe(base);assert.equal(audit.ok,true);assert.equal(audit.version,'0.8.13');
  const capA=store.authenticate(null,'封顶测试甲').player,capB=store.authenticate(null,'封顶测试乙').player;
  for(let i=0;i<4;i++){
    const fixture={mode:'ranked',matchId:'cap-test-'+i,players:{A:{profile:capA},B:{profile:capB}},counts:{A:{attack:2,move:1,skill:1},B:{attack:1,move:1,skill:0}}};
    const settled=store.settle(fixture,'A');assert.equal(settled.counted,i<3);if(i===3)assert.equal(settled.A.delta,0);assert.equal(store.settle(fixture,'A'),null);
  }
  a.send({type:'create',pool:'open',manualStart:true});const timed=await a.next('joined');b.send({type:'join',room:timed.room});await b.next('joined');b.send({type:'ready',ready:true});await a.next('state',x=>x.room===timed.room&&x.metadata.players[1]?.ready);a.send({type:'start'});await a.next('state',x=>x.room===timed.room&&x.state.phase==='draft');const timedRoom=rooms.get(timed.room);assert.ok(timedRoom.turnDeadline>Date.now());expireTurn(timedRoom);assert.equal(timedRoom.game.draftCount,1);assert.equal(timedRoom.game.team,'B');assert.ok(timedRoom.turnDeadline>Date.now());
  assert.equal(capA.games,3);assert.equal(capA.counts.attack,6);
  console.log('Real lobby, host metadata, readiness, turn authority, persistent rating and identity checks passed');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{for(const s of clients)s.terminate();for(const s of wss.clients)s.terminate();server.close();});
