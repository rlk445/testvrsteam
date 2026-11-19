/* Sinuca (bola 8) contra o bot: mesa 3D, taco, mira, força, placar e turnos. A física, as regras e a IA estão em sinsim.js.
   Como jogar: aponte o dedo para onde quer bater (a linha de mira sai da branca), junte polegar e indicador (pinça) e AFASTE a mão segurando
   (quanto mais longe, mais força), solte para tacar. Voltar ao ponto inicial antes de soltar cancela. Bola na mão: aponte e pince para posicionar.
   PC sem mãos: o mouse aponta; segure o botão, arraste e solte. */
(() => {
'use strict';
const VR = window.VR, T = VR.T, S = VR.S, H = VR.H, scene = VR.scene, headQ = VR.headQ, HEAD = VR.HEAD, ui = VR.ui, SS = window.SinSim, clamp = VR.clamp, damp = VR.damp;
const { R, L, W, HL, HW, RX, CX, POCKETS, STEP } = SS;
const game = new SS.Game();
const sin = VR.sinuca = { game, on: false, hand: null };
sin.bg = new T.Color(0x110d0a); sin.fog = new T.Fog(0x110d0a, 7, 26);
const TZ = -1.15;
const NAMES = SS.NAMES, BC = ['#f4f1ea', '#f2c230', '#1f4fbf', '#d62a2a', '#5b2a86', '#f07b1c', '#1d8a3f', '#7a1f1f', '#111111'];
const lam = (c, o) => new T.MeshLambertMaterial(Object.assign({ color: c }, o || {}));
const bas = (c, o) => new T.MeshBasicMaterial(Object.assign({ color: c }, o || {}));
const box = (par, w, h, d, x, y, z, mat) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); par.add(m); return m; };
const cyl = (par, rt, rb, h, x, y, z, mat, seg) => { const m = new T.Mesh(new T.CylinderGeometry(rt, rb, h, seg || 14), mat); m.position.set(x, y, z); par.add(m); return m; };
let rec = { w: 0, l: 0 }; try { rec = Object.assign(rec, JSON.parse(localStorage.getItem('vrsin1') || '{}')); } catch (e) {}
const saveRec = () => { try { localStorage.setItem('vrsin1', JSON.stringify(rec)); } catch (e) {} };

// ---------- estado ----------
const ST = { ph: 'aim', aim: 0, hist: [], needRel: true, pw: 0, acc: 0, settle: 0, rollT: 0, cueT: 0, sinks: [], note: '', noteT: 0, restartT: 0, thinker: null, plan: null, botT: 0, pl: null, plT: 0, sk: null, cand: [], candDirty: true, first: 'P', placeOK: true, p0: { x: 0, z: 0 } };
const lock = { on: false, hand: null, p0: new T.Vector3(), mx: 0, my: 0 };
const cue = { vis: false, gap: 0.03 };
const mouse = { x: 0, y: 0, cx: 0, cy: 0, t: -1e9, down: false, press: false, rel: false, sx: 0, sy: 0 };
const IN = { has: false, ok: false, x: 0, z: 0, ok0: false, px: 0, pz: 0, down: false, press: false, rel: false, hand: null, mouse: false };
let built = false, root, tbl, legs = [], balls = [], shadows = [], cueG, strips = [], ghost, placeRing, board, bc, boardKey = '', pm, pmc, pmKey = '', floorM, floorIn, lampG, lastTy = -1;

// ---------- texturas ----------
function ballTex(n) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d'), col = BC[n > 8 ? n - 8 : n], stripe = n > 8;
  g.fillStyle = stripe || n === 0 ? BC[0] : col; g.fillRect(0, 0, 256, 128);
  if (stripe) { g.fillStyle = col; g.fillRect(0, 34, 256, 60); }
  if (n > 0) for (let u = 0; u < 4; u++) { const x = 32 + u * 64; g.beginPath(); g.arc(x, 64, 19, 0, 7); g.fillStyle = '#f7f5ee'; g.fill(); g.fillStyle = '#111'; g.font = '700 ' + (n > 9 ? 22 : 26) + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), x, 65); }
  else { g.fillStyle = '#d33'; for (let u = 0; u < 4; u++) { g.beginPath(); g.arc(32 + u * 64, 64, 5, 0, 7); g.fill(); } }
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
}
function feltTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.fillStyle = '#157f48'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 1400; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.05)'; g.fillRect(Math.random() * 128, Math.random() * 128, 1.5, 1.5); }
  const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(10, 5); t.colorSpace = T.SRGBColorSpace; return t;
}

