'use strict';
// A non-mutating transport probe: health, real WebSocket ping, and public room listing.
const {WebSocket}=require('ws');
async function probe(value){
  const u=new URL(/^[a-z]+:\/\//i.test(value)?value:'https://'+value);
  if(!['http:','https:','ws:','wss:'].includes(u.protocol)||u.username||u.password)throw Error('Use an HTTP(S) or WS(S) address without credentials');
  u.protocol=['https:','wss:'].includes(u.protocol)?'https:':'http:';u.hash='';u.search='';u.pathname=u.pathname.replace(/\/$/,'').replace(/\/ws$/,'');
  const base=u.href.replace(/\/$/,''),started=Date.now();const response=await fetch(base+'/health',{signal:AbortSignal.timeout(6000)});if(!response.ok)throw Error(`Health HTTP ${response.status}`);const health=await response.json();if(health.app!=='tactics-card-trials')throw Error('This address is not a tactics server');if(!health.capabilities?.includes('rooms'))throw Error(`Server ${health.version} needs the 0.8.0 room-lobby upgrade`);
  const endpoint=base.replace(/^http/,'ws')+'/ws';
  return new Promise((resolve,reject)=>{
    const socket=new WebSocket(endpoint);let pong=false,listing=null,settled=false;
    const timer=setTimeout(()=>finish(Error('WebSocket handshake or room-list timeout')),6000);
    function finish(err){if(settled)return;settled=true;clearTimeout(timer);socket.close();if(err)reject(err);else resolve({ok:true,version:health.version,endpoint,latencyMs:Date.now()-started,online:listing.online,rooms:listing.rooms.map(r=>({code:r.code,title:r.title,description:r.description,mode:r.mode,phase:r.phase,players:r.players.length,canJoin:r.canJoin}))});}
    socket.on('open',()=>{socket.send(JSON.stringify({type:'ping',at:started}));socket.send(JSON.stringify({type:'list'}));});socket.on('message',raw=>{let msg;try{msg=JSON.parse(raw);}catch{return;}if(msg.type==='pong'&&msg.at===started)pong=true;if(msg.type==='rooms')listing=msg;if(pong&&listing)finish();});socket.on('error',finish);socket.on('close',()=>{if(!settled)finish(Error('Server closed the connection'));});
  });
}
if(require.main===module){if(!process.argv[2]){console.error('Usage: node tools/probe-server.cjs https://your-server');process.exitCode=1;}else probe(process.argv[2]).then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error(e.message);process.exitCode=1;});}
module.exports={probe};
