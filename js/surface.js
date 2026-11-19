/* Teclado de superfície (estilo Meta Quest): apoie as mãos numa mesa, calibre e digite tocando a mesa com a ponta dos dedos.
   Também funciona flutuando à sua frente (pinça), com o toque na tela e com o teclado do PC.
   Uso por outros módulos: VR.kb.open({ label, value, max, onChange(v), onEnter(v) }) / VR.kb.close() */
(() => {
'use strict';
const VR = window.VR, T = VR.T, S = VR.S, H = VR.H, ui = VR.ui, C = ui.C, UPM = ui.UPM, HEAD = VR.HEAD, clamp = VR.clamp, hyp = Math.hypot;

// ---------- teclas (4 linhas × 10 colunas; a 2ª camada tem números e símbolos de link) ----------
const PITCH = 64, MAR = 16, GAP = 6, COLS = 10, ROWS = 4, KW = COLS * PITCH + 2 * MAR, KH = ROWS * PITCH + 2 * MAR;
const kd = (c, w) => ({ c, w: w || 1 }), chars = s => s.split('').map(c => kd(c));
const LAYERS = [
  [chars('qwertyuiop'), chars('asdfghjklç'), [kd('shift'), ...chars('zxcvbnm'), kd('.'), kd('back')], [kd('sym', 1.5), kd(','), kd(' ', 4), kd('/'), kd('enter', 2.5)]],
  [chars('1234567890'), chars('@#$%&-_()='), [...chars('+*:;!?\'"~'), kd('back')], [kd('abc', 1.5), kd('.'), kd(' ', 4), kd('/'), kd('enter', 2.5)]]
];
const SPECIAL = { shift: '⇧', back: '⌫', enter: '↵', sym: '?123', abc: 'ABC', ' ': 'espaço' };

// ---------- estado ----------
const kb = { open: false, value: '', label: '', max: 300, onChange: null, onEnter: null, layer: 0, shift: false, mode: 'float', oldReach: undefined, boost: false, prevCx: 0 };
const plane = { y: 0, cx: 0, cz: 0, yaw: 0, kp: 0.025, k: 1 };           // mesa calibrada (mundo, metros); k = escala da textura do teclado
const cal = { t: 0, sy: 0, sx: 0, sz: 0, n: 0, last: null, msg: '' };
const ENTER = 0.016, EXIT = 0.030, HOVER = 0.05;                          // alturas (m) acima da mesa: tocar, soltar, destacar tecla
const FING = [4, 8, 12, 16, 20], PALM = [0, 5, 9, 13, 17], FLAT = [0, 4, 5, 8, 9, 12, 13, 16, 17, 20];
const st = [0, 1].map(() => ({ ph: 0, pv: 0, init: false, fin: FING.map(() => ({ h: 0, v: 0, armed: false, down: false, init: false, x: 0, z: 0, tPress: 0 })) }));
const tip = new T.Vector3(), qYaw = new T.Quaternion(), qFlat = new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), -Math.PI / 2), UP = new T.Vector3(0, 1, 0);
const wpos = (out, s, i) => VR.toWorld(out, out.copy(s.P[i]).multiplyScalar(1 / S.reach));   // ponto da mão em metros reais (sem o "alcance")

// ---------- texto ----------
function changed() { if (kb.onChange) { try { kb.onChange(kb.value); } catch (e) { VR.log('teclado: ' + e.message); } } txt.dirty = true; }
function typeKey(c) {
  if (c === 'shift') { kb.shift = !kb.shift; keys.rebuild(); return; }
  if (c === 'sym' || c === 'abc') { kb.layer = c === 'sym' ? 1 : 0; kb.shift = false; keys.rebuild(); return; }
  if (c === 'enter') { submit(); return; }
  if (c === 'back') kb.value = kb.value.slice(0, -1);
  else { let ch = c; if (kb.layer === 0 && kb.shift) { ch = c.toUpperCase(); kb.shift = false; keys.rebuild(); } if (kb.value.length < kb.max) kb.value += ch; }
  changed();
}
function submit() { const v = kb.value, f = kb.onEnter; close(); if (f) { try { f(v); } catch (e) { VR.log('teclado: ' + e.message); } } }
const label = c => SPECIAL[c] || (kb.layer === 0 && kb.shift ? c.toUpperCase() : c);

