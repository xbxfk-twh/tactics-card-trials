'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const {WebSocketServer, WebSocket} = require('ws');

const root = path.resolve(__dirname, '..');
const context = {window:{}, console};
vm.createContext(context);
for (const name of ['data/definitions.js','core/engine.js']) vm.runInContext(fs.readFileSync(path.join(root,'js',name),'utf8'),context);
const Game = context.window.TacticsGame;
const rooms = new Map();
const {RankStore,text}=require('./rank-store.cjs');
const store=new RankStore(process.env.TACTICS_DATA_FILE||path.join(root,'server-data','players.json'));
const VERSION='0.8.13';
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.mp3':'audio/mpeg'};

const server = http.createServer((req,res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/health') {
    res.writeHead(200, {'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Origin':'*','Cache-Control':'no-store'});
    res.end(JSON.stringify({app:'tactics-card-trials', version:'0.8.13', protocol:2, capabilities:['rooms','descriptions','ready','ranked','profiles']})); return;
  }
  if(url.pathname==='/api/lobby'){res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Origin':'*','Cache-Control':'no-store'}).end(JSON.stringify({rooms:roomList(),online:onlineCount()}));return;}
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { res.writeHead(400).end(); return; }
  const target = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  const relative=path.relative(root,target).replaceAll('\\','/');
  if (!target.startsWith(root + path.sep) ||
      !(relative==='index.html' || ['css/','js/','assets/'].some(prefix=>relative.startsWith(prefix)))) {
    res.writeHead(403).end();return;
  }
  fs.readFile(target,(err,body) => {
    if (err) {res.writeHead(404).end();return;}
    const headers={'Content-Type':mime[path.extname(target)] || 'application/octet-stream','Cache-Control':relative.startsWith('assets/')?'public, max-age=86400':'no-cache','Content-Length':body.length};
    if(relative.startsWith('assets/audio/')){
      headers['Accept-Ranges']='bytes';
      if(req.headers.range){
        const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);let start,end;
        if(match&&(match[1]||match[2])){start=match[1]?Number(match[1]):Math.max(0,body.length-Number(match[2]));end=match[1]?(match[2]?Math.min(Number(match[2]),body.length-1):body.length-1):body.length-1;}
        if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=body.length){res.writeHead(416,{'Content-Range':`bytes */${body.length}`}).end();return;}
        headers['Content-Range']=`bytes ${start}-${end}/${body.length}`;headers['Content-Length']=end-start+1;res.writeHead(206,headers).end(body.subarray(start,end+1));return;
      }
    }
    res.writeHead(200,headers).end(body);
  });
});

