'use strict';
/*
 * Independent check of the 3D scene line drawings (test helper, packages/shared/worksheet-3d.js).
 *
 * Ray-casts an id buffer (which body and which face is seen at each point of the picture) from the render
 * description – the world -> clip matrix and the bodies in their local frames, built the way the plugin builds them
 * for three.js (apps/plugin/src/js/scene3d.js) – and compares it with the visible SVG lines:
 *  - GAP: a boundary between two different faces with no line within gapTol mm (a region that would leak when
 *    coloured in); faces in one plane (merged faces of two bodies) need no line;
 *  - LINE-THROUGH-FACE: a line whose neighbourhood shows only one face.
 *
 * analyse(block, { widthMm, res, gapTol, minGap, minThrough }) -> { r, issues, W, H }
 */
const W3 = require('../worksheet-3d.js');

function inv4(m) { // column-major 4x4 inverse
  const a = m, out = new Array(16);
  const a00=a[0],a01=a[1],a02=a[2],a03=a[3],a10=a[4],a11=a[5],a12=a[6],a13=a[7],a20=a[8],a21=a[9],a22=a[10],a23=a[11],a30=a[12],a31=a[13],a32=a[14],a33=a[15];
  const b00=a00*a11-a01*a10,b01=a00*a12-a02*a10,b02=a00*a13-a03*a10,b03=a01*a12-a02*a11,b04=a01*a13-a03*a11,b05=a02*a13-a03*a12,b06=a20*a31-a21*a30,b07=a20*a32-a22*a30,b08=a20*a33-a23*a30,b09=a21*a32-a22*a31,b10=a21*a33-a23*a31,b11=a22*a33-a23*a32;
  let det=b00*b11-b01*b10+b02*b09+b03*b08-b04*b07+b05*b06; det=1/det;
  out[0]=(a11*b11-a12*b10+a13*b09)*det;out[1]=(a02*b10-a01*b11-a03*b09)*det;out[2]=(a31*b05-a32*b04+a33*b03)*det;out[3]=(a22*b04-a21*b05-a23*b03)*det;
  out[4]=(a12*b08-a10*b11-a13*b07)*det;out[5]=(a00*b11-a02*b08+a03*b07)*det;out[6]=(a32*b02-a30*b05-a33*b01)*det;out[7]=(a20*b05-a22*b02+a23*b01)*det;
  out[8]=(a10*b10-a11*b08+a13*b06)*det;out[9]=(a01*b08-a00*b10-a03*b06)*det;out[10]=(a30*b04-a31*b02+a33*b00)*det;out[11]=(a21*b02-a20*b04-a23*b00)*det;
  out[12]=(a11*b07-a10*b09-a12*b06)*det;out[13]=(a00*b09-a01*b07+a02*b06)*det;out[14]=(a31*b01-a30*b03-a32*b00)*det;out[15]=(a20*b03-a21*b01+a22*b00)*det;
  return out;
}
function xf(m, p) { const v=[0,1,2,3].map(r=>m[r]*p[0]+m[4+r]*p[1]+m[8+r]*p[2]+m[12+r]*p[3]); return [v[0]/v[3],v[1]/v[3],v[2]/v[3]]; }
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]], dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2], len=a=>Math.sqrt(dot(a,a));
const norm=a=>{const l=len(a);return [a[0]/l,a[1]/l,a[2]/l];};

