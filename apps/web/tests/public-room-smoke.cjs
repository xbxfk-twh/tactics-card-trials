/* Opt-in public smoke: creates one casual room and two visitors; never changes ratings. */
'use strict';
const assert=require('node:assert/strict'),{WebSocket}=require('ws');
const base=process.argv[2];if(!base)throw Error('Pass an explicit deployed HTTP(S) game URL.');
const url=new URL('ws',base.endsWith('/')?base:base+'/');url.protocol=url.protocol==='https:'?'wss:':'ws:';
const clients=[];let code;
async function peer(){const socket=new WebSocket(url),queue=[];socket.on('message',r=>queue.push(JSON.parse(r)));clients.push(socket);await new Promise((r,j)=>{socket.once('open',r);socket.once('error',j);});return {socket,send:m=>socket.send(JSON.stringify(m)),async next(type,predicate=()=>true){for(let n=0;n<200;n++){const i=queue.findIndex(x=>x.type===type&&predicate(x));if(i>=0)return queue.splice(i,1)[0];const err=queue.find(x=>x.type==='error');if(err&&type!=='error')throw Error(err.message);await new Promise(r=>setTimeout(r,50));}throw Error('Timeout: '+type);}};}
(async()=>{
 const a=await peer(),b=await peer();
 a.send({type:'hello',name:'部署验证甲'});b.send({type:'hello',name:'部署验证乙'});await a.next('welcome');await b.next('welcome');
 a.send({type:'create',pool:'open',mode:'casual',manualStart:true,title:'上线验证 · 稍后自动关闭',description:'部署测试房间：验证公网双端操作，不计段位。'});
 const joined=await a.next('joined');code=joined.room;
 b.send({type:'list'});assert.ok((await b.next('rooms',x=>x.rooms.some(r=>r.code===code))).rooms.find(r=>r.code===code).description.includes('部署测试'));
 a.send({type:'room_update',description:'房主简介更新已同步'});await a.next('state',x=>x.metadata.description==='房主简介更新已同步');
 b.send({type:'join',room:code});await b.next('joined');b.send({type:'ready',ready:true});await a.next('state',x=>x.metadata.players[1]?.ready);
 a.send({type:'start'});let state=(await a.next('state',x=>x.state.phase==='draft')).state;
 for(let n=0;n<8;n++){(state.team==='A'?a:b).send({type:'action',action:'pick',index:0});state=(await a.next('state',x=>x.state.draftCount>n)).state;}
 assert.equal(state.phase,'deploy');
 for(const team of ['A','B'])for(let n=0;state.phase==='deploy'&&state.deployTeam===team;n++){const card=state.picks[team].filter(c=>c.kind==='unit'&&!state.units.some(u=>u.team===team&&u.id===c.id))[0];assert.ok(card);(team==='A'?a:b).send({type:'action',action:'deploy',id:card.id,x:n,y:team==='A'?0:5});state=(await a.next('state',x=>x.state.units.length>state.units.length)).state;}
 assert.equal(state.phase,'battle');a.send({type:'action',action:'end-turn'});await a.next('state',x=>x.state.team==='B');
 a.send({type:'action',action:'end-turn'});await a.next('error');
 a.socket.close();await new Promise(r=>setTimeout(r,500));const resumed=await peer();resumed.send({type:'resume',room:code,token:joined.token});assert.equal((await resumed.next('joined')).seat,'A');assert.equal((await resumed.next('state')).state.team,'B');
 b.send({type:'surrender'});const result=await resumed.next('state',x=>x.state.phase==='end');assert.equal(result.state.winner,'A');assert.equal(result.metadata.mode,'casual');
 resumed.send({type:'leave'});await resumed.next('left');b.send({type:'leave'});await b.next('left');
 const lobby=await(await fetch(new URL('api/lobby',base.endsWith('/')?base:base+'/'))).json();assert.ok(!lobby.rooms.some(r=>r.code===code));
 console.log('Public TLS/WSS: room listing, description edit, ready/start, draft/deployment, turns, authority, reconnect, casual result and room cleanup passed.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{for(const s of clients){if(s.readyState===WebSocket.OPEN)s.send(JSON.stringify({type:'leave'}));s.close();}});
