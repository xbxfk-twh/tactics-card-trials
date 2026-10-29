const assert=require('node:assert/strict');
const {WebSocket}=require('ws');
const path=require('node:path');
const root=process.env.TACTICS_GAME_ROOT ? path.resolve(process.env.TACTICS_GAME_ROOT) : path.resolve(__dirname,'..');
process.env.TACTICS_DATA_FILE=process.env.TACTICS_DATA_FILE||path.join(require('node:fs').mkdtempSync(path.join(require('node:os').tmpdir(),'tactics-room-test-')),'players.json');
const {server,rooms}=require(path.join(root,'server/server.cjs'));
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const connect=url=>new Promise(resolve=>{const ws=new WebSocket(url);ws.once('open',()=>resolve(ws));});
function inbox(ws) {
  const queue=[],listeners=[];
  ws.on('message',raw=>{const data=JSON.parse(raw);const l=listeners.shift();l?l(data):queue.push(data);});
  return async type=>{for(;;){const data=queue.length?queue.shift():await new Promise(resolve=>listeners.push(resolve));if(data.type===type)return data;}};
}
function send(ws,data){ws.send(JSON.stringify(data));}
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url=`ws://127.0.0.1:${server.address().port}/ws`;
  const page=await fetch(`http://127.0.0.1:${server.address().port}/`);
  assert.equal(page.status,200);assert.match(await page.text(),/js\/network\/online\.js/);
  const a=await connect(url), b=await connect(url), nextA=inbox(a), nextB=inbox(b);
  const collection={units:['turret','angel','treent_ancient','knight','assassin','mage','cleric','ranger','necromancer','berserker'],skills:[]};
  send(a,{type:'create',collection});const joinedA=await nextA('joined');assert.equal(joinedA.seat,'A');
  await nextA('state');send(b,{type:'join',room:joinedA.room,collection});const joinedB=await nextB('joined');
  assert.equal(joinedB.seat,'B');await nextB('state');
  let state=await nextA('state');assert.equal(state.state.phase,'draft');
  assert.ok(state.state.candidates.every(card=>card.kind==='unit'&&collection.units.includes(card.id)));
  for(let i=0;i<8;i++){
    const seat=state.state.team;
    send(seat==='A'?a:b,{type:'action',action:'pick',index:0});
    state=await nextA('state');await nextB('state');
  }
  assert.equal(state.state.phase,'deploy');
  for(const team of ['A','B']) {
    for(let i=0;i<4;i++){
      const room=rooms.get(joinedA.room), id=room.game.remaining(team)[0]?.id;
      if(!id)break;
      send(team==='A'?a:b,{type:'action',action:'deploy',id,x:i,y:team==='A'?0:5});
      state=await nextA('state');await nextB('state');
    }
  }
  assert.equal(state.state.phase,'battle');
  send(a,{type:'action',action:'end-turn'});
  state=await nextA('state');await nextB('state');assert.equal(state.state.team,'B');
  send(a,{type:'action',action:'end-turn'});assert.equal((await nextA('error')).type,'error');
  a.close();await wait(30);
  const resumed=await connect(url), nextR=inbox(resumed);
  send(resumed,{type:'resume',room:joinedA.room,token:joinedA.token});
  assert.equal((await nextR('joined')).seat,'A');assert.equal((await nextR('state')).state.team,'B');
  b.close();resumed.close();server.close();
  console.log('Online room test passed');
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