// local solid from description; returns hit(o,d)->{t, part, n(local)} | null
function localSolid(b) {
  const d = b.dims;
  if (b.faces) {
    const all = [].concat(...b.faces); const c = all.reduce((a,v)=>[a[0]+v[0]/all.length,a[1]+v[1]/all.length,a[2]+v[2]/all.length],[0,0,0]);
    const planes = b.faces.map(f => { let n=[0,0,0]; for (let i=0;i<f.length;i++){const a=f[i],cc=f[(i+1)%f.length]; n[0]+=(a[1]-cc[1])*(a[2]+cc[2]); n[1]+=(a[2]-cc[2])*(a[0]+cc[0]); n[2]+=(a[0]-cc[0])*(a[1]+cc[1]);} n=norm(n); let k=dot(n,f[0]); if (dot(n,c)-k>0){n=n.map(x=>-x);k=-k;} return {n,k}; });
    return (o, dir) => { let t0=-Infinity,t1=Infinity,p0=-1; for (let i=0;i<planes.length;i++){const P=planes[i]; const den=dot(P.n,dir), dist=P.k-dot(P.n,o); if (Math.abs(den)<1e-15){ if (dist<0) return null; continue;} const t=dist/den; if (den>0) t1=Math.min(t1,t); else if (t>t0){t0=t;p0=i;} if (t0>t1) return null;} return {t:t0, part:p0, n:planes[p0]?planes[p0].n:null, k:planes[p0]?planes[p0].k:null}; };
  }
  if (b.shape === 'sphere') {
    const c=[0,d.r,0];
    return (o, dir) => { const oc=sub(o,c); const bq=dot(dir,oc), cq=dot(oc,oc)-d.r*d.r, disc=bq*bq-cq; if (disc<0) return null; return {t:-bq-Math.sqrt(disc), part:0}; };
  }
  // cylinder/cone: axis frame
  let base, axis, L = d.h;
  if (b.shape === 'cylinder' && b.lying) { axis=[1,0,0]; base=[-d.h/2, d.r, 0]; } else { axis=[0,1,0]; base=[0,0,0]; }
  const cone = b.shape === 'cone';
  return (o, dir) => {
    // candidates: side, caps
    let best = null;
    const q = sub(o, base); const s0 = dot(q, axis), da = dot(dir, axis);
    const oo = sub(q, axis.map(x=>x*s0)), dd = sub(dir, axis.map(x=>x*da));
    const rAt = s => cone ? d.r * (L - s) / L : d.r;
    // side quadratic
    let A,B,C;
    if (!cone) { A=dot(dd,dd); B=dot(oo,dd); C=dot(oo,oo)-d.r*d.r; }
    else { const k2=(d.r/L)**2, hs=L-s0; A=dot(dd,dd)-k2*da*da; B=dot(oo,dd)+k2*da*hs; C=dot(oo,oo)-k2*hs*hs; }
    const tryT = (t, part, n) => { if (!isFinite(t)) return; if (!best || t < best.t) best = {t, part, n}; };
    if (Math.abs(A) > 1e-14) { const disc=B*B-A*C; if (disc>=0){ const sq=Math.sqrt(disc); for (const t of [(-B-sq)/A,(-B+sq)/A]) { const s=s0+t*da; if (s>=0 && s<=L) { const p=[o[0]+dir[0]*t,o[1]+dir[1]*t,o[2]+dir[2]*t]; /* entering? normal dot dir<0 */ const qq=sub(p,base); const ss=dot(qq,axis); const rad=sub(qq,axis.map(x=>x*ss)); let n=norm(rad); if (cone) n=norm([n[0]*L+axis[0]*d.r,n[1]*L+axis[1]*d.r,n[2]*L+axis[2]*d.r]); if (dot(n,dir)<0) tryT(t,1,n);} } } }
    // caps
    const caps = cone ? [[0,-1]] : [[0,-1],[L,1]];
    for (const [sc, sg] of caps) { if (Math.abs(da)<1e-15) continue; const t=(sc-s0)/da; const p=[o[0]+dir[0]*t,o[1]+dir[1]*t,o[2]+dir[2]*t]; const qq=sub(p,base); const ss=dot(qq,axis); const rad=sub(qq,axis.map(x=>x*ss)); if (len(rad)<=d.r && sg*da<0) tryT(t, sg<0?2:3, axis.map(x=>x*sg)); }
    return best;
  };
}

