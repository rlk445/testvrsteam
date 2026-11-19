/* Beat Saber: 1 ou 2 sabres presos às suas mãos. Blocos vêm no ritmo da música; corte na direção da seta com o sabre da mesma cor.
   Placar, combo, multiplicador, energia, bombas, resultados com nota e recorde. A música e as fases vêm de bsmusic.js. */
(() => {
'use strict';
const VR = window.VR, T = VR.T, S = VR.S, H = VR.H, scene = VR.scene, headQ = VR.headQ, HEAD = VR.HEAD, ui = VR.ui, BSM = window.BSM, clamp = VR.clamp, damp = VR.damp;
const bs = VR.saber = { on: false, state: 'idle', paused: '', single: 1, hand: null };
bs.bg = new T.Color(0x04050b); bs.fog = new T.Fog(0x04050b, 8, 34);
const COL = [0xff2447, 0x1f8bff], COLS = ['#ff2447', '#1f8bff'], GZ = -0.7, SPAWN = 22;               // cor 0 = vermelho (mão esquerda), 1 = azul (mão direita)
const DV = [[0, 1], [0, -1], [-1, 0], [1, 0], [-0.7071, 0.7071], [0.7071, 0.7071], [-0.7071, -0.7071], [0.7071, -0.7071], [0, 0]];
const DANG = [0, Math.PI, Math.PI / 2, -Math.PI / 2, Math.PI / 4, -Math.PI / 4, 3 * Math.PI / 4, -3 * Math.PI / 4, 0];
const RANKC = { SS: '#ffd34d', S: '#ffd34d', A: '#4fe08a', B: '#6ee7ff', C: '#9aa7ff', D: '#ff9f6b', E: '#ff6b6b' };
const rankOf = p => p >= 0.9 ? 'SS' : p >= 0.8 ? 'S' : p >= 0.65 ? 'A' : p >= 0.5 ? 'B' : p >= 0.35 ? 'C' : p >= 0.2 ? 'D' : 'E';
const fmt = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const lam = (c, o) => new T.MeshLambertMaterial(Object.assign({ color: c }, o || {}));
const bas = (c, o) => new T.MeshBasicMaterial(Object.assign({ color: c }, o || {}));
const ADD = { transparent: true, blending: T.AdditiveBlending, depthWrite: false };
let rec = {}; try { rec = JSON.parse(localStorage.getItem('vrbs1') || '{}'); } catch (e) {}
const recKey = () => S.bsSong + '-' + S.bsLvl + '-' + S.bsSabers;
bs.best = () => rec[recKey()] || 0;

// ---------- estado da partida ----------
const G = { chart: null, ni: 0, active: [], score: 0, combo: 0, maxCombo: 0, energy: 0.5, good: 0, bad: 0, miss: 0, bombs: 0, proc: 0, maxProc: 0, countT: 0, failed: false, newRec: false, flash: 0, lost: 0, tN: 0, speed: 8, lead: 2.75 };
let built = false, root, decor, floorM, grid, barR, barB, ringA, ringB, rings = [], stars, plat;
let board, bc, boardKey = '', boardMode = '', tgt = [], sabG = [], trail = [], chunks = [], pops = [], notePool = [], bombPool = [];
let arrowMat, dotMat, boxG, edgeG, planeG, matN, edgeMat, lastBeatT = 0, wasPaused = false, lobbyT = 0;
const gy = () => 1.6 + S.bsH;                                                  // altura da fileira do meio
const cellSize = () => clamp(0.2 * S.bsSpread * 0.82, 0.13, 0.26);
function cell(lane, row, o) { const sp = 0.2 * S.bsSpread; o.x = (lane - 1.5) * sp; o.y = gy() + (row - 1) * sp; o.z = GZ; return o; }
const _c = { x: 0, y: 0, z: 0 };

// ---------- construção da cena ----------
function arrowTex(dot) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.shadowColor = 'rgba(255,255,255,.7)'; g.shadowBlur = 6;
  if (dot) { g.beginPath(); g.arc(64, 64, 20, 0, 7); g.fill(); }
  else { g.beginPath(); g.moveTo(64, 20); g.lineTo(104, 66); g.lineTo(78, 66); g.lineTo(78, 108); g.lineTo(50, 108); g.lineTo(50, 66); g.lineTo(24, 66); g.closePath(); g.fill(); }
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
}
function makeSaber(c) {
  const g = new T.Group(), col = COL[c];
  const hilt = new T.Mesh(new T.CylinderGeometry(0.014, 0.016, 0.16, 12), lam(0x2a2d36)); hilt.position.y = 0.0; g.add(hilt);
  const guard = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 0.012, 18), lam(0x9aa1b0)); guard.position.y = 0.082; g.add(guard);
  const grip = new T.Mesh(new T.CylinderGeometry(0.017, 0.017, 0.05, 12), bas(col)); grip.position.y = -0.03; g.add(grip);
  const blade = new T.Group(); blade.position.y = 0.09; g.add(blade);
  const cyl = (r, m) => { const geo = new T.CylinderGeometry(r, r, 1, 12, 1, false); geo.translate(0, 0.5, 0); const mesh = new T.Mesh(geo, m); mesh.frustumCulled = false; blade.add(mesh); return mesh; };
  cyl(0.0075, bas(0xffffff, { fog: false })); cyl(0.017, bas(col, Object.assign({ opacity: 0.8, fog: false }, ADD))); cyl(0.036, bas(col, Object.assign({ opacity: 0.26, fog: false }, ADD)));
  g.userData.blade = blade; g.visible = false; root.add(g); return g;
}
const TN = 14;
function makeTrail(c) {
  const geo = new T.BufferGeometry(), pos = new Float32Array(TN * 2 * 3), colr = new Float32Array(TN * 2 * 3), idx = [];
  for (let i = 0; i < TN - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('color', new T.BufferAttribute(colr, 3)); geo.setIndex(idx);
  const m = new T.Mesh(geo, new T.MeshBasicMaterial(Object.assign({ vertexColors: true, side: T.DoubleSide, fog: false }, ADD))); m.frustumCulled = false; m.visible = false; root.add(m);
  return { m, pos, colr, hist: [], c };
}
function mkNote() {
  const g = new T.Group(), body = new T.Mesh(boxG, matN[0]), arrow = new T.Mesh(planeG, arrowMat), edges = new T.LineSegments(edgeG, edgeMat);
  arrow.position.z = 0.503; arrow.scale.set(0.82, 0.82, 1); g.add(body, arrow, edges); g.visible = false; g.userData = { body, arrow, free: true }; root.add(g); return g;
}
function mkBomb() {
  const g = new T.Group(), s = new T.Mesh(new T.SphereGeometry(0.5, 16, 12), lam(0x17171f, { emissive: 0x2a0508 })), w = new T.Mesh(new T.IcosahedronGeometry(0.62, 1), bas(0xff3b3b, Object.assign({ wireframe: true, opacity: 0.8 }, ADD)));
  g.add(s, w); g.visible = false; g.userData = { free: true }; root.add(g); return g;
}
function build() {
  built = true; root = new T.Group(); root.visible = false; scene.add(root);
  boxG = new T.BoxGeometry(1, 1, 1); edgeG = new T.EdgesGeometry(boxG); planeG = new T.PlaneGeometry(1, 1);
  arrowMat = bas(0xffffff, { map: arrowTex(false), transparent: true, depthWrite: false }); dotMat = bas(0xffffff, { map: arrowTex(true), transparent: true, depthWrite: false });
  matN = [lam(0xe01e3c, { emissive: 0x5a0716 }), lam(0x1e6bff, { emissive: 0x071c5a })]; edgeMat = new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 });
  // cenário (some quando a passagem da câmera está ligada)
  decor = new T.Group(); root.add(decor);
  floorM = new T.Mesh(new T.PlaneGeometry(14, 100), bas(0x07080f)); floorM.rotation.x = -Math.PI / 2; floorM.position.set(0, 0, -44); decor.add(floorM);
  grid = new T.GridHelper(80, 80, 0x3a48b8, 0x1b2258); grid.position.set(0, 0.004, -34); grid.material.transparent = true; grid.material.opacity = 0.55; decor.add(grid);
  barR = bas(0xff2447); barB = bas(0x1f8bff); const barG = new T.BoxGeometry(0.14, 7, 0.14);
  for (let z = -6; z >= -46; z -= 5) { [[-4.2, barR], [4.2, barB]].forEach(([x, m]) => { const b = new T.Mesh(barG, m); b.position.set(x, 3.5, z); decor.add(b); }); [[-6.4, barB], [6.4, barR]].forEach(([x, m]) => { const b = new T.Mesh(barG, m); b.position.set(x, 3.5, z - 2.5); decor.add(b); }); }
  ringA = bas(0x6ee7ff, { transparent: true, opacity: 0.9 }); ringB = bas(0xff4fa0, { transparent: true, opacity: 0.9 });
  const rg = new T.TorusGeometry(5.6, 0.045, 6, 56);
  for (let i = 0; i < 8; i++) { const m = new T.Mesh(rg, i % 2 ? ringA : ringB); m.position.set(0, 2.6, -8 - i * 6); decor.add(m); rings.push(m); }
  const sp = new Float32Array(260 * 3); for (let i = 0; i < 260; i++) { const r = 45 + Math.random() * 25, a = Math.random() * Math.PI * 2, e = Math.random() * 1.2 + 0.05; sp[i * 3] = Math.cos(a) * r * Math.cos(e); sp[i * 3 + 1] = Math.sin(e) * r; sp[i * 3 + 2] = Math.sin(a) * r * Math.cos(e) - 10; }
  const sgeo = new T.BufferGeometry(); sgeo.setAttribute('position', new T.BufferAttribute(sp, 3)); stars = new T.Points(sgeo, new T.PointsMaterial({ size: 0.4, color: 0x9bb0ff, fog: false, transparent: true, opacity: 0.8 })); decor.add(stars);
  plat = new T.Mesh(new T.RingGeometry(0.42, 0.48, 48), bas(0x6ee7ff, { side: T.DoubleSide, transparent: true, opacity: 0.8 })); plat.rotation.x = -Math.PI / 2; plat.position.y = 0.012; decor.add(plat);
  // sabres e rastros
  sabG = [makeSaber(0), makeSaber(1)]; trail = [makeTrail(0), makeTrail(1)];
  // blocos (reaproveitados) e partículas
  for (let i = 0; i < 28; i++) notePool.push(mkNote()); for (let i = 0; i < 10; i++) bombPool.push(mkBomb());
  for (let i = 0; i < 72; i++) { const m = new T.Mesh(boxG, bas(0xffffff, { transparent: true })); m.visible = false; root.add(m); chunks.push({ m, vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, rz: 0, life: 0, max: 1, s: 0.05, free: true }); }
  for (let i = 0; i < 8; i++) { const cv = ui.mkCv(256, 128), sp2 = new T.Sprite(new T.SpriteMaterial({ map: cv.t, transparent: true, depthTest: false, depthWrite: false, fog: false })); sp2.scale.set(0.36, 0.18, 1); sp2.renderOrder = 30; sp2.visible = false; root.add(sp2); pops.push({ sp: sp2, cv, life: 0, free: true }); }
  // placar / lobby
  bc = ui.mkCv(1024, 512); board = new T.Mesh(new T.PlaneGeometry(1.5, 0.75), new T.MeshBasicMaterial({ map: bc.t, transparent: true, depthWrite: false, toneMapped: false, fog: false })); board.renderOrder = 9; root.add(board);
  // alvos do lobby: música, 1 sabre, jogar, 2 sabres, nível
  for (let i = 0; i < 5; i++) {
    const cv = ui.mkCv(192, 192), mats = [0, 1, 2, 3, 4, 5].map(k => k === 4 ? new T.MeshBasicMaterial({ map: cv.t, toneMapped: false, fog: false }) : lam(0x242a44, { emissive: 0x0b0e22 }));
    const m = new T.Mesh(boxG, mats); m.visible = false; root.add(m); tgt.push({ m, cv, id: ['song', 'one', 'play', 'two', 'lvl'][i], cd: 0, pop: 0, key: '' });
  }
  placeAll();
}
// ---------- desenho dos alvos ----------
function drawTarget(t) {
  const st = bs.state, one = S.bsSabers === 1, key = [t.id, S.bsSong, S.bsLvl, S.bsSabers, st].join('|'); if (key === t.key) return; t.key = key;
  const g = t.cv.g, W = 192, sel = (t.id === 'one' && one) || (t.id === 'two' && !one);
  const base = { song: ['#6c3cff', '#2a1170'], one: ['#ff2447', '#5a0716'], two: ['#1f8bff', '#071c5a'], play: ['#27d97a', '#07502c'], lvl: ['#ff9f2d', '#6a3606'] }[t.id];
  g.clearRect(0, 0, W, W); ui.rr(g, 4, 4, W - 8, W - 8, 28); const gr = g.createLinearGradient(0, 0, 0, W); gr.addColorStop(0, base[0]); gr.addColorStop(1, base[1]); g.fillStyle = gr; g.fill();
  g.lineWidth = sel ? 9 : 3; g.strokeStyle = sel ? '#fff' : 'rgba(255,255,255,.35)'; g.stroke();
  const bar = (x, col) => { g.save(); g.shadowColor = col; g.shadowBlur = 14; g.fillStyle = '#fff'; ui.rr(g, x - 5, 28, 10, 70, 5); g.fill(); g.restore(); g.fillStyle = col; ui.rr(g, x - 9, 40, 18, 50, 9); g.globalAlpha = 0.5; g.fill(); g.globalAlpha = 1; };
  let l1 = '', l2 = '';
  if (t.id === 'one') { bar(96, '#ff6b81'); l1 = '1 SABRE'; }
  else if (t.id === 'two') { bar(68, '#ff6b81'); bar(124, '#6bb2ff'); l1 = '2 SABRES'; }
  else if (t.id === 'play') { g.fillStyle = '#fff'; g.beginPath(); g.moveTo(74, 34); g.lineTo(74, 92); g.lineTo(124, 63); g.closePath(); g.fill(); l1 = st === 'results' ? 'DE NOVO' : 'JOGAR'; }
  else if (t.id === 'song') { l1 = 'MÚSICA'; l2 = BSM.SONGS[S.bsSong].short; ui.text(g, '♪', 96, 62, 62, '#fff', 'center', 700); }
  else { l1 = 'NÍVEL'; l2 = BSM.DIFFS[S.bsLvl].n; ui.text(g, '⚡', 96, 62, 56, '#fff', 'center', 700); }
  ui.text(g, l1, 96, l2 ? 122 : 134, l1.length > 7 ? 27 : 32, '#fff', 'center', 800); if (l2) ui.text(g, l2, 96, 160, 30, '#ffe9a8', 'center', 700);
  if (sel) ui.text(g, '✓', 168, 26, 30, '#fff', 'center', 800);
  t.cv.t.needsUpdate = true;
}
// ---------- posições ----------
function placeAll() {
  const sz = cellSize(), sp = 0.26 * S.bsSpread;
  tgt.forEach((t, i) => { t.bx = (i - 2) * sp; t.by = gy(); t.bz = GZ - 0.3; t.m.scale.setScalar(sz * 1.15); t.key = ''; });
}
bs.relayout = () => { if (built) { placeAll(); boardKey = ''; } };