// ---------- construção ----------
function build() {
  built = true; root = new T.Group(); root.visible = false; scene.add(root);
  floorM = new T.Mesh(new T.CircleGeometry(7, 56), lam(0x1b1511)); floorM.rotation.x = -Math.PI / 2; floorM.position.set(0, 0.001, TZ); root.add(floorM);
  floorIn = new T.Mesh(new T.CircleGeometry(2.6, 56), lam(0x2a1f18)); floorIn.rotation.x = -Math.PI / 2; floorIn.position.set(0, 0.002, TZ); root.add(floorIn);
  tbl = new T.Group(); root.add(tbl);
  const wood = lam(0x4a2c17), wood2 = lam(0x3a2112), cush = lam(0x0c5b33), black = bas(0x050505);
  const felt = new T.Mesh(new T.BoxGeometry(L + 0.24, 0.04, W + 0.24), new T.MeshLambertMaterial({ map: feltTex() })); felt.position.y = -0.02; tbl.add(felt);
  [-1, 1].forEach(sg => {                                                       // tabelas (borrachas): longas em duas partes (caçapa do meio), curtas inteiras
    [[-(HL - 0.095), -0.062], [0.062, HL - 0.095]].forEach(([a, b]) => box(tbl, b - a, 0.034, 0.06, (a + b) / 2, 0.017, sg * (HW + 0.03), cush));
    box(tbl, 0.06, 0.034, W - 0.19, sg * (HL + 0.03), 0.017, 0, cush);
    box(tbl, L + 0.12, 0.11, 0.13, 0, -0.005, sg * (HW + 0.125), wood);        // madeiras de cima
    box(tbl, 0.13, 0.11, W + 0.38, sg * (HL + 0.125), -0.005, 0, wood);
  });
  box(tbl, L + 0.38, 0.16, W + 0.38, 0, -0.14, 0, wood2);                       // corpo da mesa
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => legs.push(box(tbl, 0.11, 1, 0.11, sx * (HL + 0.05), -0.5, sz * (HW + 0.05), wood2)));
  POCKETS.forEach((P, i) => {                                                   // caçapas: um disco preto na feltro e outro na madeira
    const c = new T.Mesh(new T.CircleGeometry(0.062, 24), black); c.rotation.x = -Math.PI / 2; c.position.set(P[0], 0.002, P[1]); tbl.add(c);
    const ox = i < 4 ? Math.sign(P[0]) * 0.045 : 0, oz = Math.sign(P[1]) * (i < 4 ? 0.045 : 0.04), d = new T.Mesh(new T.CircleGeometry(i < 4 ? 0.058 : 0.052, 24), black); d.rotation.x = -Math.PI / 2; d.position.set(P[0] + ox, 0.0505, P[1] + oz); tbl.add(d);
  });
  const dm = bas(0xe9dcc0);                                                     // diamantes
  [-0.8, -0.5, -0.2, 0.2, 0.5, 0.8].forEach(x => [-1, 1].forEach(sg => cyl(tbl, 0.009, 0.009, 0.002, x, 0.0512, sg * (HW + 0.125), dm, 10)));
  [-0.24, 0, 0.24].forEach(z => [-1, 1].forEach(sg => cyl(tbl, 0.009, 0.009, 0.002, sg * (HL + 0.125), 0.0512, z, dm, 10)));
  [CX, RX].forEach(x => { const m = new T.Mesh(new T.CircleGeometry(0.007, 12), bas(0x0b4a2a)); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.002, 0); tbl.add(m); });
  box(tbl, 0.003, 0.0012, W - 0.04, CX, 0.0015, 0, bas(0x2a8a58, { transparent: true, opacity: 0.5 }));
  // bolas e sombras
  const geo = new T.SphereGeometry(R, 28, 18), sg = new T.CircleGeometry(R * 1.2, 16), smat = bas(0x000000, { transparent: true, opacity: 0.34, depthWrite: false });
  for (let i = 0; i < 16; i++) {
    const m = new T.Mesh(geo, new T.MeshPhongMaterial({ map: ballTex(i), shininess: 70, specular: 0x555555 })); m.quaternion.setFromEuler(new T.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6)); tbl.add(m); balls.push(m);
    const s = new T.Mesh(sg, smat); s.rotation.x = -Math.PI / 2; s.position.y = 0.0016; tbl.add(s); shadows.push(s);
  }
  // taco
  cueG = new T.Group(); cueG.visible = false; tbl.add(cueG);
  cyl(cueG, 0.0062, 0.0062, 0.012, 0, 0.006, 0, lam(0x2c7bd6), 10); cyl(cueG, 0.0068, 0.0068, 0.025, 0, 0.0245, 0, lam(0xf3efe6), 10);
  cyl(cueG, 0.0125, 0.0072, 0.78, 0, 0.427, 0, lam(0xe4bf86), 12); cyl(cueG, 0.0175, 0.0175, 0.014, 0, 0.82, 0, lam(0xc9a24a), 14);
  cyl(cueG, 0.0172, 0.0125, 0.66, 0, 1.147, 0, lam(0x2b1a10), 14); cyl(cueG, 0.0176, 0.0176, 0.02, 0, 1.48, 0, lam(0x111111), 14);
  // mira: três tiras no feltro e um anel (bola fantasma)
  const stripGeo = new T.PlaneGeometry(1, 1); stripGeo.rotateX(-Math.PI / 2);
  [['#ffffff', 0.55, 0.0045], ['#ffd34d', 0.85, 0.0045], ['#ffffff', 0.35, 0.0035]].forEach(([c, o, w]) => { const m = new T.Mesh(stripGeo, bas(c, { transparent: true, opacity: o, depthWrite: false })); m.renderOrder = 4; m.visible = false; m.userData.w = w; tbl.add(m); strips.push(m); });
  ghost = new T.Mesh(new T.RingGeometry(R * 0.86, R, 32), bas(0xffffff, { transparent: true, opacity: 0.85, depthWrite: false, side: T.DoubleSide })); ghost.rotation.x = -Math.PI / 2; ghost.renderOrder = 5; ghost.visible = false; tbl.add(ghost);
  placeRing = new T.Mesh(new T.RingGeometry(R * 1.25, R * 1.55, 32), bas(0x4fe08a, { transparent: true, opacity: 0.9, depthWrite: false, side: T.DoubleSide })); placeRing.rotation.x = -Math.PI / 2; placeRing.position.y = 0.003; placeRing.renderOrder = 5; placeRing.visible = false; tbl.add(placeRing);
  // placar e medidor de força
  bc = ui.mkCv(768, 300); board = new T.Mesh(new T.PlaneGeometry(1.5, 0.586), new T.MeshBasicMaterial({ map: bc.t, transparent: true, depthWrite: false, toneMapped: false, fog: false })); board.position.set(0, 0.8, -(HW + 0.38)); board.renderOrder = 9; tbl.add(board);
  pmc = ui.mkCv(256, 80); pm = new T.Mesh(new T.PlaneGeometry(0.26, 0.0813), new T.MeshBasicMaterial({ map: pmc.t, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, fog: false })); pm.renderOrder = 20; pm.visible = false; scene.add(pm);
  // lâmpada sobre a mesa
  lampG = new T.Group(); lampG.position.y = 1.0; tbl.add(lampG);
  box(lampG, 1.5, 0.09, 0.4, 0, 0, 0, lam(0x1f5b3a)); box(lampG, 1.56, 0.02, 0.44, 0, 0.05, 0, lam(0x2a2d33)); const gl = new T.Mesh(new T.PlaneGeometry(1.38, 0.32), bas(0xfff0c4, { fog: false })); gl.rotation.x = Math.PI / 2; gl.position.y = -0.047; lampG.add(gl);
  [-0.6, 0.6].forEach(x => cyl(lampG, 0.004, 0.004, 3, x, 1.55, 0, bas(0x222222), 6));
  placeTable(true);
}
function placeTable(force) {
  const ty = S.sinH; if (!force && ty === lastTy) return; lastTy = ty; tbl.position.set(0, ty, TZ);
  legs.forEach(m => { m.scale.y = ty - 0.06; m.position.y = -(ty - 0.06) / 2 - 0.06; });
}

