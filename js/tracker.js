/* Rastreamento de mãos: câmera + MediaPipe, filtro One-Euro, predição de atraso, profundidade e gestos (pinça/punho) */
(() => {
'use strict';
const VR = window.VR, S = VR.S, T = VR.T, log = VR.log, $ = VR.$, PT_D = VR.PT_D, HEAD = VR.HEAD, headQ = VR.headQ;
const video = $('cam'), prev = $('preview'), pctx = prev.getContext('2d');
const NL = 21, HFOV = 70 * Math.PI / 180, TWp = 2 * Math.tan(HFOV / 2);     // campo de visão assumido da câmera do celular
const hyp = Math.hypot, clamp = VR.clamp;
let hands = null, stream = null, busy = false, pumping = false, lastSend = 0, lastVT = -1, minInt = VR.IOS ? 33 : 25, lastRes = 0;

// Filtro One-Euro: tira o tremor parado e quase não atrasa movimentos rápidos (minC: corte parado, beta: quanto abre ao mover)
class OE {
  constructor() { this.x = null; this.dx = 0; this.t = 0; }
  reset() { this.x = null; this.dx = 0; }
  f(v, t, minC, beta, dC) {
    if (this.x === null) { this.x = v; this.t = t; this.dx = 0; return v; }
    const dt = Math.max(t - this.t, 1e-3); this.t = t;
    const al = c => 1 / (1 + 1 / (2 * Math.PI * c * dt));
    this.dx += al(dC) * ((v - this.x) / dt - this.dx);
    this.x += al(minC + beta * Math.abs(this.dx)) * (v - this.x); return this.x;
  }
}
const H = VR.H = [0, 1].map(() => ({
  vis: false, on: false, right: true, rs: 0, seen: -9, tUpd: 0, hasW: false, Z: 0.5, Zf: new OE(), hsm: 1, fade: 0,
  img: Array.from({ length: NL }, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0 })),
  wld: Array.from({ length: NL }, () => ({ x: 0, y: 0, z: 0 })),
  fi: Array.from({ length: NL }, () => [new OE(), new OE(), new OE()]),
  fw: Array.from({ length: NL }, () => [new OE(), new OE(), new OE()]),
  P: Array.from({ length: NL }, () => new T.Vector3()),                    // posições no espaço da cabeça (metros, já com alcance)
  tipL: new T.Vector3(), aim: new T.Vector3(), hist: [], q: new T.Quaternion(), rest: false,
  pinch: false, pe: false, fist: false, pr: 1, held: null, uiHover: false, ptrOn: false, ext: [false, false, false, false], cur: [false, false, false, false], thumb: false, gesture: '-', bl: [], rr: [0, 0, 0, 0],
  anchor: new T.Vector3(), prevA: new T.Vector3(), vel: new T.Vector3(), hasPrev: false
}));
const lastW = [null, null];
const mirror = VR.mirror;
const aspect = () => video.videoWidth ? video.videoWidth / video.videoHeight : 4 / 3;

