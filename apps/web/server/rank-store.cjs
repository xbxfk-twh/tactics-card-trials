'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const Rank=require('../js/network/ranks.js');
const digest=token=>crypto.createHash('sha256').update(token).digest('hex');
const text=(s,max)=>String(s||'').replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,max);
class RankStore {
  constructor(file){this.file=file;this.data={players:{},matches:[],pairs:{}};if(fs.existsSync(file)){const raw=JSON.parse(fs.readFileSync(file,'utf8'));if(!raw.players||!Array.isArray(raw.matches))throw Error('Invalid rank database');this.data=raw;this.data.pairs ||= {};}}
  persist(){fs.mkdirSync(path.dirname(this.file),{recursive:true});const temp=this.file+'.tmp';fs.writeFileSync(temp,JSON.stringify(this.data),{mode:0o600});fs.renameSync(temp,this.file);}
  authenticate(identity,name){
    if(identity?.id||identity?.token){const p=this.data.players[identity?.id];if(!p||typeof identity.token!=='string'||identity.token.length>128||!crypto.timingSafeEqual(Buffer.from(p.hash,'hex'),Buffer.from(digest(identity.token),'hex')))throw Error('身份凭证无效，请清除服务器连接中的旧身份后重新连接。');return {player:p,identity:null};}
    const id=crypto.randomUUID(),token=crypto.randomBytes(32).toString('hex');const player={id,hash:digest(token),name:text(name,16)||'旅人'+id.slice(0,4),rating:1000,games:0,wins:0,draws:0,counts:{attack:0,move:0,skill:0},history:[]};this.data.players[id]=player;this.persist();return {player,identity:{id,token}};
  }
  rename(player,name){const clean=text(name,16);if(!clean)throw Error('昵称不能为空。');player.name=clean;this.persist();}
  public(player){if(!player)return null;const {id,name,rating,games,wins,draws,counts,history}=player;return {id,name,rating,games,wins,draws,counts,history,tier:Rank.tier(rating),placement:Math.min(5,games)};}
  settle(room,winner){
    if(room.mode!=='ranked'||room.settled||this.data.matches.includes(room.matchId))return null;
    const a=room.players.A?.profile,b=room.players.B?.profile;if(!a||!b||a.id===b.id)return null;
    const day=new Date(Date.now()+8*60*60*1000).toISOString().slice(0,10),key=day+':'+[a.id,b.id].sort().join(':');
    const pairCount=this.data.pairs[key]||0,counted=pairCount<3;const before={A:a.rating,B:b.rating};
    const result=winner==='A'?1:winner==='B'?0:.5;
    const changes={A:counted?Rank.change(a,b,result):0,B:counted?Rank.change(b,a,1-result):0};
    const backup=JSON.stringify(this.data);
    try{
      for(const [seat,p,opponent] of [['A',a,b],['B',b,a]]){
        p.rating=Math.max(0,p.rating+changes[seat]);
        if(counted){p.games++;if(winner===seat)p.wins++;if(!winner)p.draws++;for(const type of ['attack','move','skill'])p.counts[type]+=(room.counts[seat][type]||0);}
        p.history.unshift({matchId:room.matchId,opponent:opponent.name,result:winner===seat?'win':winner?'loss':'draw',delta:p.rating-before[seat],at:Date.now(),counted});p.history=p.history.slice(0,20);
      }
      this.data.pairs[key]=pairCount+1;this.data.matches.push(room.matchId);this.data.matches=this.data.matches.slice(-2000);
      for(const old of Object.keys(this.data.pairs))if(old.slice(0,10)<day)delete this.data.pairs[old];
      this.persist();room.settled=true;return {counted,reason:counted?'':'同一对手每日前三场计分，本场仅保留对局记录。',A:{before:before.A,after:a.rating,delta:a.rating-before.A},B:{before:before.B,after:b.rating,delta:b.rating-before.B}};
    }catch(err){const restored=JSON.parse(backup);Object.assign(a,restored.players[a.id]);Object.assign(b,restored.players[b.id]);this.data=restored;this.data.players[a.id]=a;this.data.players[b.id]=b;throw err;}
  }
}
module.exports={RankStore,text};
