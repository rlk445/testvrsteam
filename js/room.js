/* Quarto 3D interativo: janela com a vista do panorama, móveis, luzes, TV, porta, cortinas e objetos para pegar */
(() => {
'use strict';
const VR = window.VR, T = VR.T, S = VR.S, scene = VR.scene, P = VR.phys, damp = VR.damp, clamp = VR.clamp;
const room = VR.room = {};
let built = false, props = [];
const root = new T.Group(), propsG = new T.Group(); root.visible = propsG.visible = false; scene.add(root, propsG);
const lam = (c, o) => new T.MeshLambertMaterial(Object.assign({ color: c }, o || {}));
function box(par, w, h, d, x, y, z, mat, col) { const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); par.add(m); if (col) P.staticBox(x, y, z, w / 2, h / 2, d / 2); return m; }
function cyl(par, r0, r1, h, x, y, z, mat, seg) { const m = new T.Mesh(new T.CylinderGeometry(r0, r1, h, seg || 16), mat); m.position.set(x, y, z); par.add(m); return m; }
function cvs(w, h, rep) { const c = document.createElement('canvas'); c.width = w; c.height = h; const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; if (rep) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return { c, g: c.getContext('2d'), t }; }
const st = { desk: false, floor: false, tv: false, mon: true, door: 0, door0: 0, curtain: 0, curtain0: 0 };
const L = {};                                                                  // luzes
const cur = { ceil: 0, desk: 0, floor: 0, tv: 0, sun: 0.85, hemi: 0.65, pano: 1 };
let tvC, monC, clkC, clkT = 0, tvT = 0, doorP, curL, curR, hovers = [];
const inter = (meshes, click, onHover) => { meshes.forEach(m => { if (m.material) m.userData.c0 = m.material.color.clone(); }); return { meshes, click, hover: on => { meshes.forEach(m => { if (m.material && m.userData.c0) m.material.color.copy(m.userData.c0).multiplyScalar(on ? 1.28 : 1); }); onHover && onHover(on); } }; };

function build() {
  built = true; const shell = new T.Group(), furn = new T.Group(); root.add(shell, furn);
  // ----- chão de madeira, teto, paredes (a da frente tem a janela), rodapés -----
  const wood = cvs(512, 512, [5, 4.6]), g = wood.g, tones = ['#b58b5b', '#a97f50', '#bb9262', '#a27848', '#b0865a', '#ad8355', '#b88f60', '#a67c4d'];
  for (let i = 0; i < 8; i++) { g.fillStyle = tones[i]; g.fillRect(0, i * 64, 512, 64); g.fillStyle = 'rgba(70,40,15,.55)'; g.fillRect(0, i * 64, 512, 2); const o = (i * 173) % 512; g.fillRect(o, i * 64, 2, 64); g.fillStyle = 'rgba(255,255,255,.04)'; for (let k = 0; k < 9; k++) g.fillRect((k * 97 + i * 31) % 512, i * 64 + 10 + (k * 13) % 44, 70, 2); }
  const fl = new T.Mesh(new T.PlaneGeometry(5, 4.6), new T.MeshLambertMaterial({ map: wood.t })); fl.rotation.x = -Math.PI / 2; shell.add(fl);
  const ce = new T.Mesh(new T.PlaneGeometry(5, 4.6), lam(0xf4f1ea)); ce.rotation.x = Math.PI / 2; ce.position.y = 2.7; shell.add(ce); P.staticBox(0, 2.78, 0, 2.6, 0.08, 2.4);
  const wallM = lam(0xe8e0d2), frontM = lam(0xc7d2df), whiteM = lam(0xf5f2ec);
  box(shell, 0.1, 2.7, 4.7, -2.55, 1.35, 0, wallM, 1); box(shell, 0.1, 2.7, 4.7, 2.55, 1.35, 0, wallM, 1); box(shell, 5.2, 2.7, 0.1, 0, 1.35, 2.35, wallM, 1);
  box(shell, 2.2, 2.7, 0.1, -1.5, 1.35, -2.35, frontM, 1); box(shell, 1.2, 2.7, 0.1, 2.0, 1.35, -2.35, frontM, 1); box(shell, 1.8, 0.95, 0.1, 0.5, 0.475, -2.35, frontM, 1); box(shell, 1.8, 0.55, 0.1, 0.5, 2.425, -2.35, frontM, 1);
  P.staticBox(0.5, 1.55, -2.35, 0.9, 0.6, 0.02);                              // "vidro" invisível: nada sai pela janela
  box(shell, 4.9, 0.1, 0.03, 0, 0.05, -2.285, whiteM); box(shell, 4.9, 0.1, 0.03, 0, 0.05, 2.285, whiteM); box(shell, 0.03, 0.1, 4.5, -2.485, 0.05, 0, whiteM); box(shell, 0.03, 0.1, 4.5, 2.485, 0.05, 0, whiteM);
  // janela: moldura, divisórias e peitoril
  box(shell, 1.92, 0.07, 0.1, 0.5, 2.17, -2.3, whiteM); box(shell, 1.92, 0.07, 0.1, 0.5, 0.93, -2.3, whiteM); box(shell, 0.07, 1.3, 0.1, -0.42, 1.55, -2.3, whiteM); box(shell, 0.07, 1.3, 0.1, 1.42, 1.55, -2.3, whiteM);
  box(shell, 0.04, 1.2, 0.05, 0.5, 1.55, -2.3, whiteM); box(shell, 1.8, 0.04, 0.05, 0.5, 1.55, -2.3, whiteM); box(shell, 2.1, 0.04, 0.3, 0.5, 0.97, -2.2, whiteM);
  // cortinas (abrem/fecham)
  const cm = lam(0xb98560); curL = new T.Group(); curR = new T.Group(); curL.position.set(-0.78, 1.5, -2.2); curR.position.set(1.78, 1.5, -2.2);
  const cl = box(curL, 0.36, 2.35, 0.07, 0.18, 0, 0, cm), cr = box(curR, 0.36, 2.35, 0.07, -0.18, 0, 0, cm.clone()); shell.add(curL, curR); box(shell, 2.7, 0.03, 0.03, 0.5, 2.68, -2.2, lam(0x333333));
  // pôsteres e relógio
  function poster(w, h, x, y, z, ry, seed) { const p = cvs(256, Math.round(256 * h / w)), q = p.g, hh = p.c.height; const gr = q.createLinearGradient(0, 0, 0, hh); gr.addColorStop(0, seed ? '#2b3a67' : '#f2a65a'); gr.addColorStop(1, seed ? '#e07a5f' : '#3d405b'); q.fillStyle = gr; q.fillRect(0, 0, 256, hh); q.fillStyle = 'rgba(255,255,255,.85)'; q.beginPath(); q.arc(128, hh * 0.42, 46, 0, 7); q.fill(); q.fillStyle = seed ? '#1b2440' : '#25283d'; q.beginPath(); q.moveTo(0, hh); q.lineTo(70, hh * 0.62); q.lineTo(130, hh * 0.82); q.lineTo(190, hh * 0.58); q.lineTo(256, hh); q.fill();
    const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: p.t })); m.position.set(x, y, z); m.rotation.y = ry; shell.add(m); const f = box(shell, w + 0.05, h + 0.05, 0.02, x, y, z - Math.cos(ry) * 0.012, lam(0x222222)); f.rotation.y = ry; f.position.x = x + Math.sin(ry) * -0.012; }
  poster(0.6, 0.85, -1.0, 1.55, 2.28, Math.PI, 0); poster(1.0, 0.7, -2.48, 1.55, 0.6, Math.PI / 2, 1);
  clkC = cvs(128, 128); const clk = new T.Mesh(new T.CircleGeometry(0.15, 32), new T.MeshBasicMaterial({ map: clkC.t })); clk.position.set(0.5, 2.43, -2.245); shell.add(clk);
  // ----- porta que abre, com interruptor ao lado -----
  box(shell, 0.96, 2.1, 0.02, 1.3, 1.05, 2.285, lam(0x0b0b12)); box(shell, 0.07, 2.12, 0.05, 0.8, 1.06, 2.27, whiteM); box(shell, 0.07, 2.12, 0.05, 1.8, 1.06, 2.27, whiteM); box(shell, 1.07, 0.07, 0.05, 1.3, 2.13, 2.27, whiteM);
  doorP = new T.Group(); doorP.position.set(1.77, 0, 2.24); const dm = box(doorP, 0.94, 2.05, 0.045, -0.47, 1.025, 0, lam(0xc9a27a)); box(doorP, 0.05, 0.05, 0.08, -0.85, 1.0, 0, lam(0xbfc3c9)); shell.add(doorP);
  const sw = box(shell, 0.09, 0.13, 0.015, 0.55, 1.28, 2.285, lam(0xf2f2f2));
  // ----- mesa com monitor, teclado, luminária e cadeira -----
  const deskM = lam(0x8a5a33), blk = lam(0x1d1f24);
  box(furn, 1.5, 0.05, 0.65, 0.5, 0.75, -1.95, deskM, 1); [[-0.2, -1.7], [1.2, -1.7], [-0.2, -2.2], [1.2, -2.2]].forEach(([x, z]) => box(furn, 0.05, 0.75, 0.05, x, 0.375, z, deskM));
  box(furn, 0.18, 0.015, 0.14, 0.25, 0.785, -2.1, blk); box(furn, 0.04, 0.2, 0.03, 0.25, 0.89, -2.12, blk); monC = cvs(256, 144);
  const mon = box(furn, 0.64, 0.38, 0.03, 0.25, 1.1, -2.1, blk), monS = new T.Mesh(new T.PlaneGeometry(0.6, 0.34), new T.MeshBasicMaterial({ map: monC.t })); monS.position.set(0.25, 1.1, -2.083); furn.add(monS);
  box(furn, 0.42, 0.02, 0.14, 0.25, 0.775, -1.78, lam(0x2a2d33)); box(furn, 0.06, 0.02, 0.1, 0.62, 0.775, -1.78, lam(0x2a2d33));
  const lampM = lam(0xdddddd), shadeD = lam(0xffe2a8); box(furn, 0.12, 0.02, 0.12, 1.0, 0.785, -2.05, lam(0x333333)); const arm = box(furn, 0.02, 0.3, 0.02, 1.0, 0.94, -2.05, lampM); const shD = cyl(furn, 0.04, 0.1, 0.1, 1.0, 1.12, -2.05, shadeD);
  box(furn, 0.46, 0.05, 0.46, 0.25, 0.45, -1.3, lam(0x3a4a66)); box(furn, 0.46, 0.5, 0.05, 0.25, 0.72, -1.07, lam(0x3a4a66)); cyl(furn, 0.03, 0.03, 0.43, 0.25, 0.22, -1.3, lam(0x222222)); cyl(furn, 0.22, 0.22, 0.03, 0.25, 0.015, -1.3, lam(0x222222), 6);
  // ----- estante com livros -----
  const shM = lam(0x6e4a2b); box(furn, 0.04, 1.9, 0.32, -2.2, 0.95, -2.14, shM, 1); box(furn, 0.04, 1.9, 0.32, -1.2, 0.95, -2.14, shM, 1); box(furn, 1.04, 1.9, 0.02, -1.7, 0.95, -2.28, shM);
  [0.04, 0.5, 0.95, 1.4, 1.88].forEach(y => box(furn, 1.0, 0.03, 0.32, -1.7, y, -2.14, shM, 1));
  const bc = [0xc0392b, 0x2980b9, 0x27ae60, 0xf39c12, 0x8e44ad, 0x16a085, 0xd35400, 0x34495e];
  [0.545, 1.435].forEach((y, r) => { let x = -2.15; for (let i = 0; i < 12 && x < -1.3; i++) { const w = 0.03 + ((i * 7 + r * 3) % 4) * 0.012, h = 0.2 + ((i * 5 + r) % 5) * 0.03; box(furn, w, h, 0.2, x + w / 2, y + h / 2, -2.14, lam(bc[(i + r * 3) % bc.length])); x += w + 0.004; } });
  // ----- sofá, tapete, TV, abajur de chão, planta -----
  const sofaM = lam(0x5b6f8a), cushM = lam(0x6d83a1);
  box(furn, 0.9, 0.42, 2.0, -2.05, 0.21, 0.5, sofaM, 1); box(furn, 0.2, 0.55, 2.0, -2.4, 0.69, 0.5, sofaM, 1); box(furn, 0.9, 0.62, 0.2, -2.05, 0.31 + 0.1, -0.4, sofaM, 1); box(furn, 0.9, 0.62, 0.2, -2.05, 0.41, 1.4, sofaM, 1);
  box(furn, 0.62, 0.1, 0.85, -1.9, 0.47, 0.05, cushM); box(furn, 0.62, 0.1, 0.85, -1.9, 0.47, 0.95, cushM);
  const rug = cvs(256, 180), rg = rug.g; rg.fillStyle = '#7b3f4a'; rg.fillRect(0, 0, 256, 180); rg.strokeStyle = '#e7d3a8'; rg.lineWidth = 6; rg.strokeRect(10, 10, 236, 160); rg.strokeStyle = '#c98f5a'; rg.lineWidth = 3; rg.strokeRect(22, 22, 212, 136);
  for (let i = 0; i < 7; i++) { rg.beginPath(); rg.moveTo(128 + (i - 3) * 28, 90 - 40); rg.lineTo(128 + (i - 3) * 28 + 14, 90); rg.lineTo(128 + (i - 3) * 28, 90 + 40); rg.lineTo(128 + (i - 3) * 28 - 14, 90); rg.closePath(); rg.fillStyle = i % 2 ? '#e7d3a8' : '#c98f5a'; rg.fill(); }
  const rugM = new T.Mesh(new T.BoxGeometry(2.4, 0.02, 1.7), [lam(0x7b3f4a), lam(0x7b3f4a), new T.MeshLambertMaterial({ map: rug.t }), lam(0x7b3f4a), lam(0x7b3f4a), lam(0x7b3f4a)]); rugM.position.set(0, 0.011, 0.2); furn.add(rugM);
  box(furn, 0.4, 0.5, 1.6, 2.28, 0.25, -0.2, lam(0x4b3626), 1); box(furn, 0.05, 0.75, 1.3, 2.4, 1.0, -0.2, blk); tvC = cvs(320, 180);
  const tvS = new T.Mesh(new T.PlaneGeometry(1.22, 0.69), new T.MeshBasicMaterial({ map: tvC.t })); tvS.rotation.y = -Math.PI / 2; tvS.position.set(2.372, 1.0, -0.2); furn.add(tvS);
  const flM = lam(0x2b2b2b), flShade = lam(0xfff0cf); cyl(furn, 0.15, 0.17, 0.03, -2.1, 0.015, -1.3, flM); cyl(furn, 0.012, 0.012, 1.5, -2.1, 0.78, -1.3, flM); const flS = cyl(furn, 0.15, 0.24, 0.3, -2.1, 1.65, -1.3, flShade, 20);
  const pot = cyl(furn, 0.15, 0.11, 0.26, 2.1, 0.13, -1.9, lam(0xb5651d)); for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, l = new T.Mesh(new T.SphereGeometry(0.11, 8, 6), lam(i % 2 ? 0x3f9a4a : 0x2f7d3a)); l.scale.set(0.8, 1.6, 0.5); l.position.set(2.1 + Math.cos(a) * 0.13, 0.55 + (i % 3) * 0.14, -1.9 + Math.sin(a) * 0.13); l.rotation.set(Math.sin(a) * 0.5, a, Math.cos(a) * 0.5); furn.add(l); }
  // ----- lâmpada do teto e luzes -----
  const pendM = new T.MeshLambertMaterial({ color: 0xfff6dd, emissive: 0xffe9b0 }); cyl(shell, 0.008, 0.008, 0.3, 0, 2.55, 0.1, lam(0x222222), 6); const pend = new T.Mesh(new T.SphereGeometry(0.14, 20, 14), pendM); pend.position.set(0, 2.36, 0.1); shell.add(pend);
  L.ceil = new T.PointLight(0xfff0d8, 0, 11, 1.2); L.ceil.position.set(0, 2.3, 0.1); L.desk = new T.PointLight(0xffd9a0, 0, 3.2, 1.6); L.desk.position.set(1.0, 1.0, -1.9);
  L.floor = new T.PointLight(0xffe3b0, 0, 4, 1.4); L.floor.position.set(-1.9, 1.5, -1.2); L.tv = new T.PointLight(0x6aa0ff, 0, 3.5, 1.6); L.tv.position.set(1.9, 1.0, -0.2); root.add(L.ceil, L.desk, L.floor, L.tv);
  room.mats = { pendM, shD: shD.material, flS: flS.material };
  // ----- o que reage ao ponteiro (apontar e pinçar) -----
  const toggleCeil = () => room.setCeiling(!S.ceiling);
  VR.world.setInteractives([
    inter([sw, pend], toggleCeil),
    inter([shD, arm], () => { st.desk = !st.desk; VR.ui.sfx(st.desk ? 800 : 560, 0.06); }),
    inter([flS], () => { st.floor = !st.floor; VR.ui.sfx(st.floor ? 800 : 560, 0.06); }),
    inter([tvS], () => { st.tv = !st.tv; if (st.tv) drawTV(0); else { tvC.g.fillStyle = '#05060a'; tvC.g.fillRect(0, 0, 320, 180); tvC.t.needsUpdate = true; } VR.ui.sfx(st.tv ? 800 : 560, 0.08); }),
    inter([monS], () => { st.mon = !st.mon; drawMon(); VR.ui.sfx(700, 0.05); }),
    inter([dm], () => { st.door0 = st.door0 ? 0 : 1; VR.ui.sfx(420, 0.12); }),
    inter([cl, cr], () => { st.curtain0 = st.curtain0 ? 0 : 1; VR.ui.sfx(480, 0.1); })
  ]);
  tvC.g.fillStyle = '#05060a'; tvC.g.fillRect(0, 0, 320, 180); tvC.t.needsUpdate = true; drawMon(); drawClock();
}
// ----- telas e relógio -----
function drawTV(t) {
  const g = tvC.g; g.fillStyle = '#0d1020'; g.fillRect(0, 0, 320, 180);
  for (let i = 0; i < 7; i++) { g.fillStyle = 'hsl(' + ((t * 0.04 + i * 52) % 360) + ',72%,55%)'; g.fillRect(i * 320 / 7, 0, 320 / 7 + 1, 110); }
  g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, 110, 320, 70); g.beginPath(); g.arc(160 + Math.sin(t * 0.0021) * 120, 148, 14, 0, 7); g.fillStyle = '#fff'; g.fill();
  g.font = '700 22px sans-serif'; g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText('VR TV', 160, 132); tvC.t.needsUpdate = true;
}
function drawMon() {
  const g = monC.g, d = new Date(); g.fillStyle = st.mon ? '#12233d' : '#050608'; g.fillRect(0, 0, 256, 144);
  if (st.mon) { g.fillStyle = '#8fd0ff'; g.font = '700 46px sans-serif'; g.textAlign = 'center'; g.fillText(String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'), 128, 74); g.font = '18px sans-serif'; g.fillStyle = '#9bb'; g.fillText('Quarto VR', 128, 104); }
  monC.t.needsUpdate = true;
}
function drawClock() {
  const g = clkC.g, d = new Date(); g.fillStyle = '#f7f4ee'; g.fillRect(0, 0, 128, 128); g.strokeStyle = '#222'; g.lineWidth = 4; g.beginPath(); g.arc(64, 64, 60, 0, 7); g.stroke();
  const hand = (a, l, w) => { g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(64, 64); g.lineTo(64 + Math.sin(a) * l, 64 - Math.cos(a) * l); g.stroke(); };
  for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; g.lineWidth = 3; g.beginPath(); g.moveTo(64 + Math.sin(a) * 52, 64 - Math.cos(a) * 52); g.lineTo(64 + Math.sin(a) * 58, 64 - Math.cos(a) * 58); g.stroke(); }
  hand((d.getHours() % 12 + d.getMinutes() / 60) * Math.PI / 6, 30, 6); hand((d.getMinutes() + d.getSeconds() / 60) * Math.PI / 30, 44, 4); g.strokeStyle = '#c0392b'; hand(d.getSeconds() * Math.PI / 30, 48, 2); clkC.t.needsUpdate = true;
}
// ----- objetos que você pode pegar, empurrar e jogar -----
function makeProps() {
  props = []; const M = P.M;
  const add = (mesh, shapes, mass, pos, o) => { propsG.add(mesh); const p = P.addProp(Object.assign({ mesh, shapes, mass, pos, name: '' }, o)); return p; };
  // bola de basquete
  const bt = cvs(256, 128), bg = bt.g; bg.fillStyle = '#d9692a'; bg.fillRect(0, 0, 256, 128); bg.strokeStyle = '#1a1008'; bg.lineWidth = 4; [64, 192].forEach(x => { bg.beginPath(); bg.moveTo(x, 0); bg.lineTo(x, 128); bg.stroke(); }); bg.beginPath(); bg.moveTo(0, 64); bg.lineTo(256, 64); bg.stroke(); [0, 128, 256].forEach(x => { bg.beginPath(); bg.arc(x, 64, 46, -1.2, 1.2); bg.stroke(); bg.beginPath(); bg.arc(x, 64, 46, Math.PI - 1.2, Math.PI + 1.2); bg.stroke(); });
  add(new T.Mesh(new T.SphereGeometry(0.12, 24, 16), new T.MeshLambertMaterial({ map: bt.t })), [{ shape: new CANNON.Sphere(0.12) }], 0.6, [0.4, 0.14, 0.35], { mat: M.ball, r: 0.12, name: 'bola' });
  // bola de praia
  const pc = cvs(128, 64), pg = pc.g; ['#e74c3c', '#f1c40f', '#3498db', '#ecf0f1', '#2ecc71', '#e67e22'].forEach((c, i) => { pg.fillStyle = c; pg.fillRect(i * 128 / 6, 0, 128 / 6 + 1, 64); });
  add(new T.Mesh(new T.SphereGeometry(0.17, 20, 14), new T.MeshLambertMaterial({ map: pc.t })), [{ shape: new CANNON.Sphere(0.17) }], 0.12, [-0.55, 0.19, 0.95], { mat: M.ball, r: 0.17, damping: 0.25, name: 'bola de praia' });
  // cubos em pirâmide
  const cc = [0xe74c3c, 0xf1c40f, 0x3498db, 0x2ecc71, 0x9b59b6, 0xe67e22]; [[-0.38, -0.2], [-0.28, -0.2], [-0.18, -0.2], [-0.33, -0.2], [-0.23, -0.2], [-0.28, -0.2]].forEach((xz, i) => {
    const lvl = i < 3 ? 0 : i < 5 ? 1 : 2; add(new T.Mesh(new T.BoxGeometry(0.095, 0.095, 0.095), lam(cc[i])), [{ shape: new CANNON.Box(new CANNON.Vec3(0.0475, 0.0475, 0.0475)) }], 0.25, [xz[0] - 0.3, 0.048 + lvl * 0.1, xz[1] + 0.35], { r: 0.07, name: 'cubo' }); });
  // livros na estante, caneca na mesa, urso e almofadas no sofá
  [0xc0392b, 0x2c3e50, 0x16a085].forEach((c, i) => add(new T.Mesh(new T.BoxGeometry(0.2, 0.035, 0.14), lam(c)), [{ shape: new CANNON.Box(new CANNON.Vec3(0.1, 0.0175, 0.07)) }], 0.3, [-1.62, 0.983 + i * 0.037, -2.14], { r: 0.1, name: 'livro' }));
  const mug = new T.Group(); mug.add(new T.Mesh(new T.CylinderGeometry(0.04, 0.036, 0.09, 16), lam(0xf4f4f4))); const hd = new T.Mesh(new T.TorusGeometry(0.025, 0.007, 8, 12, Math.PI), lam(0xf4f4f4)); hd.position.x = 0.04; hd.rotation.z = -Math.PI / 2; mug.add(hd);
  add(mug, [{ shape: new CANNON.Box(new CANNON.Vec3(0.045, 0.045, 0.045)) }], 0.25, [0.85, 0.82, -1.85], { r: 0.05, name: 'caneca' });
  const bear = new T.Group(), bm = lam(0xa66a3a), sp = (r, x, y, z) => { const m = new T.Mesh(new T.SphereGeometry(r, 14, 10), bm); m.position.set(x, y, z); bear.add(m); };
  sp(0.11, 0, 0, 0); sp(0.08, 0, 0.16, 0); sp(0.03, -0.06, 0.23, 0); sp(0.03, 0.06, 0.23, 0); sp(0.035, -0.1, -0.08, 0.05); sp(0.035, 0.1, -0.08, 0.05); sp(0.03, 0, 0.15, 0.075);
  add(bear, [{ shape: new CANNON.Sphere(0.12), offset: [0, 0, 0] }, { shape: new CANNON.Sphere(0.09), offset: [0, 0.16, 0] }], 0.3, [-2.0, 0.6, -0.15], { r: 0.15, name: 'urso' });
  [0.0, 1.0].forEach((dz, i) => add(new T.Mesh(new T.BoxGeometry(0.42, 0.13, 0.4), lam(i ? 0xe9c46a : 0xe76f51)), [{ shape: new CANNON.Box(new CANNON.Vec3(0.21, 0.065, 0.2)) }], 0.5, [-2.1, 0.58, 0.05 + dz], { r: 0.2, damping: 0.2, name: 'almofada' }));
  props = P.props;
}
// ----- luzes (dia/noite, interruptor, abajures) -----
room.applyLights = snap => {
  const night = S.night, c = cur;
  VR.hemi.color.set(night ? 0x2c3a5a : 0xfff2e0); VR.hemi.groundColor.set(night ? 0x14110e : 0x7a6a58); VR.sun.color.set(0xfff1d6); VR.sun.position.set(1.5, 4, -8);
  room._t = { ceil: S.ceiling ? (night ? 1.15 : 0.8) : 0, desk: st.desk ? 0.9 : 0, floor: st.floor ? 0.9 : 0, tv: st.tv ? 0.7 : 0, sun: night ? 0 : (st.curtain0 ? 0.25 : 0.85), hemi: night ? 0.28 : 0.62, pano: night ? 0.1 : 1 };
  if (snap) Object.assign(cur, room._t);
  room._apply();
};
room._apply = () => {
  const c = cur; VR.hemi.intensity = c.hemi; VR.sun.intensity = c.sun; if (L.ceil) { L.ceil.intensity = c.ceil; L.desk.intensity = c.desk; L.floor.intensity = c.floor; L.tv.intensity = c.tv; }
  const m = room.mats; if (m) { m.pendM.emissive.setScalar(S.ceiling ? 1 : 0).multiply(new T.Color(1, 0.91, 0.69)); m.shD.emissive.set(st.desk ? 0xffc873 : 0x000000); m.flS.emissive.set(st.floor ? 0xffc873 : 0x000000); }
  const pm = VR.pano.mesh; if (pm) pm.material.color.setRGB(c.pano, c.pano, Math.min(1, c.pano * 1.25));
};
room.setCeiling = v => { S.ceiling = v; VR.save(); room.applyLights(false); VR.ui.sfx(v ? 820 : 560, 0.06); };
room.setNight = v => { S.night = v; VR.save(); room.applyLights(false); };
room.setVisible = (on, pass) => {
  root.visible = on && !pass; propsG.visible = on; if (on && built) { P.setStaticsOn(!pass); } 
};
room.reset = () => { P.resetProps(); };
room.enter = () => {
  if (!built) build(); makeProps(); P.setStaticsOn(true);
  VR.bounds = { x0: -2.0, x1: 1.9, z0: -1.4, z1: 1.9 }; VR.PL.x = 0; VR.PL.z = 0.5; room.applyLights(true);
  VR.world.setInteractives(room._inter || VR.world.interactives);
};
room.exit = () => { room._inter = VR.world.interactives; VR.world.setInteractives([]); P.removeProps(); P.setStaticsOn(false); root.visible = propsG.visible = false; const pm = VR.pano.mesh; if (pm) pm.material.color.setRGB(1, 1, 1); };
room.update = (dt, t) => {
  const k = damp(7, dt); for (const n in cur) if (room._t) cur[n] += (room._t[n] - cur[n]) * k; room._apply();
  if (room._t) { room._t.desk = st.desk ? 0.9 : 0; room._t.floor = st.floor ? 0.9 : 0; room._t.tv = st.tv ? 0.7 : 0; room._t.ceil = S.ceiling ? (S.night ? 1.15 : 0.8) : 0; room._t.sun = S.night ? 0 : (st.curtain0 ? 0.25 : 0.85); }
  st.door += (st.door0 - st.door) * damp(5, dt); st.curtain += (st.curtain0 - st.curtain) * damp(4, dt);
  if (doorP) doorP.rotation.y = -1.75 * st.door; if (curL) { curL.scale.x = 1 + 2.5 * st.curtain; curR.scale.x = 1 + 2.5 * st.curtain; }
  if (st.tv && t - tvT > 110) { tvT = t; drawTV(t); }
  if (t - clkT > 1000) { clkT = t; drawClock(); if (st.mon) drawMon(); }
};
})();
