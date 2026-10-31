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
const port=process.env.PORT||3000;
server.listen(port,()=>console.log(`同词相遇 running on http://localhost:${port}`));
