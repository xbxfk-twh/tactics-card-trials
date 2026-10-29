'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const rooms=new Map();
let next=0,largestMessage=0;

function client(events) {
  const id=`player-${++next}`;
  let listener;
  const reply=(option,value) => queueMicrotask(()=>option.success(value));
  const manager={
    registerListener(value) {listener=value;},
    connect(option) {reply(option,{playerId:id});},
    createRoom(option) {
      const info={id:'tap-room-1',ownerId:id,players:[{id}],maxPlayerCount:2};
      rooms.set(info.id,{info,members:new Map([[id,()=>listener]])});
      reply(option,{roomInfo:structuredClone(info)});
    },
    joinRoom(option) {
      const room=rooms.get(option.data.roomId);
      if (!room || room.info.players.length>=2) return queueMicrotask(()=>option.fail({errMsg:'full'}));
      room.info.players.push({id});room.members.set(id,()=>listener);
      reply(option,{roomInfo:structuredClone(room.info)});
      for (const [peer,getListener] of room.members) if (peer!==id)
        queueMicrotask(()=>getListener()?.onPlayerEntered?.({roomId:room.info.id,playerInfo:{id}}));
    },
    sendCustomMessage(option) {
      const raw=option.data.msg;
      largestMessage=Math.max(largestMessage,Buffer.byteLength(raw));
      const room=[...rooms.values()].find(value=>value.members.has(id));
      for (const [peer,getListener] of room.members) if (peer!==id)
        for (let copy=0;copy<2;copy++)
          queueMicrotask(()=>getListener()?.onCustomMessageReceived?.({playerId:id,message:raw,type:0}));
      reply(option,{});
    },
    leaveRoom(option) {reply(option,{});}
  };
  const context={window:{tap:{getOnlineBattleManager:()=>manager,login:option=>reply(option,{code:'test'})}},
    setTimeout:(fn)=>setTimeout(fn,0),console};
  vm.createContext(context);
  for (const name of ['data/definitions.js','core/engine.js','network/tap-online.js'])
    vm.runInContext(fs.readFileSync(path.join(root,'js',name),'utf8'),context,{filename:name});
  return new context.window.TapOnlineClient(event=>events.push(event));
}
async function until(predicate) {
  const deadline=Date.now()+5000;
  while (!predicate()) {
    if (Date.now()>deadline) throw new Error('Tap room test timed out');
    await new Promise(resolve=>setTimeout(resolve,10));
  }
}
(async()=>{
  const hostEvents=[],guestEvents=[];
  const host=client(hostEvents),guest=client(guestEvents);
  const dataContext={window:{}};vm.createContext(dataContext);
  vm.runInContext(fs.readFileSync(path.join(root,'js/data/definitions.js'),'utf8'),dataContext);
  const progress={owned:Object.keys(dataContext.window.GAME_DATA.cards).filter(id=>
    !dataContext.window.GAME_DATA.cards[id].tags.includes('召唤物')),
    ownedSkills:Object.keys(dataContext.window.GAME_DATA.skillCards)};
  await host.create(progress);
  await guest.join(host.room,progress);
  await until(()=>guestEvents.some(event=>event.type==='state'));
  assert.equal(host.seat,'A');assert.equal(guest.seat,'B');
  assert.equal(guestEvents.find(event=>event.type==='state').state.phase,'draft');
  assert.equal(host.send('pick',{index:0}),true);
  await until(()=>guestEvents.some(event=>event.type==='state' && event.state.draftCount===1));
  assert.equal(guest.send('pick',{index:0}),true);
  await until(()=>host.game?.draftCount===2);
  await until(()=>guestEvents.some(event=>event.type==='state' && event.state.draftCount===2));
  const expectedSequence=host.game.visualSeq+32;
  for(let i=0;i<32;i++)host.game.emitVisual('skill',{id:'fireball',from:{x:0,y:0},to:{x:2,y:2}});
  host.sendState();
  await until(()=>guestEvents.some(event=>event.type==='state'&&event.state.visualSeq===expectedSequence));
  assert.equal(guestEvents.filter(event=>event.type==='state').at(-1).state.visualEvents.length,32);
  assert.ok(largestMessage<=2048,`oversized Tap message: ${largestMessage}`);
  assert.equal(hostEvents.filter(event=>event.type==='error').length,0);
  assert.equal(guestEvents.filter(event=>event.type==='error').length,0);
  console.log('Tap room adapter test passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