// ---------- resultado do MediaPipe → filtros ----------
function onHands(r) {
  if (!S.first) { S.first = 1; log('primeiro resultado das mãos OK' + (r.multiHandWorldLandmarks ? ' (3D em metros disponível)' : ' (sem 3D em metros)')); }
  const t = performance.now() / 1000;
  if (lastRes) { const hz = 1 / Math.max(t - lastRes, 1e-3); S.trkHz += (hz - S.trkHz) * 0.15; } lastRes = t;
  const L0 = r.multiHandLandmarks || [], W0 = r.multiHandWorldLandmarks || [], D0 = r.multiHandedness || [], used = [false, false], dets = [];
  L0.forEach((lm, i) => {                                                  // remove detecções duplicadas da mesma mão
    if (!dets.some(o => hyp(o.lm[0].x - lm[0].x, o.lm[0].y - lm[0].y) < 0.06 && hyp(o.lm[9].x - lm[9].x, o.lm[9].y - lm[9].y) < 0.06)) dets.push({ lm, wl: W0[i], hd: D0[i] });
  });
  // quem é quem: casa cada detecção com a mão que estava mais perto no quadro anterior (não troca ao cruzar as mãos)
  const act = [0, 1].map(s => lastW[s] && t - H[s].seen < 0.5), slotOf = [], mir = mirror();
  const side = d => (mir ? 1 - d.lm[0].x : d.lm[0].x) < 0.5 ? 0 : 1, dd = (s, d) => hyp(lastW[s][0] - d.lm[0].x, lastW[s][1] - d.lm[0].y);
  if (dets.length === 1) slotOf[0] = act[0] && act[1] ? (dd(0, dets[0]) <= dd(1, dets[0]) ? 0 : 1) : act[0] ? (dd(0, dets[0]) < 0.4 ? 0 : 1) : act[1] ? (dd(1, dets[0]) < 0.4 ? 1 : 0) : side(dets[0]);
  else if (dets.length >= 2) {
    if (act[0] && act[1]) { const same = dd(0, dets[0]) + dd(1, dets[1]), swap = dd(0, dets[1]) + dd(1, dets[0]); if (same <= swap) { slotOf[0] = 0; slotOf[1] = 1; } else { slotOf[0] = 1; slotOf[1] = 0; } }
    else { const a = (mir ? 1 - dets[0].lm[0].x : dets[0].lm[0].x) <= (mir ? 1 - dets[1].lm[0].x : dets[1].lm[0].x); slotOf[0] = a ? 0 : 1; slotOf[1] = a ? 1 : 0; }
  }
  dets.forEach((d, i) => { const s = slotOf[i]; if (s === undefined || used[s]) return; used[s] = true; ingest(s, d, t); });
  if (used[0] && used[1] && H[0].right === H[1].right) { const w = Math.abs(H[0].rs) <= Math.abs(H[1].rs) ? H[0] : H[1]; w.right = !w.right; w.rs = (w.right ? 1 : -1) * 0.3; }
  drawPreview(r);
}
function ingest(si, d, t) {
  const s = H[si], lm = d.lm, fresh = t - s.seen > 0.4;
  if (fresh) { s.fi.forEach(a => a.forEach(o => o.reset())); s.fw.forEach(a => a.forEach(o => o.reset())); s.Zf.reset(); s.on = false; }
  s.seen = t; s.tUpd = t; lastW[si] = [lm[0].x, lm[0].y];
  const sm = S.smoothH, minC = VR.lerp(3.2, 0.45, sm), beta = 26, dC = 4;
  for (let i = 0; i < NL; i++) {
    const f = s.fi[i], o = s.img[i], p = lm[i];
    o.x = f[0].f(p.x, t, minC, beta, dC); o.y = f[1].f(p.y, t, minC, beta, dC); o.z = f[2].f(p.z, t, minC * 0.6, 10, dC); o.vx = f[0].dx; o.vy = f[1].dx;
  }
  s.hasW = !!(d.wl && d.wl.length === NL);
  if (s.hasW) for (let i = 0; i < NL; i++) { const f = s.fw[i], w = s.wld[i], p = d.wl[i]; w.x = f[0].f(p.x, t, minC * 0.8, 30, dC); w.y = f[1].f(p.y, t, minC * 0.8, 30, dC); w.z = f[2].f(p.z, t, minC * 0.5, 30, dC); }
  // mão esquerda ou direita: o MediaPipe assume imagem espelhada; nossos quadros não são, então o rótulo vem trocado.
  // Com a mão de lado (palma quase paralela ao raio da câmera) o classificador erra: nesse caso não vota. Zona morta evita trocar de mão no meio do giro.
  if (d.hd) {
    const asp0 = aspect(), ax = (lm[5].x - lm[0].x) * asp0, ay = lm[5].y - lm[0].y, bx = (lm[17].x - lm[0].x) * asp0, by = lm[17].y - lm[0].y, L2 = Math.max(((lm[9].x - lm[0].x) * asp0) ** 2 + (lm[9].y - lm[0].y) ** 2, 1e-6);
    s.facing = Math.abs(ax * by - ay * bx) / L2;                                 // ~0,6 palma/dorso de frente; ~0 de lado
    const sc = d.hd.score || 0.6, right = (d.hd.label === 'Left') !== !!S.swapHands, v = (right ? 1 : -1) * sc;
    if (fresh) { s.rs = v; s.right = s.rs >= 0; }
    else if (s.facing > 0.2) { s.rs = s.rs * 0.88 + v * 0.12; if (s.rs > 0.14) s.right = true; else if (s.rs < -0.14) s.right = false; }
  }
  // distância da mão: escala (m por unidade de tangente) entre os pontos 3D em metros e os pontos da imagem
  const asp = aspect(), THp = TWp / asp; let z = 0;
  if (s.hasW) {
    let mx = 0, my = 0, wx = 0, wy = 0; for (let i = 0; i < NL; i++) { mx += lm[i].x; my += lm[i].y; wx += d.wl[i].x; wy += d.wl[i].y; } mx /= NL; my /= NL; wx /= NL; wy /= NL;
    let num = 0, den = 0; for (let i = 0; i < NL; i++) { const tx = (lm[i].x - mx) * TWp, ty = (lm[i].y - my) * THp, ux = d.wl[i].x - wx, uy = d.wl[i].y - wy; num += ux * tx + uy * ty; den += tx * tx + ty * ty; }
    if (den > 1e-8 && num > 0) z = clamp(num / den, 0.15, 1.8);
    s.hsm += (clamp(hyp(d.wl[0].x - d.wl[9].x, d.wl[0].y - d.wl[9].y, d.wl[0].z - d.wl[9].z) / 0.0995, 0.6, 1.6) - s.hsm) * 0.1;
  }
  if (!z) { const sz = Math.max(0.5 * (hyp(lm[0].x - lm[9].x, lm[0].y - lm[9].y) + 1.18 * hyp(lm[5].x - lm[17].x, lm[5].y - lm[17].y)), 0.02); z = clamp(0.12 / sz, 0.3, 1.2); }
  s.Z = s.Zf.f(z, t, 1.0, 5, 2);
}

