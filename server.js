const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
app.use(express.static(path.join(__dirname, 'public')));
const rooms = new Map();
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function code() { let c; do { c = Array.from({length: 6}, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join(''); } while (rooms.has(c)); return c; }
function emitRoom(r) { io.to(r.code).emit('state', {code:r.code, round:r.round, players:r.players.map(p=>({id:p.id, name:p.name, connected:p.connected})), submitted:r.players.map(p => Boolean(r.answers[p.id])), history:r.history, finished:r.finished}); }
function getRoom(code) { return rooms.get(String(code || '').trim().toUpperCase()); }
function fail(socket,msg) { socket.emit('gameError', msg); }
function join(socket, r, name, playerId) {
  if(socket.data.room && socket.data.room !== r.code) return fail(socket,'请先退出当前房间');
  let player = r.players.find(p=>p.id===playerId);
  if(!player && r.players.length >= 2) return fail(socket,'房间已经满员');
  if(!player){ player={ id: playerId || require('crypto').randomUUID(), name: String(name||'玩家').trim().slice(0,12)||'玩家', connected:true }; r.players.push(player); }
  player.connected = true; player.socketId = socket.id;
  socket.join(r.code); socket.data.room=r.code; socket.data.player=player.id;
  socket.emit('joined', {code:r.code, playerId:player.id}); emitRoom(r);
}
io.on('connection', socket => {
 socket.on('create', ({name, playerId}={}) => {const c=code(); const r={code:c,players:[],round:1,answers:{},history:[],finished:false}; rooms.set(c,r); join(socket,r,name,playerId);});
 socket.on('join', ({code,name,playerId}={}) => {const r=getRoom(code); if(!r)return fail(socket,'找不到房间，请检查房间码'); join(socket,r,name,playerId);});
 socket.on('submit', ({word}={}) => {
   const r=getRoom(socket.data.room); if(!r || r.finished)return fail(socket,'游戏已结束或房间不存在');
   if(r.players.length !== 2)return fail(socket,'请等待另一位玩家进入房间');
   if(r.players.some(p=>!p.connected))return fail(socket,'对方暂时离线，请等对方回来');
   const w=String(word||'').trim().replace(/\s+/g,' ').slice(0,20);
   if(!w)return fail(socket,'请输入一个词语');
   if(r.answers[socket.data.player])return fail(socket,'这一轮你已经提交过了');
   r.answers[socket.data.player]=w;
   if(r.players.every(p=>r.answers[p.id])) {
      const words=r.players.map(p=>r.answers[p.id]);
      const matched=words[0].toLocaleLowerCase()===words[1].toLocaleLowerCase();
      const result={round:r.round, words, matched}; r.history.push(result); r.answers={}; if(matched)r.finished=true; else r.round++;
      io.to(r.code).emit('reveal',result);
   }
   emitRoom(r);
 });
 socket.on('restart',()=>{const r=getRoom(socket.data.room);if(!r)return; r.round=1;r.answers={};r.history=[];r.finished=false;io.to(r.code).emit('restarted');emitRoom(r);});
 socket.on('leave',()=>{ const r=getRoom(socket.data.room);if(!r)return; r.players=r.players.filter(p=>p.id!==socket.data.player);delete r.answers[socket.data.player];socket.leave(r.code);socket.data.room=null;socket.data.player=null;emitRoom(r);if(!r.players.length)rooms.delete(r.code); });
 socket.on('disconnect',()=>{const r=getRoom(socket.data.room);if(!r)return; const p=r.players.find(p=>p.id===socket.data.player);if(p&&p.socketId===socket.id){p.connected=false;emitRoom(r);} });
});
setInterval(()=>{for(const [c,r] of rooms)if(r.players.every(p=>!p.connected))rooms.delete(c);},1000*60*60).unref();

// 独立的骗子酒馆房间，与同词相遇互不影响。
const liarRooms = new Map();
const crypto = require('crypto');
function liarCode(){let c;do{c=Array.from({length:6},()=>alphabet[Math.floor(Math.random()*alphabet.length)]).join('')}while(liarRooms.has(c)||rooms.has(c));return c;}
function lerr(sock,msg){sock.emit('liar:error',msg)}
function lroom(sock){return liarRooms.get(sock.data.liarCode)}
function lnotify(r){
 for(const p of r.players){
  const sock=io.sockets.sockets.get(p.socketId);if(!sock)continue;
  sock.emit('liar:state',{
   code:r.code, players:r.players.map(x=>({id:x.id,name:x.name,connected:x.connected,lives:x.lives,shots:x.shots,eliminated:x.eliminated,cards:x.hand.length,alive:!x.eliminated})),
   me:p.id, hand:p.hand, target:r.target,turn:r.turn,phase:r.phase,pileCount:r.pile.length,
   lastPlay:r.lastPlay?{playerId:r.lastPlay.playerId,count:r.lastPlay.cards.length}:null,
   lastOutcome:r.lastOutcome, punishment:r.punishment?{playerId:r.punishment.playerId,name:r.punishment.name}:null, winner:r.winner, log:r.log.slice(-12), round:r.round
  });
 }
}
function ldeck(){const d=[];for(const rank of ['A','K','Q'])for(let i=0;i<8;i++)d.push({id:crypto.randomUUID(),rank});for(let i=0;i<4;i++)d.push({id:crypto.randomUUID(),rank:'JOKER'});return d.sort(()=>Math.random()-.5);}
function nextAlive(r,index){for(let n=1;n<=r.players.length;n++){const i=(index+n)%r.players.length;if(!r.players[i].eliminated)return i;}return index;}
function ldeal(r,starter=0){const deck=ldeck();r.players.forEach(p=>p.hand=!p.eliminated?deck.splice(0,5):[]);r.target=['A','K','Q'][Math.floor(Math.random()*3)];r.pile=[];r.lastPlay=null;r.phase='play';r.turn=!r.players[starter]?.eliminated?starter:nextAlive(r,starter);r.round++;r.log.push('新一局开始，本局目标牌：'+r.target);}
function ljoin(sock,r,name,id){
 let p=r.players.find(x=>x.id===id);
 if(!p){if(r.phase!=='lobby')return lerr(sock,'游戏已经开始，无法加入新玩家');if(r.players.length>=4)return lerr(sock,'房间最多 4 人');p={id:crypto.randomUUID(),name:String(name||'玩家').trim().slice(0,12)||'玩家',socketId:sock.id,connected:true,lives:3,shots:0,eliminated:false,hand:[]};r.players.push(p);}
 p.socketId=sock.id;p.connected=true;sock.data.liarCode=r.code;sock.data.liarId=p.id;sock.join('liar-'+r.code);sock.emit('liar:joined',{code:r.code,playerId:p.id});lnotify(r);
}
io.on('connection',sock=>{
 sock.on('liar:create',({name}={})=>{const c=liarCode();const r={code:c,players:[],round:0,phase:'lobby',turn:0,pile:[],lastPlay:null,target:null,lastOutcome:null,log:[],winner:null};liarRooms.set(c,r);ljoin(sock,r,name);});
 sock.on('liar:join',({code,name,playerId}={})=>{const r=liarRooms.get(String(code||'').toUpperCase().trim());if(!r)return lerr(sock,'找不到房间');ljoin(sock,r,name,playerId);});
 sock.on('liar:start',()=>{const r=lroom(sock);if(!r||r.players[0]?.id!==sock.data.liarId||r.phase!=='lobby')return lerr(sock,'只有房主可以开始');if(r.players.length<2)return lerr(sock,'至少需要两名玩家');r.players.forEach(p=>{p.lives=3;p.shots=0;p.eliminated=false});ldeal(r,0);lnotify(r);});
 sock.on('liar:play',({ids}={})=>{const r=lroom(sock);if(!r||r.phase!=='play'||r.players[r.turn]?.id!==sock.data.liarId)return lerr(sock,'还没轮到你出牌');const p=r.players[r.turn];if(!Array.isArray(ids)||ids.length<1||ids.length>3||new Set(ids).size!==ids.length)return lerr(sock,'每次选择 1–3 张牌');const cards=ids.map(id=>p.hand.find(c=>c.id===id));if(cards.some(c=>!c))return lerr(sock,'选择了无效的牌');p.hand=p.hand.filter(c=>!ids.includes(c.id));r.pile.push(...cards);r.lastPlay={playerId:p.id,cards};r.phase='respond';r.turn=nextAlive(r,r.turn);r.log.push(p.name+' 扣下 '+cards.length+' 张牌，声称都是 '+r.target);lnotify(r);});
 sock.on('liar:accept',()=>{const r=lroom(sock);if(!r||r.phase!=='respond'||r.players[r.turn]?.id!==sock.data.liarId)return lerr(sock,'现在不能继续');const p=r.players[r.turn];if(!p.hand.length){r.log.push(p.name+' 没有手牌，自动质疑');resolveChallenge(r,p);return;}r.phase='play';r.log.push(p.name+' 选择相信，继续出牌');lnotify(r);});
 sock.on('liar:challenge',()=>{const r=lroom(sock);if(!r||r.phase!=='respond'||r.players[r.turn]?.id!==sock.data.liarId)return lerr(sock,'现在不能质疑');resolveChallenge(r,r.players[r.turn]);});
 sock.on('liar:punish',()=>{const r=lroom(sock);if(!r||r.phase!=='punishment'||!r.punishment)return lerr(sock,'当前没有待执行惩罚');if(sock.data.liarId!==r.punishment.playerId)return lerr(sock,'必须由受罚玩家自己按下扳机');const p=r.players.find(x=>x.id===r.punishment.playerId);if(!p)return;const chamber=crypto.randomInt(6-p.shots);const fired=chamber===0;p.shots++;if(fired)p.eliminated=true;r.lastOutcome={...r.lastOutcome,fired,shots:p.shots,eliminated:fired};r.log.push(p.name+' 扣动扳机：'+(fired?'💥 中弹，淘汰！':'咔哒，空枪，幸存！')+'（第 '+p.shots+' 次）');r.punishment=null;r.phase='result';r.nextStarter=!p.eliminated?p.id:r.lastOutcome.challengerId;lnotify(r)});
 sock.on('liar:next',()=>{const r=lroom(sock);if(!r||r.phase!=='result')return;if(r.punishment)return lerr(sock,'先完成惩罚');const active=r.players.filter(p=>!p.eliminated);if(active.length<=1){r.phase='finished';r.winner=active[0]?.id||null;}else{const starter=r.players.findIndex(p=>p.id===r.nextStarter);r.lastOutcome=null;ldeal(r,starter<0?0:starter);}lnotify(r);});
 sock.on('disconnect',()=>{const r=lroom(sock);if(!r)return;const p=r.players.find(p=>p.id===sock.data.liarId);if(p&&p.socketId===sock.id){p.connected=false;lnotify(r)}});
});
function resolveChallenge(r,challenger){const play=r.lastPlay;const liar=play.cards.some(c=>c.rank!==r.target&&c.rank!=='JOKER');const actor=r.players.find(p=>p.id===play.playerId);const loser=liar?actor:challenger;r.lastOutcome={challenger:challenger.name,challengerId:challenger.id,actor:actor.name,cards:play.cards.map(c=>c.rank),liar,loser:loser.name};r.log.push(challenger.name+' 质疑 '+actor.name+'：'+(liar?'抓到撒谎！':'被反将一军！')+' '+loser.name+' 需要接受轮盘惩罚');r.punishment={playerId:loser.id,name:loser.name};r.phase='punishment';lnotify(r);}
setInterval(()=>{for(const [c,r] of liarRooms)if(r.players.length&&r.players.every(p=>!p.connected))liarRooms.delete(c)},3600000).unref();

const port=process.env.PORT||3000;
server.listen(port,()=>console.log(`同词相遇 running on http://localhost:${port}`));