function analyse(block, opts) {
  opts = opts || {};
  const t0 = Date.now();
  const r = W3.render(block, { widthMm: opts.widthMm || 120 });
  const ms = Date.now() - t0;
  const W = r.widthMm, H = r.heightMm, desc = r.render;
  const issues = [];
  if (/NaN|Infinity|undefined/.test(r.svg)) issues.push('NaN/Infinity in SVG');
  const Minv = inv4(desc.viewProj);
  const bodies = desc.bodies.map(b => { const m=b.matrix; const R=[[m[0],m[4],m[8]],[m[1],m[5],m[9]],[m[2],m[6],m[10]]]; const T=[m[12],m[13],m[14]];
    // world->local: R^T (p - T)
    const toL = p => { const q=sub(p,T); return [R[0][0]*q[0]+R[1][0]*q[1]+R[2][0]*q[2], R[0][1]*q[0]+R[1][1]*q[1]+R[2][1]*q[2], R[0][2]*q[0]+R[1][2]*q[1]+R[2][2]*q[2]]; };
    const dirL = v => [R[0][0]*v[0]+R[1][0]*v[1]+R[2][0]*v[2], R[0][1]*v[0]+R[1][1]*v[1]+R[2][1]*v[2], R[0][2]*v[0]+R[1][2]*v[1]+R[2][2]*v[2]];
    const toWn = n => [R[0][0]*n[0]+R[0][1]*n[1]+R[0][2]*n[2], R[1][0]*n[0]+R[1][1]*n[1]+R[1][2]*n[2], R[2][0]*n[0]+R[2][1]*n[1]+R[2][2]*n[2]];
    return { hit: localSolid(b), toL, dirL, toWn, T }; });
  const res = opts.res || 0.1;
  const nx = Math.ceil(W / res), ny = Math.ceil(H / res);
  const id = new Int32Array(nx * ny), planeKey = new Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const X = (i + 0.5) * res, Y = (j + 0.5) * res;
    const ndx = 2 * X / W - 1, ndy = 1 - 2 * Y / H;
    const pN = xf(Minv, [ndx, ndy, -1, 1]), pF = xf(Minv, [ndx, ndy, 1, 1]);
    const dir = norm(sub(pF, pN));
    let best = null, who = -2;
    bodies.forEach((B, bi) => {
      const h = B.hit(B.toL(pN), B.dirL(dir));
      if (h && h.t > -1e9 && (!best || h.t < best.t - 1e-9)) { best = h; who = bi * 10 + h.part; best.bi = bi; }
    });
    if (desc.ground) {
      const c = desc.ground.corners; const t = -pN[1] / dir[1];
      if (dir[1] !== 0 && t > 0 && (!best || t < best.t - 1e-6)) { const x=pN[0]+t*dir[0], z=pN[2]+t*dir[2]; const xs=c.map(p=>p[0]), zs=c.map(p=>p[2]); if (x>=Math.min(...xs)&&x<=Math.max(...xs)&&z>=Math.min(...zs)&&z<=Math.max(...zs)) { who=-1; best=null; } }
    }
    id[j * nx + i] = who;
    if (best && best.n && best.k !== undefined && best.k !== null) { const B=bodies[best.bi]; const nW = B.toWn(best.n); const kW = best.k + dot(nW, B.T); planeKey[j*nx+i] = nW.map(v=>v.toFixed(4)).join(',')+'|'+kW.toFixed(4); }
    else if (best && best.n && best.part >= 2) {
      // a flat cap: key = its world plane (normal and offset through the hit point)
      const B = bodies[best.bi]; const nW = B.toWn(best.n); const hp = [pN[0] + dir[0] * best.t, pN[1] + dir[1] * best.t, pN[2] + dir[2] * best.t];
      planeKey[j*nx+i] = nW.map(v=>v.toFixed(4)).join(',') + '|' + dot(nW, hp).toFixed(4);
    }
  }
  // visible segments
  const segs = [];
  const m = /stroke-linecap="round" stroke-linejoin="round" d="([^"]*)"/.exec(r.svg);
  if (m) for (const part of m[1].split('M').filter(Boolean)) {
    const closed = part.endsWith('Z'); const pts = part.replace('Z','').split('L').map(p=>p.trim().split(/\s+/).map(Number)); if (closed) pts.push(pts[0]);
    for (let k=1;k<pts.length;k++) segs.push([pts[k-1],pts[k]]);
  }
  // grid of segments
  const G = 1, gx = Math.ceil(W/G)+1, gy=Math.ceil(H/G)+1, grid = Array.from({length:gx*gy},()=>[]);
  segs.forEach((s,si)=>{ const x0=Math.floor(Math.min(s[0][0],s[1][0])/G)-1, x1=Math.floor(Math.max(s[0][0],s[1][0])/G)+1, y0=Math.floor(Math.min(s[0][1],s[1][1])/G)-1, y1=Math.floor(Math.max(s[0][1],s[1][1])/G)+1; for(let x=Math.max(0,x0);x<=Math.min(gx-1,x1);x++) for(let y=Math.max(0,y0);y<=Math.min(gy-1,y1);y++) grid[y*gx+x].push(si); });
  function distToLines(X,Y){ const cx=Math.floor(X/G), cy=Math.floor(Y/G); let best=Infinity; if (cx<0||cy<0||cx>=gx||cy>=gy) return best; for (const si of grid[cy*gx+cx]) { const [a,b]=segs[si]; const dx=b[0]-a[0], dy=b[1]-a[1]; const l2=dx*dx+dy*dy; let t=l2?((X-a[0])*dx+(Y-a[1])*dy)/l2:0; t=Math.max(0,Math.min(1,t)); const ddx=a[0]+t*dx-X, ddy=a[1]+t*dy-Y; best=Math.min(best,Math.sqrt(ddx*ddx+ddy*ddy)); } return best; }
  // 1) gaps: ID boundaries without a line nearby
  const gapTol = opts.gapTol || 0.45;
  const gapPix = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const a = id[j*nx+i];
    for (const [di,dj] of [[1,0],[0,1]]) {
      const ii=i+di, jj=j+dj; if (ii>=nx||jj>=ny) continue; const b=id[jj*nx+ii]; if (a===b) continue;
      const ka=planeKey[j*nx+i], kb=planeKey[jj*nx+ii]; if (ka && kb && ka===kb) continue; // merged coplanar
      const X=(i+0.5+di/2)*res, Y=(j+0.5+dj/2)*res;
      if (distToLines(X,Y) > gapTol) gapPix.push([X,Y,a,b]);
    }
  }
  // cluster gap pixels
  if (opts.overlay) opts.overlay.gaps = gapPix; const clusters = cluster(gapPix, 0.3);
  clusters.filter(c=>c.n>=(opts.minGap||5)).forEach(c=>issues.push(`GAP: ${c.n} boundary px without line near (${c.x.toFixed(1)},${c.y.toFixed(1)}) ids ${[...c.ids].join('/')}`));
  // 2) lines through a single face
  const through = [];
  const rad = opts.thrRad || 0.3;
  segs.forEach(([a,b]) => { const L=Math.hypot(b[0]-a[0],b[1]-a[1]); const n=Math.max(1,Math.ceil(L/0.2)); for (let k=0;k<=n;k++){ const X=a[0]+(b[0]-a[0])*k/n, Y=a[1]+(b[1]-a[1])*k/n; const ids=new Set(); for(let dy=-rad;dy<=rad+1e-9;dy+=res) for(let dx=-rad;dx<=rad+1e-9;dx+=res){ if(dx*dx+dy*dy>rad*rad) continue; const i=Math.floor((X+dx)/res), j=Math.floor((Y+dy)/res); if(i<0||j<0||i>=nx||j>=ny){ids.add(-3);continue;} ids.add(id[j*nx+i]); } if (ids.size===1 && !ids.has(-2) && !ids.has(-3)) through.push([X,Y,[...ids][0]]); } });
  if (opts.overlay) opts.overlay.through = through; const tcl = cluster(through.map(p=>[p[0],p[1],p[2],p[2]]), 0.5);
  tcl.filter(c=>c.n>=(opts.minThrough||3)).forEach(c=>issues.push(`LINE-THROUGH-FACE: ${c.n} samples near (${c.x.toFixed(1)},${c.y.toFixed(1)}) on id ${[...c.ids].join('/')}`));
  return { r, ms, issues, W, H };
}
function cluster(pts, d) {
  const out = []; const used = new Uint8Array(pts.length);
  // simple grid-based union
  const key = p => Math.floor(p[0]/d)+','+Math.floor(p[1]/d); const map = new Map(); pts.forEach((p,i)=>{const k=key(p); if(!map.has(k)) map.set(k,[]); map.get(k).push(i);});
  for (let i=0;i<pts.length;i++){ if(used[i]) continue; const stack=[i]; used[i]=1; const c={n:0,x:0,y:0,ids:new Set()}; while(stack.length){ const k=stack.pop(); const p=pts[k]; c.n++; c.x+=p[0]; c.y+=p[1]; c.ids.add(p[2]); c.ids.add(p[3]); const gx=Math.floor(p[0]/d), gy=Math.floor(p[1]/d); for(let a=-1;a<=1;a++) for(let b=-1;b<=1;b++){ const l=map.get((gx+a)+','+(gy+b)); if(!l) continue; for(const q of l){ if(!used[q] && Math.hypot(pts[q][0]-p[0],pts[q][1]-p[1])<=d){used[q]=1;stack.push(q);} } } } c.x/=c.n; c.y/=c.n; out.push(c); }
  return out;
}
module.exports = { analyse, W3 };