// ---------- câmera ----------
const camMsg = VR.camMsg = e => ({
  NotReadableError: 'A câmera está ocupada por outro programa (OBS, Zoom, Discord, Teams ou outra aba). Feche-o e use "Tentar câmera de novo" nos ajustes de Câmera.',
  NotAllowedError: 'Permissão de câmera negada. Permita a câmera nas configurações do navegador e tente de novo.',
  NotFoundError: 'Nenhuma câmera encontrada neste aparelho.' }[e && e.name] || ('Câmera/mãos falhou: ' + (e && e.message) + ' (precisa de HTTPS e permissão de câmera).'));
async function startCamera() {
  const stop = () => { if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; } };
  stop(); VR.camOn = false;
  // tenta configurações cada vez mais simples (o iOS recusa algumas combinações); pede 60 fps para reduzir o atraso do vídeo
  const tries = [...(S.devId ? [{ deviceId: { exact: S.devId } }] : []),
    { facingMode: { ideal: S.facing }, width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 60 } },
    { facingMode: { ideal: S.facing }, width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } }, { facingMode: S.facing }, true];
  let lastErr;
  for (const v of tries) for (let k = 0; k < 2; k++) {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: v });
      video.srcObject = stream; await video.play(); VR.camOn = true;
      try { const st = stream.getVideoTracks()[0].getSettings(); log('câmera ' + st.width + 'x' + st.height + ' @' + Math.round(st.frameRate || 0) + 'fps'); } catch (e) {}
      try { const tk = stream.getVideoTracks()[0], cp = tk.getCapabilities ? tk.getCapabilities() : {}, adv = {};
        if (cp.focusMode && cp.focusMode.includes('continuous')) adv.focusMode = 'continuous';
        if (cp.exposureMode && cp.exposureMode.includes('continuous')) adv.exposureMode = 'continuous';
        if (cp.whiteBalanceMode && cp.whiteBalanceMode.includes('continuous')) adv.whiteBalanceMode = 'continuous';
        if (Object.keys(adv).length) await tk.applyConstraints({ advanced: [adv] }); } catch (e) {}
      listCams(); return;
    } catch (e) {
      lastErr = e; log('câmera falhou (' + JSON.stringify(v).slice(0, 40) + '): ' + (e.name || '') + ' ' + e.message);
      stop(); if (e && (e.name === 'OverconstrainedError' || e.name === 'NotAllowedError' || e.name === 'NotFoundError')) break; await new Promise(r => setTimeout(r, 500));
    }
  }
  throw lastErr;
}
const tr = VR.tracker = { cams: [], onHands, startCamera, camMsg };
async function listCams() {
  try { tr.cams = (await navigator.mediaDevices.enumerateDevices()).filter(x => x.kind === 'videoinput').map((x, i) => ({ id: x.deviceId, label: x.label || 'Câmera ' + (i + 1) })); } catch (e) {}
}
tr.listCams = listCams;
tr.retryCam = async () => {
  VR.status('Tentando abrir a câmera…');
  try { await startCamera(); if (!S.handsReady) await startHands(); VR.status('Câmera ligada.'); if (S.pass) VR.setPass(true); } catch (e) { VR.status(camMsg(e)); }
};