// ---------- entrada: mão (apontar + pinça) ou mouse ----------
const P1 = { x: 0, z: 0 }, P2 = { x: 0, z: 0 }, tv = new T.Vector3(), tv2 = new T.Vector3();
function rayToTable(o, d, out) {                                               // raio (mundo) → ponto da mesa (coordenadas locais) na altura do centro das bolas
  if (d.y > -0.03) return false; const t = (tbl.position.y + R - o.y) / d.y; if (t <= 0 || t > 9) return false;
  out.x = o.x + d.x * t - tbl.position.x; out.z = o.z + d.z * t - tbl.position.z; return true;
}
function pickHand() {
  const ok = s => s.on && s.vis, list = H.filter(ok); if (!list.length) return null;
  if (lock.on && lock.hand && ok(lock.hand)) return lock.hand;
  const w = S.sinHand; if (w === 1) return list.find(s => s.right) || null; if (w === 2) return list.find(s => !s.right) || null;
  return list.find(s => s.pinch) || (sin.hand && ok(sin.hand) ? sin.hand : null) || list.find(s => s.right) || list[0];
}
function readInput(paused) {
  IN.has = IN.ok = IN.ok0 = IN.press = IN.rel = IN.down = false; IN.hand = null; IN.mouse = false;
  if (paused) { mouse.press = mouse.rel = false; return; }
  const s = pickHand(); sin.hand = s;
  if (s) {
    IN.has = true; IN.hand = s; IN.ok = rayToTable(HEAD, s.aim, P1); IN.x = P1.x; IN.z = P1.z; IN.down = s.pinch; IN.press = s.pinch && !s.pe; IN.rel = !s.pinch && s.pe;
    if (IN.press) { IN.ok0 = rayToTable(HEAD, VR.tracker.aimAt(s, 110), P2); IN.px = P2.x; IN.pz = P2.z; }
    mouse.press = mouse.rel = false;
  } else if (!S.vr && performance.now() - mouse.t < 5000) {
    IN.has = true; IN.mouse = true; const cam = VR.camMain; tv.set(mouse.x, mouse.y, 0.5).unproject(cam).sub(cam.position).normalize();
    IN.ok = rayToTable(cam.position, tv, P1); IN.x = P1.x; IN.z = P1.z; IN.down = mouse.down; IN.press = mouse.press; IN.rel = mouse.rel; IN.ok0 = IN.ok; IN.px = IN.x; IN.pz = IN.z;
    mouse.press = mouse.rel = false;
  } else mouse.press = mouse.rel = false;
}
const cv = VR.$('scene');
cv.addEventListener('pointerdown', e => {
  if (!sin.on || !S.started || e.pointerType !== 'mouse' || e.button !== 0 || ui.menuOpen || (ST.ph !== 'aim' && ST.ph !== 'place')) return;
  mouse.down = mouse.press = true; mouse.sx = e.clientX; mouse.sy = e.clientY; e.stopImmediatePropagation(); e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (x) {}
}, true);
addEventListener('pointermove', e => { if (e.pointerType === 'mouse') { mouse.x = e.clientX / innerWidth * 2 - 1; mouse.y = -(e.clientY / innerHeight) * 2 + 1; mouse.cx = e.clientX; mouse.cy = e.clientY; mouse.t = performance.now(); } });
addEventListener('pointerup', e => { if (e.pointerType === 'mouse' && mouse.down) { mouse.down = false; mouse.rel = true; } }, true);

