/* Ping-Pong contra a IA: a raquete fica presa à sua mão (aberta, sem precisar fechar), mesa, bola, placar e dificuldade ajustável.
   A lógica da partida (bola, regras, IA) está em pongsim.js; aqui ficam o visual, a mão → raquete e a ligação com o menu. */
(() => {
'use strict';
const VR = window.VR, T = VR.T, S = VR.S, H = VR.H, scene = VR.scene, headQ = VR.headQ, HEAD = VR.HEAD, ui = VR.ui, SIM = window.PongSim, clamp = VR.clamp, damp = VR.damp;
const { ZP, ZA, ZN, NH, BR, HW, AIZ, HZ } = SIM;
const sim = new SIM.Sim();
const pong = VR.pong = { sim, on: false, hand: null, ty: 1.0, zOff: 0, paused: '' };
let built = false, root, tbl, legs = [], ballM, shadow, ring, padG, padFace, aiG, aiFace, robot, eyeL, eyeR, board, bc, boardKey = '', floorM, floorIn;
const PR = 0.1, HIT_R = 0.15;                                                // raio visual da raquete e raio usado na batida (um pouco mais generoso)
const lam = (c, o) => new T.MeshLambertMaterial(Object.assign({ color: c }, o || {}));
const bas = (c, o) => new T.MeshBasicMaterial(Object.assign({ color: c }, o || {}));
const box = (par, w, h, d, x, y, z, mat) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); par.add(m); return m; };

