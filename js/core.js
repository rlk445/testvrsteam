/* VR núcleo: configurações, cena, câmeras, rastreamento de cabeça, passagem da câmera e loop de render */
(() => {
'use strict';
const T = THREE, D2R = Math.PI / 180;
const VR = window.VR = { T, version: 25 };
const $ = VR.$ = id => document.getElementById(id);
VR.clamp = (v, a, b) => v < a ? a : v > b ? b : v;
VR.lerp = (a, b, t) => a + (b - a) * t;
VR.damp = (rate, dt) => 1 - Math.exp(-rate * dt);                         // fator de suavização independente do FPS
VR.step = (a, b, x) => { const t = VR.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// ---------- registro ----------
VR.logLines = [];
function log(m) {
  const line = new Date().toLocaleTimeString() + ' ' + m; VR.logLines.push(line); if (VR.logLines.length > 40) VR.logLines.shift();
  try { const a = JSON.parse(localStorage.getItem('vrlog') || '[]'); a.push(line); localStorage.setItem('vrlog', JSON.stringify(a.slice(-30))); } catch (e) {}
}
VR.log = log;
(function showLast() { try { const a = JSON.parse(localStorage.getItem('vrlog') || '[]'), el = $('log'); if (el) el.textContent = a.length ? 'Registro da última vez:\n' + a.join('\n') : ''; } catch (e) {} })();
addEventListener('error', e => log('ERRO: ' + e.message));
addEventListener('unhandledrejection', e => log('ERRO promessa: ' + ((e.reason && e.reason.message) || e.reason)));
addEventListener('pagehide', () => log('pagehide (página saiu)'));
document.addEventListener('visibilitychange', () => log('visibilidade: ' + document.visibilityState));
const IOS = VR.IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// ---------- configurações (as que estão em DEF são salvas no aparelho) ----------
const DEF = {
  env: 'room', hand: 'model', skin: 1, maxHands: 2, cx: 0, smoothH: 0.6, lead: 40, rate: 0, swapHands: false, reach: 1.3, dwell: false,
  pass: false, ptZoom: 1, facing: 'environment', devId: '', preview: true,
  vr: false, sens: 1, smoothHead: 0.3, headPred: 25, ipd: 0.064, eyeW: 1, shift: 0,
  night: false, ceiling: true, q: IOS ? 0 : 1, res: 0, debug: false, obs: false, ytVol: 80,
  pongLvl: 1, pongTo: 11, pongAssist: 0.5, pongHand: 0, pongAuto: true, pongH: 1.0,
  sinLvl: 1, sinAssist: 0.5, sinGuide: true, sinHand: 0, sinH: 0.85,
  bindJump: '', bindCrouch: '', ctlCrouchMode: 0,
  trkSens: 1, kbSize: 1.3, kbSurface: true, kbPrecise: true, kbSound: true,
  bsSong: 0, bsLvl: 1, bsSabers: 2, bsHand: 0, bsH: -0.3, bsSpread: 1, bsLen: 0.9, bsMin: 0.8, bsDir: true, bsBombs: true, bsNoFail: false, bsLat: 0, bsVol: 0.8
};
const S = VR.S = Object.assign({}, DEF, {
  started: false, handsReady: false, ptW: 6, ptH: 5, good: 0, fps: 0, lastOri: 0, invalid: 0, a: 0, b: 0, g: 0, acc: [0, 0, 0], rot: [0, 0, 0],
  inferMs: 0, trkHz: 0, camAge: 0, handsSeen: 0
});
try {
  const o = JSON.parse(localStorage.getItem('vrset19') || '{}');
  for (const k in DEF) if (k in o && typeof o[k] === typeof DEF[k]) S[k] = o[k];
  if (!['model', 'outline', 'skeleton', 'off'].includes(S.hand)) S.hand = 'model';
  S.obs = false; S.debug = false;
} catch (e) {}
{ const m = location.search.match(/[?&]obs=1/); if (m) S.obs = true; const e = location.search.match(/bg=(green|alpha)/); if (e) S.env = e[1]; }
let saveT = 0;
VR.save = () => { clearTimeout(saveT); saveT = setTimeout(() => { try { const o = {}; for (const k in DEF) if (k !== 'obs' && k !== 'debug') o[k] = S[k]; localStorage.setItem('vrset19', JSON.stringify(o)); } catch (e) {} }, 300); };
VR.defaults = () => { for (const k in DEF) S[k] = DEF[k]; VR.save(); };
VR.mirror = () => S.facing === 'user';

// ---------- gancho por prioridade: 10 jogador, 20 mãos, 25 visual das mãos, 30 interação/UI, 40 física, 50 ambiente ----------
const hooks = []; VR.hook = (prio, fn) => { hooks.push({ prio, fn }); hooks.sort((a, b) => a.prio - b.prio); };
VR.post = [];                                                             // chamado depois do render (ex.: vídeo do YouTube)
VR.onRecenter = [];

// ---------- THREE: renderer e cena ----------
const canvas = $('scene');
const renderer = VR.renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
const MAXPR = VR.MAXPR = Math.max(1, Math.min(window.devicePixelRatio || 1, 2400 / Math.max(innerWidth, innerHeight)));
renderer.setPixelRatio(Math.min(MAXPR, 1.5));
renderer.setScissorTest(true);
const scene = VR.scene = new T.Scene();
VR.skyBg = new T.Color(0x7fb2e5); VR.skyFog = new T.Fog(0x7fb2e5, 12, 45);
scene.background = VR.skyBg; scene.fog = VR.skyFog;
VR.hemi = new T.HemisphereLight(0xdfefff, 0x445544, 0.9); scene.add(VR.hemi);
VR.sun = new T.DirectionalLight(0xffffff, 0.8); VR.sun.position.set(5, 10, 3); scene.add(VR.sun);
const HEAD = VR.HEAD = new T.Vector3(0, 1.6, 0);
const hov = VR.hov = new T.Group(); scene.add(hov);                       // grupo preso à cabeça (mãos, contorno)
const camMain = VR.camMain = new T.PerspectiveCamera(75, 1, 0.05, 100);
const camL = VR.camL = new T.PerspectiveCamera(90, 1, 0.05, 100), camR = VR.camR = new T.PerspectiveCamera(90, 1, 0.05, 100);

// ---------- rastreamento de cabeça (giroscópio) com predição e suavização adaptativa ----------
const zee = new T.Vector3(0, 0, 1), q1 = new T.Quaternion(-Math.SQRT1_2, 0, 0, Math.SQRT1_2), _Y = new T.Vector3(0, 1, 0), _ax = new T.Vector3();
const eul = new T.Euler(), _e = new T.Euler(), q0 = new T.Quaternion();
const tmpQ = new T.Quaternion(), rawQ = VR.rawQ = new T.Quaternion(), prevRaw = new T.Quaternion(), dQ = new T.Quaternion(), yawQ = new T.Quaternion(), headQ = VR.headQ = new T.Quaternion(), tgtQ = new T.Quaternion(), predQ = new T.Quaternion();
const angVel = new T.Vector3();                                           // velocidade angular (rad/s) do sensor, no referencial do mundo
const screenAngle = () => ((screen.orientation && typeof screen.orientation.angle === 'number') ? screen.orientation.angle : (window.orientation || 0)) * D2R;
const MK = VR.MK = { yaw: 0, pitch: 0 }, KEYS = VR.KEYS = {};
let haveOri = false, needCenter = false, lastOriT = 0;
VR.haveOri = () => haveOri;
VR.needCenter = () => { needCenter = true; };
function onOri(e) {
  if (![e.alpha, e.beta, e.gamma].every(Number.isFinite)) { S.invalid++; return; }
  const now = performance.now();
  S.a = e.alpha; S.b = e.beta; S.g = e.gamma; S.lastOri = now;
  prevRaw.copy(rawQ);
  eul.set(e.beta * D2R, e.alpha * D2R, -e.gamma * D2R, 'YXZ');
  rawQ.setFromEuler(eul).multiply(q1).multiply(q0.setFromAxisAngle(zee, -screenAngle()));
  if (haveOri && lastOriT) {
    const dt = (now - lastOriT) / 1000;
    if (dt > 0.002 && dt < 0.1) {                                         // delta = raw * prev⁻¹ → velocidade angular no mundo
      dQ.copy(prevRaw).invert().premultiply(rawQ); if (dQ.w < 0) { dQ.x = -dQ.x; dQ.y = -dQ.y; dQ.z = -dQ.z; dQ.w = -dQ.w; }
      const s = Math.sqrt(dQ.x * dQ.x + dQ.y * dQ.y + dQ.z * dQ.z);
      if (s > 1e-6) { const ang = 2 * Math.atan2(s, dQ.w) / dt; _ax.set(dQ.x, dQ.y, dQ.z).multiplyScalar(ang / s); } else _ax.set(0, 0, 0);
      angVel.lerp(_ax, VR.damp(30, dt));
    }
  }
  lastOriT = now; haveOri = true;
  if (needCenter) { recenter(); needCenter = false; }
}
function recenter() {
  _e.setFromQuaternion(rawQ, 'YXZ'); yawQ.setFromAxisAngle(_Y, -_e.y); headQ.copy(yawQ).multiply(rawQ);
  MK.yaw = 0; MK.pitch = 0; VR.onRecenter.forEach(f => { try { f(); } catch (e) { log('recenter: ' + e.message); } });
}
VR.recenter = recenter;
function onMotion(e) {
  const a = e.accelerationIncludingGravity, r = e.rotationRate;
  if (a) S.acc = [a.x || 0, a.y || 0, a.z || 0];
  if (r) S.rot = [r.alpha || 0, r.beta || 0, r.gamma || 0];
}
VR.listenSensors = () => { addEventListener('deviceorientation', onOri); addEventListener('devicemotion', onMotion); };
function updateHead(dt) {
  if (!haveOri) { eul.set(MK.pitch, MK.yaw, 0, 'YXZ'); headQ.setFromEuler(eul); return; }  // PC sem giroscópio: mouse
  if (performance.now() - lastOriT > 120) angVel.multiplyScalar(0.85);
  const wl = angVel.length(), Tp = S.headPred / 1000;
  tgtQ.copy(rawQ);
  if (Tp > 0 && wl > 0.03) { predQ.setFromAxisAngle(_ax.copy(angVel).divideScalar(wl), Math.min(wl * Tp, 0.3)); tgtQ.premultiply(predQ); }
  tgtQ.premultiply(yawQ);
  if (Math.abs(S.sens - 1) > 0.01) { tmpQ.identity().slerp(tgtQ, S.sens); tgtQ.copy(tmpQ); }
  const tau = S.smoothHead * 0.14 / (1 + 4 * wl);                         // parado: filtra tremor; girando rápido: quase sem atraso
  headQ.slerp(tgtQ, tau > 0.0005 ? 1 - Math.exp(-dt / tau) : 1);
}
VR.headYaw = () => { _e.setFromQuaternion(headQ, 'YXZ'); return _e.y; };

// ---------- passagem da câmera (estilo Quest) ----------
const PT_D = VR.PT_D = 5, video = $('cam');
let vtex = null, bg = null, lastVT = -1; const fwdV = new T.Vector3();
function ensureBg() {                                                     // a textura de vídeo só é criada quando você liga a passagem
  if (bg) return true;
  try {
    vtex = new T.VideoTexture(video); vtex.minFilter = vtex.magFilter = T.LinearFilter; vtex.generateMipmaps = false; vtex.colorSpace = T.SRGBColorSpace;
    bg = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: vtex, depthTest: false, depthWrite: false, fog: false, toneMapped: false }));
    bg.renderOrder = -10; bg.frustumCulled = false; scene.add(bg); return true;
  } catch (e) { log('passagem falhou: ' + e.message); return false; }
}
function updatePass(fov, va) {
  const vA = video.videoWidth ? video.videoWidth / video.videoHeight : 4 / 3;
  const H0 = 2 * PT_D * Math.tan(fov * D2R / 2), H = Math.max(H0, H0 * va / vA) * S.ptZoom;
  S.ptH = H; S.ptW = H * vA;
  bg.scale.set(VR.mirror() ? -S.ptW : S.ptW, H, 1);
  bg.quaternion.copy(headQ); bg.position.copy(HEAD).add(fwdV.set(0, 0, -PT_D).applyQuaternion(headQ));
  if (video.readyState >= 2 && video.currentTime !== lastVT) { lastVT = video.currentTime; vtex.needsUpdate = true; }
}
VR.setPass = on => {
  if (on && !ensureBg()) on = false;
  if (on && !VR.camOn) { VR.toast && VR.toast('A câmera ainda não está ligada'); on = false; }
  log('passagem ' + (on ? 'ligada' : 'desligada'));
  S.pass = on; if (bg) bg.visible = on; VR.save(); VR.env && VR.env.refresh();
  return on;
};