// ---------- utilidades ----------
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const sfx = (f, d, v) => ui.sfx && ui.sfx(f, d, v), buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };
const speedOf = pw => 0.35 + 6.45 * Math.pow(pw, 1.6), powerOf = v => Math.pow(clamp((v - 0.35) / 6.45, 0, 1), 1 / 1.6);
const who = w => w === 'P' ? 'Você' : 'O bot';
function say(msg, sec) { ST.note = msg; ST.noteT = performance.now() + (sec || 3.6) * 1000; boardKey = ''; }
function beginTurn() {
  ST.needRel = true; ST.pw = 0; lock.on = false; ST.candDirty = true; ST.hist.length = 0; cue.vis = false;
  if (game.over) { ST.ph = 'over'; ST.restartT = 9; return; }
  if (game.turn === 'P') { ST.ph = game.inHand ? 'place' : 'aim'; cue.vis = ST.ph === 'aim'; const ph = game.ph; ST.aim = Math.atan2(-ph.z[0], (game.brk ? RX : 0) - ph.x[0]); }
  else { ST.ph = 'bStart'; ST.botT = 0; }
}
function newGame(first) {
  ST.first = first; game.newGame(first); ST.sinks.length = 0; ST.note = ''; ST.noteT = 0; ST.acc = 0; boardKey = ''; ST.plan = null; ST.thinker = null; cue.vis = false;
  balls.forEach(m => { m.scale.setScalar(1); }); beginTurn();
  say(first === 'P' ? 'Você quebra! Mire no triângulo, pince e puxe a mão.' : 'O bot quebra.', 4);
}

// ---------- tacada ----------
function fire(a, v, w) {
  game.beginShot(w); game.shoot(a, v); ST.ph = 'roll'; ST.settle = 0; ST.rollT = 0; ST.acc = 0; ST.cueT = 0.5; cue.vis = true;
  sfx(520 + v * 40, 0.05, 0.12); if (w === 'P') buzz(20);
}
function handleEvents() {
  const ph = game.ph; let n = 0;
  for (const e of ph.ev) {
    if (e.t === 'pk') { const m = balls[e.i]; ST.sinks.push({ i: e.i, p: e.p, t: 0, x: m.position.x, z: m.position.z }); sfx(150, 0.12, 0.12); setTimeout(() => sfx(110, 0.1, 0.08), 90); }
    else if (n < 3 && e.t === 'hit' && e.v > 0.08) { n++; sfx(1500 + Math.min(e.v, 4) * 250, 0.025, Math.min(0.14, 0.03 + e.v * 0.03)); }
    else if (n < 3 && e.t === 'rail' && e.v > 0.1) { n++; sfx(190, 0.045, Math.min(0.12, 0.03 + e.v * 0.03)); }
  }
  ph.ev.length = 0;
}
function endShot() {
  const j = game.resolve(), P = j.who === 'P', own = j.own;
  let msg = '';
  if (j.win) {
    const won = j.win === 'P'; msg = (won ? 'Você venceu! ' : 'O bot venceu. ') + j.why + '.'; ST.pw = 0;
    if (won) rec.w++; else rec.l++; saveRec(); sfx(won ? 880 : 300, 0.2, 0.12); setTimeout(() => sfx(won ? 1175 : 230, 0.3, 0.12), 160);
  } else if (j.foul) msg = 'Falta ' + (P ? 'sua' : 'do bot') + ': ' + j.why + '. ' + (game.turn === 'P' ? 'Você joga' : 'O bot joga') + ' com a bola na mão.';
  else if (j.cont) msg = who(j.who) + ' encaçapou ' + own + (own > 1 ? ' bolas' : ' bola') + '! ' + (P ? 'Jogue de novo.' : 'Joga de novo.');
  else msg = (j.pk.length ? 'Bola do adversário caiu. ' : 'Nada caiu. ') + 'Vez ' + (game.turn === 'P' ? 'sua.' : 'do bot.');
  if (j.assign) msg += ' ' + (j.assign.P === 'S' ? 'Você: lisas.' : 'Você: listradas.');
  say(msg, j.win ? 8 : 4.2); beginTurn();
}