// ---------- MediaPipe: um quadro por vez, só quando a câmera entrega quadro novo ----------
const SENS = [[0.6, 0.6], [0.5, 0.4], [0.4, 0.25]];                         // estável / normal / sensível (detecção, rastreio): sensível segura a mão em poses difíceis
const opts = () => { const q = SENS[S.trkSens] || SENS[1]; return { maxNumHands: S.maxHands, modelComplexity: S.cx, minDetectionConfidence: q[0], minTrackingConfidence: q[1], selfieMode: false }; };
tr.setOpts = () => { if (hands) hands.setOptions(opts()); };
tr.setPrecision = async v => {
  if (v) { try { const r = await fetch('vendor/mediapipe/hand_landmark_full.tflite', { method: 'HEAD' }); if (!r.ok) throw 0; } catch (e) { VR.toast('Falta o arquivo vendor/mediapipe/hand_landmark_full.tflite'); return false; } }
  S.cx = v ? 1 : 0; VR.save(); tr.setOpts(); return true;
};
async function startHands() {
  if (!hands) {
    hands = new Hands({ locateFile: f => 'vendor/mediapipe/' + f });
    hands.setOptions(opts()); hands.onResults(onHands);
    log('carregando MediaPipe...'); await hands.initialize(); log('MediaPipe carregado');
  }
  S.handsReady = true;
  if (!pumping) { pumping = true; schedule(); }
}
tr.startHands = startHands;
function schedule() { if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(pump); else requestAnimationFrame(t => pump(t, null)); }
async function pump(now, meta) {
  if (!pumping) return;
  schedule();
  if (busy || !hands || video.readyState < 2 || document.hidden) return;
  if (!meta && video.currentTime === lastVT) return;                       // sem rVFC: ignora quadro repetido
  const t0 = performance.now(); if (t0 - lastSend < minInt) return;
  lastSend = t0; lastVT = video.currentTime; busy = true;
  if (meta && meta.captureTime) S.camAge += (Math.max(0, t0 - meta.captureTime) - S.camAge) * 0.2;
  try { await hands.send({ image: video }); } catch (e) { console.warn(e); }
  busy = false; S.inferMs += ((performance.now() - t0) - S.inferMs) * 0.2;
}
// taxa de rastreamento: automática (diminui se o FPS cair, aumenta se sobrar) ou fixa
tr.autoRate = () => {
  if (S.rate) { minInt = 1000 / S.rate; return; }
  if (S.fps && S.fps < 45) minInt = Math.min(70, minInt + 8); else if (S.fps >= 56) minInt = Math.max(VR.IOS ? 22 : 16, minInt - 4);
};

// ---------- prévia da câmera (modo normal) ----------
const CONN = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];
let lastPrev = 0;
function drawPreview(r) {
  if (S.vr || !S.started || S.obs || !S.preview || !r.image) return;
  const n = performance.now(); if (n - lastPrev < 60) return; lastPrev = n;
  const w = prev.width, h = prev.height; pctx.save();
  if (mirror()) { pctx.translate(w, 0); pctx.scale(-1, 1); }
  try { pctx.drawImage(r.image, 0, 0, w, h); } catch (e) {}
  (r.multiHandLandmarks || []).forEach((lm, i) => {
    pctx.strokeStyle = i ? '#f5c' : '#4ef'; pctx.fillStyle = pctx.strokeStyle; pctx.lineWidth = 2;
    CONN.forEach(([a, b]) => { pctx.beginPath(); pctx.moveTo(lm[a].x * w, lm[a].y * h); pctx.lineTo(lm[b].x * w, lm[b].y * h); pctx.stroke(); });
    lm.forEach(p => pctx.fillRect(p.x * w - 2, p.y * h - 2, 4, 4));
  });
  pctx.restore();
}

