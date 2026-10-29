'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{WebSocket}=require('ws');
process.env.TACTICS_DATA_FILE=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'tactics-summon-online-')),'players.json');
const {server,rooms,wss}=require('../server/server.cjs');const sockets=[];
async function peer(url){const socket=new WebSocket(url),queue=[];sockets.push(socket);socket.on('message',raw=>queue.push(JSON.parse(raw)));await new Promise((r,j)=>{socket.once('open',r);socket.once('error',j);});return {send:m=>socket.send(JSON.stringify(m)),async next(type,where=()=>true){for(let n=0;n<150;n++){const i=queue.findIndex(m=>m.type===type&&where(m));if(i>=0)return queue.splice(i,1)[0];await new Promise(r=>setTimeout(r,20));}throw Error('Timed out: '+type);}};}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`ws://127.0.0.1:${server.address().port}/ws`,a=await peer(url),b=await peer(url);
 a.send({type:'create',pool:'open',mode:'casual',manualStart:true});const joined=await a.next('joined');b.send({type:'join',room:joined.room});await b.next('joined');const room=rooms.get(joined.room),g=room.game;
 // A deterministic battle fixture keeps this test focused on the real transport/rule boundary.
 g.reset();g.phase='battle';g.mode='online';g.team='A';const master=g.spawn('puppet_master','A',{x:0,y:0}),enemy=g.spawn('necromancer','B',{x:1,y:1});
 a.send({type:'action',action:'skill',uid:master.uid,id:'puppet',x:1,y:0});const born=await a.next('state',m=>m.state.units.some(u=>u.ownerUid===master.uid));const puppet=born.state.units.find(u=>u.ownerUid===master.uid);assert.equal(puppet.summonerUid,master.uid);assert.equal(puppet.mp,0);assert.equal(puppet.ap,1);assert.equal(master.ap,0);
 master.x=5;master.y=2;const hp=enemy.hp;
 a.send({type:'action',action:'attack',uid:puppet.uid,targetUid:enemy.uid});assert.match((await a.next('error')).message,/操控范围/);assert.equal(enemy.hp,hp);
 b.send({type:'action',action:'move',uid:puppet.uid,x:2,y:0});assert.match((await b.next('error')).message,/轮到/);
 a.send({type:'action',action:'move',uid:puppet.uid,x:2,y:0});const recovered=await a.next('state',m=>m.state.units.some(u=>u.uid===puppet.uid&&u.x===2));const p=recovered.state.units.find(u=>u.uid===puppet.uid);assert.equal(p.mp,0);assert.equal(p.ap,0,'zero-MP puppet movement consumes its only AP over the network');
 a.send({type:'action',action:'end-turn'});await b.next('state',m=>m.state.team==='B');master.hp=1;enemy.x=5;enemy.y=1;
 b.send({type:'action',action:'attack',uid:enemy.uid,targetUid:master.uid});const result=await a.next('state',m=>m.state.phase==='end');assert.equal(result.state.winner,'B');assert.ok(!result.state.units.some(u=>u.ownerUid===master.uid));assert.equal(result.state.units.filter(u=>u.id==='skeleton').length,1);assert.equal(room.counts.A.skill,1);assert.equal(room.counts.A.move,1);assert.equal(room.counts.A.attack,0,'rejected remote attacks do not enter rank action counters');
 console.log('Real dual-client puppet creation, owner metadata, rejected remote attacks, paid recovery, turn authority and owner-death cleanup passed');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{for(const s of sockets)s.terminate();for(const s of wss.clients)s.terminate();server.close();});