// ---------- mira, assistência e guia ----------
function histAngle(ms) { const h = ST.hist, tt = performance.now() - ms; let k = h.length - 1; while (k > 0 && h[k].t > tt) k--; return k >= 0 ? h[k].a : ST.aim; }
function setAim(a, dt) {
  const ph = game.ph; if (ST.candDirty) { ST.cand = game.brk ? [{ a: Math.atan2(-ph.z[0], RX - ph.x[0]) }] : game.candidates('P'); ST.candDirty = false; }
  if (S.sinAssist > 0.01) a = game.assist(a, ST.cand, 0.02 + S.sinAssist * 0.085, 0.9);
  ST.aim += angDiff(a, ST.aim) * damp(18, dt); ST.hist.push({ t: performance.now(), a: ST.aim }); if (ST.hist.length > 40) ST.hist.shift();
}
function strip(m, x0, z0, x1, z1) {
  const dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz); if (l < 1e-4) { m.visible = false; return; }
  m.visible = true; m.position.set((x0 + x1) / 2, 0.004, (z0 + z1) / 2); m.rotation.y = -Math.atan2(dz, dx); m.scale.set(l, 1, m.userData.w);
}
function guide(a, on) {
  if (!on) { strips.forEach(m => { m.visible = false; }); ghost.visible = false; return; }
  const ph = game.ph, cx = ph.x[0], cz = ph.z[0], dx = Math.cos(a), dz = Math.sin(a);
  let tb = 1e9, hit = -1;
  for (let k = 1; k < 16; k++) { if (!ph.on[k]) continue; const ex = ph.x[k] - cx, ez = ph.z[k] - cz, t = ex * dx + ez * dz; if (t <= 0) continue; const p2 = ex * ex + ez * ez - t * t; if (p2 >= 4 * R * R) continue; const tc = t - Math.sqrt(4 * R * R - p2); if (tc < tb) { tb = tc; hit = k; } }
  let tw = 1e9; if (dx > 1e-6) tw = Math.min(tw, (HL - R - cx) / dx); else if (dx < -1e-6) tw = Math.min(tw, (-HL + R - cx) / dx); if (dz > 1e-6) tw = Math.min(tw, (HW - R - cz) / dz); else if (dz < -1e-6) tw = Math.min(tw, (-HW + R - cz) / dz);
  const t1 = Math.min(tb, tw); strip(strips[0], cx + dx * R, cz + dz * R, cx + dx * t1, cz + dz * t1);
  if (hit >= 0 && tb < tw) {
    const gx = cx + dx * tb, gz = cz + dz * tb; ghost.visible = true; ghost.position.set(gx, 0.005, gz);
    let nx = ph.x[hit] - gx, nz = ph.z[hit] - gz; const nl = Math.hypot(nx, nz) || 1; nx /= nl; nz /= nl;
    strip(strips[1], ph.x[hit], ph.z[hit], ph.x[hit] + nx * 0.3, ph.z[hit] + nz * 0.3);
    const dn = dx * nx + dz * nz, tx = dx - dn * nx, tz = dz - dn * nz, tl = Math.hypot(tx, tz);
    if (tl > 0.12) strip(strips[2], gx, gz, gx + tx / tl * 0.2 * tl, gz + tz / tl * 0.2 * tl); else strips[2].visible = false;
  } else { ghost.visible = false; strips[1].visible = false; strips[2].visible = false; }
}
function placeCue(a, gap) {                                                    // taco atrás da branca, na direção contrária à tacada, levemente inclinado
  const ph = game.ph, dx = Math.cos(a), dz = Math.sin(a), e = 0.07, d = R + gap;
  cueG.position.set(ph.x[0] - dx * d, R + 0.004, ph.z[0] - dz * d); tv2.set(-dx * Math.cos(e), Math.sin(e), -dz * Math.cos(e)); cueG.quaternion.setFromUnitVectors(tv.set(0, 1, 0), tv2);
}