// ---------- sabres (mão → lâmina) ----------
const mk = c => ({ c, ok: false, wasOk: false, hasPrev: false, base: new T.Vector3(), a: new T.Vector3(), b: new T.Vector3(), pa: new T.Vector3(), pb: new T.Vector3(), dir: new T.Vector3(0, 1, 0), q: new T.Quaternion(), hasQ: false, hist: [], spd: 0, seen: false });
const sb = [mk(0), mk(1)];
const pc = new T.Vector3(), cw = new T.Vector3(), tmpV = new T.Vector3(), qW = new T.Quaternion(), dirV = new T.Vector3(), upZ = new T.Vector3(0, 1, -0.3).normalize();
const mouse = { x: 0, y: 0, t: -1e9, c: 1 };
addEventListener('pointermove', e => { if (e.pointerType === 'mouse') { mouse.x = e.clientX / innerWidth * 2 - 1; mouse.y = -(e.clientY / innerHeight) * 2 + 1; mouse.t = performance.now(); } });
function setSaber(o, pos, dir) {
  o.pa.copy(o.a); o.pb.copy(o.b); o.hasPrev = o.ok; o.seen = true; o.ok = true;
  o.dir.copy(dir).normalize(); o.base.copy(pos); o.a.copy(pos).addScaledVector(o.dir, 0.09); o.b.copy(o.a).addScaledVector(o.dir, S.bsLen);
  const t = performance.now() / 1000; o.hist.push({ t, ax: o.a.x, ay: o.a.y, az: o.a.z, bx: o.b.x, by: o.b.y, bz: o.b.z }); if (o.hist.length > 12) o.hist.shift();
}
function readSabers(dt) {
  const one = S.bsSabers === 1, vis = H.filter(s => s.on && s.vis), want = [null, null];
  sb.forEach(o => { o.seen = false; });
  if (one) {
    let h = null; const w = S.bsHand;
    if (w === 1) h = vis.find(s => s.right); else if (w === 2) h = vis.find(s => !s.right); else if (bs.hand && vis.includes(bs.hand)) h = bs.hand;
    if (!h) h = vis.find(s => s.right) || vis[0] || null; bs.hand = h; want[bs.single] = h;
  } else if (vis.length === 2) { const lo = vis[0].P[0].x <= vis[1].P[0].x; want[0] = lo ? vis[0] : vis[1]; want[1] = lo ? vis[1] : vis[0]; }
  else if (vis.length === 1) want[vis[0].right ? 1 : 0] = vis[0];
  for (let c = 0; c < 2; c++) {
    const o = sb[c], h = want[c]; if (!h) continue;
    pc.copy(h.P[0]).add(h.P[9]).multiplyScalar(0.5); VR.toWorld(cw, pc);
    qW.copy(headQ).multiply(h.q); if (!o.hasQ) { o.q.copy(qW); o.hasQ = true; } else o.q.slerp(qW, damp(26, dt));
    dirV.set(0, 1, 0).applyQuaternion(o.q); setSaber(o, cw, dirV);
  }
  if (!vis.length && !S.vr && performance.now() - mouse.t < 6000) {                 // sem mãos (PC): o sabre segue o mouse (Tab troca de sabre)
    const ac = one ? bs.single : mouse.c; tmpV.set(mouse.x, mouse.y, 0.5).unproject(VR.camMain).sub(VR.camMain.position).normalize(); cw.copy(HEAD).addScaledVector(tmpV, 0.75); setSaber(sb[ac], cw, upZ);
    if (!one) { const oc = ac ^ 1; cw.set(oc ? 0.3 : -0.3, gy() - 0.1, GZ + 0.1); setSaber(sb[oc], cw, upZ); }
  }
  sb.forEach(o => { if (!o.seen) { o.ok = false; o.hasPrev = false; o.hasQ = false; o.hist.length = 0; } });
}
let segU = 0;
function segPt(ax, ay, az, bx, by, bz, px, py, pz) {
  const dx = bx - ax, dy = by - ay, dz = bz - az, l2 = dx * dx + dy * dy + dz * dz; let u = l2 > 1e-9 ? ((px - ax) * dx + (py - ay) * dy + (pz - az) * dz) / l2 : 0; u = u < 0 ? 0 : u > 1 ? 1 : u; segU = u;
  const qx = ax + dx * u - px, qy = ay + dy * u - py, qz = az + dz * u - pz; return Math.sqrt(qx * qx + qy * qy + qz * qz);
}
const tc = { o: null, u: 0, d: 9 };
function touch(px, py, pz, R) {                                                    // lâmina (varrida entre o quadro anterior e o atual) × esfera
  tc.o = null; tc.d = 9;
  for (let c = 0; c < 2; c++) {
    const o = sb[c]; if (!o.ok) continue; const n = o.hasPrev ? 4 : 1;
    for (let k = 1; k <= n; k++) {
      const f = k / n; let ax, ay, az, bx, by, bz;
      if (o.hasPrev) { ax = o.pa.x + (o.a.x - o.pa.x) * f; ay = o.pa.y + (o.a.y - o.pa.y) * f; az = o.pa.z + (o.a.z - o.pa.z) * f; bx = o.pb.x + (o.b.x - o.pb.x) * f; by = o.pb.y + (o.b.y - o.pb.y) * f; bz = o.pb.z + (o.b.z - o.pb.z) * f; }
      else { ax = o.a.x; ay = o.a.y; az = o.a.z; bx = o.b.x; by = o.b.y; bz = o.b.z; }
      const d = segPt(ax, ay, az, bx, by, bz, px, py, pz); if (d < R && d < tc.d) { tc.o = o; tc.d = d; tc.u = segU; }
    }
  }
  return tc.o;
}
const vOut = { x: 0, y: 0, z: 0 };
function bladeVel(o, u) {                                                          // velocidade (m/s) do ponto u da lâmina, medida nos últimos ~80 ms
  const h = o.hist, L = h.length; if (L < 2) { vOut.x = vOut.y = vOut.z = 0; return 0; }
  const cur = h[L - 1]; let k = L - 1; while (k > 0 && cur.t - h[k - 1].t <= 0.08) k--; if (k === L - 1 && cur.t - h[L - 2].t <= 0.3) k = L - 2; const p = h[k], dtv = cur.t - p.t; if (dtv < 0.012) { vOut.x = vOut.y = vOut.z = 0; return 0; }
  vOut.x = ((cur.ax + (cur.bx - cur.ax) * u) - (p.ax + (p.bx - p.ax) * u)) / dtv; vOut.y = ((cur.ay + (cur.by - cur.ay) * u) - (p.ay + (p.by - p.ay) * u)) / dtv; vOut.z = ((cur.az + (cur.bz - cur.az) * u) - (p.az + (p.bz - p.az) * u)) / dtv;
  return Math.sqrt(vOut.x * vOut.x + vOut.y * vOut.y + vOut.z * vOut.z);
}

