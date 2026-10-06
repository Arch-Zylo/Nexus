/* Circuit theme background for Nexus. Controlled by applyTheme() via window.CircuitBG.start()/stop(). */
(function(){
var c=document.getElementById('circuitBg');if(!c)return;var ctx=c.getContext('2d'),s=document.createElement('canvas'),sx=s.getContext('2d');
  var rm=matchMedia('(prefers-reduced-motion: reduce)'),paths=[],pulses=[],W,H,C={},raf,last=0;
  var D=[[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];
  function rnd(n){return Math.floor(Math.random()*n)}
  function css(n,d){return getComputedStyle(document.documentElement).getPropertyValue(n).trim()||d}
  function build(){
    var d=Math.min(devicePixelRatio||1,2),g=34;
    W=innerWidth;H=innerHeight;
    [c,s].forEach(function(e){e.width=W*d;e.height=H*d});
    ctx.setTransform(d,0,0,d,0,0);sx.setTransform(d,0,0,d,0,0);
    C={t:css('--cb-trace','#3fae93'),p:css('--cb-pulse','#f3c969'),a:css('--cb-pad','#d99a4e'),b:css('--cb-board','#0b2622')};
    var cols=Math.ceil(W/g),rows=Math.ceil(H/g),n=Math.round(cols*rows/24);
    paths=[];pulses=[];
    for(var i=0;i<n;i++){
      var x=rnd(cols)*g,y=rnd(rows)*g,dir=rnd(4)*2,pts=[[x,y]],len=[0],tot=0;
      for(var k=0,steps=4+rnd(5);k<steps;k++){
        var l=(2+rnd(4))*g,v=D[dir],ds=(dir%2?0.7071:1);
        var nx=Math.max(0,Math.min(W,x+v[0]*l*ds)),ny=Math.max(0,Math.min(H,y+v[1]*l*ds));
        var seg=Math.hypot(nx-x,ny-y);if(seg<g)break;
        tot+=seg;x=nx;y=ny;pts.push([x,y]);len.push(tot);
        dir=(dir+(Math.random()<.5?1:7))%8;
      }
      if(pts.length>2)paths.push({pts:pts,len:len,tot:tot});
    }
    sx.clearRect(0,0,W,H);sx.lineJoin='round';
    paths.forEach(function(p){
      sx.globalAlpha=.32;sx.strokeStyle=C.t;sx.lineWidth=2;sx.beginPath();
      p.pts.forEach(function(q,i){i?sx.lineTo(q[0],q[1]):sx.moveTo(q[0],q[1])});sx.stroke();
      sx.globalAlpha=.7;sx.strokeStyle=C.a;sx.lineWidth=2;
      [p.pts[0],p.pts[p.pts.length-1]].forEach(function(q){
        sx.fillStyle=C.b;sx.beginPath();sx.arc(q[0],q[1],4,0,7);sx.fill();sx.stroke();
      });
    });
    sx.globalAlpha=1;
    var m=Math.min(paths.length,Math.round(paths.length/2.2));
    for(var j=0;j<m;j++)pulses.push({p:paths[rnd(paths.length)],d:Math.random()*300,v:50+rnd(90)});
  }
  function at(p,d){
    var i=1;while(i<p.len.length-1&&p.len[i]<d)i++;
    var a=p.pts[i-1],b=p.pts[i],t=(d-p.len[i-1])/(p.len[i]-p.len[i-1]);
    t=Math.max(0,Math.min(1,t));return[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
  }
  function frame(t){
    var dt=Math.min((t-last)/1000,.05);last=t;
    ctx.clearRect(0,0,W,H);ctx.drawImage(s,0,0,W,H);
    ctx.lineCap='round';ctx.strokeStyle=C.p;ctx.fillStyle=C.p;
    pulses.forEach(function(u){
      u.d+=u.v*dt;
      if(u.d-60>u.p.tot){u.p=paths[rnd(paths.length)];u.d=0;u.v=50+rnd(90)}
      var tail=70,pt=[];
      for(var i=0;i<=6;i++){var dd=u.d-tail*(1-i/6);if(dd>=0&&dd<=u.p.tot)pt.push(at(u.p,dd))}
      for(var k=1;k<pt.length;k++){
        ctx.globalAlpha=k/pt.length*.85;ctx.lineWidth=2.5;
        ctx.beginPath();ctx.moveTo(pt[k-1][0],pt[k-1][1]);ctx.lineTo(pt[k][0],pt[k][1]);ctx.stroke();
      }
      if(pt.length){ctx.globalAlpha=1;ctx.beginPath();ctx.arc(pt[pt.length-1][0],pt[pt.length-1][1],3.2,0,7);ctx.fill()}
    });
    ctx.globalAlpha=1;
    raf=requestAnimationFrame(frame);
  }
  function start(){
    cancelAnimationFrame(raf);build();
    if(rm.matches){ctx.clearRect(0,0,W,H);ctx.drawImage(s,0,0,W,H)}else{last=performance.now();raf=requestAnimationFrame(frame)}
  }
  var on=false,rt;
  addEventListener('resize',function(){if(on){clearTimeout(rt);rt=setTimeout(start,200)}});
  rm.addEventListener&&rm.addEventListener('change',function(){if(on)start()});
  document.addEventListener('visibilitychange',function(){if(on&&!document.hidden&&!rm.matches){cancelAnimationFrame(raf);last=performance.now();raf=requestAnimationFrame(frame)}});
  window.CircuitBG={
    start:function(){on=true;setTimeout(start,30)},
    stop:function(){on=false;cancelAnimationFrame(raf)}
  };
})();