function makePaddle(red, black) {                                            // face vermelha em +Z, preta em −Z, cabo para −Y
  const g = new T.Group(), cyl = (r, h, mat, z) => { const m = new T.Mesh(new T.CylinderGeometry(r, r, h, 36), mat); m.rotation.x = Math.PI / 2; m.position.z = z; g.add(m); return m; };
  const face = lam(red, { emissive: 0x000000 });
  cyl(PR + 0.003, 0.012, lam(0xd9b38c), 0); cyl(PR, 0.006, face, 0.008); cyl(PR, 0.006, lam(black), -0.008);
  box(g, 0.03, 0.11, 0.02, 0, -(PR + 0.045), 0, lam(0xc79b6a)); box(g, 0.034, 0.03, 0.024, 0, -(PR + 0.012), 0, lam(0xa9784a));
  g.userData.face = face; return g;
}
function build() {
  built = true; root = new T.Group(); root.visible = false; scene.add(root);
  // chão
  floorM = new T.Mesh(new T.CircleGeometry(7, 56), lam(0x252c3a)); floorM.rotation.x = -Math.PI / 2; floorM.position.y = 0.001; root.add(floorM);
  floorIn = new T.Mesh(new T.CircleGeometry(3.3, 56), lam(0x2f3a4f)); floorIn.rotation.x = -Math.PI / 2; floorIn.position.y = 0.002; root.add(floorIn);
  // mesa (em coordenadas locais da simulação: y = 0 é o tampo)
  tbl = new T.Group(); root.add(tbl);
  const cz = (ZP + ZA) / 2, L = ZP - ZA, topM = lam(0x1458b8), wht = lam(0xf4f6fa), leg = lam(0x23272e);
  box(tbl, HW * 2, 0.04, L, 0, -0.02, cz, topM);
  box(tbl, HW * 2, 0.003, 0.014, 0, 0.0016, ZP - 0.007, wht); box(tbl, HW * 2, 0.003, 0.014, 0, 0.0016, ZA + 0.007, wht);
  box(tbl, 0.014, 0.003, L, -HW + 0.007, 0.0016, cz, wht); box(tbl, 0.014, 0.003, L, HW - 0.007, 0.0016, cz, wht); box(tbl, 0.006, 0.003, L, 0, 0.0016, cz, wht);
  box(tbl, HW * 2 + 0.02, 0.012, 0.03, 0, -0.046, cz, lam(0x0e3d80)).scale.z = L / 0.03;
  [[-HW + 0.07, ZP - 0.07], [HW - 0.07, ZP - 0.07], [-HW + 0.07, ZA + 0.07], [HW - 0.07, ZA + 0.07]].forEach(([x, z]) => { const m = box(tbl, 0.055, 1, 0.055, x, -0.5, z, leg); legs.push(m); });
  // rede
  const nc = document.createElement('canvas'); nc.width = 128; nc.height = 16; const ng = nc.getContext('2d'); ng.fillStyle = 'rgba(235,240,250,.18)'; ng.fillRect(0, 0, 128, 16); ng.strokeStyle = 'rgba(245,248,255,.75)'; ng.lineWidth = 1;
  for (let i = 0; i <= 128; i += 4) { ng.beginPath(); ng.moveTo(i, 0); ng.lineTo(i, 16); ng.stroke(); } for (let j = 0; j <= 16; j += 4) { ng.beginPath(); ng.moveTo(0, j); ng.lineTo(128, j); ng.stroke(); }
  const nt = new T.CanvasTexture(nc); nt.colorSpace = T.SRGBColorSpace;
  const net = new T.Mesh(new T.PlaneGeometry(HW * 2 + 0.16, NH), new T.MeshBasicMaterial({ map: nt, transparent: true, side: T.DoubleSide, depthWrite: false, fog: false })); net.position.set(0, NH / 2, ZN); tbl.add(net);
  box(tbl, HW * 2 + 0.16, 0.014, 0.008, 0, NH, ZN, wht);
  [-1, 1].forEach(sg => { const p = new T.Mesh(new T.CylinderGeometry(0.008, 0.008, NH + 0.04, 10), lam(0x888d96)); p.position.set(sg * (HW + 0.08), (NH + 0.04) / 2 - 0.02, ZN); tbl.add(p); });
  // bola, sombra e anel do saque
  ballM = new T.Mesh(new T.SphereGeometry(BR, 20, 14), lam(0xfff1dc, { emissive: 0x4a3b22 })); tbl.add(ballM);
  shadow = new T.Mesh(new T.CircleGeometry(BR * 1.25, 18), bas(0x000000, { transparent: true, opacity: 0.35, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; tbl.add(shadow);
  ring = new T.Mesh(new T.RingGeometry(0.085, 0.1, 40), bas(0x6ee7ff, { transparent: true, opacity: 0.85, depthTest: false, depthWrite: false, side: T.DoubleSide })); ring.renderOrder = 20; ring.visible = false; tbl.add(ring);
  // raquete do jogador (mundo) e da IA (mesa) + robô
  padG = makePaddle(0xd7263d, 0x15161a); padG.visible = false; padFace = padG.userData.face; root.add(padG);
  aiG = makePaddle(0x2d7ff9, 0x15161a); aiFace = aiG.userData.face; tbl.add(aiG);
  robot = new T.Group(); tbl.add(robot);
  box(robot, 0.5, 0.62, 0.26, 0, 0.1, 0, lam(0x39424f)); box(robot, 0.34, 0.26, 0.24, 0, 0.55, 0, lam(0x4a5667)); box(robot, 0.04, 0.12, 0.04, 0, 0.74, 0, lam(0x4a5667));
  const eye = lam(0x6ee7ff, { emissive: 0x2a8fa8 }); eyeL = box(robot, 0.07, 0.05, 0.02, -0.08, 0.56, 0.125, eye); eyeR = box(robot, 0.07, 0.05, 0.02, 0.08, 0.56, 0.125, eye);
  robot.position.set(0, -0.1, ZA - 0.55); box(robot, 0.12, 0.5, 0.12, 0, -0.35, 0, lam(0x2c333d));
  // placar
  bc = ui.mkCv(768, 256); board = new T.Mesh(new T.PlaneGeometry(1.9, 0.633), new T.MeshBasicMaterial({ map: bc.t, transparent: true, depthWrite: false, toneMapped: false, fog: false })); board.position.set(0, 1.2, ZA - 0.5); board.renderOrder = 9; tbl.add(board);
  placeTable(true);
}
// ---------- posição da mesa: altura e distância se ajustam à sua mão entre um ponto e outro ----------
function placeTable(snap) {
  const auto = S.pongAuto && avg.n > 0, free = snap || sim.phase === 'ready' || sim.phase === 'point' || sim.phase === 'over';
  const ty = auto ? clamp(avg.y - 0.25, 0.8, 1.5) : S.pongH, zo = auto ? clamp(avg.z - HZ, -0.7, 0.2) : -0.35;   // a sua mão fica em média em z = HZ (no meio do seu lado da mesa)
  if (snap || !auto) { pong.ty = ty; pong.zOff = zo; }                        // manual: vale direto (o menu pausa o jogo)
  else if (free) { const k = 0.02; pong.ty += clamp(ty - pong.ty, -k, k); pong.zOff += clamp(zo - pong.zOff, -k, k); }   // automático: só se mexe entre um ponto e outro
  tbl.position.set(0, pong.ty, pong.zOff);
  legs.forEach(m => { m.scale.y = pong.ty; m.position.y = -pong.ty / 2 - 0.04; });
}
// ---------- mão → raquete ----------
const avg = { y: 1.2, z: -0.65, n: 0 };
const pad = { ok: false, c: [0, 0, 0], pc: [0, 0, 0], pw: [0, 0, 0], n: [0, 0, -1], v: [0, 0, 0], r: HIT_R };
const pc = new T.Vector3(), cW = new T.Vector3(), prevW = new T.Vector3(), vel = new T.Vector3(), padQ = new T.Quaternion(), qW = new T.Quaternion(), ax = new T.Vector3(), az = new T.Vector3(), tmp = new T.Vector3();
let havePrev = false;
const mouse = { x: 0, y: 0, t: -1e9 };
addEventListener('pointermove', e => { if (e.pointerType === 'mouse') { mouse.x = e.clientX / innerWidth * 2 - 1; mouse.y = -(e.clientY / innerHeight) * 2 + 1; mouse.t = performance.now(); } });
function pickHand() {
  const ok = s => s.on && s.vis, w = S.pongHand;
  if (w === 0 && pong.hand && ok(pong.hand)) return pong.hand;
  const list = H.filter(ok); if (!list.length) return null;
  const want = w === 2 ? list.find(s => !s.right) : list.find(s => s.right);
  return want || list[0];
}
function readPose(dt) {                                                       // posição, normal e velocidade da raquete (mundo)
  const s = pickHand(); pong.hand = s;
  if (s) {
    pc.copy(s.P[0]).add(s.P[9]).multiplyScalar(0.5); VR.toWorld(cW, pc);
    qW.copy(headQ).multiply(s.q);
    if (!havePrev) padQ.copy(qW); else padQ.slerp(qW, damp(28, dt));
    ax.set(0, 1, 0).applyQuaternion(padQ); az.set(0, 0, 1).applyQuaternion(padQ);
    cW.addScaledVector(ax, 0.15).addScaledVector(az, 0.03);                    // o prato da raquete fica à frente da palma, na direção dos dedos
  } else if (!S.vr && performance.now() - mouse.t < 4000) {                   // sem mãos (PC): a raquete segue o mouse
    tmp.set(mouse.x, mouse.y, 0.5).unproject(VR.camMain).sub(VR.camMain.position).normalize();
    cW.copy(HEAD).addScaledVector(tmp, 0.75);
    qW.setFromEuler(new T.Euler(-0.2, 0, 0)); if (!havePrev) padQ.copy(qW); else padQ.slerp(qW, damp(20, dt));
    az.set(0, 0, 1).applyQuaternion(padQ);
  } else { havePrev = false; pad.ok = false; return false; }
  if (havePrev && dt > 0) { tmp.copy(cW).sub(prevW).multiplyScalar(1 / dt); vel.lerp(tmp, 0.5); const l = vel.length(); if (l > 9) vel.multiplyScalar(9 / l); } else vel.set(0, 0, 0);
  if (havePrev) { pad.pw[0] = prevW.x; pad.pw[1] = prevW.y; pad.pw[2] = prevW.z; } else { pad.pw[0] = cW.x; pad.pw[1] = cW.y; pad.pw[2] = cW.z; }
  prevW.copy(cW); havePrev = true; pad.ok = true; return true;
}
function fillPad() {                                                          // converte a raquete do mundo para as coordenadas locais da mesa
  const o = tbl.position;
  pad.c[0] = cW.x - o.x; pad.c[1] = cW.y - o.y; pad.c[2] = cW.z - o.z;
  pad.pc[0] = pad.pw[0] - o.x; pad.pc[1] = pad.pw[1] - o.y; pad.pc[2] = pad.pw[2] - o.z;
  pad.n[0] = az.x; pad.n[1] = az.y; pad.n[2] = az.z; pad.v[0] = vel.x; pad.v[1] = vel.y; pad.v[2] = vel.z; pad.r = HIT_R;
}
// ---------- placar ----------
function drawBoard(msg) {
  const s = sim.score, key = [s.p, s.a, sim.level, msg, sim.to, sim.server].join('|'); if (key === boardKey) return; boardKey = key;
  const g = bc.g; g.clearRect(0, 0, 768, 256); ui.rr(g, 6, 6, 756, 244, 40); g.fillStyle = 'rgba(10,14,28,.82)'; g.fill(); g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.22)'; g.stroke();
  ui.text(g, 'PING-PONG  ·  ' + SIM.NAMES[sim.level].toUpperCase() + '  ·  até ' + sim.to, 384, 36, 26, 'rgba(235,240,250,.7)', 'center', 600);
  ui.text(g, 'VOCÊ', 190, 80, 30, '#ff7a8a', 'left', 700); ui.text(g, 'IA', 578, 80, 30, '#6aa9ff', 'right', 700);
  ui.text(g, String(s.p), 210, 142, 110, '#fff', 'center', 800); ui.text(g, ':', 384, 136, 90, 'rgba(255,255,255,.6)', 'center', 700); ui.text(g, String(s.a), 558, 142, 110, '#fff', 'center', 800);
  if (sim.server === 'P') { g.beginPath(); g.arc(150, 142, 9, 0, 7); g.fillStyle = '#ffd34d'; g.fill(); } else { g.beginPath(); g.arc(618, 142, 9, 0, 7); g.fillStyle = '#ffd34d'; g.fill(); }
  ui.text(g, msg, 384, 218, 32, '#ffe9a8', 'center', 600); bc.t.needsUpdate = true;
}
// ---------- sons / eventos ----------
const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };
let flashP = 0, flashA = 0;
function handleEvents() {
  for (const e of sim.ev) {
    if (e.t === 'hit') { ui.sfx(e.who === 'P' ? 640 : 470, 0.05, 0.13); if (e.who === 'P') { buzz(14); padFace.emissive.setHex(0x661122); flashP = 0.15; } else { aiFace.emissive.setHex(0x113a77); flashA = 0.15; } }
    else if (e.t === 'bounce') ui.sfx(300, 0.035, 0.09);
    else if (e.t === 'net') ui.sfx(170, 0.06, 0.1);
    else if (e.t === 'point') { if (e.who === 'P') { ui.sfx(720, 0.09, 0.1); setTimeout(() => ui.sfx(960, 0.12, 0.1), 90); } else { ui.sfx(320, 0.12, 0.1); setTimeout(() => ui.sfx(230, 0.18, 0.1), 110); } }
    else if (e.t === 'over') { [0, 120, 240].forEach((d, i) => setTimeout(() => ui.sfx(e.who === 'P' ? 660 + i * 160 : 420 - i * 70, 0.16, 0.11), d)); }
  }
  sim.ev.length = 0;
}
// ---------- por quadro ----------
VR.hook(45, (dt, t) => {
  if (!pong.on || !built) return;
  const have = readPose(dt);
  if (have) { const k = sim.phase === 'ready' ? damp(3, dt) : damp(0.6, dt); if (!avg.n) { avg.y = cW.y; avg.z = cW.z; avg.n = 1; } else { avg.y += (cW.y - avg.y) * k; avg.z += (cW.z - avg.z) * k; } }
  placeTable(false);
  sim.assist = S.pongAssist; sim.to = S.pongTo; if (sim.level !== S.pongLvl) sim.setLevel(S.pongLvl);
  pong.paused = ui.menuOpen ? 'Jogo pausado: feche o menu' : !have ? 'Mostre a mão para jogar' : '';
  if (have) fillPad();
  sim.update(dt, have ? pad : null, !pong.paused);
  handleEvents();
  // visual
  const b = sim.ball, a = sim.ai;
  ballM.position.set(b.x, b.y, b.z); ballM.rotation.x += b.vz * dt * 8; ballM.rotation.z -= b.vx * dt * 8;
  const over = Math.abs(b.x) <= HW && b.z <= ZP && b.z >= ZA && b.y > 0; shadow.visible = over; if (over) { shadow.position.set(b.x, 0.004, b.z); const k = 1 - Math.min(b.y, 0.9) * 0.55; shadow.scale.setScalar(k); shadow.material.opacity = 0.38 * k; }
  ring.visible = sim.phase === 'serveP' && !pong.paused; if (ring.visible) { ring.position.set(b.x, b.y, b.z); ring.quaternion.copy(headQ); ring.scale.setScalar(1 + Math.sin(t * 0.006) * 0.15); }
  aiG.position.set(a.x, a.y, a.z); aiG.rotation.set(-0.18, 0, 0); aiG.position.z += flashA > 0 ? 0.12 * (flashA / 0.15) : 0;
  robot.position.x += (a.x * 0.7 - robot.position.x) * damp(8, dt); const eyeK = 0.7 + 0.3 * Math.sin(t * 0.004); eyeL.scale.y = eyeR.scale.y = sim.phase === 'rally' ? 1 : eyeK;
  if (flashP > 0) { flashP -= dt; if (flashP <= 0) padFace.emissive.setHex(0); } if (flashA > 0) { flashA -= dt; if (flashA <= 0) aiFace.emissive.setHex(0); }
  if (have) { padG.visible = true; padG.position.copy(cW); padG.quaternion.copy(padQ); } else padG.visible = false;
  drawBoard(pong.paused || sim.msg || (sim.phase === 'rally' ? sim.rally > 1 ? 'Troca: ' + sim.rally : '' : ''));
});
// ---------- API ----------
const dirtySettings = () => { if (ui.panels.settings) ui.panels.settings.dirty = true; };
pong.setLevel = (i, quiet) => { i = clamp(i | 0, 0, 3); S.pongLvl = i; sim.setLevel(i); VR.save(); boardKey = ''; if (!quiet && ui.toast) ui.toast('Dificuldade: ' + SIM.NAMES[i]); dirtySettings(); };
pong.restart = () => { sim.restart(); boardKey = ''; havePrev = false; if (built) placeTable(true); };
pong.scoreText = () => sim.score.p + ' × ' + sim.score.a + '  (' + SIM.NAMES[sim.level] + ')';
pong.enter = () => { if (!built) build(); sim.setLevel(S.pongLvl); pong.restart(); pong.on = true; root.visible = true; VR.bounds = { x0: -0.5, x1: 0.5, z0: -0.4, z1: 0.4 }; VR.PL.x = 0; VR.PL.z = 0; };
pong.exit = () => { pong.on = false; if (built) root.visible = false; };
pong.setVisible = (on, pass) => { if (!built) return; root.visible = on; floorM.visible = floorIn.visible = on && !pass; };
addEventListener('keydown', e => {
  if (!pong.on || (e.target && e.target.tagName === 'INPUT')) return;
  if (e.code >= 'Digit1' && e.code <= 'Digit4') pong.setLevel(+e.code.slice(5) - 1);
  else if (e.code === 'KeyN') { pong.restart(); ui.toast && ui.toast('Nova partida'); }
});
VR.onRecenter.push(() => { if (built) { havePrev = false; avg.n = 0; } });
})();
