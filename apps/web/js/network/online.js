/* Persistent lobby + match transport. Identity and reconnect tokens are scoped to the endpoint. */
(function(){
  'use strict';
  class OnlineClient {
    constructor(onEvent){this.onEvent=onEvent;this.socket=null;this.room=this.seat=this.token=null;this.metadata=null;this.profile=null;this.status='idle';this.pending=null;}
    static normalize(value){const raw=String(value||'').trim();const u=new URL(/^[a-z]+:\/\//i.test(raw)?raw:'https://'+raw);if(!['http:','https:','ws:','wss:'].includes(u.protocol)||u.username||u.password)throw Error('请输入 HTTP(S) 或 WS(S) 服务器地址。');u.protocol=['https:','wss:'].includes(u.protocol)?'wss:':'ws:';u.hash='';u.search='';let pathname=u.pathname.replace(/\/+$/,'');if(!pathname.endsWith('/ws'))pathname+='/ws';u.pathname=pathname;return u.href;}
    endpoint(){const saved=localStorage.getItem('tactics-server');if(saved)return OnlineClient.normalize(saved);if(['http:','https:'].includes(location.protocol))return OnlineClient.normalize(new URL('./',location.href).href);return 'ws://127.0.0.1:8080/ws';}
    key(kind){return `tactics-${kind}:${this.endpoint()}`;}
    read(kind){try{return JSON.parse(localStorage.getItem(this.key(kind)));}catch{return null;}}
    emit(data){this.onEvent(data);}
    async connect(){
      if(this.socket?.readyState===WebSocket.OPEN)return;
      if(this.pending)return this.pending;
      this.status='connecting';this.emit({type:'connection',status:this.status});
      this.pending=new Promise((resolve,reject)=>{
        let socket,settled=false,timer;
        const fail=message=>{if(settled)return;settled=true;clearTimeout(timer);this.status='error';socket?.close();reject(Error(message));};
        try{const endpoint=this.endpoint();if(location.protocol==='https:'&&endpoint.startsWith('ws:'))return fail('HTTPS 页面需要 WSS 地址。');socket=new WebSocket(endpoint);this.socket=socket;}catch(err){fail(err.message);return;}
        timer=setTimeout(()=>fail('连接超时，请核对地址、端口与 WebSocket 代理。'),7000);
        socket.onopen=()=>socket.send(JSON.stringify({type:'hello',identity:this.read('identity'),name:localStorage.getItem('tactics-nickname')||''}));
        socket.onmessage=event=>{
          if(this.socket!==socket)return;let data;try{data=JSON.parse(event.data);}catch{return;}
          if(data.type==='welcome'){
            if(data.identity)localStorage.setItem(this.key('identity'),JSON.stringify(data.identity));this.profile=data.profile;this.status='connected';if(!settled){settled=true;clearTimeout(timer);resolve();}this.emit({type:'connection',status:this.status,version:data.version});
          }
          if(data.type==='error'&&!settled){fail(data.message);this.emit(data);return;}
          if(data.type==='profile'||data.type==='welcome')this.profile=data.profile;
          if(data.type==='joined'){this.room=data.room;this.seat=data.seat;this.token=data.token;this.metadata=data.metadata;localStorage.setItem(this.key('session'),JSON.stringify({room:this.room,token:this.token}));}
          if(data.type==='state'&&data.metadata)this.metadata=data.metadata;
          if(data.type==='room_closed'||data.type==='left'){this.room=this.seat=this.token=this.metadata=null;localStorage.removeItem(this.key('session'));}
          this.emit(data);
        };
        socket.onerror=()=>{if(!settled)fail('服务器连接失败，请确认服务已启动，且地址与端口可访问。');};
        socket.onclose=()=>{if(this.socket!==socket||this.status==='error')return;if(!settled)fail('服务器连接已关闭。');if(this.status==='error')return;this.status='disconnected';this.emit({type:'disconnected',message:'连接已断开；对局中有 45 秒重连时间。'});};
      }).finally(()=>{this.pending=null;});
      return this.pending;
    }
    async request(message){try{await this.connect();if(this.socket?.readyState===WebSocket.OPEN)this.socket.send(JSON.stringify(message));}catch(err){this.emit({type:'error',message:err.message});}}
    collection(progress){return {units:progress.owned,skills:progress.ownedSkills};}
    async list(){return this.request({type:'list'});}
    create(progress,meta={}){return this.request({type:'create',collection:this.collection(progress),pool:meta.pool||'open',mode:meta.mode||'casual',title:meta.title,description:meta.description,manualStart:true});}
    join(room,progress){return this.request({type:'join',room:String(room).trim().toUpperCase(),collection:this.collection(progress)});}
    resume(){const saved=this.read('session');if(saved?.room&&saved?.token)return this.request({type:'resume',...saved});this.emit({type:'error',message:'此服务器没有可恢复的房间。'});}
    ready(value){return this.request({type:'ready',ready:value});}
    start(){return this.request({type:'start'});}
    update(meta){return this.request({type:'room_update',...meta});}
    rename(name){localStorage.setItem('tactics-nickname',name);return this.request({type:'profile',name});}
    surrender(){return this.request({type:'surrender'});}
    send(action,payload={}){if(this.socket?.readyState!==WebSocket.OPEN)return false;this.socket.send(JSON.stringify({type:'action',action,...payload}));return true;}
    leave(){return this.request({type:'leave'});}
    disconnect(){const socket=this.socket;this.socket=null;this.pending=null;socket?.close();this.status='idle';this.room=this.seat=this.token=this.metadata=this.profile=null;}
    setEndpoint(value){const endpoint=OnlineClient.normalize(value);this.disconnect();localStorage.setItem('tactics-server',endpoint);return endpoint;}
    forgetIdentity(){this.disconnect();localStorage.removeItem(this.key('identity'));localStorage.removeItem(this.key('session'));}
  }
  window.WebSocketOnlineClient=OnlineClient;
  window.OnlineClient=window.TapOnlineClient?.supported()?window.TapOnlineClient:OnlineClient;
})();