// ---------- placar ----------
function wrap2(g, s, maxW) { if (g.measureText(s).width <= maxW) return [s]; const w = s.split(' '); let best = [s, ''], bd = 1e9; for (let i = 1; i < w.length; i++) { const a = w.slice(0, i).join(' '), b = w.slice(i).join(' '), d = Math.abs(g.measureText(a).width - g.measureText(b).width); if (d < bd) { bd = d; best = [a, b]; } } return best; }
function ballIcon(g, n, x, y, r, alive) {
  g.globalAlpha = alive ? 1 : 0.22; const col = BC[n > 8 ? n - 8 : n];
  g.beginPath(); g.arc(x, y, r, 0, 7); g.fillStyle = n > 8 ? '#f4f1ea' : col; g.fill();
  if (n > 8) { g.save(); g.beginPath(); g.arc(x, y, r, 0, 7); g.clip(); g.fillStyle = col; g.fillRect(x - r, y - r * 0.42, r * 2, r * 0.84); g.restore(); }
  g.lineWidth = 1.5; g.strokeStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke(); g.globalAlpha = 1;
}
function drawBoard(msg) {
  const gm = game, ph = gm.ph, key = [gm.group.P, gm.group.A, Array.from(ph.on).join(''), gm.turn, msg, S.sinLvl, rec.w, rec.l, ST.ph === 'over'].join('|'); if (key === boardKey) return; boardKey = key;
  const g = bc.g; g.clearRect(0, 0, 768, 300); ui.rr(g, 6, 6, 756, 288, 40); g.fillStyle = 'rgba(10,14,20,.84)'; g.fill(); g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.22)'; g.stroke();
  ui.text(g, 'SINUCA  ·  BOLA 8  ·  BOT ' + NAMES[S.sinLvl].toUpperCase(), 384, 34, 24, 'rgba(235,240,250,.72)', 'center', 600);
  [['P', 24, 'VOCÊ', '#7fd1ff'], ['A', 396, 'BOT', '#ffa07a']].forEach(([w, x0, name, col]) => {
    const turn = gm.turn === w && !gm.over; ui.rr(g, x0, 58, 348, 148, 24); g.fillStyle = 'rgba(255,255,255,.07)'; g.fill(); g.lineWidth = turn ? 5 : 2; g.strokeStyle = turn ? '#ffd34d' : 'rgba(255,255,255,.2)'; g.stroke();
    ui.text(g, name, x0 + 24, 90, 30, col, 'left', 800); const gr = gm.group[w];
    ui.text(g, gr === 'S' ? 'Lisas' : gr === 'L' ? 'Listradas' : 'Mesa aberta', x0 + 324, 90, 24, 'rgba(236,240,250,.75)', 'right', 600);
    if (gr) { const base = gr === 'S' ? 1 : 9; for (let k = 0; k < 7; k++) ballIcon(g, base + k, x0 + 30 + k * 41, 150, 15, !!ph.on[base + k]); ballIcon(g, 8, x0 + 30 + 7 * 41 + 8, 150, 15, !!ph.on[8]); ui.text(g, gm.onEight(w) ? 'Agora a bola 8!' : gm.remaining(gr) + ' restantes', x0 + 24, 188, 20, 'rgba(236,240,250,.6)', 'left', 500); }
    else ui.text(g, 'a primeira bola encaçapada define o grupo', x0 + 24, 150, 20, 'rgba(236,240,250,.55)', 'left', 500);
  });
  g.font = '600 28px ' + ui.FONT; const lines = wrap2(g, msg, 716), fs = lines.length > 1 ? 26 : 30;
  lines.forEach((l, i) => ui.text(g, l, 384, (lines.length > 1 ? 232 : 240) + i * 28, fs, '#ffe9a8', 'center', 600));
  ui.text(g, 'Vitórias ' + rec.w + '  ·  Derrotas ' + rec.l, 384, 281, 19, 'rgba(235,240,250,.5)', 'center', 500);
  bc.t.needsUpdate = true;
}
function drawPower(p) {
  const key = Math.round(p * 50); if (key === pmKey) return; pmKey = key; const g = pmc.g; g.clearRect(0, 0, 256, 80);
  ui.rr(g, 4, 8, 248, 64, 32); g.fillStyle = 'rgba(10,14,20,.85)'; g.fill(); g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.35)'; g.stroke();
  ui.rr(g, 16, 22, 224, 20, 10); g.fillStyle = 'rgba(255,255,255,.16)'; g.fill();
  if (p > 0.01) { const gr = g.createLinearGradient(16, 0, 240, 0); gr.addColorStop(0, '#4fe08a'); gr.addColorStop(0.6, '#ffd34d'); gr.addColorStop(1, '#ff5a5a'); ui.rr(g, 16, 22, Math.max(20, 224 * p), 20, 10); g.fillStyle = gr; g.fill(); }
  ui.text(g, 'FORÇA ' + Math.round(p * 100) + '%', 128, 56, 20, '#fff', 'center', 700); pmc.t.needsUpdate = true;
}