const wss = new WebSocketServer({noServer:true,maxPayload:8192});
server.on('upgrade',(req,socket,head)=>{if(req.url!=='/ws'){socket.destroy();return;}wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws));});
const send=(socket,data)=>{if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify(data));};
const error=(socket,message)=>send(socket,{type:'error',message});
const code=()=>crypto.randomBytes(4).toString('hex').toUpperCase();
function collection(value,open=false){
  const cards=context.window.GAME_DATA.cards,skills=context.window.GAME_DATA.skillCards;
  if(open)return {units:Object.keys(cards).filter(id=>!cards[id].tags.includes('召唤物')),skills:Object.keys(skills)};
  if(!value||!Array.isArray(value.units)||!Array.isArray(value.skills))return null;
  const units=[...new Set(value.units.filter(id=>typeof id==='string'&&cards[id]&&!cards[id].tags.includes('召唤物')))];
  const hands=[...new Set(value.skills.filter(id=>typeof id==='string'&&skills[id]))];
  return units.length+hands.length>=10&&units.length>=4?{units,skills:hands}:null;
}
function metadata(room){return {code:room.code,title:room.title,description:room.description,mode:room.mode,pool:room.pool,phase:room.game.phase,manualStart:room.manualStart,createdAt:room.createdAt,host:store.public(room.players.A?.profile)?.name||'房主',hostRating:room.players.A?.profile?.rating||1000,hostOnline:!!room.players.A?.socket,canJoin:!!room.players.A?.socket&&!room.players.B&&room.game.phase==='menu',players:['A','B'].filter(s=>room.players[s]).map(s=>({seat:s,name:room.players[s].profile.name,online:!!room.players[s].socket,ready:room.players[s].ready,rating:room.players[s].profile.rating})),deadline:room.turnDeadline||null,rankResult:room.rankResult||null};}
function onlineCount(){return new Set([...wss.clients].filter(s=>s.readyState===WebSocket.OPEN&&s.profile).map(s=>s.profile.id)).size;}
function roomList(){return [...rooms.values()].filter(r=>r.game.phase!=='end').map(metadata).sort((a,b)=>Number(b.canJoin)-Number(a.canJoin)||b.createdAt-a.createdAt).slice(0,50);}
function broadcastLobby(){const message={type:'rooms',rooms:roomList(),online:onlineCount()};for(const socket of wss.clients)if(socket.lobby)send(socket,message);}
function profile(socket){if(!socket.profile)socket.profile=store.authenticate(null,'').player;return socket.profile;}
function expireTurn(room){
  if(!rooms.has(room.code)||!['draft','deploy','battle'].includes(room.game.phase))return;
  const game=room.game,seat=game.team;
  if(game.phase==='draft'){game.pick(0);game.note('选卡超时，服务器自动选择第一张候选卡。');}
  else if(game.phase==='deploy'){
    for(const card of [...game.remaining(seat)]){let placed=false;for(const y of seat==='A'?[0,1]:[5,4]){for(let x=0;x<6;x++){if(!game.at({x,y}).length&&game.deploy(card.id,{x,y})){placed=true;break;}}if(placed)break;}}
    game.note('部署超时，服务器已在己方空格补齐剩余角色。');
  }else{game.endTurn();game.note('行动回合超时，服务器自动结束本回合。');}
  publish(room);
}
function syncClock(room){
  const g=room.game,key=['draft','deploy','battle'].includes(g.phase)?`${g.phase}:${g.team}:${g.round}`:null;
  if(key===room.turnKey)return;clearTimeout(room.turnTimer);room.turnKey=key;room.turnDeadline=null;
  if(!key)return;const duration=g.phase==='draft'?45000:g.phase==='deploy'?90000:120000;
  room.turnDeadline=Date.now()+duration;room.turnTimer=setTimeout(()=>{if(room.turnKey===key)expireTurn(room);},duration);room.turnTimer.unref();
}
function publish(room){
  syncClock(room);
  for(const seat of ['A','B']){const player=room.players[seat];if(!player)continue;const state=room.game.snapshot();state.hands[seat==='A'?'B':'A']=[];send(player.socket,{type:'state',room:room.code,matchId:room.matchId,seat,connected:{A:!!room.players.A?.socket,B:!!room.players.B?.socket},state,metadata:metadata(room)});send(player.socket,{type:'profile',profile:store.public(player.profile)});}
  broadcastLobby();
}
function settle(room){if(room.game.phase==='end'&&!room.rankResult)room.rankResult=store.settle(room,room.game.winner);}
function forfeit(room,seat,reason){if(room.game.phase==='menu'||room.game.phase==='end')return;room.game.phase='end';room.game.winner=seat==='A'?'B':'A';room.game.note(reason);settle(room);publish(room);}
function startRoom(room){room.game.start({A:room.players.A.collection,B:room.players.B.collection});room.game.mode='online';room.startedAt=Date.now();publish(room);}
function join(socket,room,seat,cards){
  const token=crypto.randomBytes(24).toString('hex');room.players[seat]={token,socket,collection:cards,profile:profile(socket),ready:seat==='A',offlineAt:null};socket.room=room;socket.seat=seat;
  send(socket,{type:'joined',room:room.code,seat,token,metadata:metadata(room)});
  if(room.players.A&&room.players.B&&room.game.phase==='menu'&&!room.manualStart)startRoom(room);else publish(room);
}
function leave(socket){
  const room=socket.room,seat=socket.seat;if(!room)return;if(room.players[seat]?.socket!==socket){socket.room=null;socket.seat=null;return error(socket,'房间连接已被新的重连会话替代。');}
  forfeit(room,seat,'一方主动离开，判定认输。');
  if(room.game.phase==='menu'){
    if(seat==='A'){for(const player of Object.values(room.players))if(player?.socket&&player.socket!==socket){player.socket.room=null;player.socket.seat=null;send(player.socket,{type:'room_closed',message:'房主已关闭房间。'});}rooms.delete(room.code);}
    else room.players.B=null;
  }else if(room.players[seat])room.players[seat].socket=null;
  socket.room=null;socket.seat=null;send(socket,{type:'left'});if(rooms.has(room.code))publish(room);else broadcastLobby();
}
function action(socket,msg){
  const room=socket.room,seat=socket.seat;if(!room||room.players[seat]?.socket!==socket)return error(socket,'房间连接无效。');
  const game=room.game;if(game.phase==='end')return error(socket,'对局已经结束。');if(game.team!==seat)return error(socket,'还没轮到你。');
  const pos={x:msg.x,y:msg.y};let done=false;
  if(msg.action==='pick'&&game.phase==='draft'&&Number.isInteger(msg.index))done=game.pick(msg.index);
  else if(msg.action==='deploy'&&game.phase==='deploy'&&typeof msg.id==='string')done=game.deploy(msg.id,pos);
  else if(game.phase==='battle'){
    if(msg.action==='move')done=game.move(msg.uid,pos);
    else if(msg.action==='attack')done=game.attack(msg.uid,msg.targetUid);
    else if(msg.action==='skill')done=game.useSkill(msg.uid,msg.id,pos,msg.targetUid??null);
    else if(msg.action==='hand')done=game.playHand(msg.id,pos,msg.targetUid??null);
    else if(msg.action==='end-turn'){game.endTurn();done=true;}
  }
  if(!done)return error(socket,game.log[0]||'当前操作无效。');
  const kind=msg.action==='attack'?'attack':msg.action==='move'?'move':['skill','hand'].includes(msg.action)?'skill':null;if(kind)room.counts[seat][kind]++;
  settle(room);publish(room);
}
wss.on('connection',socket=>{
  socket.alive=true;socket.on('pong',()=>{socket.alive=true;});
  socket.on('error',()=>{});socket.messageWindow=Date.now();socket.messageCount=0;
  socket.on('message',raw=>{
    if(Date.now()-socket.messageWindow>10000){socket.messageWindow=Date.now();socket.messageCount=0;}if(++socket.messageCount>120)return error(socket,'操作过于频繁，请稍后再试。');
    let msg;try{msg=JSON.parse(raw);}catch{return error(socket,'消息格式错误。');}if(!msg||typeof msg!=='object')return error(socket,'消息格式错误。');
    try{
      if(msg.type==='hello'){
        if(socket.room)return error(socket,'请先离开当前房间再切换身份。');const auth=store.authenticate(msg.identity,msg.name);socket.profile=auth.player;socket.lobby=true;
        send(socket,{type:'welcome',version:VERSION,identity:auth.identity,profile:store.public(auth.player)});broadcastLobby();
      }else if(msg.type==='list'){socket.lobby=true;send(socket,{type:'rooms',rooms:roomList(),online:onlineCount()});}
      else if(msg.type==='ping')send(socket,{type:'pong',at:msg.at,version:VERSION});
      else if(msg.type==='profile'){store.rename(profile(socket),msg.name);send(socket,{type:'profile',profile:store.public(socket.profile)});if(socket.room)publish(socket.room);}
      else if(msg.type==='create'){
        if(socket.room)return error(socket,'请先离开当前房间。');if(rooms.size>=200)return error(socket,'当前房间较多，请稍后再试。');
        const mode=msg.mode==='ranked'?'ranked':'casual',pool=mode==='ranked'||msg.pool==='open'?'open':'collection';const cards=collection(msg.collection,pool==='open');if(!cards)return error(socket,'自有卡池需要至少 10 张卡，且拥有至少 4 名角色；也可选择公共卡池。');
        const now=Date.now(),room={code:code(),title:text(msg.title,24)||'旅人的棋局',description:text(msg.description,160)||'欢迎落座，一起下盘好棋。',mode,pool,manualStart:mode==='ranked'||!!msg.manualStart,matchId:crypto.randomUUID(),players:{A:null,B:null},game:new Game(),lastActive:now,createdAt:now,counts:{A:{attack:0,move:0,skill:0},B:{attack:0,move:0,skill:0}},settled:false};rooms.set(room.code,room);join(socket,room,'A',cards);
      }else if(msg.type==='join'){
        if(socket.room)return error(socket,'请先离开当前房间。');const room=rooms.get(String(msg.room||'').trim().toUpperCase());if(!room||room.players.B||!room.players.A?.socket||room.game.phase!=='menu')return error(socket,'房间不存在、已满或已开始，请刷新列表。');
        const who=profile(socket);if(who.id===room.players.A.profile.id)return error(socket,'不能使用同一身份加入自己的房间。');const cards=collection(msg.collection,room.pool==='open');if(!cards)return error(socket,'此房间使用自有卡池，需要至少 10 张卡和 4 名角色。');join(socket,room,'B',cards);
      }else if(msg.type==='resume'){
        const room=rooms.get(msg.room),seat=['A','B'].find(s=>room?.players[s]?.token===msg.token);if(!seat)return error(socket,'无法恢复房间，请重新建房。');if(socket.room&&socket.room!==room)return error(socket,'请先离开当前房间。');
        const p=room.players[seat];p.socket?.close();p.socket=socket;p.offlineAt=null;socket.profile=p.profile;socket.room=room;socket.seat=seat;send(socket,{type:'joined',room:room.code,seat,token:msg.token,metadata:metadata(room)});publish(room);
      }else if(msg.type==='room_update'){
        const room=socket.room;if(!room||socket.seat!=='A'||room.players.A?.socket!==socket)return error(socket,'只有房主可以修改简介。');if(room.game.phase!=='menu')return error(socket,'对局开始后不能修改房间。');room.title=text(msg.title,24)||room.title;room.description=text(msg.description,160);publish(room);
      }else if(msg.type==='ready'){
        const room=socket.room;if(!room||room.players[socket.seat]?.socket!==socket||room.game.phase!=='menu')return error(socket,'当前不能准备。');room.players[socket.seat].ready=!!msg.ready;publish(room);
      }else if(msg.type==='start'){
        const room=socket.room;if(!room||socket.seat!=='A'||room.players.A?.socket!==socket)return error(socket,'只有房主可以开始对局。');if(room.game.phase!=='menu'||!room.players.B?.socket||!room.players.A?.socket||!room.players.A.ready||!room.players.B.ready)return error(socket,'双方在线并准备后才能开始。');startRoom(room);
      }else if(msg.type==='leave')leave(socket);
      else if(msg.type==='surrender'){if(!socket.room||socket.room.players[socket.seat]?.socket!==socket)return error(socket,'不在有效房间中。');forfeit(socket.room,socket.seat,'一方认输，棋局结束。');}
      else if(msg.type==='action')action(socket,msg);
      if(socket.room)socket.room.lastActive=Date.now();
    }catch(err){error(socket,err.message||'服务器暂时无法处理本次请求。');}
  });
  socket.on('close',()=>{
    const room=socket.room,seat=socket.seat;if(room&&room.players[seat]?.socket===socket){const p=room.players[seat];p.socket=null;p.offlineAt=Date.now();publish(room);
      const at=p.offlineAt;setTimeout(()=>{if(!rooms.has(room.code)||room.players[seat]!==p||p.socket||p.offlineAt!==at)return;if(room.game.phase!=='menu'&&room.game.phase!=='end'){if(!room.players[seat==='A'?'B':'A']?.socket){room.game.phase='end';room.game.winner=null;room.game.note('双方均已离线，对局终止且不计分。');room.settled=true;room.rankResult={counted:false,reason:'双方均已离线，本场不计分。',...Object.fromEntries(['A','B'].map(s=>[s,{before:room.players[s].profile.rating,after:room.players[s].profile.rating,delta:0}]))};publish(room);}else forfeit(room,seat,'断线超过 45 秒未重连，判定离线方认输。');}else if(room.game.phase==='menu'&&seat==='B'){room.players.B=null;publish(room);}},45000).unref();
    }broadcastLobby();
  });
});
// Protocol pings keep nginx/mobile links alive while players are thinking or browsing.
function heartbeat(){for(const socket of wss.clients){if(socket.readyState!==WebSocket.OPEN)continue;if(!socket.alive){socket.terminate();continue;}socket.alive=false;socket.ping();}}
setInterval(heartbeat,25000).unref();
setInterval(()=>{const now=Date.now();let changed=false;for(const [id,r] of rooms)if(now-r.lastActive>2*60*60*1000||(!r.players.A?.socket&&r.game.phase==='menu'&&now-r.lastActive>10*60*1000)){for(const p of Object.values(r.players))if(p?.socket){p.socket.room=null;p.socket.seat=null;send(p.socket,{type:'room_closed',message:'房间长时间无活动，已关闭。'});}rooms.delete(id);changed=true;}if(changed)broadcastLobby();},60000).unref();
if(require.main===module)server.listen(Number(process.env.PORT)||8080,process.env.HOST||'0.0.0.0',()=>console.log(`Tactics room server: http://127.0.0.1:${server.address().port}/`));
module.exports={server,rooms,store,wss,expireTurn,heartbeat};