// ---------- panorama 360 (tela inicial e vista da janela do quarto) ----------
const PANO_YAW = 4.25, pano = VR.pano = { mesh: null, fog: new T.Color(0x6f7f9a), yaw: PANO_YAW, spin: 0 };
function loadPano() {
  const img = new Image();
  img.onload = () => { try {
    const k = Math.min(2, 4096 / img.naturalWidth), sc = document.createElement('canvas'); sc.width = Math.round(img.naturalWidth * k); sc.height = Math.round(img.naturalHeight * k);
    const s0 = sc.getContext('2d'); s0.imageSmoothingEnabled = true; s0.imageSmoothingQuality = 'high'; s0.drawImage(img, 0, 0, sc.width, sc.height);
    const W = sc.width, H = sc.height, FH = Math.round(W / 2), c = document.createElement('canvas'); c.width = W; c.height = FH;
    const g = c.getContext('2d'); g.drawImage(sc, 0, 0);
    const ext = FH - H;                                                   // a foto vai do zênite até ~30° abaixo do horizonte: completa o chão com a cor da grama borrada
    if (ext > 0) {
      const sm = document.createElement('canvas'); sm.width = 96; sm.height = 1; const sg = sm.getContext('2d'); sg.imageSmoothingQuality = 'high'; sg.drawImage(sc, 0, H - 10, W, 10, 0, 0, 96, 1);
      const ec = document.createElement('canvas'); ec.width = W; ec.height = ext + 24; const eg = ec.getContext('2d'); eg.imageSmoothingQuality = 'high'; eg.drawImage(sm, 0, 0, 96, 1, 0, 0, W, ec.height);
      const gr = eg.createLinearGradient(0, 0, 0, ec.height); gr.addColorStop(0, 'rgba(10,22,8,0)'); gr.addColorStop(1, 'rgba(10,22,8,.7)'); eg.fillStyle = gr; eg.fillRect(0, 0, W, ec.height);
      eg.globalCompositeOperation = 'destination-in'; const fg = eg.createLinearGradient(0, 0, 0, 24); fg.addColorStop(0, 'rgba(0,0,0,0)'); fg.addColorStop(1, 'rgba(0,0,0,1)'); eg.fillStyle = fg; eg.fillRect(0, 0, W, ec.height);
      g.drawImage(ec, 0, H - 24);
    }
    try { const s1 = document.createElement('canvas'); s1.width = s1.height = 1; const sx = s1.getContext('2d'); sx.drawImage(sc, 0, Math.round(H * 0.68), W, 8, 0, 0, 1, 1); const d = sx.getImageData(0, 0, 1, 1).data; pano.fog.setRGB(d[0] / 255, d[1] / 255, d[2] / 255, T.SRGBColorSpace); } catch (e) {}
    const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace; tex.minFilter = tex.magFilter = T.LinearFilter; tex.generateMipmaps = false; tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const geo = new T.SphereGeometry(80, 64, 36); geo.scale(-1, 1, 1);
    const m = pano.mesh = new T.Mesh(geo, new T.MeshBasicMaterial({ map: tex, fog: false, depthTest: false, depthWrite: false, toneMapped: false, color: 0xffffff }));
    m.renderOrder = -20; m.frustumCulled = false; m.rotation.y = PANO_YAW; m.visible = false; scene.add(m);
    VR.env && VR.env.refresh(); log('panorama carregado');
  } catch (e) { log('panorama falhou: ' + e.message); } };
  img.onerror = () => log('panorama: arquivo assets/panorama.jpg não encontrado');
  img.src = 'assets/panorama.jpg?v=21';
}
VR.updatePano = t => { const m = pano.mesh; if (m && m.visible) { m.position.copy(HEAD); m.rotation.y = pano.yaw + pano.spin * t * 0.00002; } };

