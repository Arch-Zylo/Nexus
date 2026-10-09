/* Starry Night theme background for Nexus. Controlled by applyTheme() via window.StarryBG.start()/stop(). */
(function(){
var c=document.getElementById('starryBg');if(!c)return;
var ctx=c.getContext('2d'),
    B=document.createElement('canvas'),bx=B.getContext('2d'),   /* back: sky */
    F=document.createElement('canvas'),fx=F.getContext('2d');   /* front: hills, village, cypress */
var rm=matchMedia('(prefers-reduced-motion: reduce)'),
    W,H,S,HZ,C={},V=[],stars=[],moon,parts=[],raf,last=0,T=0;
var PAL=['#102a63','#1b438f','#2a63b4','#4f8fd0','#8fbbe0','#e6e7a6'];
var STARS=[[.12,.20,1],[.27,.12,.8],[.40,.31,.9],[.50,.10,1.1],[.61,.22,.85],[.73,.12,.9],[.80,.33,1],[.33,.47,.7],[.66,.48,.75],[.20,.39,.7]];

function rnd(n){return Math.random()*n}
function css(n,d){return getComputedStyle(document.documentElement).getPropertyValue(n).trim()||d}
function hx(h,a){h=h.replace('#','');if(h.length==3)h=h.replace(/./g,'$&$&');var n=parseInt(h,16);return'rgba('+(n>>16&255)+','+(n>>8&255)+','+(n&255)+','+a+')'}

/* Direction of the paint flow at (x,y): two big vortices + a rolling wave. */
function flow(x,y,t){
  var vx=.55,vy=Math.sin(x/(S*.09)+t*.4)*.35;
  for(var i=0;i<V.length;i++){
    var v=V[i],dx=x-v.x,dy=y-v.y,r2=dx*dx+dy*dy,r=Math.sqrt(r2)+1e-3,
        f=Math.exp(-r2/(v.r*v.r*2.5))*v.s*2.2;
    vx+=-dy/r*f-dx/r*f*.12;
    vy+=dx/r*f-dy/r*f*.12;
  }
  var m=Math.hypot(vx,vy)||1;return[vx/m,vy/m];
}

function build(){
  var d=Math.min(devicePixelRatio||1,1.5);
  W=innerWidth;H=innerHeight;S=Math.min(W,H*1.4);HZ=H*.8;
  [c,B,F].forEach(function(e){e.width=W*d;e.height=H*d});
  ctx.setTransform(d,0,0,d,0,0);bx.setTransform(d,0,0,d,0,0);fx.setTransform(d,0,0,d,0,0);
  C={deep:css('--sb-deep','#0b1a3d'),mid:css('--sb-mid','#1d3f86'),low:css('--sb-low','#4f86c6'),
     star:css('--sb-star','#f6e27a'),moon:css('--sb-moon','#f2b84b'),hill:css('--sb-hill','#1a2f66'),
     village:css('--sb-village','#0a1127'),veil:parseFloat(css('--sb-veil','.18'))};
  V=[{x:.52*W,y:.34*H,r:.22*S,s:1},{x:.71*W,y:.41*H,r:.14*S,s:-1}];

  /* ---------- back layer: sky ---------- */
  var g=bx.createLinearGradient(0,0,0,HZ);
  g.addColorStop(0,C.deep);g.addColorStop(.6,C.mid);g.addColorStop(1,C.low);
  bx.fillStyle=g;bx.fillRect(0,0,W,H);
  bx.lineCap='round';bx.lineJoin='round';
  var n=Math.round(W*HZ/170);
  for(var i=0;i<n;i++){
    var x=rnd(W),y=rnd(HZ),pts=[[x,y]],steps=7+Math.floor(rnd(6)),st=5+rnd(4);
    for(var k=0;k<steps;k++){var f=flow(x,y,0);x+=f[0]*st;y+=f[1]*st;pts.push([x,y])}
    var ci=Math.floor(y/HZ*3+rnd(3));ci=Math.max(0,Math.min(4,ci));
    if(Math.random()<.04)ci=5;
    bx.globalAlpha=.1+rnd(.2);bx.strokeStyle=PAL[ci];bx.lineWidth=3+rnd(4);
    bx.beginPath();pts.forEach(function(q,j){j?bx.lineTo(q[0],q[1]):bx.moveTo(q[0],q[1])});bx.stroke();
  }
  bx.globalAlpha=1;
  /* crescent moon */
  var mx=.88*W,my=.15*H,mr=Math.max(14,S*.03);
  moon={x:mx,y:my,R:mr,ph:rnd(6)};
  bx.save();bx.beginPath();bx.arc(mx,my,mr,0,7);bx.clip();
  bx.fillStyle=C.moon;bx.beginPath();
  bx.rect(mx-mr*2,my-mr*2,mr*4,mr*4);
  bx.moveTo(mx-mr*.45+mr*.88,my-mr*.2);bx.arc(mx-mr*.45,my-mr*.2,mr*.88,0,7);
  bx.fill('evenodd');bx.restore();
  /* sky veil keeps overlaid text readable */
  bx.fillStyle='rgba(0,0,0,'+C.veil+')';bx.fillRect(0,0,W,H);

  /* ---------- front layer: hills, village, cypress ---------- */
  fx.clearRect(0,0,W,H);fx.lineCap='round';fx.lineJoin='round';
  function farY(x){return HZ+Math.sin(x/S*3.2+1)*H*.03+Math.sin(x/S*7.1)*H*.012}
  function nearY(x){return H*.91+Math.sin(x/S*2.2+.4)*H*.014}
  [[farY,C.hill,'#0c1a3d',.32],[nearY,C.village,C.village,.0]].forEach(function(L,li){
    var fy=L[0],gg=fx.createLinearGradient(0,HZ-H*.05,0,H);
    gg.addColorStop(0,L[1]);gg.addColorStop(1,L[2]);
    fx.fillStyle=gg;fx.beginPath();fx.moveTo(0,H);
    for(var x=0;x<=W+8;x+=8)fx.lineTo(x,fy(x));
    fx.lineTo(W,H);fx.closePath();fx.fill();
    if(li===0){ /* brush texture on the far hills */
      for(var q=0;q<W*H*.12/170;q++){
        var sx0=rnd(W),sy0=fy(sx0)+rnd(H-fy(sx0));
        fx.globalAlpha=.12+rnd(.2);fx.strokeStyle=Math.random()<.5?'#2c4a8f':'#0b1838';fx.lineWidth=3+rnd(3);
        fx.beginPath();fx.moveTo(sx0,sy0);fx.quadraticCurveTo(sx0+14,sy0-4-rnd(5),sx0+30,sy0);fx.stroke();
      }
      fx.globalAlpha=1;
    }
  });
  /* village with a lit church spire */
  var vx0=.4*W,vx1=.92*W,hx0=vx0;
  while(hx0<vx1){
    var hw=Math.max(8,S*(.016+rnd(.014))),hh=Math.max(7,S*(.012+rnd(.012))),by=nearY(hx0)+2;
    fx.fillStyle=C.village;fx.fillRect(hx0,by-hh,hw,hh+4);
    fx.beginPath();fx.moveTo(hx0-2,by-hh);fx.lineTo(hx0+hw/2,by-hh-hw*.45);fx.lineTo(hx0+hw+2,by-hh);fx.fill();
    if(Math.random()<.75){fx.fillStyle='#f5d76e';fx.globalAlpha=.9;fx.fillRect(hx0+hw*.25,by-hh*.65,Math.max(2,hw*.2),Math.max(3,hh*.35));
      if(Math.random()<.5)fx.fillRect(hx0+hw*.6,by-hh*.65,Math.max(2,hw*.2),Math.max(3,hh*.35));fx.globalAlpha=1}
    hx0+=hw+4+rnd(10);
  }
  var cx0=.65*W,cw=Math.max(9,S*.018),cb=nearY(cx0)+2,ch=Math.max(40,S*.07);
  fx.fillStyle=C.village;fx.fillRect(cx0-cw/2,cb-ch*.55,cw,ch*.55+4);
  fx.beginPath();fx.moveTo(cx0-cw/2-1,cb-ch*.55);fx.lineTo(cx0,cb-ch*1.25);fx.lineTo(cx0+cw/2+1,cb-ch*.55);fx.fill();
  /* cypress flame */
  var cyx=.16*W,wmax=Math.max(26,S*.05),top=H*.2;
  function cyp(t){return[cyx+Math.sin(t*4.5+.5)*wmax*.5*t,
    wmax*Math.pow(1-t,.65)*(1+.18*Math.sin(t*22)),H+10-t*(H+10-top)]}
  fx.beginPath();
  for(var a=0;a<=60;a++){var p=cyp(a/60);a?fx.lineTo(p[0]-p[1],p[2]):fx.moveTo(p[0]-p[1],p[2])}
  for(var b=60;b>=0;b--){var p2=cyp(b/60);fx.lineTo(p2[0]+p2[1],p2[2])}
  fx.closePath();fx.fillStyle='#0d1f1a';fx.fill();
  fx.save();fx.clip();
  var GC=['#0a1614','#16301f','#1f4a33','#2d5a3d','#0c2a24'];
  for(var s=0;s<110;s++){
    var t0=rnd(.85),u=rnd(2)-1,len=.1+rnd(.2);
    fx.globalAlpha=.45;fx.strokeStyle=GC[Math.floor(rnd(5))];fx.lineWidth=3+rnd(3);
    fx.beginPath();
    for(var m=0;m<=8;m++){var tt=Math.min(1,t0+len*m/8),pp=cyp(tt);
      var xx=pp[0]+u*pp[1]*.9+Math.sin(tt*30+s)*2;m?fx.lineTo(xx,pp[2]):fx.moveTo(xx,pp[2])}
    fx.stroke();
  }
  fx.restore();fx.globalAlpha=1;

  /* ---------- live objects: stars and brush-stroke particles ---------- */
  stars=STARS.map(function(s){return{x:s[0]*W,y:s[1]*H,R:Math.max(3,S*.0065*s[2]),sp:.6+rnd(.8),ph:rnd(6.28)}});
  parts=[];
  var np=Math.min(W<700?200:420,Math.round(W*HZ/2800));
  for(var j=0;j<np;j++){var pt={};reset(pt);pt.a=rnd(pt.l);parts.push(pt)}
}

function reset(p){
  p.x=rnd(W);p.y=rnd(HZ*.95);p.a=0;p.l=3+rnd(6);p.v=25+rnd(45);
  p.w=2.5+rnd(3.5);p.o=.35+rnd(.4);p.n=7;p.t=[p.x,p.y];
  p.c=Math.random()<.08?PAL[5]:PAL[2+Math.floor(rnd(3.99))];
}

function draw(dt){
  T+=dt;
  ctx.clearRect(0,0,W,H);ctx.drawImage(B,0,0,W,H);
  ctx.lineCap='round';ctx.lineJoin='round';
  /* brush strokes drifting along the swirl */
  for(var i=0;i<parts.length;i++){
    var p=parts[i],f=flow(p.x,p.y,T);
    p.x+=f[0]*p.v*dt;p.y+=f[1]*p.v*dt;p.a+=dt;
    var L=p.t.length;
    if(Math.hypot(p.x-p.t[L-2],p.y-p.t[L-1])>5){p.t.push(p.x,p.y);if(p.t.length>p.n*2)p.t.splice(0,2)}
    if(p.a>p.l||p.x<-20||p.x>W+20||p.y<-20||p.y>HZ){reset(p);continue}
    ctx.globalAlpha=Math.sin(Math.PI*Math.min(1,p.a/p.l))*p.o;
    ctx.strokeStyle=p.c;ctx.lineWidth=p.w;ctx.beginPath();
    for(var k=0;k<p.t.length;k+=2)k?ctx.lineTo(p.t[k],p.t[k+1]):ctx.moveTo(p.t[0],p.t[1]);
    ctx.lineTo(p.x,p.y);ctx.stroke();
  }
  /* pulsing stars with concentric halos */
  stars.forEach(function(s){
    var k=.5+.5*Math.sin(T*s.sp+s.ph),R=s.R,gr=ctx.createRadialGradient(s.x,s.y,0,s.x,s.y,R*4.5);
    gr.addColorStop(0,hx(C.star,.5*(.6+.4*k)));gr.addColorStop(1,hx(C.star,0));
    ctx.globalAlpha=1;ctx.fillStyle=gr;ctx.beginPath();ctx.arc(s.x,s.y,R*4.5,0,7);ctx.fill();
    for(var r=0;r<4;r++){
      ctx.globalAlpha=(.5-r*.1)*(.5+.5*k);ctx.strokeStyle=r%2?'#cfe3f5':C.star;ctx.lineWidth=1.5+(3-r)*.4;
      ctx.beginPath();ctx.arc(s.x,s.y,R*(1.6+r*.9+.12*k),0,7);ctx.stroke();
    }
    ctx.globalAlpha=1;ctx.fillStyle=C.star;ctx.beginPath();ctx.arc(s.x,s.y,R,0,7);ctx.fill();
    ctx.fillStyle='#fffbe0';ctx.beginPath();ctx.arc(s.x,s.y,R*.5,0,7);ctx.fill();
  });
  /* moon glow */
  var mk=.5+.5*Math.sin(T*.5+moon.ph),mg=ctx.createRadialGradient(moon.x,moon.y,moon.R*.8,moon.x,moon.y,moon.R*3.2);
  mg.addColorStop(0,hx(C.moon,.35*(.7+.3*mk)));mg.addColorStop(1,hx(C.moon,0));
  ctx.globalAlpha=1;ctx.fillStyle=mg;ctx.beginPath();ctx.arc(moon.x,moon.y,moon.R*3.2,0,7);ctx.fill();
  for(var q=0;q<3;q++){
    ctx.globalAlpha=(.4-q*.1)*(.5+.5*mk);ctx.strokeStyle=C.moon;ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(moon.x,moon.y,moon.R*(1.4+q*.5+.1*mk),0,7);ctx.stroke();
  }
  ctx.globalAlpha=1;
  ctx.drawImage(F,0,0,W,H);
}

function frame(t){var dt=Math.min((t-last)/1000,.05);last=t;draw(dt);raf=requestAnimationFrame(frame)}
function start(){
  cancelAnimationFrame(raf);build();
  if(rm.matches){for(var i=0;i<40;i++)draw(.05);T=0}
  else{last=performance.now();raf=requestAnimationFrame(frame)}
}
var on=false,rt;
addEventListener('resize',function(){if(on){clearTimeout(rt);rt=setTimeout(start,200)}});
rm.addEventListener&&rm.addEventListener('change',function(){if(on)start()});
document.addEventListener('visibilitychange',function(){if(on&&!document.hidden&&!rm.matches){cancelAnimationFrame(raf);last=performance.now();raf=requestAnimationFrame(frame)}});
window.StarryBG={
  start:function(){on=true;setTimeout(start,30)},
  stop:function(){on=false;cancelAnimationFrame(raf)}
};
})();