// ---------- por quadro ----------
const q1 = new T.Quaternion(), ax = new T.Vector3();
function hintMsg() {
  const p = ST.ph;
  if (ui.menuOpen) return 'Jogo pausado: feche o menu';
  if (performance.now() < ST.noteT) return ST.note;
  if (p === 'over') return ST.note || 'Fim de jogo';
  if (p === 'roll' || p === 'strike') return '';
  if (p === 'aim' || p === 'place') {
    if (!IN.has) return 'Mostre a mão para jogar';
    if (p === 'place') return 'Aponte e pince para posicionar a branca';
    return lock.on ? 'Solte para tacar (volte ao início para cancelar)' : 'Aponte · pince e afaste a mão · solte';
  }
  return ST.ph === 'bStart' || ST.ph === 'bThink' || ST.ph === 'bPlace' ? 'O bot está pensando…' : 'O bot vai tacar…';
}
VR.hook(45, (dt, t) => {
  if (!sin.on || !built) return;
  const paused = ui.menuOpen, ph = game.ph; placeTable(false);
  readInput(paused);
  if (!IN.down) ST.needRel = false;
  if (paused && lock.on) { lock.on = false; ST.pw = 0; }
  // ---- fases ----
  if (!paused) switch (ST.ph) {
    case 'aim': {
      if (!IN.has) { lock.on = false; ST.pw = 0; break; }
      if (!lock.on) {
        if (IN.ok && Math.hypot(IN.x - ph.x[0], IN.z - ph.z[0]) > 0.05) setAim(Math.atan2(IN.z - ph.z[0], IN.x - ph.x[0]), dt);
        if (IN.press && !ST.needRel && (IN.ok || IN.ok0)) {                                // trava a mira (a de ~110 ms atrás) e começa a puxar
          lock.on = true; lock.hand = IN.hand; ST.aim = IN.mouse ? ST.aim : histAngle(110); ST.pw = 0;
          if (IN.hand) { lock.p0.copy(IN.hand.anchor); IN.hand.busy = true; } else { lock.mx = mouse.cx; lock.my = mouse.cy; }
        }
      } else {
        if (lock.hand) lock.hand.busy = true;
        const pull = IN.mouse ? Math.hypot(mouse.cx - lock.mx, mouse.cy - lock.my) / (innerHeight * 0.3) : IN.hand ? IN.hand.anchor.distanceTo(lock.p0) / 0.26 : 0;
        const tgt = clamp((pull - 0.1) / 0.9, 0, 1); ST.pw += (tgt - ST.pw) * damp(22, dt);
        if (!IN.has) { lock.on = false; ST.pw = 0; }
        else if (!IN.down) {
          lock.on = false;
          if (ST.pw > 0.08) { ST.ph = 'strike'; ST.sk = { t: 0, pw: ST.pw, dur: 0.11 }; } else { ST.pw = 0; say('Tacada cancelada', 1.6); }
        }
      }
      break;
    }
    case 'strike': { const k = ST.sk; k.t += dt; if (k.t >= k.dur) { fire(ST.aim, speedOf(k.pw), 'P'); ST.pw = 0; } break; }
    case 'place': {
      if (!IN.has) break;
      if (IN.ok) { const x = clamp(IN.x, -HL + R, HL - R), z = clamp(IN.z, -HW + R, HW - R); ph.x[0] = x; ph.z[0] = z; ST.placeOK = SS.freeAt(ph, x, z, 0, 2 * R + 0.002); }
      if (IN.press && !ST.needRel) {
        if (IN.ok && ST.placeOK) { ST.ph = 'aim'; game.inHand = false; ST.needRel = true; cue.vis = true; ST.candDirty = true; ST.hist.length = 0; sfx(700, 0.06, 0.1); if (IN.hand) IN.hand.busy = true; }
        else { sfx(200, 0.1, 0.1); buzz(30); }
      }
      break;
    }
    case 'roll': {
      ST.acc += Math.min(dt, 0.05); let n = 0; ST.rollT += dt;
      while (ST.acc >= STEP && n < 12) { ph.step(STEP); ST.acc -= STEP; n++; handleEvents(); }
      if (!ph.moving()) { ST.settle += dt; if (ST.settle > 0.3) endShot(); } else ST.settle = 0;
      if (ST.rollT > 25) { ph.vx.fill(0); ph.vz.fill(0); }
      break;
    }
    case 'bStart': {
      ST.botT += dt; if (ST.botT < 0.9) break;
      if (game.inHand) { ST.pl = game.placement('A'); ST.plT = 0; ST.p0.x = ph.x[0]; ST.p0.z = ph.z[0]; ST.ph = 'bPlace'; }
      else { ST.thinker = game.think('A', S.sinLvl); ST.botT = 0; ST.ph = 'bThink'; }
      break;
    }
    case 'bPlace': {
      ST.plT += dt; const k = clamp(ST.plT / 0.8, 0, 1), e = k * k * (3 - 2 * k); ph.x[0] = ST.p0.x + (ST.pl.x - ST.p0.x) * e; ph.z[0] = ST.p0.z + (ST.pl.z - ST.p0.z) * e;
      if (k >= 1) { game.inHand = false; ST.thinker = game.think('A', S.sinLvl); ST.botT = 0; ST.ph = 'bThink'; sfx(700, 0.06, 0.1); }
      break;
    }
    case 'bThink': {
      ST.botT += dt; ST.thinker.step(2);
      if (ST.thinker.done && ST.botT > 1.2) { ST.plan = ST.thinker.result(); ST.sk = { t: 0, a0: ST.aim, pw: powerOf(ST.plan.v) }; ST.ph = 'bAim'; cue.vis = true; ST.aim = Math.atan2(-ph.z[0], RX - ph.x[0]); ST.sk.a0 = ST.aim; }
      break;
    }
    case 'bAim': {
      const k = ST.sk, p = ST.plan; k.t += dt; const e = x => x * x * (3 - 2 * x);
      if (k.t < 0.9) ST.aim = k.a0 + angDiff(p.a, k.a0) * e(clamp(k.t / 0.9, 0, 1)); else ST.aim = p.a;
      if (k.t >= 1.5) { fire(p.a, p.v, 'A'); ST.plan = null; }
      break;
    }
    case 'over': { ST.restartT -= dt; if (ST.restartT <= 0) newGame(ST.first === 'P' ? 'A' : 'P'); break; }
  }
  // ---- visual das bolas ----
  const rolling = ST.ph === 'roll';
  for (let i = 0; i < 16; i++) {
    const m = balls[i], s = shadows[i], on = !!ph.on[i];
    if (on) {
      if (m.scale.x !== 1) m.scale.setScalar(1);
      m.visible = s.visible = true; m.position.set(ph.x[i], R, ph.z[i]); s.position.x = ph.x[i]; s.position.z = ph.z[i];
      if (rolling) { const vx = ph.vx[i], vz = ph.vz[i], sp = Math.hypot(vx, vz); if (sp > 0.002) { ax.set(vz, 0, -vx).multiplyScalar(1 / sp); q1.setFromAxisAngle(ax, sp * dt / R); m.quaternion.premultiply(q1); } }
    } else s.visible = false;
  }
  for (let k = ST.sinks.length - 1; k >= 0; k--) {                              // bola caindo na caçapa
    const f = ST.sinks[k], m = balls[f.i], P = POCKETS[f.p]; f.t += dt; const u = clamp(f.t / 0.42, 0, 1);
    if (ph.on[f.i]) { ST.sinks.splice(k, 1); continue; }
    m.visible = u < 1; m.position.set(f.x + (P[0] - f.x) * u, R - u * u * 0.12, f.z + (P[1] - f.z) * u); m.scale.setScalar(1 - u * 0.3); if (u >= 1) { m.scale.setScalar(1); ST.sinks.splice(k, 1); }
  }
  // ---- taco, mira, força, anel da bola na mão ----
  const showAim = !paused && ST.ph === 'aim' && IN.has, bots = ST.ph === 'bAim';
  guide(ST.aim, showAim && S.sinGuide);
  placeRing.visible = ST.ph === 'place' && !paused && IN.has; if (placeRing.visible) { placeRing.position.set(ph.x[0], 0.003, ph.z[0]); placeRing.material.color.setHex(ST.placeOK ? 0x4fe08a : 0xff5a5a); const k = 1 + Math.sin(t * 0.008) * 0.08; placeRing.scale.set(k, k, k); }
  if (ST.cueT > 0) { ST.cueT -= dt; if (ST.cueT <= 0) cue.vis = false; }
  let gap = 0.03 + 0.012 * Math.sin(t * 0.004);
  if (ST.ph === 'aim') gap = 0.03 + ST.pw * 0.3;
  else if (ST.ph === 'strike') { const k = ST.sk, f = clamp(k.t / k.dur, 0, 1); gap = (0.03 + k.pw * 0.3) * (1 - f * f) + 0.004 * f; }
  else if (bots) { const k = ST.sk, pull = clamp((k.t - 0.9) / 0.6, 0, 1), e = pull * pull * (3 - 2 * pull), pw = k.pw; gap = 0.03 + e * (0.03 + pw * 0.3); if (k.t > 1.5 - 0.1) gap = 0.004; }
  else if (ST.ph === 'roll') gap = 0.004;
  cueG.visible = cue.vis && ph.on[0] && ST.ph !== 'place' && ST.ph !== 'over' && ST.ph !== 'bStart' && ST.ph !== 'bThink' && ST.ph !== 'bPlace'; if (cueG.visible) placeCue(ST.aim, gap);
  pm.visible = lock.on && !paused; if (pm.visible) { drawPower(ST.pw); pm.position.set(tbl.position.x + ph.x[0], tbl.position.y + 0.2, tbl.position.z + ph.z[0]); pm.quaternion.copy(headQ); }
  drawBoard(hintMsg());
});