// ---------- painéis ----------
ui.D.key = (g, w) => {
  const x = w.x + GAP / 2, y = w._y + GAP / 2, ww = w.w - GAP, hh = w.h - GAP, hot = w.flash && performance.now() < w.flash, on = w.active && w.active();
  ui.rr(g, x, y, ww, hh, 12);
  g.fillStyle = hot ? '#ffffff' : on ? C.acc : (w.fh || w.hov) ? 'rgba(255,255,255,.34)' : w.special ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.2)'; g.fill();
  ui.text(g, w.disp(), x + ww / 2, y + hh / 2 + 2, w.special && w.c !== 'shift' && w.c !== 'back' && w.c !== 'enter' ? 24 : 34, hot ? '#10131a' : '#fff', 'center', 600);
};
const keys = ui.panel({ id: 'kbkeys', mw: KW / UPM, mh: KH / UPM, closable: false, bar: false, order: 12, keep: true, dist: 1.0, dy: -0.3, radius: 30,
  build() {
    const out = [];
    LAYERS[kb.layer].forEach((row, r) => { let x = MAR; row.forEach(d => { const w = d.w * PITCH;
      out.push({ t: 'key', x, y: MAR + r * PITCH, w, h: PITCH, c: d.c, special: !!SPECIAL[d.c], disp: () => label(d.c), active: () => d.c === 'shift' && kb.shift, onClick: () => typeKey(d.c) }); x += w; }); });
    return out;
  } });
const txt = ui.panel({ id: 'kbtext', mw: 1.0, mh: 0.56, title: 'Teclado', titleIcon: 'keyboard', closable: false, order: 12, keep: true, dist: 1.2, dy: 0.24,
  extra(g, p) {
    ui.rr(g, 30, 92, 640, 80, 18); g.fillStyle = 'rgba(0,0,0,.35)'; g.fill(); g.lineWidth = 2; g.strokeStyle = C.line; g.stroke();
    ui.text(g, kb.label, 670, 58, 24, C.dim, 'right');
    g.font = '500 34px ' + ui.FONT; let s = kb.value, w = g.measureText(s).width; while (w > 600 && s.length > 1) { s = s.slice(1); w = g.measureText('…' + s).width; }
    ui.text(g, (s.length < kb.value.length ? '…' : '') + s + (((performance.now() / 500) | 0) % 2 ? '' : '|'), 50, 134, 34, C.txt);
    let msg = 'Aponte e belisque (pinça) as teclas';
    if (kb.mode === 'cal') msg = cal.msg || 'Apoie as mãos abertas na mesa e fique parado';
    else if (kb.mode === 'surface') msg = anyHand() ? 'Toque com a ponta dos dedos. Levante e toque de novo.' : 'Mostre as mãos para a câmera';
    ui.text(g, msg, 30, 196, 22, kb.mode === 'surface' ? C.ok : C.dim);
    if (kb.mode === 'cal') { ui.rr(g, 30, 212, 640, 8, 4); g.fillStyle = 'rgba(255,255,255,.2)'; g.fill(); ui.rr(g, 30, 212, Math.max(8, 640 * clamp(cal.t / 1.2, 0, 1)), 8, 4); g.fillStyle = C.acc; g.fill(); }
  },
  build() {
    return [
      { t: 'button', x: 30, y: 232, w: 330, h: 70, icon: 'keyboard', label: () => kb.mode === 'surface' ? 'Recalibrar mesa' : kb.mode === 'cal' ? 'Calibrando…' : 'Teclado na mesa', chev: false, onClick: () => startCal() },
      { t: 'button', x: 370, y: 232, w: 300, h: 70, label: 'Flutuante', chev: false, onClick: () => toFloat() },
      { t: 'button', x: 30, y: 312, w: 400, h: 70, label: 'Enviar', style: 'primary', chev: false, onClick: () => submit() },
      { t: 'button', x: 440, y: 312, w: 230, h: 70, label: 'Fechar', icon: 'close', chev: false, onClick: () => close() }
    ];
  } });