// ---------- por quadro: monta a mão 3D no espaço da cabeça, com predição e suavização ----------
const tmp = new T.Vector3(), _a = new T.Vector3(), _b = new T.Vector3(), _x = new T.Vector3(), _y = new T.Vector3(), _z = new T.Vector3(), _m = new T.Matrix4(), _q = new T.Quaternion(), _w = new T.Vector3();
const capAbs = (v, m) => v > m ? m : v < -m ? -m : v;
function palmFrame(s) {                                                    // base da palma: Y = pulso→dedos, X = lado do polegar, Z = para fora da palma
  const P = s.P;
  _y.copy(P[9]).sub(P[0]).normalize();
  if (s.right) _x.copy(P[5]).sub(P[17]); else _x.copy(P[17]).sub(P[5]);
  _x.addScaledVector(_y, -_x.dot(_y)).normalize(); _z.crossVectors(_x, _y);
  _m.makeBasis(_x, _y, _z); return _q.setFromRotationMatrix(_m);
}
tr.palmFrame = palmFrame;
function aimAt(s, tBack) {                                                 // direção da mira alguns ms atrás (compensa o dedo mexendo ao fechar a pinça)
  const h = s.hist; if (!h.length) return s.aim;
  const tt = performance.now() - tBack; let k = h.length - 1; while (k > 0 && h[k].t > tt) k--;
  return _w.set(h[k].x, h[k].y, h[k].z);
}
tr.aimAt = aimAt;
function pinchHold(s, raw, now) {                                           // soltar só vale se persistir por 45 ms
  if (raw) { s.relT = 0; return true; }
  if (!s.pinch) return false;
  if (!s.relT) s.relT = now; return now - s.relT < 0.045;
}
// ---------- comprimento dos ossos: o tamanho da mão não muda, então a distância de cada junta ao pai fica perto do valor medido em metros (pontos 3D do MediaPipe) ----------
const PAR = [-1, 0, 1, 2, 3, 0, 5, 6, 7, 0, 9, 10, 11, 0, 13, 14, 15, 0, 17, 18, 19];
function boneFix(s) {
  const W = s.wld, P = s.P, bl = s.bl, reach = S.reach;
  for (let i = 1; i < NL; i++) { const l = hyp(W[i].x - W[PAR[i]].x, W[i].y - W[PAR[i]].y, W[i].z - W[PAR[i]].z); bl[i] = bl[i] ? bl[i] + (l - bl[i]) * 0.06 : l; }
  for (let i = 1; i < NL; i++) {
    const p = P[PAR[i]], q = P[i], dx = q.x - p.x, dy = q.y - p.y, dz = q.z - p.z, l = hyp(dx, dy, dz), tg = bl[i] * reach;
    if (l > tg * 1.15) q.set(p.x + dx * tg * 1.15 / l, p.y + dy * tg * 1.15 / l, p.z + dz * tg * 1.15 / l);
    else if (l < tg * 0.8 && l > 1e-5) q.set(p.x + dx * tg * 0.8 / l, p.y + dy * tg * 0.8 / l, p.z + dz * tg * 0.8 / l);
  }
}
// ---------- gestos: cada dedo estendido/enrolado (distância ponta→pulso ÷ junta→pulso, com histerese) e polegar para fora ou recolhido ----------
function classify(s) {
  const P = s.P, L0 = Math.max(P[0].distanceTo(P[9]), 0.02);
  for (let f = 0; f < 4; f++) {
    const t = 8 + 4 * f, r = P[t].distanceTo(P[0]) / Math.max(P[t - 3].distanceTo(P[0]), 0.02); s.rr[f] = r;
    s.cur[f] = s.cur[f] ? r < 1.3 : r < 1.15; s.ext[f] = s.ext[f] ? r > 1.4 : r > 1.55;
  }
  const td = P[4].distanceTo(P[5]) / L0; s.thumb = s.thumb ? td > 0.55 : td > 0.68;
  const nCur = s.cur.filter(Boolean).length, nExt = s.ext.filter(Boolean).length, c = s.cur, e = s.ext;
  s.fist = !s.thumb && (s.fist ? nCur >= 3 : nCur === 4);                  // punho: 4 dedos enrolados e polegar recolhido (apontar, dedo do meio e joia NÃO seguram)
  s.gesture = s.fist ? 'punho' : s.pinch ? 'pinça' : nCur === 4 && s.thumb ? 'joia' : e[1] && c[0] && c[2] && c[3] ? 'dedo do meio' : e[0] && c[1] && c[2] && c[3] ? 'apontar' : nExt >= 3 ? 'aberta' : 'outro';
}
tr.classify = classify; tr.boneFix = boneFix;
function updateHands(dt) {
  const now = performance.now() / 1000, mir = mirror(), pass = S.pass, asp = aspect();
  const TW = pass ? S.ptW / PT_D : TWp, TH = pass ? S.ptH / PT_D : TWp / asp, reach = S.reach;
  const k = VR.lerp(90, 22, S.smoothH), lead = S.lead / 1000;
  for (let h = 0; h < 2; h++) {
    const s = H[h], age = now - s.seen;
    s.pe = s.pinch; s.vis = age < 0.25; s.fade = clamp(1 - (age - 0.08) / 0.17, 0, 1);
    if (!s.vis) { s.on = false; s.relT = 0; s.pinch = s.fist = false; s.hasPrev = false; s.ptrOn = false; s.hist.length = 0; continue; }
    const P = s.P, dz0 = s.hasW ? s.wld[0].z : 0, pa = clamp(now - s.tUpd + lead, 0, 0.14), first = !s.on;
    const sp = hyp(s.img[0].vx, s.img[0].vy), a = VR.damp(k * (1 + clamp(sp * 2.5, 0, 3)), dt);   // adaptativa: acompanha rápido ao mover, firme parado
    for (let i = 0; i < NL; i++) {
      const o = s.img[i], w = s.wld[i];
      const x = o.x + capAbs(o.vx * pa, 0.05), y = o.y + capAbs(o.vy * pa, 0.05), nx = mir ? 1 - x : x;
      const dz = s.hasW ? w.z - dz0 : (o.z - s.img[0].z) * s.Z * 1.4;     // profundidade relativa (metros, ou estimada pela imagem)
      const depth = Math.max(reach * (s.Z + dz), 0.12);
      tmp.set((nx - 0.5) * TW * depth, -(y - 0.5) * TH * depth, -depth);   // cada ponto fica sobre o raio do pixel do vídeo
      if (first) P[i].copy(tmp); else P[i].lerp(tmp, a);
    }
    s.on = true; if (s.hasW) boneFix(s);
    // pinça: distância real em metros entre as pontas (imagem para x/y, 3D para a profundidade) com histerese
    const a4 = s.img[4], a8 = s.img[8];
    if (s.hasW) {
      const lat = hyp((a4.x - a8.x) * TWp, (a4.y - a8.y) * TWp / asp) * s.Z, dd = hyp(lat, 0.6 * (s.wld[4].z - s.wld[8].z)), hs0 = clamp(s.hsm, 0.75, 1.3);
      s.pinch = pinchHold(s, s.pinch ? dd < 0.048 * hs0 : dd < 0.032 * hs0, now); s.pr = dd / (0.075 * hs0);
    } else {
      const size = Math.max(hyp(s.img[0].x - s.img[9].x, s.img[0].y - s.img[9].y), 0.02), pr = hyp(a4.x - a8.x, a4.y - a8.y) / size;
      s.pinch = pinchHold(s, s.pinch ? pr < 0.5 : pr < 0.33, now); s.pr = pr / 0.8;
    }
    classify(s);
    // ponteiro: ponto entre a ponta do polegar e do indicador (não se mexe quando você fecha a pinça)
    s.tipL.copy(P[4]).add(P[8]).multiplyScalar(0.5);
    s.aim.copy(s.tipL).normalize().applyQuaternion(headQ); s.ptrOn = true;
    s.hist.push({ t: performance.now(), x: s.aim.x, y: s.aim.y, z: s.aim.z }); if (s.hist.length > 14) s.hist.shift();
    // âncora (mundo) para pegar objetos e velocidade para arremessar
    if (s.fist) _a.copy(P[0]).add(P[9]).multiplyScalar(0.5); else _a.copy(P[4]).add(P[8]).multiplyScalar(0.5);
    s.anchor.copy(_a).applyQuaternion(headQ).add(HEAD);
    if (s.hasPrev && dt > 0) s.vel.lerp(_b.copy(s.anchor).sub(s.prevA).multiplyScalar(1 / dt), 0.35);
    s.prevA.copy(s.anchor); s.hasPrev = true;
    const q = palmFrame(s); if (first) s.q.copy(q); else s.q.slerp(q, VR.damp(18, dt));
  }
}
VR.hook(20, updateHands); tr._update = updateHands;
// converte um ponto do espaço da cabeça para o mundo (sem alocar)
VR.toWorld = (out, v) => out.copy(v).applyQuaternion(headQ).add(HEAD);
})();