// ---------- API ----------
const dirtySettings = () => { if (ui.panels.settings) ui.panels.settings.dirty = true; };
const orbAway = on => { const o = ui.panels.orb; if (o && o.g) { if (on) o.g.position.set(0.5, 0.22, -0.8); else o.g.position.set(0, -0.23, -0.8); } };
sin.setLevel = (i, quiet) => { i = clamp(i | 0, 0, 3); S.sinLvl = i; VR.save(); boardKey = ''; if (!quiet && ui.toast) ui.toast('Bot: ' + NAMES[i]); dirtySettings(); };
sin.restart = () => { if (!built) return; newGame(ST.first === 'P' ? 'A' : 'P'); };
sin.scoreText = () => game.group.P ? game.remaining(game.group.P) + ' × ' + game.remaining(game.group.A) + ' bolas restantes' : 'mesa aberta';
sin.bestText = () => rec.w + ' vitórias · ' + rec.l + ' derrotas';
sin.enter = () => { if (!built) build(); placeTable(true); sin.on = true; root.visible = true; VR.bounds = { x0: -2.4, x1: 2.4, z0: -3.4, z1: 0.6 }; VR.PL.x = 0; VR.PL.z = 0; orbAway(true); newGame('P'); };
sin.exit = () => { sin.on = false; if (built) root.visible = false; lock.on = false; pm && (pm.visible = false); orbAway(false); };
sin.setVisible = (on, pass) => { if (!built) return; root.visible = on; floorM.visible = floorIn.visible = on && !pass; if (lampG) lampG.visible = !pass; };
addEventListener('keydown', e => {
  if (!sin.on || (e.target && e.target.tagName === 'INPUT')) return;
  if (e.code >= 'Digit1' && e.code <= 'Digit4') sin.setLevel(+e.code.slice(5) - 1); else if (e.code === 'KeyN') { sin.restart(); ui.toast && ui.toast('Nova partida'); }
});
})();