// ---------- poses do teclado ----------
function restoreReach() { if (kb.oldReach !== undefined) { S.reach = kb.oldReach; kb.oldReach = undefined; } }
function toFloat() {
  restoreReach(); kb.mode = 'float'; keys.fixedPose = false; keys.noHit = false; keys.mesh.scale.setScalar(1); keys.mat.depthTest = true;
  ui.place(keys, 1.0, -0.3, 0); keys.rebuild(); txt.dirty = true;
}
function startCal() {                                                     // com o alcance em 1× a mão desenhada coincide com a mão real
  if (kb.oldReach === undefined) { kb.oldReach = S.reach; S.reach = 1; }
  kb.mode = 'cal'; calReset(); cal.msg = ''; keys.fixedPose = false; keys.noHit = false; txt.dirty = true;
}
function calReset() { cal.t = 0; cal.sy = cal.sx = cal.sz = 0; cal.n = 0; }
function anyHand() { return H.some(s => s.vis && s.on); }
function toSurface() {
  plane.kp = 0.0195 * S.kbSize; plane.k = plane.kp / (PITCH / UPM); plane.yaw = VR.headYaw();
  const fx = -Math.sin(plane.yaw), fz = -Math.cos(plane.yaw);
  plane.y = cal.sy / cal.n - 0.009;                                        // a ponta do dedo fica ~9 mm acima da mesa
  plane.cx = cal.sx / cal.n - fx * 0.5 * plane.kp; plane.cz = cal.sz / cal.n - fz * 0.5 * plane.kp;   // pontas dos dedos caem na fileira do meio (ASDF)
  kb.mode = 'surface'; keys.fixedPose = true; keys.noHit = true; keys.mat.depthTest = false;
  keys.mesh.scale.setScalar(plane.k); keys.g.position.set(plane.cx, plane.y + 0.003, plane.cz);
  keys.g.quaternion.copy(qYaw.setFromAxisAngle(UP, plane.yaw).multiply(qFlat)); keys.g.updateMatrixWorld(true); keys.placed = true;
  st.forEach(s => { s.init = false; s.fin.forEach(f => { f.init = false; f.armed = false; f.down = false; }); });
  keys.rebuild(); txt.dirty = true; VR.toast('Mesa calibrada. Pode digitar.', 2200);
}

// ---------- calibração: mãos abertas, paradas e na mesma altura por ~1,2 s ----------
function calTick(dt) {
  const vis = [0, 1].filter(i => H[i].vis && H[i].on), old = cal.msg;
  if (!vis.length) { calReset(); cal.last = null; cal.msg = 'Mostre as mãos para a câmera'; if (old !== cal.msg) txt.dirty = true; return; }
  let ok = true, sy = 0, sx = 0, sz = 0, n = 0;
  for (const i of vis) {
    const s = H[i]; let lo = 9, hi = -9;
    for (const l of FLAT) { wpos(tip, s, l); lo = Math.min(lo, tip.y); hi = Math.max(hi, tip.y); }
    if (hi - lo > 0.06) ok = false;
    for (const l of [8, 12, 16, 20]) { wpos(tip, s, l); sy += tip.y; sx += tip.x; sz += tip.z; n++; }
  }
  sy /= n; sx /= n; sz /= n;
  const moving = cal.last && hyp(sx - cal.last.x, sy - cal.last.y, sz - cal.last.z) / Math.max(dt, 1e-3) > 0.12;
  cal.last = { x: sx, y: sy, z: sz };
  if (!ok) { calReset(); cal.msg = 'Abra as mãos com a palma para baixo na mesa'; }
  else if (moving) { calReset(); cal.msg = 'Fique parado'; }
  else if (sy > HEAD.y - 0.12) { calReset(); cal.msg = 'Mãos muito altas: apoie numa mesa abaixo do rosto'; }
  else {
    cal.msg = vis.length === 1 ? 'Ótimo. Com as duas mãos fica melhor' : 'Segure assim…';
    cal.t += dt; cal.sy += sy; cal.sx += sx; cal.sz += sz; cal.n++;
    if (cal.t >= 1.2) { toSurface(); return; }
  }
  if (old !== cal.msg || cal.n % 4 === 0) txt.dirty = true;
}

