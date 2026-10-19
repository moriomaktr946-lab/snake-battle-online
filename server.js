const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const PORT = process.env.PORT || 8080;
const SIZE = 30, TICK_MS = 140, MAX_PLAYERS = 30;
const colors = ['#39ef82','#ff5555','#28a7ff','#ffc247','#bd72ff','#ff7bcb','#45e0df','#ff914d','#c3f35c','#f97316'];
let snakes = new Map(), food = [];
const server = http.createServer((req,res) => {
  if (req.url === '/' || req.url === '/index.html') {
    fs.readFile(path.join(__dirname,'index.html'), (err,data) => {
      if(err){res.writeHead(500);res.end('Game file missing');return;}
      res.writeHead(200, {'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(data);
    });
  } else if (req.url === '/health') {
    res.writeHead(200, {'Content-Type':'text/plain'});res.end('Snake Battle Online is running');
  } else {res.writeHead(404);res.end('Not found');}
});
const wss = new WebSocket.Server({ server });
const rand = n => Math.floor(Math.random()*n);
function freeCell(){
  for(let tries=0;tries<1000;tries++){
    const p={x:rand(SIZE),y:rand(SIZE)};
    if(!food.some(f=>f.x===p.x&&f.y===p.y) &&
       ![...snakes.values()].some(s=>s.body.some(b=>b.x===p.x&&b.y===p.y))) return p;
  }
  return {x:rand(SIZE),y:rand(SIZE)};
}
function addFood(){while(food.length<45)food.push(freeCell());}
function send(ws,obj){if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(obj));}
function broadcast(){
 const state=JSON.stringify({type:'state',food,snakes:[...snakes.values()].map(s=>({id:s.id,name:s.name,color:s.color,score:s.score,body:s.body}))});
 for(const c of wss.clients)if(c.readyState===WebSocket.OPEN&&c.playerId) c.send(state);
}
function respawn(s){
 let p=freeCell();s.body=[p,{x:(p.x+SIZE-1)%SIZE,y:p.y},{x:(p.x+SIZE-2)%SIZE,y:p.y}];s.dir={x:1,y:0};s.nextDir={x:1,y:0};
}
wss.on('connection',ws=>{
 ws.on('message',raw=>{
  let m;try{m=JSON.parse(raw.toString())}catch{return}
  if(m.type==='join'){
   if(ws.playerId)return;
   if(snakes.size>=MAX_PLAYERS){send(ws,{type:'error',message:'রুম ভরা'});ws.close();return;}
   const id=Math.random().toString(36).slice(2,10);
   const s={id,name:String(m.name||'Player').slice(0,14),color:colors[snakes.size%colors.length],score:0,body:[],dir:{x:1,y:0},nextDir:{x:1,y:0}};
   snakes.set(id,s);ws.playerId=id;respawn(s);send(ws,{type:'welcome',id});addFood();broadcast();
  } else if(m.type==='dir'&&ws.playerId){
   const s=snakes.get(ws.playerId);if(!s)return;
   const x=Number(m.x),y=Number(m.y);
   if(Math.abs(x)+Math.abs(y)!==1)return;
   if(!(x===-s.dir.x&&y===-s.dir.y))s.nextDir={x,y};
  }
 });
 ws.on('close',()=>{if(ws.playerId){snakes.delete(ws.playerId);broadcast();}});
});
addFood();
setInterval(()=>{
 for(const s of snakes.values()){
   s.dir=s.nextDir;
   const head=s.body[0], next={x:(head.x+s.dir.x+SIZE)%SIZE,y:(head.y+s.dir.y+SIZE)%SIZE};
   let hit=s.body.slice(0,-1).some(p=>p.x===next.x&&p.y===next.y);
   for(const other of snakes.values())if(other.id!==s.id&&other.body.some(p=>p.x===next.x&&p.y===next.y))hit=true;
   if(hit){s.score=Math.max(0,s.score-2);respawn(s);continue;}
   s.body.unshift(next);
   const fi=food.findIndex(f=>f.x===next.x&&f.y===next.y);
   if(fi>=0){food.splice(fi,1);s.score+=1;addFood();}else{s.body.pop();}
 }
 addFood();broadcast();
},TICK_MS);
server.listen(PORT,'0.0.0.0',()=>console.log(`Snake Battle Online listening on ${PORT}`));
