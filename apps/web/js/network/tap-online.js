/* TapTap mini-game room transport. The room owner runs the rules engine. */
(function () {
  'use strict';
  const VERSION = 1;
  const PART = 450; // Four-byte UTF-8 characters still fit the 2048-byte SDK limit.
  const ROOM_TYPE = 'tactics-card-v1';
  const other = seat => seat === 'A' ? 'B' : 'A';
  const errorText = err => err?.errMsg || err?.message || 'TapTap 联机服务暂时不可用。';

  class TapOnlineClient {
    constructor(onEvent) {
      this.onEvent = onEvent;
      this.manager = null;
      this.room = this.seat = this.playerId = this.guestId = this.matchId = null;
      this.players = new Set();
      this.collection = null;
      this.guestCollection = null;
      this.game = null;
      this.accountId=null;this.guestAccountId=null;this.proof=null;
      this.queue = Promise.resolve();
      this.chunks = new Map();
      this.revision = 0;
      this.session = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      this.sequence = 0;
      this.seen = new Set();
      this.connected = false;
      this.listener = null;
    }
    static supported() { return !!(window.tap && typeof window.tap.getOnlineBattleManager === 'function'); }
    report(message) { this.onEvent({type:'error', message}); }
    async invoke(name, option = {}) {
      return new Promise((resolve, reject) => {
        try {
          const call = this.manager[name]({...option, success:resolve, fail:reject});
          if (call?.then) call.then(resolve, reject);
        } catch (err) { reject(err); }
      });
    }
    async connect() {
      if (!TapOnlineClient.supported()) throw new Error('当前环境没有 TapTap 小游戏联机 API。');
      if (!this.manager) {
        this.manager = window.tap.getOnlineBattleManager();
        this.listener = {
          onPlayerEntered: info => this.playerEntered(info),
          onPlayerLeft: info => this.playerLeft(info),
          onPlayerOffline: info => this.playerLeft(info),
          onCustomMessageReceived: info => this.receive(info),
          onCustomMessage: info => this.receive(info),
          onDisconnected: () => { this.connected=false; this.onEvent({type:'disconnected',message:'TapTap 连接已断开，请返回房间重连。'}); },
          onBattleServiceError: info => this.report(errorText(info))
        };
        this.manager.registerListener(this.listener);
      }
      if (!this.connected) {
        if (typeof window.tap.login === 'function') await new Promise((resolve,reject) => {
          try {
            const result=window.tap.login({success:resolve,fail:reject});
            if (result?.then) result.then(resolve,reject);
          } catch (err) {reject(err);}
        });
        const result = await this.invoke('connect');
        this.playerId = result.playerId;
        this.connected = true;
      }
    }
    async enter(method, data, progress) {
      try {
        await this.connect();
        if (this.room) await this.invoke('leaveRoom');
        this.resetRoom();
        this.collection = {units:[...progress.owned],skills:[...progress.ownedSkills]};
        const result = await this.invoke(method, {data});
        const info = result.roomInfo;
        if (!info?.id || !info?.ownerId) throw new Error('TapTap 没有返回有效房间。');
        this.room = info.id;
        this.seat = info.ownerId === this.playerId ? 'A' : 'B';
        this.players = new Set((info.players || []).map(p => p.id));
        this.guestId = [...this.players].find(id => id !== info.ownerId) || null;
        this.onEvent({type:'joined',room:this.room,seat:this.seat});
        this.publishStatus();
        if (this.seat === 'B') this.sendMessage({kind:'hello',collection:this.collection,accountId:this.accountId});
      } catch (err) { this.report(errorText(err)); }
    }
    create(progress) {
      return this.enter('createRoom',{roomCfg:{maxPlayerCount:2,type:ROOM_TYPE,name:'战棋卡牌对局',matchParams:{level:'1',score:'0'}}},progress);
    }
    match(progress) {
      return this.enter('matchRoom',{roomCfg:{maxPlayerCount:2,type:ROOM_TYPE,matchParams:{level:'1',score:'0'}}},progress);
    }
    join(room,progress) {
      const roomId=String(room || '').trim();
      if (!roomId) {this.report('请输入 TapTap 房间 ID。');return;}
      return this.enter('joinRoom',{roomId},progress);
    }
    async list() {
      try {
        await this.connect();
        const result=await this.invoke('getRoomList',{data:{roomType:ROOM_TYPE,offset:0,limit:20}});
        this.onEvent({type:'rooms',rooms:(result.rooms || []).filter(room=>room.players?.length<2)});
      } catch (err) {this.report(errorText(err));}
    }
    resume() {
      this.onEvent({type:'disconnected',message:'TapTap 断线后请重新输入房间 ID 加入；房主掉线后需新建房间。'});
    }
    resetRoom() {
      this.room=this.seat=this.guestId=this.matchId=null;
      this.players.clear();this.guestCollection=null;this.guestAccountId=null;this.game=null;this.proof=null;
      this.chunks.clear();this.revision=0;
      this.seen.clear();
    }
    leave() {
      if (this.manager && this.room) this.invoke('leaveRoom').catch(err=>this.report(errorText(err)));
      this.resetRoom();
    }
    publishStatus() {
      this.onEvent({type:'presence',connected:{A:this.players.size>0,B:this.players.size>1}});
    }
    playerEntered(info) {
      if (!this.room || info.roomId !== this.room || !info.playerInfo?.id) return;
      this.players.add(info.playerInfo.id);
      if (this.seat === 'A' && info.playerInfo.id !== this.playerId) {
        if (this.game && this.guestId && this.guestId!==info.playerInfo.id)
          this.sendMessage({kind:'error',message:'这场对局已经有对手，请另建房间。'});
        else this.guestId=info.playerInfo.id;
      }
      this.publishStatus();
      if (this.seat === 'B') this.sendMessage({kind:'hello',collection:this.collection,accountId:this.accountId});
    }
    playerLeft(info) {
      if (!this.room || (info.roomId && info.roomId !== this.room)) return;
      this.players.delete(info.playerId);
      this.publishStatus();
      if (info.playerId !== this.playerId) this.onEvent({type:'disconnected',message:'对手已离开或掉线，等待重新加入。'});
    }
    sendMessage(message) {
      if (!this.room) return false;
      const msg=JSON.stringify({v:VERSION,room:this.room,session:this.session,seq:++this.sequence,...message});
      this.queue=this.queue.catch(()=>{}).then(() => new Promise(resolve=>setTimeout(resolve,80)))
        .then(()=>this.invoke('sendCustomMessage',{data:{msg,type:0}}))
        .catch(err=>this.report(`消息发送失败：${errorText(err)}`));
      return true;
    }
    // Split snapshots: TapTap's custom message payload is limited to 2048 UTF-8 bytes.
    sendState() {
      if (!this.game || !this.guestId) return;
      const state=this.game.snapshot();
      state.hands.A=[];
      const resultProof=this.game.phase==='end'?this.proof:null;
      const serialized=JSON.stringify({matchId:this.matchId,state,proof:resultProof});
      const total=Math.ceil(serialized.length/PART);
      const revision=++this.revision;
      for (let index=0;index<total;index++)
        this.sendMessage({kind:'state-part',revision,index,total,part:serialized.slice(index*PART,(index+1)*PART)});
      this.onEvent({type:'state',room:this.room,seat:'A',matchId:this.matchId,
        connected:{A:true,B:this.players.has(this.guestId)},state:this.game.snapshot(),proof:resultProof});
    }
    startIfReady() {
      if (this.seat !== 'A' || this.game || !this.guestCollection) return;
      const cards=window.GAME_DATA.cards,skills=window.GAME_DATA.skillCards;
      const clean = value => ({
        units:[...new Set((Array.isArray(value?.units)?value.units:[]).filter(id=>
          typeof id==='string' && cards[id] && !cards[id].tags.includes('召唤物')))],
        skills:[...new Set((Array.isArray(value?.skills)?value.skills:[]).filter(id=>
          typeof id==='string' && skills[id]))]
      });
      const own=clean(this.collection),guest=clean(this.guestCollection);
      if ([own,guest].some(value=>value.units.length<4 || value.units.length+value.skills.length<10)) {
        this.report('双方需要至少 10 张卡，且各有 4 名角色。');return;
      }
      this.game=new window.TacticsGame();
      const seed=Date.now()>>>0;
      this.game.start({A:own,B:guest},seed);
      this.game.mode='online';
      this.matchId=`${this.room}:${Date.now()}`;
      this.proof={seed,allowed:{A:own,B:guest},accounts:{A:this.accountId,B:this.guestAccountId},actions:[]};
      this.sendState();
    }
    receive(info) {
      if (!this.room) return;
      let message=info.message ?? info.msg;
      try {if (typeof message==='string') message=JSON.parse(message);} catch {return;}
      if (!message || message.v!==VERSION || message.room!==this.room) return;
      const sender=info.playerId || info.fromPlayerId;
      if (!sender || sender===this.playerId || !this.players.has(sender)) return;
      if (typeof message.session!=='string' || !Number.isInteger(message.seq)) return;
      const key=`${sender}:${message.session}:${message.seq}`;
      if (this.seen.has(key)) return;
      this.seen.add(key);
      if (this.seen.size>500) this.seen.delete(this.seen.values().next().value);
      if (message.kind==='hello' && this.seat==='A' && sender===this.guestId) {
        this.guestCollection=message.collection;
        this.guestAccountId=message.accountId;
        if(this.proof)this.proof.accounts.B=this.guestAccountId;
        if (this.game) this.sendState(); else this.startIfReady();
      } else if (message.kind==='action' && this.seat==='A' && sender===this.guestId) {
        this.applyAction(message.action,message.payload,'B');
      } else if (message.kind==='state-part' && this.seat==='B' && sender!==this.playerId) {
        this.receivePart(message);
      } else if (message.kind==='error' && this.seat==='B') this.report(message.message);
    }
    receivePart(message) {
      const {revision,index,total,part}=message;
      if (!Number.isInteger(revision)||revision<=this.revision||!Number.isInteger(index)||!Number.isInteger(total)||
          total<1||total>200||index<0||index>=total||typeof part!=='string') return;
      for (const key of this.chunks.keys()) if (key<revision) this.chunks.delete(key);
      if (!this.chunks.has(revision)) this.chunks.set(revision,Array(total));
      const pieces=this.chunks.get(revision);
      if (pieces.length!==total) return;
      pieces[index]=part;
      if (Array.from({length:total},(_,i)=>pieces[i]).some(value=>value===undefined)) return;
      this.chunks.delete(revision);
      try {
        const {matchId,state,proof}=JSON.parse(pieces.join(''));
        if (!state || !matchId || revision<this.revision) return;
        this.revision=revision;
        this.onEvent({type:'state',room:this.room,seat:'B',matchId,
          connected:{A:this.players.size>1,B:true},state,proof});
      } catch {this.report('对局状态传输不完整，请重新加入房间。');}
    }
    applyAction(action,payload,seat) {
      const game=this.game;
      if (!game || game.phase==='end' || game.team!==seat) return false;
      const pos={x:payload?.x,y:payload?.y};
      let done=false;
      if (action==='pick' && game.phase==='draft' && Number.isInteger(payload?.index)) done=game.pick(payload.index);
      else if (action==='deploy' && game.phase==='deploy' && typeof payload?.id==='string') done=game.deploy(payload.id,pos);
      else if (game.phase==='battle') {
        if (action==='move') done=game.move(payload.uid,pos);
        else if (action==='attack') done=game.attack(payload.uid,payload.targetUid);
        else if (action==='skill') done=game.useSkill(payload.uid,payload.id,pos,payload.targetUid??null);
        else if (action==='hand') done=game.playHand(payload.id,pos,payload.targetUid??null);
        else if (action==='end-turn') {game.endTurn();done=true;}
      }
      if (!done) {
        const message=game.log[0] || '当前操作无效。';
        if (seat==='B') this.sendMessage({kind:'error',message}); else this.report(message);
        return false;
      }
      this.proof?.actions.push({seat,action,payload});
      this.sendState();return true;
    }
    send(action,payload={}) {
      if (!this.room || !this.seat) return false;
      if (this.seat==='A') return this.applyAction(action,payload,'A');
      return this.sendMessage({kind:'action',action,payload});
    }
  }
  window.TapOnlineClient=TapOnlineClient;
})();