// ---------- render ----------
function resize() { renderer.setSize(innerWidth, innerHeight, false); }
addEventListener('resize', resize); resize();
const rightV = new T.Vector3();
function eye(cam, sign, w, h) {
  cam.aspect = (w / 2) / h; cam.updateProjectionMatrix();
  cam.quaternion.copy(headQ);
  rightV.set(1, 0, 0).applyQuaternion(headQ);
  cam.position.copy(HEAD).addScaledVector(rightV, sign * S.ipd / 2);
}
function render() {
  const w = innerWidth, h = innerHeight;
  if (S.vr) {
    const ew = (w / 2) * S.eyeW, ox = (w / 2 - ew) / 2;
    if (S.eyeW < 0.999) { renderer.setViewport(0, 0, w, h); renderer.setScissor(0, 0, w, h); renderer.setClearColor(0x000000, 1); renderer.clear(); }
    eye(camL, -1, ew * 2, h); eye(camR, 1, ew * 2, h);
    camL.projectionMatrix.elements[8] = S.shift; camR.projectionMatrix.elements[8] = -S.shift;   // alinhamento: esquerdo +, direito −
    camL.projectionMatrixInverse.copy(camL.projectionMatrix).invert(); camR.projectionMatrixInverse.copy(camR.projectionMatrix).invert();
    if (S.pass && bg) updatePass(camL.fov, ew / h);
    renderer.setViewport(ox, 0, ew, h); renderer.setScissor(ox, 0, ew, h); renderer.render(scene, camL);
    renderer.setViewport(w / 2 + ox, 0, ew, h); renderer.setScissor(w / 2 + ox, 0, ew, h); renderer.render(scene, camR);
  } else {
    camMain.aspect = w / h; camMain.updateProjectionMatrix();
    camMain.quaternion.copy(headQ); camMain.position.copy(HEAD);
    if (S.pass && bg) updatePass(camMain.fov, w / h);
    renderer.setViewport(0, 0, w, h); renderer.setScissor(0, 0, w, h); renderer.render(scene, camMain);
  }
  for (let i = 0; i < VR.post.length; i++) VR.post[i](w, h);
}
let last = performance.now(), frames = 0, fpsT = last, hudT = 0;
function frame(t) {
  requestAnimationFrame(frame);
  const dt = Math.min((t - last) / 1000, 0.05); last = t;
  updateHead(dt);
  for (let i = 0; i < hooks.length; i++) { try { hooks[i].fn(dt, t); } catch (e) { if (!hooks[i].err) { hooks[i].err = 1; log('ERRO no quadro: ' + e.message + ' ' + ((e.stack || '').split('\n')[1] || '')); console.error(e); } } }
  hov.position.copy(HEAD); hov.quaternion.copy(headQ);
  VR.updatePano(t);
  render();
  frames++; if (t - fpsT > 1000) { S.fps = Math.round(frames * 1000 / (t - fpsT)); frames = 0; fpsT = t; adapt(); VR.tracker && VR.tracker.autoRate && VR.tracker.autoRate(); }
  if (S.debug && t - hudT > 200) { hudT = t; updateHud(); }
}
// resolução: automática (sobe/desce conforme o FPS) ou fixa
const RES = [0, 0.75, 1, 99];
VR.applyRes = () => { const m = RES[S.res] || 0; if (m) { renderer.setPixelRatio(Math.min(MAXPR, m)); resize(); } };
function adapt() {
  if (S.res) return;
  const pr = renderer.getPixelRatio();
  if (S.fps < 30 && pr > 0.7) { renderer.setPixelRatio(Math.max(0.7, pr - 0.2)); resize(); S.good = 0; }
  else if (S.fps >= 54 && pr < MAXPR) { if (++S.good >= 6) { renderer.setPixelRatio(Math.min(MAXPR, pr + 0.1)); resize(); S.good = 0; } }
  else S.good = 0;
}
function updateHud() {
  const age = performance.now() - S.lastOri, f = v => v.toFixed(1).padStart(7), H = VR.H || [];
  $('hud').textContent =
    `FPS ${S.fps}  res ${renderer.getPixelRatio().toFixed(2)}  sensor ${haveOri ? (age < 500 ? 'OK' : 'PERDIDO') : '—'}  inválidos ${S.invalid}\n` +
    `alpha ${f(S.a)}  beta ${f(S.b)}  gamma ${f(S.g)}\n` +
    `mãos ${H.filter(h => h && h.vis).length}  rastreio ${S.trkHz.toFixed(0)} Hz  inferência ${S.inferMs.toFixed(0)} ms  idade do quadro ${S.camAge.toFixed(0)} ms\n` +
    `gestos ${H.filter(h => h && h.vis).map(h => (h.right ? 'D' : 'E') + ':' + h.gesture).join('  ') || '—'}\n` +
    `câmera ${S.handsReady ? 'ON' : 'off'}  modelo ${S.cx ? 'alta' : 'rápida'}  ambiente ${S.env}`;
}
VR.start = () => requestAnimationFrame(frame);
VR.loadPano = loadPano;
})();
