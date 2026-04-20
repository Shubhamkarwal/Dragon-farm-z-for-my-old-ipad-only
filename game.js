// DRAGON FARM Z - ES5 Compatible (iOS 10+)
;(function() {
'use strict';

// ── POLYFILLS ──
if (!CanvasRenderingContext2D.prototype.ellipse) {
  CanvasRenderingContext2D.prototype.ellipse = function(x,y,rX,rY,rot,start,end,ccw) {
    this.save();this.translate(x,y);this.rotate(rot);this.scale(rX,rY);
    this.arc(0,0,1,start,end,ccw);this.restore();
  };
}
window.requestAnimationFrame = window.requestAnimationFrame ||
  window.webkitRequestAnimationFrame ||
  function(cb){ return setTimeout(cb,16); };

// ── CANVAS ──
var canvas = document.getElementById('c');
var ctx = canvas.getContext('2d');
function resize() { canvas.width=window.innerWidth; canvas.height=window.innerHeight; }
resize();
window.addEventListener('resize', resize);

// ── CONSTANTS ──
var TILE=48, MW=32, MH=24;
var T = {GRASS:0,DIRT:1,WATER:2,TILLED:3,PLANTED:4,GROWING:5,READY:6,
  PATH:7,TREE:8,ROCK:9,FLOWER:10,FENCE:11,WOOD:12,SAND:13,DWATER:14};

// ── CROP DATA ──
var CROPS = {
  carrot:   {name:'Carrot',   em:'[C]', growDays:1, sell:15,  cost:5,  pb:100, sp:null,         desc:'Fast grower'},
  tomato:   {name:'Tomato',   em:'[T]', growDays:2, sell:30,  cost:12, pb:150, sp:'regrow',     desc:'Regrows!'},
  corn:     {name:'Corn',     em:'[N]', growDays:3, sell:55,  cost:20, pb:250, sp:'powerBoost', desc:'+500 PL'},
  strawberry:{name:'Strawberry',em:'[S]',growDays:2,sell:45,  cost:18, pb:120, sp:'restoreKi',  desc:'+20 Ki'},
  senzu:    {name:'Senzu',    em:'[Z]', growDays:5, sell:150, cost:50, pb:300, sp:'senzuCrop',  desc:'+1 Senzu'},
  starfruit:{name:'StarFruit',em:'[*]', growDays:6, sell:200, cost:80, pb:500, sp:'powerSurge', desc:'+2000 PL'},
};

// ── CITIES ──
var CITIES = {
  westcity: {name:'West City',   icon:'[W]', unlocked:false, expanded:false,
    cost:5000, pl:10000, mult:{carrot:1.5,tomato:2,corn:2,strawberry:1.5,senzu:1,starfruit:1}, passive:50,
    desc:'Tomato & Corn 2x!'},
  korinstower:{name:'Korins Tower',icon:'[K]',unlocked:false,expanded:false,
    cost:15000,pl:20000, mult:{carrot:1,tomato:1,corn:1.5,strawberry:2,senzu:5,starfruit:2},passive:150,
    desc:'Senzu 5x!'},
  namek:    {name:'Planet Namek', icon:'[M]', unlocked:false, expanded:false,
    cost:50000,pl:50000, mult:{carrot:2,tomato:2,corn:2,strawberry:2,senzu:3,starfruit:10},passive:500,
    desc:'StarFruit 10x!'},
};

// ── WEATHER ──
var WEATHERS = [
  {id:'sunny',  name:'Sunny',    chance:40, sky1:'#4a9fd4', sky2:'#87CEEB'},
  {id:'cloudy', name:'Cloudy',   chance:20, sky1:'#6a8a9a', sky2:'#9ab0ba'},
  {id:'rain',   name:'Rainy',    chance:15, sky1:'#2a4a5a', sky2:'#4a6a7a'},
  {id:'storm',  name:'Storm',    chance:8,  sky1:'#1a2a3a', sky2:'#2a3a4a'},
  {id:'windy',  name:'Windy',    chance:7,  sky1:'#5a9aaa', sky2:'#8abaca'},
  {id:'aurora', name:'Ki Aurora',chance:10, sky1:'#0a0a2a', sky2:'#1a0a3a'},
];
var weather = {cur: WEATHERS[0], drops:[], lt:0, travel:null};

// ── MISSIONS ──
var MPOOL = [
  {id:'h5', text:'Harvest 5 crops',  type:'harvest', tgt:5,  zeni:500,  pl:200},
  {id:'w8', text:'Water 8 tiles',    type:'water',   tgt:8,  zeni:300,  pl:100},
  {id:'p5', text:'Plant 5 seeds',    type:'plant',   tgt:5,  zeni:200,  pl:80},
  {id:'t6', text:'Till 6 tiles',     type:'till',    tgt:6,  zeni:250,  pl:100},
  {id:'e1', text:'Earn 1000 Zeni',   type:'earn',    tgt:1000,zeni:500, pl:200},
  {id:'tr', text:'Complete a trade', type:'trade',   tgt:1,  zeni:600,  pl:250},
];

// ── STATE ──
var G = {
  day:1, hour:6, min:0,
  gold:999999, ki:100, maxKi:100, pl:9001,
  senzu:3, ssj:false, ssj2:false, fly:false,
  tool:'nimbus', crop:'carrot',
  inv:{carrot:{s:10,h:0},tomato:{s:3,h:0},corn:{s:2,h:0},strawberry:{s:2,h:0},senzu:{s:0,h:0},starfruit:{s:0,h:0}},
  missions:[], mprog:{}, earned:0, traded:0,
  cities:{},
  godMode:true,
  bot:{on:false,phase:'till',timer:0,rate:90,tilled:0,planted:0,watered:0,harvested:0},
};
// Deep copy cities
for (var ck in CITIES) { G.cities[ck] = {name:CITIES[ck].name,icon:CITIES[ck].icon,unlocked:false,expanded:false,cost:CITIES[ck].cost,pl:CITIES[ck].pl,mult:CITIES[ck].mult,passive:CITIES[ck].passive,desc:CITIES[ck].desc}; }

// ── MAP ──
var map=[], farmData={}, trees=[], rocks=[];
function initMap() {
  var x, y;
  for (y=0;y<MH;y++){map[y]=[];for(x=0;x<MW;x++)map[y][x]=T.GRASS;}
  for (y=0;y<MH;y++){map[y][MW-1]=T.DWATER;map[y][MW-2]=T.WATER;map[y][MW-3]=T.WATER;map[y][MW-4]=T.SAND;}
  for (y=6;y<16;y++) for(x=4;x<16;x++) map[y][x]=T.DIRT;
  for (x=0;x<MW-4;x++) map[5][x]=T.PATH;
  for (y=0;y<MH;y++) map[y][1]=T.PATH;
  for (x=1;x<MW-4;x++) map[MH-1][x]=T.PATH;
  for (y=5;y<MH;y++) map[y][17]=T.PATH;
  for (y=1;y<5;y++) for(x=2;x<6;x++) map[y][x]=T.WOOD;
  for (y=1;y<5;y++) for(x=19;x<24;x++) map[y][x]=T.WOOD;
  // Fences with gaps
  for(x=3;x<9;x++){map[5][x]=T.FENCE;map[16][x]=T.FENCE;}
  for(x=12;x<17;x++){map[5][x]=T.FENCE;map[16][x]=T.FENCE;}
  for(y=6;y<11;y++){map[y][3]=T.FENCE;map[y][16]=T.FENCE;}
  for(y=13;y<16;y++){map[y][3]=T.FENCE;map[y][16]=T.FENCE;}
  var treePts=[[8,1],[9,1],[10,1],[11,1],[1,7],[1,9],[1,11],[1,13],[1,15],[18,8],[18,10],[18,12],[20,6],[22,7],[5,18],[7,18],[9,19]];
  for(var i=0;i<treePts.length;i++){x=treePts[i][0];y=treePts[i][1];if(map[y]&&map[y][x]===T.GRASS){map[y][x]=T.TREE;trees.push([x,y]);}}
  var rPts=[[19,5],[21,4],[23,5],[6,20],[10,21]];
  for(var i=0;i<rPts.length;i++){x=rPts[i][0];y=rPts[i][1];if(map[y]&&map[y][x]===T.GRASS){map[y][x]=T.ROCK;rocks.push([x,y]);}}
  var fPts=[[8,3],[9,3],[15,3],[7,4],[20,9],[22,11]];
  for(var i=0;i<fPts.length;i++){x=fPts[i][0];y=fPts[i][1];if(map[y]&&map[y][x]===T.GRASS)map[y][x]=T.FLOWER;}
}

// ── PLAYER ──
var P = {x:7*TILE,y:9*TILE,vx:0,vy:0,spd:2.8,fspd:5,w:32,h:40,dir:'down',af:0,at:0,nt:0,ltu:0};

// ── NPCS ──
var NPCS = [
  {id:'zenko', name:'Zenko', col:'#f0c060', x:25*TILE, y:18*TILE,
   bx1:22*TILE,by1:16*TILE,bx2:27*TILE,by2:22*TILE,
   dlg:['Zenko here! Been meditating by the river.','Always carry Ki-Berries on you.','Dark energy near eastern cliffs!','Farming with life energy is genius!'],
   di:0,vx:0,vy:0,wt:0,af:0,at:0},
  {id:'lyra',  name:'Lyra',  col:'#60a0f0', x:21*TILE, y:5*TILE,
   bx1:19*TILE,by1:4*TILE,bx2:25*TILE,by2:7*TILE,
   dlg:['Lyra here! Tap E near me to open my shop.','Your energy is insane! Soil glows around you.','I built a Harvest Scanner!','StarFruit on outer colonies is 10x price!'],
   di:0,vx:0,vy:0,wt:0,af:0,at:0},
  {id:'elder', name:'Elder Torr', col:'#80c080', x:3*TILE, y:20*TILE,
   bx1:2*TILE,by1:17*TILE,bx2:7*TILE,by2:23*TILE,
   dlg:['Press T to till, S to plant, G to water, Space to sleep, H to harvest. Full cycle of life!',
        'Press S once to select Seed tool, S again to cycle crops. Or tap 1-6 for quick select.',
        'Tomato is special - REGROWS after harvest. Plant once, harvest forever.',
        'Star Fruit gives +2000 Power Level when harvested. Worth the 6-day wait!',
        'Complete Daily Missions every day for bonus Zeni and Power Level.',
        'At Power Level 15000 you transform Super Saiyan. At 25000, Super Saiyan 2!',
        'Open Trade Routes (R button) to sell crops at 2x-10x price in other cities.',
        'Press the Cheats button (gear icon) to access God Mode and Farm Bot!'],
   di:0,vx:0,vy:0,wt:0,af:0,at:0},
];

// ── PARTICLES ──
var parts = [];
function spark(x,y,col,n) {
  for(var i=0;i<n;i++){
    var a=Math.PI*2*i/n+Math.random()*0.5, sp=1.5+Math.random()*2;
    parts.push({x:x,y:y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-1.5,life:1,dec:0.02+Math.random()*0.02,col:col,sz:4+Math.random()*5});
  }
}

// ── CAMERA ──
var cam = {x:0,y:0};
function updateCam() {
  var tx=Math.max(0,Math.min(P.x-canvas.width/2+P.w/2, MW*TILE-canvas.width));
  var ty=Math.max(0,Math.min(P.y-canvas.height/2+P.h/2, MH*TILE-canvas.height));
  cam.x+=(tx-cam.x)*0.1; cam.y+=(ty-cam.y)*0.1;
}

// ── MISSIONS ──
function genMissions() {
  G.missions=[];G.mprog={};G.earned=0;G.traded=0;
  var pool=MPOOL.slice();
  for(var i=pool.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=pool[i];pool[i]=pool[j];pool[j]=t;}
  G.missions=pool.slice(0,3);
  for(var i=0;i<G.missions.length;i++) G.mprog[G.missions[i].id]=0;
  renderMissions();
}
function advMission(type, amt) {
  if(!amt) amt=1;
  for(var i=0;i<G.missions.length;i++){
    var m=G.missions[i];if(m.done)continue;
    if(m.type===type){
      G.mprog[m.id]=(G.mprog[m.id]||0)+amt;
      if(G.mprog[m.id]>=m.tgt&&!m.done){
        m.done=true;G.gold+=m.zeni;G.pl+=m.pl;
        showToast('MISSION DONE! '+m.text+' +'+m.zeni+' Zeni +'+m.pl+' PL');
        checkSSJ();updateUI();
      }
    }
  }
  renderMissions();
}
function renderMissions() {
  var el=document.getElementById('mlist');if(!el)return;
  var html='';
  for(var i=0;i<G.missions.length;i++){
    var m=G.missions[i],p=Math.min(G.mprog[m.id]||0,m.tgt),pct=Math.min(100,p/m.tgt*100);
    if(m.done){html+='<div class="mitem done"><div class="mname">'+m.text+'</div><div class="mdone">DONE! +'+m.zeni+' Zeni</div></div>';}
    else{html+='<div class="mitem"><div class="mname">'+m.text+'</div><div class="mprog"><div class="mprogbar" style="width:'+pct+'%"></div></div><div class="mreward">'+p+'/'+m.tgt+' +'+m.zeni+' Zeni</div></div>';}
  }
  el.innerHTML=html;
}

// ── TILE DRAWING ──
function px(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(x,y,w,h);}

function drawGrass(x,y,s) {
  var v=s%4;
  px(x,y,TILE,TILE,'#5a8a3c');
  if(v===0){px(x+2,y+2,20,18,'#62963f');px(x+26,y+18,18,16,'#507a35');}
  else if(v===1){px(x+8,y+4,28,20,'#5f9140');px(x+2,y+24,16,14,'#4d7532');}
  else if(v===2){px(x+4,y+8,22,28,'#639642');}
  else{px(x+10,y+10,28,28,'#5e8e3e');}
  var b=(s*13)%(TILE-14);
  px(x+b+2,y+4,2,7,'#3d6e26');px(x+b+2,y+22,2,7,'#3d6e26');
  px(x,y,TILE,1,'rgba(0,0,0,0.05)');
}
function drawDirt(x,y){
  px(x,y,TILE,TILE,'#8B6340');px(x+3,y+3,14,10,'#7a5632');px(x+22,y+8,18,12,'#9a6e4a');px(x+8,y+28,22,12,'#7d5836');
}
function drawWater(x,y,t,deep){
  var b=deep?'#1a5a8a':'#2272b0',m=deep?'#1e6699':'#2a82c8';
  px(x,y,TILE,TILE,b);px(x+2,y+2,TILE-4,TILE-4,m);
  var a=0.25+Math.sin(t/400)*0.15;ctx.fillStyle='rgba(255,255,255,'+a+')';ctx.fillRect(x+4,y+6,20,4);
  var a2=0.2+Math.sin(t/600)*0.12;ctx.fillStyle='rgba(255,255,255,'+a2+')';ctx.fillRect(x+10,y+20,16,4);
}
function drawTilled(x,y){
  px(x,y,TILE,TILE,'#5c3a1e');
  for(var r=0;r<4;r++){var ry=y+4+r*10;px(x+2,ry,TILE-4,6,'#4a2e12');px(x+2,ry+1,TILE-4,2,'#3d2410');}
}
function drawPath(x,y){
  px(x,y,TILE,TILE,'#b89a70');px(x+1,y+1,22,22,'#c8aa80');px(x+24,y+1,22,22,'#bea070');
  px(x+1,y+24,22,22,'#bca070');px(x+24,y+24,22,22,'#c4a878');px(x,y+23,TILE,2,'#a08860');px(x+23,y,2,TILE,'#a08860');
}
function drawFence(x,y){
  drawGrass(x,y,3);px(x+4,y+8,6,32,'#c8a870');px(x+38,y+8,6,32,'#c8a870');
  px(x+8,y+14,32,5,'#d4b07a');px(x+8,y+28,32,5,'#d4b07a');
}
function drawWood(x,y){
  var p=['#8B6340','#7a5530','#9a7050'];
  for(var i=0;i<3;i++){px(x,y+i*16,TILE,15,p[i%3]);px(x+1,y+i*16+1,TILE-2,3,'#a87848');}
}
function drawSand(x,y){
  px(x,y,TILE,TILE,'#d4b870');px(x+6,y+4,16,12,'#dcc478');px(x+28,y+18,14,10,'#ccb068');
}
function drawFlower(x,y,t){
  drawGrass(x,y,3);
  var bob=Math.sin(t/800+(x+y)*0.3)*1.5;
  px(x+TILE/2-1,y+TILE/2+bob,2,10,'#2d6e1e');
  var fc=['#FF6BA8','#FFD700','#FF8C42','#C084FC'];
  ctx.fillStyle=fc[Math.floor((x+y)/TILE)%4];
  ctx.beginPath();ctx.arc(x+TILE/2,y+TILE/2-4+bob,6,0,Math.PI*2);ctx.fill();
  px(x+TILE/2-2,y+TILE/2-6+bob,4,4,'#FFD700');
}
function drawTree(x,y){
  ctx.fillStyle='rgba(0,0,0,0.15)';ctx.beginPath();ctx.ellipse(x+TILE+5,y+TILE*2-6,24,8,0,0,Math.PI*2);ctx.fill();
  px(x+TILE-7,y+TILE+10,16,28,'#5c3a18');
  ctx.fillStyle='#2d6e1e';ctx.beginPath();ctx.ellipse(x+TILE,y+TILE+4,30,20,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#3a8a26';ctx.beginPath();ctx.ellipse(x+TILE,y+TILE-6,26,18,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#48a030';ctx.beginPath();ctx.ellipse(x+TILE,y+TILE-16,20,15,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#56ba3a';ctx.beginPath();ctx.ellipse(x+TILE,y+TILE-24,14,11,0,0,Math.PI*2);ctx.fill();
}
function drawRock(x,y){
  ctx.fillStyle='rgba(0,0,0,0.2)';ctx.beginPath();ctx.ellipse(x+TILE/2+3,y+TILE-6,16,5,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#7a7a80';ctx.beginPath();ctx.ellipse(x+TILE/2,y+TILE/2+2,16,13,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#b0b0b8';ctx.beginPath();ctx.ellipse(x+TILE/2-4,y+TILE/2-4,6,4,-0.5,0,Math.PI*2);ctx.fill();
}
function drawCrop(x,y,cid,stage,t){
  drawTilled(x,y);
  if(stage===1){
    px(x+TILE/2-1,y+TILE-14,2,8,'#3d8a20');
    ctx.fillStyle='#4aaa28';ctx.beginPath();ctx.ellipse(x+TILE/2+4,y+TILE-18,5,4,0.5,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.ellipse(x+TILE/2-4,y+TILE-20,5,4,-0.5,0,Math.PI*2);ctx.fill();
  } else if(stage===2){
    px(x+TILE/2-1,y+TILE-22,2,16,'#3d8a20');
    ctx.fillStyle='#56c232';ctx.beginPath();ctx.ellipse(x+TILE/2+5,y+TILE-28,6,4,0.4,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.ellipse(x+TILE/2-5,y+TILE-30,6,4,-0.4,0,Math.PI*2);ctx.fill();
  } else if(stage===3){
    var c=CROPS[cid];
    px(x+TILE/2-1,y+TILE-28,2,18,'#3d8a20');
    ctx.fillStyle=(c&&c.col)||'#FF7A00';
    ctx.beginPath();ctx.arc(x+TILE/2,y+TILE/2-4,10,0,Math.PI*2);ctx.fill();
    // Sparkle
    var sp=(t/200+(x+y)/100)%1;
    ctx.fillStyle='rgba(255,220,0,'+(0.6+sp*0.4)+')';
    ctx.beginPath();ctx.arc(x+TILE-10+Math.cos(t/300)*3,y+6+Math.sin(t/300)*3,3+sp*2,0,Math.PI*2);ctx.fill();
  }
}
// Add color to each crop
CROPS.carrot.col='#FF7A00';CROPS.tomato.col='#e74c3c';CROPS.corn.col='#f1c40f';
CROPS.strawberry.col='#e91e63';CROPS.senzu.col='#27ae60';CROPS.starfruit.col='#FFD700';

function drawHouse(bx,by){
  var x=bx-cam.x,y=by-cam.y,w=TILE*4,h=TILE*3;
  ctx.fillStyle='rgba(0,0,0,0.15)';ctx.fillRect(x+8,y+h,w-4,12);
  px(x,y+16,w,h-16,'#e8d4a0');px(x+2,y+18,w-4,h-20,'#f0dca8');
  px(x,y+16,w,6,'#8B6340');px(x,y+h-14,w,6,'#8B6340');
  ctx.fillStyle='#c0392b';ctx.beginPath();ctx.moveTo(x-10,y+18);ctx.lineTo(x+w/2,y-22);ctx.lineTo(x+w+10,y+18);ctx.closePath();ctx.fill();
  px(x+w/2-2,y-22,4,26,'#922b21');
  px(x+w/2-10,y+h-38,20,38,'#7d4e2e');px(x+w/2+4,y+h-18,4,4,'#FFD700');
  px(x+14,y+h-70,28,26,'#87CEEB');px(x+w-46,y+h-70,28,26,'#87CEEB');
  ctx.fillStyle='rgba(0,0,0,0.5)';ctx.fillRect(x+w/2-36,y+h-94,72,14);
  ctx.fillStyle='#FFD700';ctx.font='bold 10px Arial';ctx.textAlign='center';ctx.fillText("GOKU'S FARM",x+w/2,y+h-84);
}
function drawShop(bx,by){
  var x=bx-cam.x,y=by-cam.y,w=TILE*5,h=TILE*3;
  ctx.fillStyle='rgba(0,0,0,0.15)';ctx.fillRect(x+8,y+h,w-4,12);
  px(x,y+20,w,h-20,'#1a237e');px(x+2,y+22,w-4,h-24,'#283593');
  ctx.fillStyle='#FFD700';ctx.font='bold 11px Arial';ctx.textAlign='center';ctx.fillText('CAPSULE CORP',x+w/2,y+55);
  ctx.fillStyle='#FFD700';ctx.beginPath();ctx.moveTo(x-6,y+22);ctx.lineTo(x+w/2,y-12);ctx.lineTo(x+w+6,y+22);ctx.closePath();ctx.fill();
  px(x+w/2-12,y+h-42,24,42,'#1565C0');
  ctx.fillStyle='rgba(0,0,0,0.6)';ctx.fillRect(x+w/2-44,y+h-112,88,14);
  ctx.fillStyle='#00E5FF';ctx.font='bold 9px Arial';ctx.textAlign='center';ctx.fillText("LYRA'S SHOP",x+w/2,y+h-102);
}

function drawMap(t){
  var stx=Math.max(0,Math.floor(cam.x/TILE)),sty=Math.max(0,Math.floor(cam.y/TILE));
  var etx=Math.min(MW,stx+Math.ceil(canvas.width/TILE)+3),ety=Math.min(MH,sty+Math.ceil(canvas.height/TILE)+3);
  for(var ty=sty;ty<ety;ty++){
    for(var tx=stx;tx<etx;tx++){
      var sx=tx*TILE-cam.x,sy=ty*TILE-cam.y,tile=map[ty][tx],s=(tx*MH+ty)*31337%100;
      if(tile===T.GRASS){drawGrass(sx,sy,s);}
      else if(tile===T.DIRT){drawDirt(sx,sy);}
      else if(tile===T.WATER){drawWater(sx,sy,t,false);}
      else if(tile===T.DWATER){drawWater(sx,sy,t,true);}
      else if(tile===T.SAND){drawSand(sx,sy);}
      else if(tile===T.TILLED){drawTilled(sx,sy);}
      else if(tile===T.PATH){drawPath(sx,sy);}
      else if(tile===T.FENCE){drawFence(sx,sy);}
      else if(tile===T.WOOD){drawWood(sx,sy);}
      else if(tile===T.FLOWER){drawFlower(sx,sy,t);}
      else if(tile===T.PLANTED){var fd=farmData[tx+','+ty];drawCrop(sx,sy,fd?fd.cid:'carrot',1,t);}
      else if(tile===T.GROWING){var fd=farmData[tx+','+ty];drawCrop(sx,sy,fd?fd.cid:'carrot',2,t);}
      else if(tile===T.READY){var fd=farmData[tx+','+ty];drawCrop(sx,sy,fd?fd.cid:'carrot',3,t);}
      else if(tile===T.ROCK){drawGrass(sx,sy,s);drawRock(sx,sy);}
      else if(tile===T.TREE||tile===T.WOOD){drawGrass(sx,sy,s);}
      else{drawGrass(sx,sy,s);}
    }
  }
  // Buildings
  if(2*TILE-cam.x>-TILE*5&&2*TILE-cam.x<canvas.width+TILE) drawHouse(2*TILE,1*TILE);
  if(19*TILE-cam.x>-TILE*6&&19*TILE-cam.x<canvas.width+TILE) drawShop(19*TILE,1*TILE);
  // Trees
  for(var i=0;i<trees.length;i++){
    var tx2=trees[i][0],ty2=trees[i][1];
    var sx=tx2*TILE-cam.x,sy=ty2*TILE-cam.y;
    if(sx>-TILE*2&&sx<canvas.width+TILE&&sy>-TILE*3&&sy<canvas.height+TILE) drawTree(sx,sy);
  }
}

// ── DRAW PLAYER ──
function drawPlayer(t){
  var sx=P.x-cam.x,sy=P.y-cam.y;
  var moving=Math.abs(P.vx)>0.1||Math.abs(P.vy)>0.1;
  if(moving){P.at++;if(P.at>8){P.at=0;P.af=(P.af+1)%4;}}else P.af=0;
  var leg=moving?Math.sin(P.af/4*Math.PI*2)*5:0;
  var bob=moving?Math.abs(Math.sin(P.af/4*Math.PI*2))*2:0;
  var by=sy+bob, cx=sx+16;
  // Nimbus
  if(G.fly){
    P.nt+=0.04;var nb=Math.sin(P.nt)*4,ny=sy+P.h+10+nb;
    ctx.fillStyle='rgba(255,200,0,0.95)';ctx.beginPath();ctx.ellipse(cx,ny,30,12,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='rgba(255,240,140,0.8)';
    ctx.beginPath();ctx.ellipse(cx-14,ny-4,14,9,0,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.ellipse(cx+14,ny-4,14,9,0,0,Math.PI*2);ctx.fill();
  }
  // Shadow
  ctx.fillStyle='rgba(0,0,0,0.2)';ctx.beginPath();ctx.ellipse(cx,sy+P.h+2,13,5,0,0,Math.PI*2);ctx.fill();
  // SSJ aura
  if(G.ssj){
    var ar=24+Math.sin(t/150)*3;
    var ag=ctx.createRadialGradient(cx,by+20,2,cx,by+20,ar);
    ag.addColorStop(0,'rgba(255,220,0,0.4)');ag.addColorStop(1,'transparent');
    ctx.fillStyle=ag;ctx.beginPath();ctx.ellipse(cx,by+20,ar+6,ar+10,0,0,Math.PI*2);ctx.fill();
  }
  // Legs
  var lLy=by+P.h-18+leg,rLy=by+P.h-18-leg;
  ctx.fillStyle='#2a2a4a';ctx.beginPath();ctx.ellipse(sx+10,lLy+7,5,8,0,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.ellipse(sx+22,rLy+7,5,8,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#1a1a3a';ctx.beginPath();ctx.ellipse(sx+10,lLy+15,7,5,0,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.ellipse(sx+22,rLy+15,7,5,0,0,Math.PI*2);ctx.fill();
  // Body
  ctx.fillStyle='#FF6B00';ctx.beginPath();ctx.ellipse(cx,by+20,13,11,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#FF8C30';ctx.beginPath();ctx.ellipse(cx,by+16,9,6,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#111';ctx.beginPath();ctx.ellipse(cx,by+26,13,4,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#FFD700';ctx.beginPath();ctx.ellipse(cx,by+26,4,3,0,0,Math.PI*2);ctx.fill();
  // Arms
  var as=moving?leg*0.7:0;
  ctx.fillStyle='#FF6B00';
  ctx.beginPath();ctx.ellipse(sx+3,by+19+as,5,9,0.25,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.ellipse(sx+29,by+19-as,5,9,-0.25,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#f5c39a';
  ctx.beginPath();ctx.ellipse(sx+2,by+28+as,5,4,0,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.ellipse(sx+30,by+28-as,5,4,0,0,Math.PI*2);ctx.fill();
  // Head
  ctx.fillStyle='#f5c39a';ctx.beginPath();ctx.ellipse(cx,by+8,11,12,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#f8d0a8';ctx.beginPath();ctx.ellipse(cx-3,by+5,6,5,0,0,Math.PI*2);ctx.fill();
  if(P.dir!=='up'){
    ctx.fillStyle=G.ssj?'#39FF14':'#1a1a2a';
    ctx.beginPath();ctx.ellipse(cx-4,by+7,2.5,3,0,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.ellipse(cx+4,by+7,2.5,3,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(cx-3,by+6,1,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#1a1a1a';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(cx-7,by+4);ctx.lineTo(cx-1,by+5);ctx.stroke();
    ctx.beginPath();ctx.moveTo(cx+7,by+4);ctx.lineTo(cx+1,by+5);ctx.stroke();
  }
  // Hair
  var hc=G.ssj?'#FFD700':'#1a1a1a';
  if(G.ssj){ctx.shadowColor='#FFD700';ctx.shadowBlur=14;}
  ctx.fillStyle=hc;ctx.beginPath();ctx.ellipse(cx,by+2,11,7,0,Math.PI,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.ellipse(cx-10,by+5,4,6,0.4,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.ellipse(cx+10,by+5,4,6,-0.4,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle=hc;ctx.lineWidth=5;ctx.lineCap='round';
  var spikes=[[cx-8,by+1,cx-14,by-15],[cx-2,by-2,cx-3,by-19],[cx+3,by-1,cx+7,by-17],[cx+9,by+2,cx+15,by-12]];
  for(var i=0;i<spikes.length;i++){
    var s2=spikes[i];
    ctx.beginPath();ctx.moveTo(s2[0],s2[1]);ctx.quadraticCurveTo(s2[2],s2[3],s2[2]+(s2[0]-cx)*0.3,s2[3]+5);ctx.stroke();
  }
  ctx.shadowBlur=0;ctx.lineCap='butt';
}

// ── DRAW NPC ──
function drawNPC(npc,t){
  var sx=npc.x-cam.x,sy=npc.y-cam.y;
  if(sx<-80||sx>canvas.width+80||sy<-80||sy>canvas.height+80)return;
  var mov=Math.abs(npc.vx)>0.05||Math.abs(npc.vy)>0.05;
  npc.at++;if(npc.at>10){npc.at=0;npc.af=(npc.af+1)%4;}
  var leg=mov?Math.sin(npc.af/4*Math.PI*2)*4:0;
  ctx.fillStyle='rgba(0,0,0,0.15)';ctx.beginPath();ctx.ellipse(sx+TILE/2,sy+TILE-4,12,4,0,0,Math.PI*2);ctx.fill();
  // Legs
  ctx.fillStyle='#44445a';
  ctx.beginPath();ctx.ellipse(sx+14,sy+TILE-10+leg,4,7,0,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.ellipse(sx+26,sy+TILE-10-leg,4,7,0,0,Math.PI*2);ctx.fill();
  // Body
  ctx.fillStyle=npc.col;ctx.beginPath();ctx.ellipse(sx+TILE/2,sy+TILE-28,11,12,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='rgba(255,255,255,0.25)';ctx.beginPath();ctx.ellipse(sx+TILE/2-2,sy+TILE-33,6,5,0,0,Math.PI*2);ctx.fill();
  // Arms
  ctx.fillStyle=npc.col;
  ctx.beginPath();ctx.ellipse(sx+8,sy+TILE-26,4,7,0.3,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.ellipse(sx+32,sy+TILE-26,4,7,-0.3,0,Math.PI*2);ctx.fill();
  // Head
  ctx.fillStyle='#f5c39a';ctx.beginPath();ctx.ellipse(sx+TILE/2,sy+TILE-46,11,12,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#1a1a2a';
  ctx.beginPath();ctx.ellipse(sx+TILE/2-4,sy+TILE-47,2,2.5,0,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.ellipse(sx+TILE/2+4,sy+TILE-47,2,2.5,0,0,Math.PI*2);ctx.fill();
  // NPC unique hair
  if(npc.id==='zenko'){
    ctx.fillStyle='#f5c39a';ctx.beginPath();ctx.ellipse(sx+TILE/2,sy+TILE-52,11,6,0,0,Math.PI*2);ctx.fill();
    px(sx+6,sy+TILE-51,28,4,'#e74c3c');
  } else if(npc.id==='lyra'){
    ctx.fillStyle='#00bcd4';ctx.beginPath();ctx.ellipse(sx+TILE/2,sy+TILE-54,12,8,0,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.ellipse(sx+6,sy+TILE-52,5,10,0,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.ellipse(sx+TILE-6,sy+TILE-52,5,10,0,0,Math.PI*2);ctx.fill();
  } else {
    // Elder Torr big hat
    ctx.fillStyle='#2c3e50';ctx.beginPath();ctx.moveTo(sx+TILE/2,sy+TILE-84);ctx.lineTo(sx+2,sy+TILE-56);ctx.lineTo(sx+TILE-2,sy+TILE-56);ctx.closePath();ctx.fill();
    px(sx+1,sy+TILE-58,TILE-2,5,'#1a252f');
    ctx.fillStyle='#FFD700';ctx.font='bold 10px Arial';ctx.textAlign='center';ctx.fillText('*',sx+TILE/2,sy+TILE-70);
    ctx.fillStyle='#ecf0f1';ctx.beginPath();ctx.moveTo(sx+10,sy+TILE-34);ctx.lineTo(sx+8,sy+TILE-10);ctx.lineTo(sx+TILE/2,sy+TILE-6);ctx.lineTo(sx+TILE-8,sy+TILE-10);ctx.lineTo(sx+TILE-10,sy+TILE-34);ctx.closePath();ctx.fill();
    px(sx-5,sy+TILE-74,4,66,'#795548');
    var op=0.6+Math.sin(t/400)*0.4;ctx.fillStyle='rgba(100,200,255,'+op+')';ctx.beginPath();ctx.arc(sx-3,sy+TILE-78,7,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.9)';ctx.beginPath();ctx.arc(sx-3,sy+TILE-78,4,0,Math.PI*2);ctx.fill();
  }
  // Name tag
  ctx.fillStyle='rgba(0,0,0,0.7)';var nw=npc.name.length*6+12;ctx.fillRect(sx+TILE/2-nw/2,sy-22,nw,14);
  ctx.fillStyle=npc.id==='lyra'?'#00E5FF':npc.id==='elder'?'#a8e6cf':'#FFD700';
  ctx.font='bold 9px Arial';ctx.textAlign='center';ctx.fillText(npc.name,sx+TILE/2,sy-12);
  // Talk indicator
  var dx=P.x+16-(npc.x+TILE/2),dy=P.y+20-(npc.y+TILE/2);
  var dist=Math.sqrt(dx*dx+dy*dy);
  if(dist<120){
    var pulse=0.6+Math.sin(t/200)*0.4;
    ctx.fillStyle='rgba(255,255,255,'+pulse+')';ctx.beginPath();ctx.arc(sx+TILE/2,sy-32,9,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#333';ctx.font='bold 11px Arial';ctx.textAlign='center';
    ctx.fillText(npc.id==='lyra'?'$':npc.id==='elder'?'?':'!',sx+TILE/2,sy-28);
  }
}

// ── SKY ──
function drawSky(t){
  var h=G.hour,w=weather.cur;
  var c1=w.sky1,c2=w.sky2;
  if(h<6||h>21){c1='#020818';c2='#0a1030';}
  else if(h<8){c1='#FF6B35';c2='#FFD700';}
  else if(h>18&&h<=21){c1='#FF8C00';c2='#FF6B35';}
  var g=ctx.createLinearGradient(0,0,0,canvas.height*0.3);
  g.addColorStop(0,c1);g.addColorStop(1,c2);
  ctx.fillStyle=g;ctx.fillRect(0,0,canvas.width,canvas.height);
  // Stars at night
  if(h<6||h>20){
    var now2=Date.now();
    for(var i=0;i<60;i++){
      ctx.globalAlpha=Math.sin(now2/600+i)*0.4+0.5;
      ctx.fillStyle='#fff';
      ctx.fillRect((i*137.5+80)%canvas.width,(i*97.3+40)%(canvas.height*0.28),i%3===0?2:1,i%3===0?2:1);
    }
    ctx.globalAlpha=1;
  }
  // Clouds
  if(w.id==='cloudy'||w.id==='rain'||w.id==='storm'){
    var cn=w.id==='storm'?'rgba(40,40,50,0.88)':'rgba(200,210,220,0.82)';
    var nt=Date.now();
    for(var i=0;i<4;i++){
      var cx2=((nt/((i+1)*800)+i*350))%(canvas.width+200)-100;
      var cy2=20+i*22,cr=50+i*15;
      ctx.fillStyle=cn;
      ctx.beginPath();ctx.ellipse(cx2,cy2,cr,cr*0.5,0,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.ellipse(cx2-cr*0.5,cy2+5,cr*0.6,cr*0.38,0,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.ellipse(cx2+cr*0.5,cy2+5,cr*0.6,cr*0.38,0,0,Math.PI*2);ctx.fill();
    }
  }
  // Rain
  if(w.id==='rain'||w.id==='storm'){
    ctx.strokeStyle='rgba(150,190,255,0.45)';ctx.lineWidth=1.5;
    for(var i=0;i<weather.drops.length;i++){
      var d=weather.drops[i];
      ctx.beginPath();ctx.moveTo(d.x,d.y);ctx.lineTo(d.x+2,d.y+d.len);ctx.stroke();
      d.y+=d.spd;d.x+=1.5;if(d.y>canvas.height){d.y=-20;d.x=Math.random()*canvas.width;}
    }
  }
  // Weather label
  ctx.fillStyle='rgba(0,0,0,0.5)';ctx.fillRect(canvas.width/2-55,4,110,16);
  ctx.fillStyle='#fff';ctx.font='bold 9px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(w.name,canvas.width/2,12);
  // Nimbus travel
  if(weather.travel)drawTravel(t);
}

function drawTravel(t){
  var nt=weather.travel;nt.prog+=0.005;
  ctx.fillStyle='rgba(5,5,25,0.75)';ctx.fillRect(0,0,canvas.width,canvas.height);
  var cx2=canvas.width*0.15+nt.prog*(canvas.width*0.7),cy2=canvas.height*0.38+Math.sin(Date.now()/350)*18;
  ctx.fillStyle='rgba(255,200,0,0.95)';ctx.beginPath();ctx.ellipse(cx2,cy2,32,13,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='rgba(255,230,100,0.8)';
  ctx.beginPath();ctx.ellipse(cx2-14,cy2-3,16,9,0,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.ellipse(cx2+14,cy2-3,16,9,0,0,Math.PI*2);ctx.fill();
  var dest=G.cities[nt.target];
  ctx.fillStyle='rgba(0,0,0,0.6)';ctx.fillRect(canvas.width/2-140,canvas.height*0.54,280,50);
  ctx.fillStyle='#FFD700';ctx.font='bold 13px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(dest.name,canvas.width/2,canvas.height*0.558);
  ctx.fillStyle='#aaa';ctx.font='9px Arial';ctx.fillText(dest.desc,canvas.width/2,canvas.height*0.578);
  var bw=260,bx=(canvas.width-bw)/2,bby=canvas.height*0.65;
  ctx.fillStyle='#222';ctx.fillRect(bx,bby,bw,14);
  ctx.fillStyle='#FFD700';ctx.fillRect(bx,bby,bw*Math.min(nt.prog,1),14);
  ctx.fillStyle='#fff';ctx.font='8px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('Flying to '+dest.name+'... '+Math.floor(Math.min(nt.prog,1)*100)+'%',canvas.width/2,bby+7);
  if(nt.prog>=1){weather.travel=null;setTimeout(function(){openTrade();showMsg('Arrived at '+dest.name+'!');},300);}
}

// ── INPUT ──
var keys={};
var cheatBuf='';

document.addEventListener('keydown',function(e){
  keys[e.key.toLowerCase()]=true;
  if(e.key==='Enter'){
    var code=cheatBuf.toLowerCase().trim();
    if(typeof cheat==='function') cheat(code);
    else showMsg('Unknown: '+code.toUpperCase());
    cheatBuf='';
  } else if(e.key==='Escape'){
    cheatBuf='';
  } else if(e.key.length===1&&/[a-zA-Z0-9]/.test(e.key)){
    cheatBuf+=e.key;if(cheatBuf.length>10)cheatBuf=cheatBuf.slice(-10);
  }
  handleKey(e.key.toLowerCase());
});
document.addEventListener('keyup',function(e){keys[e.key.toLowerCase()]=false;});

function handleKey(k){
  if(k==='e'){talkNPC();return;}
  if(k==='r'){openTrade();return;}
  if(k===' '){nextDay();return;}
  if(k==='x'){useTool();return;}
  if(k==='f'){setTool('nimbus');return;}
  if(k==='t'){setTool('till');return;}
  if(k==='g'){setTool('water');return;}
  if(k==='h'){setTool('harvest');return;}
  if(k==='s'){if(G.tool==='seed')cycleCrop();else setTool('seed');return;}
  if(k==='z'&&G.senzu>0){G.senzu--;G.ki=G.maxKi;showMsg('Senzu Bean eaten! KI restored!');spark(P.x+16,P.y+20,'#39FF14',10);updateUI();}
  var cids=Object.keys(CROPS);
  if(k>='1'&&k<='6'){var idx=parseInt(k)-1;if(cids[idx]){G.crop=cids[idx];renderSeeds();showMsg(CROPS[G.crop].name+' selected!');}}
}

// ── CHEAT FUNCTION ──
function cheat(code){
  var el=document.getElementById('cheatfb');
  function fb(msg){if(el){el.textContent=msg;setTimeout(function(){el.textContent='';},3000);}showMsg(msg);}
  if(code==='god'||code===''){
    G.godMode=!G.godMode;
    if(G.godMode){G.gold=999999;G.ki=G.maxKi;var cids=Object.keys(CROPS);for(var i=0;i<cids.length;i++)G.inv[cids[i]].s=99;fb('GOD MODE ON! Unlimited everything!');updateUI();}
    else{fb('GOD MODE OFF! Good luck!');}
    updateCheatBtn();
  } else if(code==='bot'){toggleBot();fb(G.bot.on?'FARM BOT ON!':'FARM BOT OFF');}
  else if(code==='botall'){G.bot.on=false;toggleBot();fb('ALL 3 HELPERS farming your land!');}
  else if(code==='ssj'){G.pl=15001;checkSSJ();fb('INSTANT SUPER SAIYAN!');updateUI();}
  else if(code==='ssj2'){G.pl=25001;G.ssj=true;checkSSJ();fb('INSTANT SUPER SAIYAN 2!');updateUI();}
  else if(code==='rich'){G.gold+=100000;fb('+100,000 ZENI!');updateUI();}
  else if(code==='seeds'){var cids2=Object.keys(CROPS);for(var i=0;i<cids2.length;i++)G.inv[cids2[i]].s+=50;fb('+50 of every seed!');updateUI();renderSeeds();}
  else if(code==='senzu'){G.senzu+=10;fb('+10 Senzu Beans!');updateUI();}
  else if(code==='power'){G.pl+=10000;fb('+10,000 Power Level!');checkSSJ();updateUI();}
  else if(code==='harvest'){var ks=Object.keys(farmData);for(var i=0;i<ks.length;i++){var fd=farmData[ks[i]];if(fd.cid&&fd.stage>0&&fd.stage<3){fd.stage=3;var parts2=ks[i].split(',');map[parseInt(parts2[1])][parseInt(parts2[0])]=T.READY;}}fb('ALL CROPS INSTANTLY READY!');}
  else if(code==='rain'){var ks2=Object.keys(farmData);for(var i=0;i<ks2.length;i++){if(farmData[ks2[i]].stage>0&&farmData[ks2[i]].stage<3)farmData[ks2[i]].watered=true;}fb('ALL CROPS WATERED!');}
  else if(code==='help'){fb('CODES: god bot botall ssj ssj2 rich seeds senzu power harvest rain');}
  else if(code.length>0){fb('Unknown code: '+code.toUpperCase()+' - type help');}
}
window.cheat=cheat;

function updateCheatBtn(){
  var btn=document.getElementById('godBtn');var txt=document.getElementById('godtxt');
  if(btn){btn.className=G.godMode?'cheat-big':'cheat-big off';}
  if(txt){txt.textContent=G.godMode?'Currently: ON':'Currently: OFF';}
}

// ── TOOL FUNCTIONS ──
function setTool(tool){
  G.tool=tool;
  document.querySelectorAll('.tbtn').forEach(function(b){b.classList.remove('active');});
  var el=document.getElementById('t-'+tool);if(el)el.classList.add('active');
  if(tool==='nimbus'){
    G.fly=!G.fly;P.spd=G.fly?P.fspd:2.8;
    showMsg(G.fly?'Nimbus activated! Soaring!':'Landed safely.');
  }
}
window.setTool=setTool;

function cycleCrop(){
  var ids=Object.keys(CROPS),cur=ids.indexOf(G.crop);
  G.crop=ids[(cur+1)%ids.length];renderSeeds();showMsg(CROPS[G.crop].name+' selected!');
}
window.touchSeed=function(){if(G.tool==='seed')cycleCrop();else setTool('seed');};

// ── COLLISION ──
function solid(tx,ty){
  if(tx<0||ty<0||tx>=MW||ty>=MH)return true;
  if(G.fly)return false;
  var t=map[ty][tx];
  return t===T.WATER||t===T.DWATER||t===T.ROCK||t===T.FENCE||t===T.TREE||t===T.WOOD;
}
function npcSolid(tx,ty){
  if(tx<0||ty<0||tx>=MW||ty>=MH)return true;
  var t=map[ty][tx];
  return t===T.WATER||t===T.DWATER||t===T.ROCK||t===T.FENCE||t===T.TREE||t===T.WOOD||t===T.DIRT;
}
function frontTile(){
  var cx=P.x+P.w/2,cy=P.y+P.h/2;
  var offs={down:[0,28],up:[0,-20],left:[-28,0],right:[28,0]};
  var o=offs[P.dir];var tx=Math.floor((cx+o[0])/TILE),ty=Math.floor((cy+o[1])/TILE);
  return{tx:tx,ty:ty,tile:map[ty]?map[ty][tx]:null,key:tx+','+ty};
}

// ── USE TOOL ──
function useTool(){
  var f=frontTile(),tx=f.tx,ty=f.ty,tile=f.tile,key=f.key;
  var cid=G.crop,cr=CROPS[cid];
  if(G.tool==='till'){
    if(tile===T.DIRT||tile===T.GRASS){
      map[ty][tx]=T.TILLED;farmData[key]={stage:0,watered:false,gt:0,cid:null};
      G.pl+=50;showMsg('Ki-Tilled!');spark(tx*TILE+TILE/2,ty*TILE+TILE/2,'#8B6340',8);
      advMission('till');updateUI();
    }
  } else if(G.tool==='water'){
    if((tile===T.PLANTED||tile===T.GROWING)&&farmData[key]){
      if(!farmData[key].watered){
        farmData[key].watered=true;showMsg('KAMEHAMEHA WATER!');
        spark(tx*TILE+TILE/2,ty*TILE+TILE/2,'#00BFFF',10);advMission('water');updateUI();
      } else showMsg('Already watered today!');
    } else showMsg('Plant seeds first!');
  } else if(G.tool==='seed'){
    if(tile===T.TILLED){
      var inv=G.inv[cid];
      if(inv&&inv.s>0){
        map[ty][tx]=T.PLANTED;farmData[key]={stage:1,watered:false,gt:0,cid:cid};
        inv.s--;showMsg(cr.name+' planted!');spark(tx*TILE+TILE/2,ty*TILE+TILE/2,'#39FF14',6);
        advMission('plant');updateUI();renderSeeds();
      } else showMsg('No '+cr.name+' seeds! Buy from Lyra.');
    } else showMsg('Till soil first!');
  } else if(G.tool==='harvest'){
    if(tile===T.READY&&farmData[key]){
      var fid=farmData[key].cid||'carrot',fc=CROPS[fid];
      var earned=Math.floor(fc.sell*0.8+Math.random()*fc.sell*0.4);
      if(fc.sp==='regrow'){map[ty][tx]=T.PLANTED;farmData[key]={stage:1,watered:false,gt:0,cid:fid};}
      else{map[ty][tx]=T.TILLED;farmData[key]={stage:0,watered:false,gt:0,cid:null};}
      G.inv[fid].h++;G.gold+=earned;G.earned+=earned;G.pl+=fc.pb;
      advMission('harvest');advMission('earn',earned);
      handleSpecial(fc,tx,ty);
      showMsg('Harvested '+fc.name+'! +'+earned+' Zeni +'+fc.pb+' PL');
      spark(tx*TILE+TILE/2,ty*TILE+TILE/2,'#FFD700',12);
      checkSSJ();updateUI();
    } else showMsg('Nothing ready here!');
  }
}
window.useTool=useTool;

function handleSpecial(crop,tx,ty){
  if(crop.sp==='powerBoost'){G.pl+=500;showMsg('CORN POWER BOOST! +500 PL!');}
  else if(crop.sp==='restoreKi'){G.ki=Math.min(G.maxKi,G.ki+20);showMsg('Strawberry Ki Restore! +20 Ki!');}
  else if(crop.sp==='senzuCrop'){G.senzu++;showMsg('SENZU BEAN HARVESTED! +1 Senzu!');}
  else if(crop.sp==='powerSurge'){G.pl+=2000;showMsg('STAR FRUIT POWER SURGE! +2000 PL!');spark(tx*TILE+TILE/2,ty*TILE+TILE/2,'#FFD700',20);}
}

// ── NPC TALK ──
function talkNPC(){
  var closest=null,closestD=Infinity;
  for(var i=0;i<NPCS.length;i++){
    var npc=NPCS[i];
    var dx=npc.x+TILE/2-(P.x+16),dy=npc.y+TILE/2-(P.y+20);
    var d=Math.sqrt(dx*dx+dy*dy);
    if(d<120&&d<closestD){closestD=d;closest=npc;}
  }
  if(closest){
    if(closest.id==='lyra'){openShop();return;}
    var line=closest.dlg[closest.di%closest.dlg.length];closest.di++;
    var el=document.getElementById('dlg-portrait');if(el)el.textContent=closest.id==='zenko'?'*':closest.id==='elder'?'?':'!';
    var el2=document.getElementById('dlg-text');if(el2)el2.innerHTML='<strong style="color:#FFD700">'+closest.name+':</strong><br><br>'+line;
    var dlg=document.getElementById('dialogue');if(dlg)dlg.style.display='block';
  } else showMsg('No one nearby! Walk up to a character.');
}
window.talkNPC=talkNPC;
function closeDlg(){var d=document.getElementById('dialogue');if(d)d.style.display='none';}
window.closeDlg=closeDlg;

// ── SHOP ──
function openShop(){
  buildShop();
  var el=document.getElementById('shopgold');if(el)el.textContent=G.gold;
  var m=document.getElementById('shopmodal');if(m)m.classList.add('open');
}
function closeShop(){var m=document.getElementById('shopmodal');if(m)m.classList.remove('open');}
window.openShop=openShop;window.closeShop=closeShop;

function shopTab(name,btn){
  document.querySelectorAll('.stab').forEach(function(t){t.classList.remove('active');});
  document.querySelectorAll('.stab-content').forEach(function(t){t.classList.remove('active');});
  btn.classList.add('active');
  var el=document.getElementById('tab-'+name);if(el)el.classList.add('active');
}
window.shopTab=shopTab;

function buildShop(){
  var seedsEl=document.getElementById('tab-seeds');
  if(seedsEl){
    var h='';
    var cids=Object.keys(CROPS);
    for(var i=0;i<cids.length;i++){
      var cid=cids[i],c=CROPS[cid];
      h+='<div class="shop-item"><div class="si-icon">&#127807;</div><div class="si-info"><div class="si-name">'+c.name+' Seeds x5</div><div class="si-desc">'+c.desc+' - '+c.growDays+' day(s)</div></div><div class="si-cost">'+c.cost+' Zeni</div><button class="sbtn" onclick="buySeed(\''+cid+'\')">BUY</button></div>';
    }
    seedsEl.innerHTML=h;
  }
  var itemsEl=document.getElementById('tab-items');
  if(itemsEl){itemsEl.innerHTML='<div class="shop-item"><div class="si-icon">&#129802;</div><div class="si-info"><div class="si-name">Senzu Bean x1</div><div class="si-desc">Restores full Ki</div></div><div class="si-cost">30 Zeni</div><button class="sbtn" onclick="buySenzu(1)">BUY</button></div><div class="shop-item"><div class="si-icon">&#129802;</div><div class="si-info"><div class="si-name">Senzu Pack x3</div><div class="si-desc">Save 15 Zeni</div></div><div class="si-cost">75 Zeni</div><button class="sbtn" onclick="buySenzu(3)">BUY</button></div>';}
  var sellEl=document.getElementById('tab-sell');
  if(sellEl){
    var h2='';var cids2=Object.keys(CROPS);
    for(var i=0;i<cids2.length;i++){
      var cid2=cids2[i],c2=CROPS[cid2],qty=G.inv[cid2].h;
      h2+='<div class="shop-item"><div class="si-icon">&#127806;</div><div class="si-info"><div class="si-name">'+c2.name+' (Have: '+qty+')</div><div class="si-desc">'+c2.sell+' Zeni each</div></div><button class="sbtn sell" onclick="sellCrop(\''+cid2+'\')"'+(qty===0?' disabled':'')+'>SELL ALL</button></div>';
    }
    sellEl.innerHTML=h2;
  }
}

function shopFb(msg){var el=document.getElementById('shopfb');if(el){el.textContent=msg;setTimeout(function(){el.textContent='';},2500);}}

function buySeed(cid){
  // GOD MODE - free
  G.inv[cid].s+=5;shopFb('Got 5 '+CROPS[cid].name+' seeds!');
  spark(P.x+16,P.y+20,'#39FF14',6);buildShop();renderSeeds();updateUI();
}
window.buySeed=buySeed;

function buySenzu(qty){G.senzu+=qty;shopFb('Got '+qty+' Senzu Beans!');updateUI();}
window.buySenzu=buySenzu;

function sellCrop(cid){
  var qty=G.inv[cid].h;if(!qty){shopFb('Nothing to sell!');return;}
  var earned=qty*CROPS[cid].sell;G.gold+=earned;G.earned+=earned;G.inv[cid].h=0;
  advMission('earn',earned);shopFb('Sold '+qty+' '+CROPS[cid].name+' for '+earned+' Zeni!');
  spark(P.x+16,P.y+20,'#FFD700',10);buildShop();updateUI();
}
window.sellCrop=sellCrop;

// ── TRADE ──
function openTrade(){buildTrade();var m=document.getElementById('trademodal');if(m)m.classList.add('open');}
function closeTrade(){var m=document.getElementById('trademodal');if(m)m.classList.remove('open');}
window.openTrade=openTrade;window.closeTrade=closeTrade;

function buildTrade(){
  var cl=document.getElementById('citylist');if(!cl)return;
  var h='';
  var cks=Object.keys(G.cities);
  for(var i=0;i<cks.length;i++){
    var cid=cks[i],city=G.cities[cid],base=CITIES[cid];
    var unlocked=city.unlocked;
    h+='<div class="city-card '+(unlocked?'open-city':'')+'"><div class="city-name">'+city.icon+' '+city.name+'</div><div class="city-desc">'+city.desc+'</div><div class="city-btns">';
    if(unlocked){
      h+='<button class="cbtn" onclick="nimbusTo(\''+cid+'\')">Fly Nimbus</button>';
      h+='<button class="cbtn green" onclick="tradeTo(\''+cid+'\')">Instant Trade</button>';
      if(!city.expanded)h+='<button class="cbtn purple" onclick="expandTo(\''+cid+'\')">Expand ('+city.cost+' Zeni)</button>';
      else h+='<span style="font-size:8px;color:#39FF14"> EXPANDED +'+city.passive+'/day</span>';
    } else {
      var canUnlock=G.gold>=city.cost&&G.pl>=city.pl;
      h+='<button class="cbtn" onclick="unlockCity(\''+cid+'\')" '+(canUnlock?'':'disabled')+'>Unlock ('+city.cost+' Zeni, PL '+city.pl+')</button>';
    }
    h+='</div></div>';
  }
  cl.innerHTML=h;
  // Inventory
  var inv=document.getElementById('tradeinv');if(!inv)return;inv.innerHTML='';
  var cids=Object.keys(G.inv);
  for(var i=0;i<cids.length;i++){
    var cid2=cids[i];if(G.inv[cid2].h>0){
      var div=document.createElement('div');div.style.cssText='background:rgba(255,255,255,0.06);border:1px solid #444;border-radius:6px;padding:5px 8px;font-size:9px;color:#FFD700;font-weight:bold;';
      div.textContent=CROPS[cid2].name+' x'+G.inv[cid2].h;inv.appendChild(div);
    }
  }
  if(!inv.children.length){var d=document.createElement('div');d.style.cssText='font-size:8px;color:#666;';d.textContent='No harvested crops yet!';inv.appendChild(d);}
}

function tradeFb(msg){var el=document.getElementById('tradefb');if(el){el.textContent=msg;setTimeout(function(){el.textContent='';},3000);}showMsg(msg);}
function unlockCity(cid){
  var city=G.cities[cid],base=CITIES[cid];
  if(G.gold<city.cost||G.pl<city.pl){tradeFb('Need '+city.cost+' Zeni and PL '+city.pl+'!');return;}
  G.gold-=city.cost;city.unlocked=true;tradeFb(city.name+' unlocked!');updateUI();buildTrade();
}
window.unlockCity=unlockCity;
function expandTo(cid){
  var city=G.cities[cid];if(!city.unlocked||city.expanded||G.gold<city.cost){tradeFb('Cannot expand!');return;}
  G.gold-=city.cost;city.expanded=true;tradeFb('Expanded to '+city.name+'! +'+city.passive+' Zeni/day');updateUI();buildTrade();
}
window.expandTo=expandTo;
function nimbusTo(cid){closeTrade();weather.travel={target:cid,prog:0};showMsg('Goku jumps on Nimbus!');}
window.nimbusTo=nimbusTo;
function tradeTo(cid){
  var city=G.cities[cid];if(!city.unlocked){tradeFb('Unlock first!');return;}
  var total=0,items=[];
  var cids=Object.keys(G.inv);
  for(var i=0;i<cids.length;i++){
    var cid2=cids[i];if(G.inv[cid2].h>0){
      var mult=city.mult[cid2]||1;
      var earned=Math.floor(G.inv[cid2].h*CROPS[cid2].sell*mult);
      total+=earned;items.push(CROPS[cid2].name+'x'+G.inv[cid2].h+'@'+mult+'x');G.inv[cid2].h=0;
    }
  }
  if(!total){tradeFb('No crops to trade!');return;}
  G.gold+=total;G.earned+=total;G.traded++;
  advMission('earn',total);advMission('trade');
  tradeFb('Traded: '+items.join(', ')+' = +'+total+' Zeni!');
  spark(P.x+16,P.y+20,'#FFD700',15);updateUI();buildTrade();
}
window.tradeTo=tradeTo;

// ── CHEATS MODAL ──
function openCheat(){updateCheatBtn();var m=document.getElementById('cheatmodal');if(m)m.classList.add('open');}
function closeCheat(){var m=document.getElementById('cheatmodal');if(m)m.classList.remove('open');}
window.openCheat=openCheat;window.closeCheat=closeCheat;

// ── GAME MECHANICS ──
function growCrops(){
  var ks=Object.keys(farmData);
  for(var i=0;i<ks.length;i++){
    var fd=farmData[ks[i]];if(!fd.cid)continue;
    var crop=CROPS[fd.cid];if(!crop)continue;
    if(fd.watered&&fd.stage<3){
      fd.gt++;var needed=Math.max(1,Math.ceil(crop.growDays/2));
      if(fd.gt>=needed){
        fd.stage++;fd.gt=0;var pts=ks[i].split(',');
        var tx=parseInt(pts[0]),ty=parseInt(pts[1]);
        if(fd.stage===1)map[ty][tx]=T.PLANTED;
        else if(fd.stage===2)map[ty][tx]=T.GROWING;
        else map[ty][tx]=T.READY;
      }
      fd.watered=false;
    }
  }
}
function collectPassive(){
  var total=0,cks=Object.keys(G.cities);
  for(var i=0;i<cks.length;i++){var c=G.cities[cks[i]];if(c.expanded&&c.passive)total+=c.passive;}
  if(total>0){G.gold+=total;showMsg('Passive income: +'+total+' Zeni!');}
}
function rollWeather(){
  var total=0;for(var i=0;i<WEATHERS.length;i++)total+=WEATHERS[i].chance;
  var r=Math.random()*total;
  for(var i=0;i<WEATHERS.length;i++){r-=WEATHERS[i].chance;if(r<=0){weather.cur=WEATHERS[i];break;}}
  if(weather.cur.id==='rain'){
    var ks=Object.keys(farmData);for(var i=0;i<ks.length;i++){if(farmData[ks[i]].stage>0&&farmData[ks[i]].stage<3)farmData[ks[i]].watered=true;}
    showMsg('Raining! All crops auto-watered!');
  } else if(weather.cur.id==='windy'){P.fspd=9;showMsg('Windy! Nimbus faster today!');}
  else if(weather.cur.id==='aurora'){G.pl+=500;showMsg('Ki Aurora! +500 Power Level!');}
  else showMsg(weather.cur.name+' today!');
  weather.drops=[];
  for(var i=0;i<100;i++)weather.drops.push({x:Math.random()*window.innerWidth,y:Math.random()*window.innerHeight,spd:6+Math.random()*4,len:10+Math.random()*8});
}
function nextDay(){
  growCrops();collectPassive();G.day++;G.hour=6;G.min=0;G.ki=Math.min(G.maxKi,G.ki+40);
  P.fspd=G.ssj2?8:5;genMissions();rollWeather();spark(P.x+16,P.y+20,'#FFD700',18);updateUI();
}
window.nextDay=nextDay;
function checkSSJ(){
  if(G.pl>=15000&&!G.ssj){G.ssj=true;G.maxKi=150;G.ki=150;showMsg('SUPER SAIYAN! Golden hair! Max Ki 150!');updateUI();}
  if(G.pl>=25000&&!G.ssj2){G.ssj2=true;G.maxKi=200;G.ki=200;P.fspd=8;showMsg('SUPER SAIYAN 2! Lightning crackles!');updateUI();}
}

// ── FARM BOT ──
function toggleBot(){
  G.bot.on=!G.bot.on;G.bot.phase='till';G.bot.timer=0;
  if(G.bot.on)showMsg('Farm Bot ON! Elder Torr is farming for you!');
  else showMsg('Farm Bot stopped.');
}
window.toggleBot=toggleBot;

function runBot(){
  var bot=G.bot;if(!bot.on)return;
  bot.timer++;if(bot.timer<bot.rate)return;bot.timer=0;
  if(G.godMode){var cids=Object.keys(G.inv);for(var i=0;i<cids.length;i++)G.inv[cids[i]].s=Math.max(G.inv[cids[i]].s,30);}
  var bestCrop='carrot',bestCount=0;
  var cids2=Object.keys(G.inv);for(var i=0;i<cids2.length;i++){if(G.inv[cids2[i]].s>bestCount){bestCount=G.inv[cids2[i]].s;bestCrop=cids2[i];}}
  if(bot.phase==='till'){
    for(var y=6;y<16;y++){for(var x=4;x<16;x++){if(map[y][x]===T.DIRT||map[y][x]===T.GRASS){map[y][x]=T.TILLED;farmData[x+','+y]={stage:0,watered:false,gt:0,cid:null};bot.tilled++;bot.phase='seed';advMission('till');updateUI();return;}}}
    bot.phase='seed';
  } else if(bot.phase==='seed'){
    var inv=G.inv[bestCrop];
    for(var y=6;y<16;y++){for(var x=4;x<16;x++){if(map[y][x]===T.TILLED&&inv&&inv.s>0){map[y][x]=T.PLANTED;farmData[x+','+y]={stage:1,watered:false,gt:0,cid:bestCrop};inv.s--;bot.planted++;advMission('plant');updateUI();renderSeeds();return;}}}
    bot.phase='water';
  } else if(bot.phase==='water'){
    for(var y=6;y<16;y++){for(var x=4;x<16;x++){var k=x+','+y;if((map[y][x]===T.PLANTED||map[y][x]===T.GROWING)&&farmData[k]&&!farmData[k].watered){farmData[k].watered=true;bot.watered++;spark(x*TILE+TILE/2,y*TILE+TILE/2,'#00BFFF',3);advMission('water');return;}}}
    bot.phase='harvest';
  } else if(bot.phase==='harvest'){
    for(var y=6;y<16;y++){for(var x=4;x<16;x++){if(map[y][x]===T.READY){
      var k=x+','+y,fd=farmData[k],fid=fd?fd.cid||'carrot':'carrot',fc=CROPS[fid];
      var earned=Math.floor(fc.sell*0.8+Math.random()*fc.sell*0.4);
      if(fc.sp==='regrow'){map[y][x]=T.PLANTED;farmData[k]={stage:1,watered:false,gt:0,cid:fid};}
      else{map[y][x]=T.TILLED;farmData[k]={stage:0,watered:false,gt:0,cid:null};}
      G.inv[fid].h++;G.gold+=earned;G.earned+=earned;G.pl+=fc.pb;
      bot.harvested++;handleSpecial(fc,x,y);advMission('harvest');advMission('earn',earned);
      spark(x*TILE+TILE/2,y*TILE+TILE/2,'#FFD700',5);checkSSJ();updateUI();return;
    }}}
    // Nothing ready - re-water or re-till
    var needWater=false,needTill=false;
    for(var y=6;y<16;y++){for(var x=4;x<16;x++){var k=x+','+y;if((map[y][x]===T.PLANTED||map[y][x]===T.GROWING)&&farmData[k]&&!farmData[k].watered)needWater=true;if(map[y][x]===T.DIRT)needTill=true;}}
    if(needWater)bot.phase='water';else if(needTill)bot.phase='till';else bot.phase='seed';
  }
}

// ── UI ──
var msgTimer;
function showMsg(text){
  var el=document.getElementById('msgbox');if(!el)return;
  el.textContent=text;el.style.display='block';
  clearTimeout(msgTimer);msgTimer=setTimeout(function(){el.style.display='none';},3200);
}
var toastTimer;
function showToast(text){
  var el=document.getElementById('toast');if(!el)return;
  el.textContent=text;el.style.display='block';
  clearTimeout(toastTimer);toastTimer=setTimeout(function(){el.style.display='none';},3000);
}

function renderSeeds(){
  var el=document.getElementById('seedopts');if(!el)return;
  var h='';var cids=Object.keys(CROPS);
  for(var i=0;i<cids.length;i++){
    var cid=cids[i],c=CROPS[cid];
    h+='<div class="sopt'+(G.crop===cid?' active':'')+'" onclick="G.crop=\''+cid+'\';renderSeeds();showMsg(\''+c.name+' selected!\');" title="'+c.name+' ('+i+1+')">'+(i+1)+'<span class="sc">'+G.inv[cid].s+'</span></div>';
  }
  el.innerHTML=h;
}

function updateUI(){
  function set(id,v){var e=document.getElementById(id);if(e)e.textContent=v;}
  set('day',G.day);set('gold',G.gold);set('pl',G.pl);set('kival',G.ki+'/'+G.maxKi);set('time',G.hour+':'+(G.min<10?'0':'')+G.min+' '+(G.hour<12?'AM':'PM'));set('senzu-count',G.senzu);
  var kb=document.getElementById('kibar');if(kb)kb.style.width=(G.ki/G.maxKi*100)+'%';
  var sagas=[[0,'Saiyan Saga'],[10000,'Namek Saga'],[20000,'Cell Saga'],[30000,'Buu Saga'],[50000,'Tournament of Power']];
  var saga='Saiyan Saga';for(var i=0;i<sagas.length;i++){if(G.pl>=sagas[i][0])saga=sagas[i][1];}
  set('saga',saga);
  renderSeeds();renderMissions();
}

// ── MOVEMENT ──
function moveP(){
  var dx=0,dy=0,spd=G.fly?P.fspd:P.spd;
  if(keys['arrowleft']||keys['a']){dx=-spd;P.dir='left';}
  if(keys['arrowright']||keys['d']){dx=spd;P.dir='right';}
  if(keys['arrowup']||keys['w']){dy=-spd;P.dir='up';}
  if(keys['arrowdown']){dy=spd;P.dir='down';}
  if(dx!==0&&dy!==0){dx*=0.707;dy*=0.707;}
  P.vx=dx;P.vy=dy;
  var nx=P.x+dx;
  var tL=Math.floor(nx/TILE),tR=Math.floor((nx+P.w-2)/TILE);
  var tT=Math.floor((P.y+P.h/2)/TILE),tB=Math.floor((P.y+P.h-2)/TILE);
  if(!solid(tL,tT)&&!solid(tL,tB)&&!solid(tR,tT)&&!solid(tR,tB))P.x=Math.max(0,Math.min(MW*TILE-P.w,nx));
  var ny=P.y+dy;
  var tLy=Math.floor(P.x/TILE),tRy=Math.floor((P.x+P.w-2)/TILE);
  var tTy=Math.floor((ny+P.h/2)/TILE),tBy=Math.floor((ny+P.h-2)/TILE);
  if(!solid(tLy,tTy)&&!solid(tLy,tBy)&&!solid(tRy,tTy)&&!solid(tRy,tBy))P.y=Math.max(0,Math.min(MH*TILE-P.h,ny));
  if((dx!==0||dy!==0)&&G.tool!=='nimbus'&&G.tool!=='talk'&&G.tool!=='trade'){
    var now=Math.floor(Date.now()/350);if(now!==P.ltu){P.ltu=now;useTool();}
  }
}

function updateNPCs(){
  for(var i=0;i<NPCS.length;i++){
    var npc=NPCS[i];npc.wt++;
    if(npc.wt>200){npc.wt=0;var dirs=[[0.3,0],[-0.3,0],[0,0.3],[0,-0.3],[0,0],[0,0],[0,0]];var d=dirs[Math.floor(Math.random()*dirs.length)];npc.vx=d[0];npc.vy=d[1];}
    var nx=npc.x+npc.vx,ny=npc.y+npc.vy;
    var inBounds=nx>=npc.bx1&&nx<=npc.bx2&&ny>=npc.by1&&ny<=npc.by2;
    var tx=Math.floor(nx/TILE),ty=Math.floor(ny/TILE);
    var blocked=npcSolid(tx,ty)||npcSolid(tx+1,ty)||npcSolid(tx,ty+1);
    if(inBounds&&!blocked){npc.x=nx;npc.y=ny;}else{npc.vx=0;npc.vy=0;npc.wt=180;}
  }
}

// ── TIME ──
var lastTick=Date.now();
function updateTime(){
  var now=Date.now();if(now-lastTick>2000){lastTick=now;G.min+=10;
    if(G.min>=60){G.min=0;G.hour++;}
    if(G.hour>=22)showMsg('Getting late! Press Space to sleep.');
    if(G.ki<G.maxKi)G.ki=Math.min(G.maxKi,G.ki+2);updateUI();
  }
}

// ── TOUCH JOYSTICK ──
var touch={on:false,id:null,sx:0,sy:0,dx:0,dy:0,max:44};
function initTouch(){
  var isTouchDevice=('ontouchstart' in window)||navigator.maxTouchPoints>0;
  var tui=document.getElementById('touchui');if(tui&&isTouchDevice)tui.style.display='-webkit-flex';
  if(tui&&isTouchDevice)tui.style.display='flex';
  var base=document.getElementById('jbase');var knob=document.getElementById('jknob');
  if(!base||!knob)return;
  function jStart(e){e.preventDefault();var t=e.changedTouches?e.changedTouches[0]:e;touch.on=true;touch.id=t.identifier;touch.sx=t.clientX;touch.sy=t.clientY;}
  function jMove(e){e.preventDefault();if(!touch.on)return;var t=null;if(e.changedTouches){for(var i=0;i<e.changedTouches.length;i++){if(e.changedTouches[i].identifier===touch.id){t=e.changedTouches[i];break;}}}else t=e;if(!t)return;
    var rdx=t.clientX-touch.sx,rdy=t.clientY-touch.sy,dist=Math.sqrt(rdx*rdx+rdy*rdy),ang=Math.atan2(rdy,rdx),cl=Math.min(dist,touch.max);
    touch.dx=Math.cos(ang)*(cl/touch.max);touch.dy=Math.sin(ang)*(cl/touch.max);
    knob.style.webkitTransform='translate('+Math.cos(ang)*cl+'px,'+Math.sin(ang)*cl+'px)';
    knob.style.transform='translate('+Math.cos(ang)*cl+'px,'+Math.sin(ang)*cl+'px)';}
  function jEnd(){touch.on=false;touch.dx=0;touch.dy=0;knob.style.webkitTransform='translate(0,0)';knob.style.transform='translate(0,0)';}
  base.addEventListener('touchstart',jStart,false);base.addEventListener('touchmove',jMove,false);
  base.addEventListener('touchend',jEnd,false);base.addEventListener('touchcancel',jEnd,false);
  base.addEventListener('mousedown',jStart);window.addEventListener('mousemove',function(e){if(touch.on)jMove(e);});window.addEventListener('mouseup',jEnd);
}

// ── GAME LOOP ──
function gameLoop(){
  var t=Date.now();
  ctx.clearRect(0,0,canvas.width,canvas.height);
  drawSky(t);updateCam();drawMap(t);
  for(var i=0;i<NPCS.length;i++)drawNPC(NPCS[i],t);
  drawPlayer(t);
  // Particles
  for(var i=parts.length-1;i>=0;i--){
    var p=parts[i];
    ctx.save();ctx.globalAlpha=p.life;ctx.fillStyle=p.col;ctx.beginPath();ctx.arc(p.x-cam.x,p.y-cam.y,p.sz/2,0,Math.PI*2);ctx.fill();ctx.restore();
    p.x+=p.vx;p.y+=p.vy;p.vy+=0.06;p.life-=p.dec;if(p.life<=0)parts.splice(i,1);
  }
  // Touch movement
  if(touch.on&&(Math.abs(touch.dx)>0.1||Math.abs(touch.dy)>0.1)){
    var spd=G.fly?P.fspd:P.spd;var dx2=touch.dx*spd,dy2=touch.dy*spd;
    P.vx=dx2;P.vy=dy2;
    if(Math.abs(dx2)>Math.abs(dy2)){P.dir=dx2>0?'right':'left';}else{P.dir=dy2>0?'down':'up';}
    P.at++;if(P.at>8){P.at=0;P.af=(P.af+1)%4;}
    var nx=P.x+dx2;var tL=Math.floor(nx/TILE),tR=Math.floor((nx+P.w-2)/TILE);
    var tT=Math.floor((P.y+P.h/2)/TILE),tB=Math.floor((P.y+P.h-2)/TILE);
    if(!solid(tL,tT)&&!solid(tL,tB)&&!solid(tR,tT)&&!solid(tR,tB))P.x=Math.max(0,Math.min(MW*TILE-P.w,nx));
    var ny=P.y+dy2;var tLy=Math.floor(P.x/TILE),tRy=Math.floor((P.x+P.w-2)/TILE);
    var tTy=Math.floor((ny+P.h/2)/TILE),tBy=Math.floor((ny+P.h-2)/TILE);
    if(!solid(tLy,tTy)&&!solid(tLy,tBy)&&!solid(tRy,tTy)&&!solid(tRy,tBy))P.y=Math.max(0,Math.min(MH*TILE-P.h,ny));
    if(G.tool!=='nimbus'&&G.tool!=='talk'&&G.tool!=='trade'){var now2=Math.floor(Date.now()/400);if(now2!==P.ltu){P.ltu=now2;useTool();}}
  } else moveP();
  runBot();updateNPCs();updateTime();
  requestAnimationFrame(gameLoop);
}

// ── INIT ──
try {
  initMap();genMissions();rollWeather();updateUI();initTouch();
  showMsg('WASD=Move S=Seed G=Water T=Till H=Harvest F=Nimbus E=Talk Space=Sleep Tap Cheats for God Mode!');
  gameLoop();
} catch(err) {
  document.body.style.background='#111';document.body.style.color='#ff4444';document.body.style.padding='20px';document.body.style.fontFamily='Arial';
  document.body.innerHTML='<h2 style="color:#ff4444">Error - screenshot this:</h2><pre style="font-size:12px;white-space:pre-wrap">'+err.message+'\n'+err.stack+'</pre>';
}

})(); // end IIFE
