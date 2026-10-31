const crypto=require('crypto');
module.exports=function(io){
const rooms=new Map(), alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const rnd=n=>crypto.randomInt(n),shuffle=a=>{for(let i=a.length-1;i>0;i--){let j=rnd(i+1);[a[i],a[j]]=[a[j],a[i]]}return a}, key=()=>{let c;do{c=Array.from({length:6},()=>alphabet[rnd(alphabet.length)]).join('')}while(rooms.has(c));return c};
const TYPES=['battleship','codenames','uno','buckshot','doudizhu'];
const get=s=>rooms.get(s.data.multiRoom), err=(s,m)=>s.emit('multi:error',m), other=(r,i)=>1-i;
function state(r,p){const g=r.g||{};let base={code:r.code,type:r.type,phase:r.phase,players:r.players.map((x,i)=>({name:x.name,id:x.id,connected:x.connected,index:i})),me:r.players.indexOf(p),turn:g.turn??0,winner:g.winner??null,log:(g.log||[]).slice(-8)};
if(r.type==='battleship'){base={...base,setup:g.setup?.[r.players.indexOf(p)]||[],myShots:g.shots?.[r.players.indexOf(p)]||[],theirShots:g.shots?.[other(r,r.players.indexOf(p))]||[],placed:g.setup?.map(a=>a.length===3)||[false,false],hits:g.hits||[0,0]};}
if(r.type==='codenames'){base={...base,words:g.words||[],targets:g.targets||[],found:g.found||[],mistakes:g.mistakes||0,clue:g.clue||'',roles:['线索员','猜词员'],turn:g.turn||0};if(r.players.indexOf(p)!==0)delete base.targets;}
if(r.type==='uno'){base={...base,hand:g.hands?.[r.players.indexOf(p)]||[],counts:g.hands?.map(a=>a.length)||[0,0],top:g.top||null,color:g.color||'',draw:g.draw||0};}
if(r.type==='buckshot'){base={...base,hp:g.hp||[4,4],shells:g.shells?.length||0,live:g.live??0,blank:g.blank??0,items:g.items?.[r.players.indexOf(p)]||[],itemCounts:g.items?.map(a=>a.length)||[0,0],last:g.last||'',peek:g.peek?.[r.players.indexOf(p)]||null};}
if(r.type==='doudizhu'){base={...base,hand:g.hands?.[r.players.indexOf(p)]||[],counts:g.hands?.map(a=>a.length)||[0,0],last:g.last||null,passes:g.passes||0,landlord:g.landlord??0};}
return base;}
function send(r){for(const p of r.players){let s=io.sockets.sockets.get(p.sock);if(s)s.emit('multi:state',state(r,p));}}
const wordBank='月亮 星星 海洋 飞机 玫瑰 巧克力 学校 蝴蝶 钢琴 城堡 火山 咖啡 雪人 太阳 小猫 电影 书店 彩虹 森林 沙漠 雨伞 机器人 篮球 熊猫 蜡烛 机场 花园 火车 河流 企鹅 钻石'.split(' ');
function cards(){let a=[];for(let c of ['红','黄','蓝','绿']){for(let n=0;n<=9;n++)for(let k=0;k<(n===0?1:2);k++)a.push({id:crypto.randomUUID(),c,n:String(n)});for(let n of ['跳过','+2','反转'])for(let k=0;k<2;k++)a.push({id:crypto.randomUUID(),c,n});}for(let n of ['万能','+4'])for(let k=0;k<4;k++)a.push({id:crypto.randomUUID(),c:'黑',n});return shuffle(a)}
const ranks=['3','4','5','6','7','8','9','10','J','Q','K','A','2','小王','大王'];
function poker(){let a=[];for(const n of ranks){for(let i=0;i<(n.includes('王')?1:4);i++)a.push({id:crypto.randomUUID(),n});}return shuffle(a)}
function init(r){let g={turn:0,winner:null,log:[]};r.phase='play';if(r.type==='battleship'){r.phase='setup';g.setup=[[],[]];g.shots=[[],[]];g.hits=[0,0];}
if(r.type==='codenames'){g.words=shuffle([...wordBank]).slice(0,16);g.targets=shuffle([...g.words]).slice(0,6);g.found=[];g.mistakes=0;g.turn=0;g.clue='';r.phase='clue';}
if(r.type==='uno'){let d=cards();g.hands=[d.splice(0,7),d.splice(0,7)];g.deck=d;g.top=d.pop();while(g.top.c==='黑'){d.unshift(g.top);g.top=d.pop()}g.color=g.top.c;g.draw=0;}
if(r.type==='buckshot'){g.hp=[4,4];g.items=[['放大镜','香烟'],['放大镜','香烟']];newShells(g);}
if(r.type==='doudizhu'){let d=poker();g.hands=[d.splice(0,17),d.splice(0,17)];g.landlord=rnd(2);g.turn=g.landlord;g.last=null;g.passes=0;}
r.g=g;send(r)}
function newShells(g){let n=4+rnd(3),live=1+rnd(n-1);g.shells=shuffle([...Array(live)].map(()=>1).concat([...Array(n-live)].map(()=>0)));g.live=live;g.blank=n-live;g.peek=[null,null];}
function end(r,w){r.g.winner=w;r.phase='finished';send(r)}
function act(s,action,data={}){let r=get(s);if(!r||r.phase==='lobby')return err(s,'房间尚未开始');let g=r.g,i=r.players.findIndex(p=>p.id===s.data.multiId);if(i<0)return err(s,'不在房间里');const otherI=1-i;function turn(){if(g.turn!==i)return err(s,'还没轮到你')}
if(r.type==='battleship'){
if(action==='place'){if(r.phase!=='setup'||g.setup[i].length===3)return err(s,'现在无法布置船只');let ships=data.ships;if(!Array.isArray(ships)||ships.length!==3)return err(s,'需要布置长度为 3、2、2 的三艘船');let occupied=new Set();for(let k=0;k<3;k++){let a=ships[k];if(!Array.isArray(a)||a.length!==[3,2,2][k]||a.some(x=>!Number.isInteger(x)||x<0||x>=36||occupied.has(x)))return err(s,'船只不能重叠或越界');let sorted=[...a].sort((x,y)=>x-y), horizontal=sorted.every((x,j)=>j===0||x===sorted[j-1]+1)&&Math.floor(sorted[0]/6)===Math.floor(sorted.at(-1)/6),vertical=sorted.every((x,j)=>j===0||x===sorted[j-1]+6);if(!horizontal&&!vertical)return err(s,'船只必须横向或纵向连续');a.forEach(x=>occupied.add(x));}g.setup[i]=ships.flat();if(g.setup.every(a=>a.length===7))r.phase='play';send(r);return;}
if(action==='shoot'){if(r.phase!=='play')return err(s,'等待双方布置船只');turn();let x=data.cell;if(!Number.isInteger(x)||x<0||x>=36||g.shots[i].some(t=>t.cell===x))return err(s,'请选择尚未攻击的位置');let hit=g.setup[otherI].includes(x);g.shots[i].push({cell:x,hit});if(hit)g.hits[i]++;g.log.push(r.players[i].name+' 攻击 '+String.fromCharCode(65+x%6)+(Math.floor(x/6)+1)+(hit?' 命中！':' 落空'));if(g.hits[i]===7)return end(r,i);g.turn=otherI;send(r);return;}}
if(r.type==='codenames'){
if(action==='clue'){if(r.phase!=='clue'||i!==0)return err(s,'请等待线索员');let v=String(data.text||'').trim().slice(0,30);if(!v)return err(s,'输入线索');g.clue=v;r.phase='guess';send(r);return;}
if(action==='guess'){if(r.phase!=='guess'||i!==1)return err(s,'请等待猜词员');let w=data.word;if(!g.words.includes(w)||g.found.includes(w))return err(s,'无效词语');if(g.targets.includes(w)){g.found.push(w);g.log.push('猜中了 '+w);if(g.found.length===6)return end(r,0);}else{g.mistakes++;g.log.push('猜错了 '+w);if(g.mistakes===3)return end(r,null);}r.phase='clue';g.clue='';send(r);return;}}
if(r.type==='uno'){
if(action==='draw'){turn();let d=g.deck;if(!d.length){g.deck=cards();d=g.deck;}g.hands[i].push(d.pop());g.log.push(r.players[i].name+' 摸一张');g.turn=otherI;send(r);return;}
if(action==='play'){turn();let pos=g.hands[i].findIndex(c=>c.id===data.id);if(pos<0)return err(s,'没有这张牌');let c=g.hands[i][pos];if(c.c!==g.color&&c.n!==g.top.n&&c.c!=='黑')return err(s,'颜色或数字不匹配');if(c.c==='黑'&&!['红','黄','蓝','绿'].includes(data.color))return err(s,'万能牌请选颜色');g.hands[i].splice(pos,1);g.top=c;g.color=c.c==='黑'?data.color:c.c;g.log.push(r.players[i].name+' 出 '+c.c+c.n);if(g.hands[i].length===0)return end(r,i);if(c.n==='+2'||c.n==='+4'){let count=c.n==='+2'?2:4;for(let x=0;x<count;x++){if(!g.deck.length)g.deck=cards();g.hands[otherI].push(g.deck.pop())}g.turn=i;}else if(['跳过','反转'].includes(c.n)){g.turn=i;}else g.turn=otherI;send(r);return;}}
if(r.type==='buckshot'){
if(action==='item'){turn();let item=data.item,index=g.items[i].indexOf(item);if(index<0)return err(s,'没有这个道具');if(item==='放大镜'){g.peek[i]=g.shells.at(-1)?'实弹':'空弹';}else if(item==='香烟'){g.hp[i]=Math.min(5,g.hp[i]+1);}else return err(s,'无效道具');g.items[i].splice(index,1);send(r);return;}
if(action==='fire'){turn();if(!['self','other'].includes(data.target))return err(s,'选择射击对象');let bullet=g.shells.pop();if(bullet)g.live--;else g.blank--;let hit=bullet===1,who=data.target==='self'?i:otherI;g.log.push(r.players[i].name+' 对 '+(data.target==='self'?'自己':'对手')+' 扣动虚拟扳机：'+(hit?'实弹！':'空弹'));if(hit)g.hp[who]--;g.peek=[null,null];if(g.hp[who]<=0)return end(r,other(r,who));if(!g.shells.length){newShells(g);g.items.forEach(a=>a.push(rnd(2)?'香烟':'放大镜'));}if(!(data.target==='self'&&!hit))g.turn=otherI;send(r);return;}}
if(r.type==='doudizhu'){
if(action==='pass'){turn();if(!g.last||g.last.by===i)return err(s,'当前不能不要');g.log.push(r.players[i].name+' 不要');g.last=null;g.turn=otherI;send(r);return;}
if(action==='play'){turn();let ids=data.ids;if(!Array.isArray(ids)||ids.length<1||new Set(ids).size!==ids.length)return err(s,'请选择牌');let selected=ids.map(id=>g.hands[i].find(c=>c.id===id));if(selected.some(x=>!x))return err(s,'无效手牌');let same=selected.every(c=>c.n===selected[0].n);let rocket=selected.length===2&&selected.some(c=>c.n==='小王')&&selected.some(c=>c.n==='大王');if(!same&&!rocket)return err(s,'当前支持单张、对子、三张、炸弹及王炸');let level=rocket?99:ranks.indexOf(selected[0].n),strength=rocket?5:selected.length;
if(g.last&&g.last.by!==i){let last=g.last;if(strength!==5){if(last.strength===5)return err(s,'王炸无法压过');if(strength===4&&last.strength!==4){}else if(strength!==last.strength||level<=last.level)return err(s,'必须出相同张数且更大的牌，炸弹除外');}else{} }
g.hands[i]=g.hands[i].filter(c=>!ids.includes(c.id));g.last={by:i,strength,level,text:selected.map(x=>x.n).join('、')};g.log.push(r.players[i].name+' 出 '+g.last.text);if(!g.hands[i].length)return end(r,i);g.turn=otherI;send(r);return;}}
err(s,'当前操作不可用');}
io.on('connection',s=>{
s.on('multi:create',({type,name}={})=>{if(!TYPES.includes(type))return err(s,'不存在的游戏');let code=key(),r={code,type,phase:'lobby',players:[],g:null};rooms.set(code,r);join(s,r,name);});
s.on('multi:join',({code,name,id}={})=>{let r=rooms.get(String(code||'').trim().toUpperCase());if(!r)return err(s,'房间不存在');join(s,r,name,id);});
s.on('multi:start',()=>{let r=get(s);if(!r||r.players[0]?.id!==s.data.multiId||r.players.length!==2)return err(s,'房主需要等待两位玩家');init(r);});
s.on('multi:action',({action,data}={})=>act(s,action,data));
s.on('multi:restart',()=>{let r=get(s);if(r&&r.players.length===2)init(r)});
s.on('disconnect',()=>{let r=get(s);if(!r)return;let p=r.players.find(p=>p.id===s.data.multiId);if(p&&p.sock===s.id){p.connected=false;send(r);}});
});
function join(s,r,name,id){let p=r.players.find(x=>x.id===id);if(!p){if(r.phase!=='lobby'||r.players.length===2)return err(s,'游戏已开始或房间已满');p={id:crypto.randomUUID(),name:String(name||'玩家').trim().slice(0,12)||'玩家'};r.players.push(p);}p.sock=s.id;p.connected=true;s.data.multiRoom=r.code;s.data.multiId=p.id;s.join('multi-'+r.code);s.emit('multi:joined',{code:r.code,id:p.id,type:r.type});send(r)}
setInterval(()=>{for(let [c,r] of rooms)if(r.players.length&&r.players.every(p=>!p.connected))rooms.delete(c)},3600000).unref();
};