// ---------- digitação: toque = dedo desce rápido e para na altura da mesa (dedos que já estavam apoiados não contam) ----------
function keyAt(x, z) {
  const dx = x - plane.cx, dz = z - plane.cz, c = Math.cos(plane.yaw), s = Math.sin(plane.yaw);
  let u = KW / 2 + (dx * c - dz * s) / plane.k * UPM, v = KH / 2 - (-dx * s - dz * c) / plane.k * UPM;
  const m = 0.4 * PITCH; if (u < -m || u > KW + m || v < -m || v > KH + m) return null;
  u = clamp(u, 1, KW - 1); v = clamp(v, 1, KH - 1);
  return keys.widgets.find(w => w.t === 'key' && u >= w.x && u < w.x + w.w && v >= w.y && v < w.y + w.h) || null;
}
function hit(w) {
  w.flash = performance.now() + 140; keys.dirty = true; setTimeout(() => { keys.dirty = true; }, 160);
  if (S.kbSound) ui.sfx(w.c === ' ' ? 520 : 840, 0.045, 0.06);
  try { navigator.vibrate && navigator.vibrate(6); } catch (e) {}
  w.onClick();
}
let hovSig = '';
function typeTick(dt) {
  const now = performance.now(), hv = [];
  for (let h = 0; h < 2; h++) {
    const s = H[h], ss = st[h];
    if (!(s.vis && s.on)) { ss.init = false; ss.fin.forEach(f => { f.init = false; f.armed = false; f.down = false; }); continue; }
    let ph = 0; for (const l of PALM) { wpos(tip, s, l); ph += tip.y; } ph = ph / PALM.length - plane.y;    // altura da palma: se a mão inteira desce, não é toque de dedo
    ss.pv = ss.init ? ss.pv + ((ph - ss.ph) / dt - ss.pv) * VR.damp(20, dt) : 0; ss.ph = ph; ss.init = true;
    const cands = [];
    ss.fin.forEach((f, fi) => {
      wpos(tip, s, FING[fi]); const raw = tip.y - plane.y;
      if (!f.init) { f.init = true; f.h = raw; f.v = 0; f.armed = raw > EXIT; f.down = false; }
      else { const nh = f.h + (raw - f.h) * VR.damp(35, dt); f.v += ((nh - f.h) / dt - f.v) * VR.damp(22, dt); f.h = nh; }
      f.x = tip.x; f.z = tip.z;
      if (f.h > EXIT) { f.armed = true; f.down = false; }
      if (f.h < HOVER) { const k = keyAt(f.x, f.z); if (k) hv.push(k); }
      if (!f.down && f.armed && f.h < ENTER && f.v - ss.pv < -0.05 && f.v < -0.03 && now - f.tPress > 120) cands.push(f);
    });
    if (cands.length >= 3) cands.forEach(f => { f.armed = false; f.down = true; });                          // mão inteira pousando na mesa: ignora
    else cands.forEach(f => { f.armed = false; f.down = true; f.tPress = now; const k = keyAt(f.x, f.z); if (k) hit(k); });
  }
  const sig = hv.map(k => k.c + k.x + k.y).join('|');
  if (sig !== hovSig) { hovSig = sig; keys.widgets.forEach(w => { w.fh = false; }); hv.forEach(k => { k.fh = true; }); keys.dirty = true; }
}
VR.hook(31, dt => { if (!kb.open) return; if (kb.mode === 'cal') calTick(dt); else if (kb.mode === 'surface') typeTick(dt); });

// ---------- abrir / fechar ----------
function open(o) {
  o = o || {}; kb.value = String(o.value || ''); kb.label = o.label || 'Digitar'; kb.max = o.max || 300; kb.onChange = o.onChange || null; kb.onEnter = o.onEnter || null;
  kb.open = true; kb.layer = 0; kb.shift = false; hovSig = '';
  if (S.kbPrecise && !S.cx && !kb.boost) { kb.boost = true; S.cx = 1; VR.tracker.setOpts(); }                // modelo de mão mais preciso enquanto digita (sem salvar)
  txt.rebuild(); ui.place(txt, 1.2, 0.24, 0); ui.show(txt, true); ui.show(keys, true);
  toFloat(); if (S.kbSurface) startCal();
}
function close() {
  if (!kb.open) return;
  kb.open = false; kb.mode = 'float'; restoreReach();
  if (kb.boost) { kb.boost = false; S.cx = kb.prevCx; VR.tracker.setOpts(); }
  keys.fixedPose = false; keys.noHit = false; keys.mesh.scale.setScalar(1); keys.mat.depthTest = true;
  ui.show(txt, false); ui.show(keys, false);
}
// teclado do PC (para testar sem as mãos)
addEventListener('keydown', e => {
  if (!kb.open || (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA'))) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'Escape') { close(); e.stopImmediatePropagation(); e.preventDefault(); return; }
  if (e.key === 'Enter') { submit(); e.stopImmediatePropagation(); e.preventDefault(); return; }
  if (e.key === 'Backspace') typeKey('back');
  else if (e.key.length === 1) { if (kb.value.length < kb.max) { kb.value += e.key; changed(); } }
  else return;
  e.stopImmediatePropagation(); e.preventDefault();
}, true);

VR.kb = { open, close, isOpen: () => kb.open, mode: () => kb.mode, state: kb };
})();
