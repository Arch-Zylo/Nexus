/* Dragon theme background for Nexus. Controlled by applyTheme() via window.DragonBG.start()/stop(). */
(function(){
var c=document.getElementById('dragonBg');if(!c)return;
var ctx=c.getContext('2d'),s=document.createElement('canvas'),sx=s.getContext('2d');
var rm=matchMedia('(prefers-reduced-motion: reduce)'),W,H,C={},scales=[],waves=[],embers=[],R,raf,last=0,T=0,nextWave=0;
function rnd(n){return Math.random()*n}
function css(n,d){return getComputedStyle(document.documentElement).getPropertyValue(n).trim()||d}
function rgb(h){h=h.replace('#','');if(h.length==3)h=h.replace(/./g,'$&$&');var n=parseInt(h,16);return[n>>16&255,n>>8&255,n&255]}
function mix(a,b,t){return'rgb('+Math.round(a[0]+(b[0]-a[0])*t)+','+Math.round(a[1]+(b[1]-a[1])*t)+','+Math.round(a[2]+(b[2]-a[2])*t)+')'}

function build(){
  var d=Math.min(devicePixelRatio||1,1.5);
  W=innerWidth;H=innerHeight;
  [c,s].forEach(function(e){e.width=W*d;e.height=H*d});
  ctx.setTransform(d,0,0,d,0,0);sx.setTransform(d,0,0,d,0,0);
  C={n:css('--db-night','#0a0607'),s:css('--db-scale','#7a1a14'),f:css('--db-fire','#ff8a2a'),e:css('--db-ember','#ffd36b')};
  C.sr=rgb(C.s);C.fr=rgb(C.f);C.er=rgb(C.e);
  R=Math.max(16,Math.min(26,W/42));           /* scale radius */
  var g=sx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,C.n);g.addColorStop(.6,'#150a0b');g.addColorStop(1,'#2a0e0a');
  sx.fillStyle=g;sx.fillRect(0,0,W,H);
  /* overlapping scale rows, top to bottom */
  scales=[];
  var rows=Math.ceil(H/(R*.9))+2,cols=Math.ceil(W/(R*2))+2;
  for(var r=0;r<rows;r++){
    for(var k=0;k<cols;k++){
      var x=k*R*2+(r%2?R:0)-R,y=r*R*.9,depth=y/H,sh=.55+rnd(.45);
      var gg=sx.createLinearGradient(x,y-R*.2,x,y+R);
      gg.addColorStop(0,'rgba('+Math.round(C.sr[0]*.28*sh)+','+Math.round(C.sr[1]*.28*sh)+','+Math.round(C.sr[2]*.28*sh)+',1)');
      gg.addColorStop(1,'rgba('+Math.round(C.sr[0]*(.45+depth*.5)*sh)+','+Math.round(C.sr[1]*(.45+depth*.5)*sh)+','+Math.round(C.sr[2]*(.45+depth*.5)*sh)+',1)');
      sx.fillStyle=gg;sx.beginPath();sx.arc(x,y,R,0,Math.PI);sx.closePath();sx.fill();
      sx.strokeStyle='rgba(0,0,0,.55)';sx.lineWidth=1.5;sx.beginPath();sx.arc(x,y,R,0,Math.PI);sx.stroke();
      sx.strokeStyle='rgba('+C.fr[0]+','+C.fr[1]+','+C.fr[2]+','+(.05+depth*.1)+')';sx.lineWidth=1;
      sx.beginPath();sx.arc(x,y,R-2,.15,Math.PI-.15);sx.stroke();
      scales.push({x:x,y:y});
    }
  }
  /* heat glow from the bottom and a dark vignette so content stays readable */
  var hg=sx.createRadialGradient(W/2,H*1.15,0,W/2,H*1.15,H*.9);
  hg.addColorStop(0,'rgba('+C.fr[0]+','+C.fr[1]+','+C.fr[2]+',.28)');hg.addColorStop(1,'rgba('+C.fr[0]+','+C.fr[1]+','+C.fr[2]+',0)');
  sx.fillStyle=hg;sx.fillRect(0,0,W,H);
  var vg=sx.createRadialGradient(W/2,H/2,Math.min(W,H)*.2,W/2,H/2,Math.max(W,H)*.75);
  vg.addColorStop(0,'rgba(0,0,0,.35)');vg.addColorStop(1,'rgba(0,0,0,.55)');
  sx.fillStyle=vg;sx.fillRect(0,0,W,H);
  /* embers */
  embers=[];var ne=Math.min(90,Math.round(W*H/16000));
  for(var i=0;i<ne;i++){var e={};respawn(e,true);embers.push(e)}
  waves=[];nextWave=0;
}
function respawn(e,init){
  e.x=rnd(W);e.y=init?rnd(H):H+10;e.v=18+rnd(40);e.r=.8+rnd(2);e.ph=rnd(6.28);e.sw=10+rnd(25);e.f=1+rnd(3);e.x0=e.x;
}
function spawnWave(){
  waves.push({x:rnd(W),y:H*(.35+rnd(.65)),r:0,v:170+rnd(110),w:70+rnd(50)});
}
function draw(dt){
  T+=dt;nextWave-=dt;
  if(nextWave<=0){spawnWave();nextWave=2.2+rnd(2.4)}
  ctx.clearRect(0,0,W,H);ctx.drawImage(s,0,0,W,H);
  var maxR=Math.hypot(W,H);
  for(var i=waves.length-1;i>=0;i--){waves[i].r+=waves[i].v*dt;if(waves[i].r>maxR)waves.splice(i,1)}
  /* fire rolling through the scales */
  ctx.lineWidth=2;
  for(var k=0;k<scales.length;k++){
    var sc=scales[k],I=0;
    for(var j=0;j<waves.length;j++){
      var w=waves[j],dd=(Math.hypot(sc.x-w.x,sc.y+R*.5-w.y)-w.r)/w.w;
      if(dd>-2&&dd<2)I+=Math.exp(-dd*dd*2.2)*(1-w.r/maxR);
    }
    if(I>.04){
      I=Math.min(1,I);
      ctx.globalAlpha=Math.min(1,I*1.1);
      ctx.strokeStyle=mix(C.fr,C.er,Math.max(0,I-.45)*1.8);
      ctx.beginPath();ctx.arc(sc.x,sc.y,R-1,.1,Math.PI-.1);ctx.stroke();
      if(I>.35){ctx.globalAlpha=(I-.35)*.28;ctx.fillStyle=mix(C.sr,C.fr,I);ctx.beginPath();ctx.arc(sc.x,sc.y,R-1,0,Math.PI);ctx.fill()}
    }
  }
  /* rising embers */
  ctx.globalCompositeOperation='lighter';
  for(var m=0;m<embers.length;m++){
    var e=embers[m];e.y-=e.v*dt;e.x=e.x0+Math.sin(T*.8+e.ph)*e.sw;
    if(e.y<-10){respawn(e,false);continue}
    var life=e.y/H,fl=.6+.4*Math.sin(T*e.f*5+e.ph);
    ctx.globalAlpha=Math.min(1,life*1.3)*fl*.9;
    ctx.fillStyle=mix(C.fr,C.er,1-life);
    ctx.beginPath();ctx.arc(e.x,e.y,e.r,0,7);ctx.fill();
    ctx.globalAlpha*=.25;ctx.beginPath();ctx.arc(e.x,e.y,e.r*3.5,0,7);ctx.fill();
  }
  ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
}
function frame(t){var dt=Math.min((t-last)/1000,.05);last=t;draw(dt);raf=requestAnimationFrame(frame)}
function start(){
  cancelAnimationFrame(raf);build();
  if(rm.matches){ctx.clearRect(0,0,W,H);ctx.drawImage(s,0,0,W,H)}
  else{last=performance.now();raf=requestAnimationFrame(frame)}
}
var on=false,rt;
addEventListener('resize',function(){if(on){clearTimeout(rt);rt=setTimeout(start,200)}});
rm.addEventListener&&rm.addEventListener('change',function(){if(on)start()});
document.addEventListener('visibilitychange',function(){if(on&&!document.hidden&&!rm.matches){cancelAnimationFrame(raf);last=performance.now();raf=requestAnimationFrame(frame)}});
window.DragonBG={
  start:function(){on=true;setTimeout(start,30)},
  stop:function(){on=false;cancelAnimationFrame(raf)}
};
})();