// ---------- efeitos ----------
function chunk(x, y, z, vx, vy, vz, s, col, life) {
  const c = chunks.find(k => k.free); if (!c) return; c.free = false; c.m.visible = true; c.m.position.set(x, y, z); c.m.material.color.setHex(col); c.m.material.opacity = 1; c.vx = vx; c.vy = vy; c.vz = vz;
  c.rx = (Math.random() - 0.5) * 14; c.ry = (Math.random() - 0.5) * 14; c.rz = (Math.random() - 0.5) * 14; c.life = c.max = life; c.s = s; c.m.scale.setScalar(s); c.m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
}
function popup(x, y, z, txt, col) {
  const p = pops.find(k => k.free); if (!p) return; p.free = false; const g = p.cv.g; g.clearRect(0, 0, 256, 128); g.lineWidth = 8; g.strokeStyle = 'rgba(0,0,0,.6)'; g.font = '800 78px ' + ui.FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.strokeText(txt, 128, 66); g.fillStyle = col; g.fillText(txt, 128, 66);
  p.cv.t.needsUpdate = true; p.sp.visible = true; p.sp.position.set(x, y + 0.08, z + 0.1); p.sp.material.opacity = 1; p.life = 0.8;
}
function burst(n, col, vdir, good) {
  const x = n.x, y = n.y, z = n.z, sz = cellSize();
  let px = -vdir.y, py = vdir.x; const pl = Math.hypot(px, py) || 1; px /= pl; py /= pl;                      // perpendicular ao corte: as duas metades se afastam
  if (good) {
    for (let s = -1; s <= 1; s += 2) for (let k = 0; k < 3; k++) chunk(x + px * s * 0.03, y + py * s * 0.03, z, px * s * (1.1 + Math.random() * 0.8) + vdir.x * 0.6, py * s * (1.1 + Math.random() * 0.8) + vdir.y * 0.6, 1.2 + Math.random() * 1.6, sz * 0.45, col, 0.7);
    for (let k = 0; k < 10; k++) chunk(x, y, z, (Math.random() - 0.5) * 3.4, (Math.random() - 0.5) * 3.4, (Math.random() - 0.2) * 3, 0.014, 0xffffff, 0.35);
  } else for (let k = 0; k < 8; k++) chunk(x, y, z, (Math.random() - 0.5) * 2.4, (Math.random() - 0.3) * 2.4, (Math.random() - 0.2) * 2.4, sz * 0.3, 0x7d828f, 0.6);
}
function updFx(dt) {
  for (const c of chunks) if (!c.free) {
    c.life -= dt; if (c.life <= 0) { c.free = true; c.m.visible = false; continue; }
    c.vy -= 5.5 * dt; c.m.position.x += c.vx * dt; c.m.position.y += c.vy * dt; c.m.position.z += c.vz * dt; c.m.rotation.x += c.rx * dt; c.m.rotation.y += c.ry * dt; c.m.rotation.z += c.rz * dt;
    const k = clamp(c.life / c.max * 2, 0, 1); c.m.scale.setScalar(c.s * (0.3 + 0.7 * k)); c.m.material.opacity = k;
  }
  for (const p of pops) if (!p.free) { p.life -= dt; if (p.life <= 0) { p.free = true; p.sp.visible = false; continue; } p.sp.position.y += 0.35 * dt; p.sp.material.opacity = clamp(p.life / 0.4, 0, 1); }
}
// ---------- blocos ----------
function spawn(nd) {
  const bomb = nd.type === 'b', pool = bomb ? bombPool : notePool, v = pool.find(g => g.userData.free); if (!v) return; v.userData.free = false; v.visible = true;
  const n = { type: nd.type, c: nd.c, dir: nd.dir, lane: nd.lane, row: nd.row, t: nd.t, z: -99, v, x: 0, y: 0 }; cell(nd.lane, nd.row, _c); n.x = _c.x; n.y = _c.y;
  const sz = cellSize(); v.scale.setScalar(bomb ? sz * 0.8 : sz); v.position.set(n.x, n.y, -99);
  if (!bomb) { v.userData.body.material = matN[nd.c]; v.userData.arrow.material = nd.dir === 8 ? dotMat : arrowMat; v.rotation.set(0, 0, DANG[nd.dir]); } else v.rotation.set(0, 0, 0);
  G.active.push(n);
}
function free(n) { n.v.visible = false; n.v.userData.free = true; }
function gain(d) { G.energy = clamp(G.energy + d, 0, 1); if (G.energy <= 0 && !S.bsNoFail && bs.state === 'play') finish(true); }
function markProc() { G.maxProc += 115 * BSM.multFor(G.proc); G.proc++; }
function resolve(n, o, u, speed) {                                                  // o sabre encostou num bloco com velocidade suficiente
  const sz = cellSize(), colHex = COL[n.c], vx = vOut.x, vy = vOut.y, pl = Math.hypot(vx, vy) || 1, vd = { x: vx / pl, y: vy / pl };
  if (n.type === 'b') { G.bombs++; G.combo = 0; gain(-0.15); G.flash = 1; BSM.sfx('bomb'); burst(n, 0xff5533, vd, false); for (let k = 0; k < 14; k++) chunk(n.x, n.y, n.z, (Math.random() - 0.5) * 4, (Math.random() - 0.2) * 4, (Math.random() - 0.5) * 4, 0.03, 0xffa040, 0.5); free(n); return true; }
  const colorOk = n.c === o.c; let cos = 1;
  if (n.dir !== 8 && S.bsDir) { const a = DV[n.dir]; cos = pl > speed * 0.35 ? (vx * a[0] + vy * a[1]) / pl : 0; }
  const dirOk = cos >= 0.5;
  if (colorOk && dirOk) {
    const speedS = clamp(speed / 3.5, 0, 1) * 50, dirS = (n.dir === 8 || !S.bsDir) ? 35 : clamp((cos - 0.5) / 0.5, 0, 1) * 35, cenS = clamp(1 - tc.d / (sz * 0.75), 0, 1) * 30, pts = Math.round(speedS + dirS + cenS);
    const m = BSM.multFor(G.combo); G.score += pts * m; G.combo++; G.maxCombo = Math.max(G.maxCombo, G.combo); G.good++; markProc(); gain(0.02);
    BSM.sfx('cut', pts / 115); burst(n, colHex, vd, true); popup(n.x, n.y, n.z, String(pts), pts >= 100 ? '#ffe36b' : '#ffffff'); G.flash = Math.min(1, G.flash + 0.25);
    try { navigator.vibrate && navigator.vibrate(12); } catch (e) {}
  } else { G.bad++; G.combo = 0; markProc(); gain(-0.1); BSM.sfx('bad'); burst(n, 0x7d828f, vd, false); popup(n.x, n.y, n.z, '✕', '#ff6b6b'); }
  free(n); return true;
}
function updateNotes(dt) {
  const tN = G.tN, minV = S.bsMin, ch = G.chart;
  while (G.ni < ch.notes.length && ch.notes[G.ni].t - tN <= G.lead) spawn(ch.notes[G.ni++]);
  const sz = cellSize();
  for (let i = G.active.length - 1; i >= 0; i--) {
    const n = G.active[i]; if (!n) break; n.z = GZ - (n.t - tN) * G.speed; n.v.position.z = n.z;
    if (n.type === 'b') n.v.rotation.y += dt * 2; 
    let gone = false;
    if (n.z > GZ + 0.55) { if (n.type === 'n') { G.miss++; G.combo = 0; markProc(); gain(-0.1); BSM.sfx('miss'); } free(n); gone = true; }
    else if (n.z > GZ - 0.9 && sb[0].ok + sb[1].ok > 0) {
      const R = sz * (n.type === 'b' ? 0.55 : 0.75);
      if (touch(n.x, n.y, n.z, R)) { const o = tc.o, spd = bladeVel(o, tc.u); if (spd >= (n.type === 'b' ? minV * 0.5 : minV)) gone = resolve(n, o, tc.u, spd); }
    }
    if (gone && bs.state === 'play') G.active.splice(i, 1); else if (bs.state !== 'play') break;
  }
}
// ---------- fluxo da partida ----------
function resetG() {
  G.active.forEach(free); G.active.length = 0; Object.assign(G, { ni: 0, score: 0, combo: 0, maxCombo: 0, energy: 0.5, good: 0, bad: 0, miss: 0, bombs: 0, proc: 0, maxProc: 0, countT: 0, failed: false, newRec: false, flash: 0, lost: 0, tN: 0, pct: 0, rank: 'E' });
}
function pickSingle() {
  const vis = H.filter(s => s.on && s.vis); if (S.bsHand === 1) return 1; if (S.bsHand === 2) return 0; return vis.length ? (vis.find(s => s.right) ? 1 : 0) : 1;
}
const orbHome = new T.Vector3(0, -0.23, -0.8);
function orbMove(away) { const p = ui.panels.orb; if (p && p.g) { if (away) p.g.position.set(0.42, 0.22, -0.8); else p.g.position.copy(orbHome); } }
function startNow() {
  bs.single = pickSingle(); bs.hand = null; resetG();
  G.chart = BSM.makeChart(S.bsSong, S.bsLvl, S.bsSabers, bs.single, S.bsBombs); G.speed = G.chart.speed; G.lead = SPAWN / G.speed;
  bs.state = 'count'; G.countT = 0; boardKey = ''; orbMove(true); ui.closeMenu(); BSM.ctx();
}
bs.start = () => { if (!bs.on) { VR.env.set('saber', true); } startNow(); };
bs.stop = () => { BSM.stop(true); resetG(); bs.state = 'idle'; boardKey = ''; orbMove(true); };
function finish(failed) {
  const ch = G.chart, pct = ch.maxScore ? G.score / ch.maxScore : 0; G.failed = failed; bs.state = 'results'; boardKey = ''; BSM.stop(); G.active.forEach(free); G.active.length = 0; orbMove(true);
  G.pct = pct; G.rank = failed ? 'E' : rankOf(pct);
  if (!failed && G.score > bs.best()) { G.newRec = G.score > 0; rec[recKey()] = G.score; try { localStorage.setItem('vrbs1', JSON.stringify(rec)); } catch (e) {} }
  BSM.sfx(failed ? 'fail' : 'win');
  if (ui.panels.settings) ui.panels.settings.dirty = true;
}
// ---------- lobby ----------
function targetAction(t) {
  const dirty = () => { if (ui.panels.settings) ui.panels.settings.dirty = true; };
  switch (t.id) {
    case 'song': S.bsSong = (S.bsSong + 1) % BSM.SONGS.length; VR.save(); dirty(); ui.toast('Música: ' + BSM.SONGS[S.bsSong].name, 1800); break;
    case 'lvl': S.bsLvl = (S.bsLvl + 1) % BSM.DIFFS.length; VR.save(); dirty(); ui.toast('Nível: ' + BSM.DIFFS[S.bsLvl].n, 1800); break;
    case 'one': S.bsSabers = 1; VR.save(); dirty(); ui.toast('1 sabre', 1800); break;
    case 'two': S.bsSabers = 2; VR.save(); dirty(); ui.toast('2 sabres', 1800); break;
    case 'play': startNow(); break;
  }
  boardKey = ''; t.pop = 0.25; BSM.sfx('tick');
}
function updLobby(dt, t) {
  lobbyT += dt; const sz = cellSize();
  tgt.forEach((tg, i) => {
    drawTarget(tg); tg.cd -= dt; if (tg.pop > 0) tg.pop -= dt;
    const bob = Math.sin(lobbyT * 2 + i) * 0.015; tg.m.position.set(tg.bx, tg.by + bob, tg.bz); tg.m.rotation.set(0, Math.sin(lobbyT * 0.8 + i) * 0.12, 0);
    tg.m.scale.setScalar(sz * 1.15 * (1 + Math.max(0, tg.pop) * 1.6)); tg.m.visible = true;
    if (tg.cd <= 0 && !bs.paused && sb[0].ok + sb[1].ok > 0 && touch(tg.bx, tg.by, tg.bz, sz * 1.15 * 0.62)) {
      const spd = bladeVel(tc.o, tc.u); if (spd >= S.bsMin) { tg.cd = 0.7; for (let k = 0; k < 10; k++) chunk(tg.bx, tg.by, tg.bz, (Math.random() - 0.5) * 3, (Math.random() - 0.2) * 3, (Math.random() - 0.2) * 3, 0.02, 0xffffff, 0.4); targetAction(tg); }
    }
  });
}
// ---------- placar ----------
function drawBoard(msg) {
  const st = bs.state, sg = BSM.SONGS[S.bsSong], df = BSM.DIFFS[S.bsLvl].n, mode = S.bsSabers === 1 ? '1 sabre' : '2 sabres', ch = G.chart;
  const pctNow = G.maxProc ? G.score / G.maxProc : 1, rk = rankOf(pctNow), cnt = st === 'count' ? Math.ceil(3 - G.countT) : 0;
  const key = [st, G.score, G.combo, Math.round(G.energy * 40), rk, msg, cnt, S.bsSong, S.bsLvl, S.bsSabers, G.rank, G.newRec, G.failed, Math.floor(G.tN || 0)].join('|'); if (key === boardKey) return; boardKey = key;
  const g = bc.g, W = 1024, Hh = 512; g.clearRect(0, 0, W, Hh); ui.rr(g, 8, 8, W - 16, Hh - 16, 56); g.fillStyle = 'rgba(8,10,24,.88)'; g.fill(); g.lineWidth = 4; g.strokeStyle = 'rgba(120,140,255,.5)'; g.stroke();
  if (st === 'play') {
    ui.text(g, sg.name.toUpperCase() + '  ·  ' + df + '  ·  ' + mode, W / 2, 52, 34, 'rgba(225,232,255,.75)', 'center', 700);
    const prog = ch ? clamp(G.tN / ch.dur, 0, 1) : 0; ui.rr(g, 60, 84, W - 120, 8, 4); g.fillStyle = 'rgba(255,255,255,.15)'; g.fill(); ui.rr(g, 60, 84, Math.max(8, (W - 120) * prog), 8, 4); g.fillStyle = '#6ee7ff'; g.fill();
    ui.text(g, fmt(G.score), 60, 190, 118, '#fff', 'left', 800);
    ui.text(g, rk, 90, 318, 100, RANKC[rk], 'left', 800); ui.text(g, Math.round(pctNow * 100) + '%', 200, 322, 52, 'rgba(225,232,255,.8)', 'left', 700);
    ui.text(g, 'COMBO', W - 60, 268, 30, 'rgba(225,232,255,.7)', 'right', 700); ui.text(g, String(G.combo), W - 60, 338, 100, G.combo ? '#ffe36b' : 'rgba(255,255,255,.35)', 'right', 800);
    const m = BSM.multFor(G.combo); ui.text(g, '×' + m, W - 60, 150, 70, ['#fff', '#6ee7ff', '#4fe08a', '#ffd34d'][m === 1 ? 0 : m === 2 ? 1 : m === 4 ? 2 : 3], 'right', 800);
    ui.rr(g, 60, 410, W - 120, 36, 18); g.fillStyle = 'rgba(255,255,255,.14)'; g.fill(); const e = G.energy, eg = g.createLinearGradient(60, 0, W - 60, 0); eg.addColorStop(0, e < 0.3 ? '#ff4d4d' : '#ffb84d'); eg.addColorStop(1, '#4fe08a');
    if (e > 0.01) { ui.rr(g, 60, 410, Math.max(36, (W - 120) * e), 36, 18); g.fillStyle = eg; g.fill(); }
    if (msg) { g.fillStyle = 'rgba(8,10,24,.78)'; g.fillRect(40, 190, W - 80, 120); ui.text(g, msg, W / 2, 250, 46, '#ffe9a8', 'center', 700); }
  } else if (st === 'count') {
    ui.text(g, sg.name.toUpperCase(), W / 2, 66, 56, '#fff', 'center', 800); ui.text(g, df + '  ·  ' + mode + '  ·  ' + sg.bpm + ' BPM', W / 2, 122, 34, 'rgba(225,232,255,.75)', 'center', 600);
    ui.text(g, msg || String(cnt), W / 2, 285, msg ? 56 : 190, '#ffe36b', 'center', 800);
    ui.text(g, S.bsSabers === 1 ? 'Cor do seu sabre: corte todos os blocos' : 'Vermelho = mão esquerda · Azul = mão direita', W / 2, 438, 30, 'rgba(225,232,255,.75)', 'center', 600);
  } else if (st === 'results') {
    ui.text(g, G.failed ? 'FALHOU' : 'FASE COMPLETA', W / 2, 62, 54, G.failed ? '#ff6b6b' : '#4fe08a', 'center', 800);
    ui.text(g, sg.name + '  ·  ' + df + '  ·  ' + mode, W / 2, 112, 30, 'rgba(225,232,255,.75)', 'center', 600);
    ui.text(g, G.rank, 200, 270, 190, RANKC[G.rank], 'center', 800);
    ui.text(g, fmt(G.score), 640, 210, 100, '#fff', 'center', 800); ui.text(g, Math.round((G.pct || 0) * 100) + '% de precisão', 640, 285, 38, 'rgba(225,232,255,.85)', 'center', 700);
    ui.text(g, 'Maior combo ' + G.maxCombo + '  ·  Cortes ' + G.good + '/' + (ch ? ch.count : 0), 640, 340, 32, 'rgba(225,232,255,.75)', 'center', 600);
    ui.text(g, 'Erros ' + (G.bad + G.miss + G.bombs), 640, 382, 32, 'rgba(225,232,255,.6)', 'center', 600);
    ui.text(g, G.newRec ? 'NOVO RECORDE!' : 'Recorde: ' + fmt(bs.best()), W / 2, 440, 40, G.newRec ? '#ffd34d' : 'rgba(225,232,255,.7)', 'center', 800);
  } else {
    const gr = g.createLinearGradient(260, 0, 764, 0); gr.addColorStop(0, '#ff4d6d'); gr.addColorStop(1, '#4da3ff'); ui.text(g, 'BEAT SABER', W / 2, 92, 104, gr, 'center', 800);
    ui.text(g, sg.name + '  ·  ' + sg.bpm + ' BPM', W / 2, 190, 54, '#fff', 'center', 700);
    ui.text(g, df + '   ·   ' + mode, W / 2, 252, 42, '#ffe9a8', 'center', 700);
    ui.text(g, 'Recorde: ' + fmt(bs.best()), W / 2, 316, 34, 'rgba(225,232,255,.7)', 'center', 600);
    ui.text(g, msg || 'Corte um bloco com o sabre. Vermelho = mão esquerda, azul = direita.', W / 2, 400, 29, 'rgba(225,232,255,.8)', 'center', 600);
    ui.text(g, 'Corte JOGAR para começar', W / 2, 446, 34, '#4fe08a', 'center', 800);
  }
  bc.t.needsUpdate = true;
}
function placeBoard() {
  const play = bs.state === 'play', mode = play ? 'p' : 'l'; if (mode === boardMode) return; boardMode = mode;
  if (play) { board.position.set(0, 1.6 + 0.72, -3.0); board.scale.setScalar(1.45); } else { board.position.set(0, 1.6 + 0.3, -1.5); board.scale.setScalar(1); }
}
// ---------- visual dos sabres ----------
const tv = new T.Vector3(), yAx = new T.Vector3(0, 1, 0), pa2 = new T.Vector3(), pb2 = new T.Vector3();
function updSabers(dt) {
  const one = S.bsSabers === 1;
  for (let c = 0; c < 2; c++) {
    const o = sb[c], g = sabG[c], tr = trail[c], show = o.ok && (!one || c === bs.single); g.visible = show; tr.m.visible = show;
    if (!show) { tr.hist.length = 0; continue; }
    g.position.copy(o.base); g.quaternion.setFromUnitVectors(yAx, o.dir); g.userData.blade.scale.set(1, S.bsLen, 1);
    const sp = bladeVel(o, 1); o.spd += (sp - o.spd) * damp(14, dt);
    tr.hist.unshift({ ax: o.a.x + (o.b.x - o.a.x) * 0.3, ay: o.a.y + (o.b.y - o.a.y) * 0.3, az: o.a.z + (o.b.z - o.a.z) * 0.3, bx: o.b.x, by: o.b.y, bz: o.b.z }); if (tr.hist.length > TN) tr.hist.pop();
    const k = clamp((o.spd - 0.6) / 2.2, 0, 1), cr = (COL[c] >> 16 & 255) / 255, cg = (COL[c] >> 8 & 255) / 255, cb = (COL[c] & 255) / 255;
    for (let i = 0; i < TN; i++) {
      const h = tr.hist[Math.min(i, tr.hist.length - 1)], f = Math.pow(1 - i / (TN - 1), 1.6) * k * 0.9;
      tr.pos[i * 6] = h.ax; tr.pos[i * 6 + 1] = h.ay; tr.pos[i * 6 + 2] = h.az; tr.pos[i * 6 + 3] = h.bx; tr.pos[i * 6 + 4] = h.by; tr.pos[i * 6 + 5] = h.bz;
      tr.colr[i * 6] = tr.colr[i * 6 + 3] = cr * f; tr.colr[i * 6 + 1] = tr.colr[i * 6 + 4] = cg * f; tr.colr[i * 6 + 2] = tr.colr[i * 6 + 5] = cb * f;
    }
    tr.m.geometry.attributes.position.needsUpdate = true; tr.m.geometry.attributes.color.needsUpdate = true;
  }
}
// ---------- cenário com a batida ----------
function updScene(dt, t) {
  const ph = bs.state === 'play' ? BSM.beatPhase() : (lobbyT * 0.5) % 1, pulse = 0.3 + 0.7 * Math.exp(-ph * 4.5) + G.flash * 0.4; G.flash = Math.max(0, G.flash - dt * 2.5);
  const kk = Math.min(1.4, pulse); barR.color.setHex(0xff2447).multiplyScalar(kk); barB.color.setHex(0x1f8bff).multiplyScalar(kk);
  ringA.opacity = 0.35 + 0.65 * Math.min(1, pulse); ringB.opacity = 0.35 + 0.65 * Math.min(1, pulse);
  const sp = bs.state === 'play' ? G.speed * 0.5 : 2; rings.forEach(r => { r.position.z += dt * sp; if (r.position.z > 3) r.position.z -= 48; r.scale.setScalar(1 + (pulse - 0.3) * 0.05); });
  if (decor.visible) { grid.position.z = -34 + ((t * 0.001 * (bs.state === 'play' ? G.speed : 2)) % 1); plat.material.opacity = 0.5 + 0.4 * pulse; }
}
// ---------- por quadro ----------
VR.hook(45, (dt, t) => {
  if (!bs.on || !built) return;
  readSabers(dt);
  const st = bs.state, playing = st === 'play' || st === 'count';
  let msg = '';
  if (playing) {
    if (ui.menuOpen) msg = 'Jogo pausado: feche o menu';
    else { if (sb[0].ok || sb[1].ok) G.lost = 0; else { G.lost += dt; if (G.lost > 1.3) msg = 'Mostre a mão para continuar'; } }
  }
  bs.paused = msg; const paused = !!msg;
  if (paused !== wasPaused) { wasPaused = paused; if (st === 'play') paused ? BSM.pause() : BSM.resume(); }
  placeBoard();
  if (st === 'idle' || st === 'results') { updLobby(dt, t); drawBoard(msg); }
  else { tgt.forEach(x => { x.m.visible = false; }); }
  if (st === 'count') {
    if (!paused) { const p = G.countT; G.countT += dt; for (let k = 0; k < 3; k++) if (p < k && G.countT >= k) BSM.sfx('beep'); if (G.countT >= 3) { if (BSM.start(S.bsSong, S.bsVol)) { bs.state = 'play'; BSM.sfx('go'); boardKey = ''; } else { bs.stop(); ui.toast('Não foi possível abrir o áudio'); } } }
    drawBoard(msg);
  } else if (st === 'play') {
    if (!paused) {
      BSM.update(dt); G.tN = BSM.now() - BSM.lat() - S.bsLat / 1000; updateNotes(dt);
      if (bs.state === 'play' && G.ni >= G.chart.notes.length && !G.active.length && G.tN > G.chart.dur) finish(false);
    }
    drawBoard(msg);
  }
  updSabers(dt); updFx(dt); updScene(dt, t);
});
// ---------- API ----------
bs.enter = () => {
  if (!built) build(); bs.on = true; root.visible = true; bs.state = 'idle'; resetG(); lobbyT = 0; boardMode = ''; boardKey = ''; wasPaused = false; placeAll();
  VR.bounds = { x0: -0.15, x1: 0.15, z0: -0.15, z1: 0.15 }; VR.PL.x = 0; VR.PL.z = 0; orbMove(true);
};
bs.exit = () => { bs.on = false; BSM.stop(true); if (built) { root.visible = false; resetG(); } bs.state = 'idle'; orbMove(false); };
bs.setVisible = (on, pass) => { if (!built) return; root.visible = on; decor.visible = on && !pass; };
bs.scoreText = () => bs.state === 'play' ? fmt(G.score) + ' pts  ·  combo ' + G.combo : bs.state === 'results' ? fmt(G.score) + ' pts  (' + G.rank + ')' : '—';
bs.bestText = () => fmt(bs.best()) + ' pts';
bs.debug = () => ({ G, sb, tgt, finish, GZ });
bs.playing = () => bs.state === 'play' || bs.state === 'count';
addEventListener('keydown', e => {
  if (!bs.on || (e.target && e.target.tagName === 'INPUT')) return;
  if (e.code === 'Tab') { mouse.c ^= 1; e.preventDefault(); ui.toast('Mouse controla o sabre ' + (mouse.c ? 'azul' : 'vermelho'), 1500); }
  else if (e.code === 'Digit1' && !bs.playing()) { S.bsSabers = 1; VR.save(); boardKey = ''; ui.toast('1 sabre', 1500); }
  else if (e.code === 'Digit2' && !bs.playing()) { S.bsSabers = 2; VR.save(); boardKey = ''; ui.toast('2 sabres', 1500); }
  else if ((e.code === 'Enter' || e.code === 'Space') && !bs.playing() && !ui.menuOpen) { startNow(); e.preventDefault(); }
  else if (e.code === 'Escape' && bs.playing()) bs.stop();
});
VR.onRecenter.push(() => { if (built) { boardKey = ''; } });
})();
