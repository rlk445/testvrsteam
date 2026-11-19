/* Kit de interface 3D estilo Quest: painéis em canvas, widgets, ponteiros (pinça, toque, mouse), arrastar janelas, rolagem e sliders */
(() => {
'use strict';
const VR = window.VR, T = VR.T, S = VR.S, H = VR.H, HEAD = VR.HEAD, headQ = VR.headQ, scene = VR.scene, hov = VR.hov, clamp = VR.clamp;
const UPM = 700;                                                          // pixels de textura por metro
const FONT = '-apple-system,"SF Pro Display","Segoe UI",Roboto,"Noto Sans",system-ui,sans-serif';
const C = { txt: '#f6f8fb', dim: 'rgba(236,240,250,.64)', acc: '#4a9dff', row: 'rgba(255,255,255,.075)', rowH: 'rgba(255,255,255,.15)', rowP: 'rgba(255,255,255,.27)', line: 'rgba(255,255,255,.17)', ok: '#4fe08a', bad: '#ff6b6b' };
const ui = VR.ui = { panels: {}, list: [], UPM, C, FONT, menuOpen: false };

// ---------- desenho ----------
const rr = ui.rr = (g, x, y, w, h, r) => { r = Math.min(r, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
const text = ui.text = (g, s, x, y, size, color, align = 'left', weight = 500) => { g.font = weight + ' ' + size + 'px ' + FONT; g.fillStyle = color; g.textAlign = align; g.textBaseline = 'middle'; g.fillText(s, x, y); };
const IC = {
  home: ['M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z'],
  keyboard: ['M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z', 'M6 9h.01', 'M10 9h.01', 'M14 9h.01', 'M18 9h.01', 'M8 13h.01', 'M12 13h.01', 'M16 13h.01', 'M7 16h10'],
  hand: ['M18 11V6a2 2 0 0 0-4 0', 'M14 10V4a2 2 0 0 0-4 0v2', 'M10 10.5V6a2 2 0 0 0-4 0v8', 'M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15'],
  camera: ['M4 7h3l2-3h6l2 3h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z', 'M12 9a4 4 0 1 0 0 8a4 4 0 0 0 0-8z'],
  vr: ['M3 8h18a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-5l-2-3h-4l-2 3H3a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z'],
  cube: ['M12 2l9 5v10l-9 5-9-5V7z', 'M12 12l9-5M12 12L3 7M12 12v10'],
  help: ['M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18z', 'M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7', 'M12 17v.01'],
  play: { f: ['M7 4.5v15l13-7.5z'] }, pause: { f: ['M6 4h4v16H6z', 'M14 4h4v16h-4z'] },
  close: ['M6 6l12 12', 'M18 6L6 18'], check: ['M5 12.5l4.5 4.5L19 7'], chev: ['M9 5l7 7-7 7'], back: ['M15 5l-7 7 7 7'],
  refresh: ['M20 11a8 8 0 1 0-2.3 5.7', 'M20 4v7h-7'],
  sun: ['M12 8a4 4 0 1 0 0 8a4 4 0 0 0 0-8z', 'M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8'],
  moon: ['M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z'],
  bulb: ['M9 18h6', 'M10 21h4', 'M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z'],
  tune: ['M4 7h9', 'M17 7h3', 'M4 17h3', 'M11 17h9', 'M15 4v6', 'M9 14v6'],
  target: ['M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18z', 'M12 8a4 4 0 1 0 0 8a4 4 0 0 0 0-8z'],
  bolt: ['M13 2L4 14h7l-1 8 9-12h-7z'],
  city: ['M4 21V10l6-3v14', 'M10 21V3l10 4v14', 'M3 21h18', 'M14 10h2', 'M14 14h2', 'M14 18h2'],
  room: ['M3 11l9-8 9 8', 'M5 10v10h14V10', 'M10 20v-6h4v6'],
  image: ['M3 5h18v14H3z', 'M3 16l5-5 4 4 3-3 6 6'],
  vol: ['M4 9h4l5-4v14l-5-4H4z', 'M16.5 8.5a5 5 0 0 1 0 7', 'M19 6a8.5 8.5 0 0 1 0 12'],
  grid: ['M4 4h6v6H4z', 'M14 4h6v6h-6z', 'M4 14h6v6H4z', 'M14 14h6v6h-6z'],
  tv: ['M3 6h18v12H3z', 'M8 21h8'], door: ['M6 21V3h12v18', 'M3 21h18', 'M14.5 12v.01'],
  gamepad: ['M6 11h4M8 9v4', 'M15 12h.01', 'M18 10h.01', 'M17.32 5H6.68a4 4 0 0 0-3.98 3.59C2.6 9.42 2 14.46 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.41-1.41A2 2 0 0 1 9.83 16h4.34a2 2 0 0 1 1.41.59L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.55-.6-6.58-.68-7.26A4 4 0 0 0 17.32 5z'],
  chroma: ['M3 4h18v16H3z', 'M8 9l8 6M16 9l-8 6'], sky: ['M7 18a4 4 0 0 1-.5-8A5.5 5.5 0 0 1 17 8.5 4.8 4.8 0 0 1 17 18z']
};
const IC2 = {}; for (const k in IC) { const v = IC[k]; IC2[k] = Array.isArray(v) ? { s: v.map(d => new Path2D(d)) } : { f: v.f.map(d => new Path2D(d)) }; }
const icon = ui.icon = (g, name, cx, cy, size, color, lw = 1.9) => {
  g.save(); g.translate(cx - size / 2, cy - size / 2); g.scale(size / 24, size / 24); g.strokeStyle = color; g.fillStyle = color; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round';
  if (name === 'gear') { g.beginPath(); g.arc(12, 12, 6, 0, 7); g.stroke(); g.beginPath(); g.arc(12, 12, 2.4, 0, 7); g.stroke(); g.lineWidth = lw * 1.5; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; g.beginPath(); g.moveTo(12 + Math.cos(a) * 7, 12 + Math.sin(a) * 7); g.lineTo(12 + Math.cos(a) * 9.6, 12 + Math.sin(a) * 9.6); g.stroke(); } }
  else { const e = IC2[name]; if (e) { if (e.f) e.f.forEach(p => g.fill(p)); else e.s.forEach(p => g.stroke(p)); } }
  g.restore();
};
const glass = (g, W, Hh, r) => {
  rr(g, 3, 3, W - 6, Hh - 6, r); const gr = g.createLinearGradient(0, 0, 0, Hh); gr.addColorStop(0, 'rgba(52,56,69,.97)'); gr.addColorStop(1, 'rgba(23,25,32,.97)'); g.fillStyle = gr; g.fill();
  g.lineWidth = 2.5; g.strokeStyle = 'rgba(255,255,255,.2)'; g.stroke();
};
function mkCv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; t.generateMipmaps = true; t.minFilter = T.LinearMipmapLinearFilter; return { c, g: c.getContext('2d'), t }; }
ui.mkCv = mkCv;
const bgFor = w => w.prs ? C.rowP : w.hov ? C.rowH : C.row;
const fmtV = (w, v) => w.fmt ? w.fmt(v) : String(v);

// ---------- widgets: cada um sabe se desenhar ----------
const D = {
  toggle(g, w) {
    rr(g, w.x, w._y, w.w, w.h, 20); g.fillStyle = bgFor(w); g.fill();
    text(g, w.label, w.x + 26, w._y + (w.sub ? w.h * 0.36 : w.h / 2), 30, C.txt);
    if (w.sub) text(g, w.sub, w.x + 26, w._y + w.h * 0.72, 22, C.dim);
    const on = w.get(), k = w.k = w.k === undefined ? (on ? 1 : 0) : w.k + ((on ? 1 : 0) - w.k) * 0.4, tx = w.x + w.w - 26 - 92, ty = w._y + w.h / 2 - 26;
    if (Math.abs(k - (on ? 1 : 0)) > 0.02) w.anim = true; else { w.k = on ? 1 : 0; w.anim = false; }
    rr(g, tx, ty, 92, 52, 26); g.fillStyle = on ? C.acc : 'rgba(255,255,255,.3)'; g.fill();
    g.beginPath(); g.arc(tx + 26 + 40 * k, ty + 26, 21, 0, 7); g.fillStyle = '#fff'; g.fill();
  },
  slider(g, w) {
    rr(g, w.x, w._y, w.w, w.h, 20); g.fillStyle = bgFor(w); g.fill();
    const v = w.get(), f = clamp((v - w.min) / (w.max - w.min), 0, 1), x0 = w.x + 34, x1 = w.x + w.w - 34, ty = w._y + w.h - 34;
    text(g, w.label, w.x + 26, w._y + 32, 30, C.txt); text(g, fmtV(w, v), w.x + w.w - 26, w._y + 32, 28, C.dim, 'right');
    rr(g, x0 - 6, ty - 6, x1 - x0 + 12, 12, 6); g.fillStyle = 'rgba(255,255,255,.26)'; g.fill();
    rr(g, x0 - 6, ty - 6, (x1 - x0) * f + 12, 12, 6); g.fillStyle = C.acc; g.fill();
    g.save(); g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 10; g.beginPath(); g.arc(x0 + (x1 - x0) * f, ty, w.cap ? 25 : 21, 0, 7); g.fillStyle = '#fff'; g.fill(); g.restore();
  },
  choice(g, w) {
    rr(g, w.x, w._y, w.w, w.h, 20); g.fillStyle = bgFor(w); g.fill();
    text(g, w.label, w.x + 26, w._y + 32, 30, C.txt); if (w.sub) text(g, w.sub, w.x + w.w - 26, w._y + 32, 22, C.dim, 'right');
    const n = w.opts.length, x0 = w.x + 20, sw = (w.w - 40) / n, y0 = w._y + w.h - 66, cur = w.get();
    rr(g, x0, y0, sw * n, 52, 26); g.fillStyle = 'rgba(255,255,255,.1)'; g.fill();
    w.opts.forEach((o, i) => {
      const sel = o[0] === cur, cx = x0 + sw * (i + 0.5);
      if (w.swatch) { g.beginPath(); g.arc(cx, y0 + 26, 17, 0, 7); g.fillStyle = o[2]; g.fill(); if (sel) { g.lineWidth = 4; g.strokeStyle = '#fff'; g.beginPath(); g.arc(cx, y0 + 26, 23, 0, 7); g.stroke(); } return; }
      if (sel) { rr(g, x0 + sw * i + 3, y0 + 3, sw - 6, 46, 23); g.fillStyle = '#fff'; g.fill(); }
      text(g, o[1], cx, y0 + 27, 25, sel ? '#10131a' : C.txt, 'center', sel ? 700 : 500);
    });
  },
  button(g, w) {
    const st = w.style, bg = st === 'primary' ? (w.prs ? '#cfe3ff' : w.hov ? '#e8f1ff' : '#ffffff') : st === 'danger' ? (w.prs ? 'rgba(255,107,107,.5)' : w.hov ? 'rgba(255,107,107,.36)' : 'rgba(255,107,107,.22)') : bgFor(w);
    rr(g, w.x, w._y, w.w, w.h, 20); g.fillStyle = bg; g.fill();
    const col = st === 'primary' ? '#10131a' : C.txt; let tx = w.x + 26;
    if (w.icon) { icon(g, w.icon, tx + 16, w._y + w.h / 2, 34, col); tx += 52; }
    text(g, typeof w.label === 'function' ? w.label() : w.label, tx, w.h > 70 && w.sub ? w._y + w.h * 0.36 : w._y + w.h / 2, 30, col, 'left', st === 'primary' ? 700 : 500);
    if (w.sub) text(g, typeof w.sub === 'function' ? w.sub() : w.sub, tx, w._y + w.h * 0.72, 22, st === 'primary' ? 'rgba(16,19,26,.6)' : C.dim);
    if (w.val) text(g, w.val(), w.x + w.w - 62, w._y + w.h / 2, 26, C.dim, 'right');
    if (st !== 'primary' && w.chev !== false) icon(g, 'chev', w.x + w.w - 38, w._y + w.h / 2, 26, C.dim);
  },
  bind(g, w) {
    rr(g, w.x, w._y, w.w, w.h, 20); g.fillStyle = bgFor(w); g.fill();
    text(g, w.label, w.x + 26, w._y + 32, 30, C.txt);
    const lis = w.listening(), cur = w.get(), bx = w.x + 26, by = w._y + 58, bw = Math.min(250, w.w - 120), bh = 52;
    rr(g, bx, by, bw, bh, 14); g.fillStyle = lis ? 'rgba(74,157,255,.28)' : 'rgba(255,255,255,.1)'; g.fill();
    g.lineWidth = lis ? 4 : 2; g.strokeStyle = lis ? C.acc : C.line; g.stroke();
    text(g, lis ? 'Aperte um botão…' : (cur ? w.fmt(cur) : 'Toque aqui'), bx + bw / 2, by + bh / 2 + 1, 25, lis ? '#fff' : (cur ? C.txt : C.dim), 'center', 600);
    if (cur && !lis) { g.beginPath(); g.arc(w.x + w.w - 44, by + bh / 2, 22, 0, 7); g.fillStyle = 'rgba(255,255,255,.14)'; g.fill(); icon(g, 'close', w.x + w.w - 44, by + bh / 2, 22, '#fff', 2.4); }
  },
  pic(g, w) {
    rr(g, w.x, w._y, w.w, w.h, 20); const gr = g.createLinearGradient(0, w._y, 0, w._y + w.h); gr.addColorStop(0, '#eef1f7'); gr.addColorStop(1, '#c4ccdc'); g.fillStyle = gr; g.fill();
    const im = w.img; if (im && im.complete && im.naturalWidth) { const k = Math.min((w.w - 20) / im.naturalWidth, (w.h - 78) / im.naturalHeight), iw = im.naturalWidth * k, ih = im.naturalHeight * k; g.drawImage(im, w.x + (w.w - iw) / 2, w._y + 14 + (w.h - 78 - ih) / 2, iw, ih); }
    else icon(g, 'gamepad', w.x + w.w / 2, w._y + (w.h - 60) / 2, 90, '#2a3042', 1.6);
    text(g, w.label, w.x + w.w / 2, w._y + w.h - 40, 22, '#1b2030', 'center', 700);
    text(g, w.sub, w.x + w.w / 2, w._y + w.h - 16, 18, '#4a5266', 'center', 500);
  },
  info(g, w) { rr(g, w.x, w._y, w.w, w.h, 20); g.fillStyle = C.row; g.fill(); text(g, w.label, w.x + 26, w._y + w.h / 2, 28, C.txt); text(g, w.val(), w.x + w.w - 26, w._y + w.h / 2, 28, C.dim, 'right'); },
  note(g, w) { w.lines.forEach((l, i) => text(g, l, w.x + 8, w._y + 16 + i * (w.lh || 32), w.size || 24, w.color || C.dim, 'left', w.weight || 400)); },
  head(g, w) { text(g, w.label.toUpperCase(), w.x + 10, w._y + w.h - 18, 21, C.dim, 'left', 700); },
  tab(g, w) {
    const sel = w.active(); rr(g, w.x, w._y, w.w, w.h, 18); g.fillStyle = sel ? 'rgba(255,255,255,.2)' : w.prs ? C.rowP : w.hov ? C.rowH : 'rgba(255,255,255,0)'; g.fill();
    icon(g, w.icon, w.x + 38, w._y + w.h / 2, 32, sel ? '#fff' : 'rgba(255,255,255,.75)'); text(g, w.label, w.x + 70, w._y + w.h / 2, 27, sel ? '#fff' : 'rgba(255,255,255,.78)', 'left', sel ? 700 : 500);
  },
  dock(g, w) {                                                            // ícone redondo com legenda (dock)
    const on = w.active ? w.active() : false, cx = w.x + w.w / 2, cy = w._y + 50, r = w.hov || w.prs ? 52 : 46;
    g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fillStyle = on ? '#fff' : w.prs ? 'rgba(255,255,255,.38)' : w.hov ? 'rgba(255,255,255,.26)' : 'rgba(255,255,255,.13)'; g.fill();
    icon(g, w.icon, cx, cy, 44, on ? '#10131a' : '#fff', 2.1); text(g, w.label, cx, w._y + 112, 20, w.hov || on ? '#fff' : C.dim, 'center', w.hov || on ? 700 : 500);
  },
  tile(g, w) {                                                            // ajuste rápido: círculo + legenda
    const on = w.active ? w.active() : false, cx = w.x + w.w / 2, cy = w._y + 58, r = w.hov || w.prs ? 62 : 56;
    g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fillStyle = on ? '#fff' : w.prs ? 'rgba(255,255,255,.38)' : w.hov ? 'rgba(255,255,255,.26)' : 'rgba(255,255,255,.13)'; g.fill();
    icon(g, w.icon, cx, cy, 52, on ? '#10131a' : '#fff', 2.1); text(g, w.label, cx, w._y + 142, 25, C.txt, 'center', 600);
    if (w.state) text(g, w.state(), cx, w._y + 172, 21, C.dim, 'center');
  },
  card(g, w) {                                                            // cartão de ambiente
    const sel = w.active(), gr = g.createLinearGradient(w.x, w._y, w.x + w.w, w._y + w.h); gr.addColorStop(0, w.c0); gr.addColorStop(1, w.c1);
    rr(g, w.x, w._y, w.w, w.h, 26); g.fillStyle = gr; g.fill();
    if (w.hov || w.prs) { rr(g, w.x, w._y, w.w, w.h, 26); g.fillStyle = w.prs ? 'rgba(255,255,255,.28)' : 'rgba(255,255,255,.14)'; g.fill(); }
    icon(g, w.icon, w.x + w.w / 2, w._y + w.h * 0.38, 76, 'rgba(255,255,255,.95)', 1.7);
    rr(g, w.x, w._y + w.h - 62, w.w, 62, 0); g.save(); rr(g, w.x, w._y, w.w, w.h, 26); g.clip(); g.fillStyle = 'rgba(0,0,0,.38)'; g.fillRect(w.x, w._y + w.h - 62, w.w, 62); g.restore();
    text(g, w.label, w.x + w.w / 2, w._y + w.h - 31, 29, '#fff', 'center', 700);
    if (sel) { rr(g, w.x + 3, w._y + 3, w.w - 6, w.h - 6, 24); g.lineWidth = 6; g.strokeStyle = C.acc; g.stroke(); g.beginPath(); g.arc(w.x + w.w - 34, w._y + 34, 20, 0, 7); g.fillStyle = C.acc; g.fill(); icon(g, 'check', w.x + w.w - 34, w._y + 34, 24, '#fff', 3); }
  },
  x(g, w) { g.beginPath(); g.arc(w.x + w.w / 2, w._y + w.h / 2, w.hov || w.prs ? 30 : 27, 0, 7); g.fillStyle = w.prs ? 'rgba(255,255,255,.4)' : w.hov ? 'rgba(255,255,255,.28)' : 'rgba(255,255,255,.14)'; g.fill(); icon(g, 'close', w.x + w.w / 2, w._y + w.h / 2, 28, '#fff', 2.6); },
  orb(g, w) { const cx = w.x + w.w / 2, cy = w._y + w.h / 2, r = w.hov || w.prs ? 56 : 50; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fillStyle = w.prs ? 'rgba(255,255,255,.5)' : 'rgba(20,22,30,.82)'; g.fill(); g.lineWidth = 4; g.strokeStyle = w.hov ? '#fff' : 'rgba(255,255,255,.55)'; g.stroke();
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { g.beginPath(); g.arc(cx + (i - 1) * 17, cy + (j - 1) * 17, 5.4, 0, 7); g.fillStyle = w.prs ? '#10131a' : '#fff'; g.fill(); } },
  text(g, w) { text(g, typeof w.label === 'function' ? w.label() : w.label, w.x, w._y + w.h / 2, w.size || 26, w.color || C.txt, w.align || 'left', w.weight || 500); }
};
ui.D = D;                                                            // permite que outros módulos (teclado) registrem novos widgets
const CLICK = { button: 1, toggle: 1, choice: 1, tab: 1, dock: 1, tile: 1, card: 1, x: 1, orb: 1 };

// ---------- painel ----------
class Panel {
  constructor(o) {
    Object.assign(this, { id: '', mw: 1, mh: 0.6, space: 'world', glass: true, title: '', closable: true, bar: true, build: null, extra: null, order: 10, scrollY: 0, sc: null, widgets: [], vis: false, anim: 0, dirty: true, dist: 1.3, dy: 0, dx: 0, radius: 40, primary: false, noHit: false, titleIcon: '', placed: false, contentH: 0 }, o);
    this.W = Math.round(this.mw * UPM); this.H = Math.round(this.mh * UPM); this.barH = this.bar ? 56 : 0; this.CH = this.H + this.barH;
    this.cv = mkCv(this.W, this.CH);
    this.mat = new T.MeshBasicMaterial({ map: this.cv.t, transparent: true, depthWrite: false, depthTest: this.space === 'world', fog: false, toneMapped: false, opacity: 0 });
    this.mesh = new T.Mesh(new T.PlaneGeometry(this.W / UPM, this.CH / UPM), this.mat); this.mesh.position.y = -this.barH / 2 / UPM; this.mesh.renderOrder = this.order;
    this.g = new T.Group(); this.g.add(this.mesh); this.g.visible = false; this.inv = new T.Matrix4(); this.vp = new T.Vector3();
    (this.space === 'head' ? hov : scene).add(this.g);
    this.fixed = []; this.rebuild(); ui.panels[this.id] = this; ui.list.push(this);
  }
  rebuild() {
    this.fixed = []; const rows = this.build ? this.build(this) || [] : [];
    this.widgets = this.fixed.concat(rows.filter(w => !w.show || w.show()));
    if (this.closable && this.glass && !this.noX) this.widgets.push({ t: 'x', x: this.W - 82, y: 16, w: 64, h: 64, onClick: () => ui.closeWin(this.id) });
    this.clampScroll(); this.dirty = true;
  }
  scrollMax() { return this.sc ? Math.max(0, this.contentH - this.sc.h) : 0; }
  clampScroll() { this.scrollY = clamp(this.scrollY, 0, this.scrollMax()); }
  scrollTo(y) { const o = this.scrollY; this.scrollY = clamp(y, 0, this.scrollMax()); if (o !== this.scrollY) this.dirty = true; }
  layoutRows(rows, x, w, gap) { let y = 0; rows.forEach(r => { r.x = x; r.w = w; r.y = y; r.sc = true; y += r.h + (gap === undefined ? 10 : gap); }); this.contentH = Math.max(0, y - 10); return rows; }
  widgetAt(u, v) {
    for (let i = this.widgets.length - 1; i >= 0; i--) {
      const w = this.widgets[i]; if (!w.t || w.t === 'head' || w.t === 'note' || w.t === 'text' || w.t === 'pic' || (w.t === 'info' && !w.onClick)) continue;
      let y = w.y; if (w.sc) { const s = this.sc; if (u < s.x || u > s.x + s.w || v < s.y || v > s.y + s.h) continue; y = s.y + w.y - this.scrollY; }
      if (u >= w.x && u <= w.x + w.w && v >= y && v <= y + w.h) return w;
    }
    return null;
  }
  // raio (origem o, direção d) → { t, u, v, point } em pixels do painel; v > H é a barrinha de arrastar
  hit(o, d) {
    const e = this.g.matrixWorld.elements, nx = e[8], ny = e[9], nz = e[10], den = nx * d.x + ny * d.y + nz * d.z; if (Math.abs(den) < 1e-6) return null;
    const t = ((e[12] - o.x) * nx + (e[13] - o.y) * ny + (e[14] - o.z) * nz) / den; if (t <= 0.05) return null;
    this.vp.set(o.x + d.x * t, o.y + d.y * t, o.z + d.z * t); this.vp.applyMatrix4(this.inv);
    const u = this.vp.x * UPM + this.W / 2, v = this.H / 2 - this.vp.y * UPM;
    if (u < -10 || u > this.W + 10 || v < -10 || v > this.H + this.barH + 10) return null;
    return { panel: this, t, u, v, point: null };
  }
  draw() {
    const g = this.cv.g, W = this.W, Hh = this.H; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, this.CH);
    if (this.glass) glass(g, W, Hh, this.radius);
    if (this.title) { if (this.titleIcon) icon(g, this.titleIcon, 52, 48, 34, '#fff'); text(g, this.title, this.titleIcon ? 84 : 40, 48, 36, '#fff', 'left', 700); }
    const sc = this.sc;
    for (const w of this.widgets) if (!w.sc && D[w.t]) { w._y = w.y; D[w.t](g, w); }
    if (this.extra) this.extra(g, this);
    if (sc) {
      g.save(); rr(g, sc.x, sc.y, sc.w + 14, sc.h, 14); g.clip();
      for (const w of this.widgets) if (w.sc && D[w.t]) { w._y = sc.y + w.y - this.scrollY; if (w._y + w.h < sc.y - 2 || w._y > sc.y + sc.h + 2) continue; D[w.t](g, w); }
      g.restore();
      const mx = this.scrollMax(); if (mx > 0) { const th = Math.max(50, sc.h * sc.h / this.contentH), ty = sc.y + (this.scrollY / mx) * (sc.h - th); rr(g, sc.x + sc.w + 6, ty, 8, th, 4); g.fillStyle = 'rgba(255,255,255,.45)'; g.fill(); }
    }
    if (this.bar) { const bh = this.barH; rr(g, W / 2 - 90, Hh + bh / 2 - 7, 180, 14, 7); g.fillStyle = this.barHov ? '#fff' : 'rgba(255,255,255,.5)'; g.fill(); }
    this.cv.t.needsUpdate = true; this.dirty = false;
  }
  anyAnim() { return this.widgets.some(w => w.anim); }
}
ui.Panel = Panel;
ui.panel = o => new Panel(o);

// ---------- posicionamento ----------
ui.place = (p, dist, dy, dx) => {
  dist *= S.vr ? 1 : 0.66; dx = dx || 0;                                       // na tela normal as janelas ficam mais perto (maiores)
  const yaw = VR.headYaw(), fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
  p.g.position.set(HEAD.x + fx * dist + rx * dx, HEAD.y + dy, HEAD.z + fz * dist + rz * dx); p.g.lookAt(HEAD.x, p.g.position.y, HEAD.z); p.g.updateMatrixWorld(true); p.placed = true;
};
ui.widgetScreen = (id, match) => {                                           // (teste) posição na tela do centro de um widget
  const p = ui.panels[id]; if (!p) return null; const w = p.widgets.find(x => (typeof x.label === 'function' ? x.label() : x.label) === match || x.icon === match); if (!w) return null;
  const y = w.sc ? p.sc.y + w.y - p.scrollY : w.y, v = new T.Vector3((w.x + w.w / 2 - p.W / 2) / UPM, (p.H / 2 - (y + w.h / 2)) / UPM, 0); p.g.updateMatrixWorld(true); p.g.localToWorld(v);
  const cam = S.vr ? VR.camL : VR.camMain; cam.updateMatrixWorld(); v.project(cam); const W = innerWidth, Hh = innerHeight, ew = S.vr ? (W / 2) * S.eyeW : W, ox = S.vr ? (W / 2 - ew) / 2 : 0;
  return { x: ox + (v.x * 0.5 + 0.5) * ew, y: (-v.y * 0.5 + 0.5) * Hh, w };
};
ui.show = (p, on) => { if (on && !p.vis) { if (!p.placed && p.space === 'world') ui.place(p, p.dist, p.dy, p.dx); p.dirty = true; if (p.onOpen) p.onOpen(p); } p.vis = on; if (on) p.g.visible = true; };
ui.anyVisible = () => ui.list.some(p => p.vis && p.space === 'world');
ui.openWin = id => { const p = ui.panels[id]; if (!p) return; if (p.primary) ui.list.forEach(q => { if (q.primary && q !== p) ui.show(q, false); }); ui.show(p, true); ui.menuOpen = true; ui.show(ui.panels.dock, true); ui.show(ui.panels.orb, false); };
ui.closeWin = id => { const p = ui.panels[id]; if (p) ui.show(p, false); if (id === 'dock') ui.closeMenu(); };
ui.toggleWin = id => { const p = ui.panels[id]; if (!p) return; if (p.vis) ui.closeWin(id); else ui.openWin(id); };
ui.closeMenu = () => { ui.menuOpen = false; ui.list.forEach(p => { if (p.space === 'world' && p.id !== 'yt' && !p.keep) ui.show(p, false); }); ui.show(ui.panels.orb, true); };
ui.openMenu = () => { ui.menuOpen = true; ui.show(ui.panels.dock, true); ui.show(ui.panels.orb, false); if (!ui.list.some(p => p.primary && p.vis)) ui.show(ui.panels[ui.lastPrimary || 'quick'], true); };
ui.toggleMenu = () => { if (ui.menuOpen) ui.closeMenu(); else ui.openMenu(); };
ui.replaceAll = () => ui.list.forEach(p => { if (p.space === 'world' && p.vis && !p.fixedPose) ui.place(p, p.dist, p.dy, p.dx); });   // reposiciona as janelas à frente (depois de recentralizar)
VR.onRecenter.push(() => ui.replaceAll());

// ---------- ponteiros: 0/1 = mãos (pinça), 2 = mouse/toque ----------
const mouse = ui.mouse = { on: false, down: false, o: new T.Vector3(), d: new T.Vector3(), id: null };
const ptr = [0, 1, 2].map(i => ({ idx: i, o: new T.Vector3(), d: new T.Vector3(), dp: new T.Vector3(), down: false, prev: false, hov: null, hovP: null, cap: null, dwellW: null, dwellT: 0, dwellDone: false, vib: 0, cur: { mode: '', prog: -1 } }));
const curMat = [0, 1, 2].map(() => { const cv = mkCv(128, 128), m = new T.Mesh(new T.PlaneGeometry(0.055, 0.055), new T.MeshBasicMaterial({ map: cv.t, transparent: true, depthTest: false, depthWrite: false, fog: false, toneMapped: false })); m.renderOrder = 30; m.visible = false; scene.add(m); return { cv, m }; });
function drawCursor(c, mode, prog, down) {
  const k = mode + '|' + Math.round(prog * 20) + '|' + down; if (c.key === k) return; c.key = k; const g = c.cv.g; g.clearRect(0, 0, 128, 128);
  const col = mode === 'prop' ? '#7dffb0' : mode === 'int' ? '#ffd166' : '#ffffff';
  g.lineWidth = 9; g.strokeStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.arc(64, 64, down ? 26 : 34, 0, 7); g.stroke();
  g.lineWidth = 6; g.strokeStyle = col; g.beginPath(); g.arc(64, 64, down ? 26 : 34, 0, 7); g.stroke();
  if (down) { g.fillStyle = col; g.beginPath(); g.arc(64, 64, 14, 0, 7); g.fill(); }
  if (prog > 0) { g.lineWidth = 9; g.strokeStyle = '#4a9dff'; g.beginPath(); g.arc(64, 64, 48, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2); g.stroke(); }
  c.cv.t.needsUpdate = true;
}
function hitPanels(o, d, hands) {
  let best = null;
  for (const p of ui.list) { if (!p.vis || p.anim < 0.5 || p.noHit) continue; const h = p.hit(o, d); if (h && (!best || h.t < best.t)) best = h; }
  if (best) best.point = new T.Vector3(o.x + d.x * best.t, o.y + d.y * best.t, o.z + d.z * best.t);
  return best;
}
ui.hitPanels = hitPanels;
const sfxCtx = { ctx: null };
ui.sfx = (f, dur, vol) => {                                               // clique sonoro curto
  try { if (!sfxCtx.ctx) { const A = window.AudioContext || window.webkitAudioContext; if (!A) return; sfxCtx.ctx = new A(); } const c = sfxCtx.ctx; if (c.state === 'suspended') c.resume();
    const o = c.createOscillator(), g = c.createGain(); o.frequency.value = f; o.type = 'sine'; g.gain.setValueAtTime(vol || 0.07, c.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur); o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + dur); } catch (e) {}
};
const haptic = () => { try { navigator.vibrate && navigator.vibrate(8); } catch (e) {} };
function setHov(p, w, panel) {
  if (p.hov === w) return;
  if (p.hov) { p.hov.hov = false; if (p.hovP) p.hovP.dirty = true; }
  p.hov = w; p.hovP = panel || null; p.dwellW = null; p.dwellT = 0; p.dwellDone = false;
  if (w) { w.hov = true; panel.dirty = true; }
}
function sliderSet(w, panel, u) {
  const x0 = w.x + 34, x1 = w.x + w.w - 34; let v = w.min + clamp((u - x0) / (x1 - x0), 0, 1) * (w.max - w.min);
  if (w.step) v = Math.round(v / w.step) * w.step; v = +v.toFixed(4); if (v !== w.get()) { w.set(v); if (w.on) w.on(v); VR.save(); panel.dirty = true; }
}
function activate(p, panel, w, u, v) {
  w.prs = true; panel.dirty = true; p.pressW = w; p.pressP = panel; haptic();
  switch (w.t) {
    case 'slider': p.cap = { type: 'slider', panel, w }; w.cap = true; sliderSet(w, panel, u); break;
    case 'toggle': { const nv = !w.get(); w.set(nv); if (w.on) w.on(nv); VR.save(); ui.sfx(nv ? 760 : 520, 0.06); if (panel.build && w.rebuild) panel.rebuild(); break; }
    case 'choice': { const n = w.opts.length, x0 = w.x + 20, sw = (w.w - 40) / n, i = Math.floor((u - x0) / sw); if (i >= 0 && i < n) { w.set(w.opts[i][0]); if (w.on) w.on(w.opts[i][0]); VR.save(); ui.sfx(900, 0.05); if (w.rebuild) panel.rebuild(); } break; }
    case 'bind': ui.sfx(900, 0.05); if (w.onPress) w.onPress(u - w.x, w); break;
    default: if (w.onClick) { ui.sfx(900, 0.05); w.onClick(w, panel); } break;
  }
}
function pressPanelBg(p, hit) {
  const pn = hit.panel;
  if (hit.v > pn.H - 4) { const dist = clamp(hit.t, 0.6, 3.5); pn.g.updateMatrixWorld(true); p.cap = { type: 'drag', panel: pn, dist, off: pn.g.position.clone().sub(p.o).addScaledVector(p.d, -dist) }; pn.barHov = true; pn.dirty = true; ui.sfx(600, 0.05); return; }
  if (pn.sc && hit.u >= pn.sc.x && hit.u <= pn.sc.x + pn.sc.w + 16 && hit.v >= pn.sc.y && hit.v <= pn.sc.y + pn.sc.h) p.cap = { type: 'scroll', panel: pn, v0: hit.v, s0: pn.scrollY, moved: 0 };
}
function updateCapture(p) {
  const c = p.cap, pn = c.panel; pn.g.updateMatrixWorld(true);
  if (c.type === 'drag') { const x = p.o.x + p.d.x * c.dist + c.off.x, y = p.o.y + p.d.y * c.dist + c.off.y, z = p.o.z + p.d.z * c.dist + c.off.z; pn.g.position.set(x, y, z); pn.g.lookAt(HEAD.x, y, HEAD.z); pn.g.updateMatrixWorld(true); return { point: pn.g.position, mode: 'ui' }; }
  const pl = hitPlane(pn, p.o, p.d); if (!pl) return null;
  if (c.type === 'slider') sliderSet(c.w, pn, pl.u);
  else if (c.type === 'scroll') { const dv = pl.v - c.v0; c.moved = Math.max(c.moved, Math.abs(dv)); pn.scrollTo(c.s0 - dv); }
  return { point: pl.point, mode: 'ui' };
}
function hitPlane(pn, o, d) {                                             // como hit(), mas sem limitar à borda do painel (para arrastar sliders)
  const e = pn.g.matrixWorld.elements, nx = e[8], ny = e[9], nz = e[10], den = nx * d.x + ny * d.y + nz * d.z; if (Math.abs(den) < 1e-6) return null;
  const t = ((e[12] - o.x) * nx + (e[13] - o.y) * ny + (e[14] - o.z) * nz) / den; if (t <= 0.05) return null;
  const v = new T.Vector3(o.x + d.x * t, o.y + d.y * t, o.z + d.z * t), pt = v.clone(); v.applyMatrix4(pn.inv); return { u: v.x * UPM + pn.W / 2, v: pn.H / 2 - v.y * UPM, point: pt };
}
function endCapture(p) {
  const c = p.cap; if (!c) return; if (c.type === 'slider') c.w.cap = false; if (c.type === 'drag') c.panel.barHov = false; c.panel.dirty = true; p.cap = null;
}
const lookback = new T.Vector3();
ui.updatePointers = dt => {
  const t = performance.now(), show = ui.list.some(p => p.vis) && !S.obs;
  for (const p of ui.list) { if (!p.g.visible) continue; p.g.updateMatrixWorld(true); p.inv.copy(p.g.matrixWorld).invert(); }
  for (let i = 0; i < 3; i++) {
    const p = ptr[i], s = i < 2 ? H[i] : null, cm = curMat[i];
    let on = false;
    if (s) { on = s.vis && s.on && s.ptrOn; if (on) { p.o.copy(HEAD); p.d.copy(s.aim); p.down = s.pinch; } }
    else { on = mouse.on || mouse.pend; if (on) { p.o.copy(mouse.o); p.d.copy(mouse.d); p.down = mouse.down || mouse.pend; VR.MH.aim.copy(mouse.d); } VR.MH.pinch = on && p.down; }
    const press = on && p.down && !p.prev, rel = !p.down && p.prev; p.prev = on && p.down;
    if (!on) { endCapture(p); setHov(p, null); if (s) { s.uiHover = false; } VR.world.clearHover(i); cm.m.visible = false; continue; }
    if (press) { if (s) p.dp.copy(VR.tracker.aimAt(s, 110)); else p.dp.copy(p.d); }    // na pinça usa a mira de ~110 ms atrás (o dedo mexe ao fechar)
    let res = null;
    if (p.cap) {
      if (!p.down) endCapture(p); else { res = updateCapture(p); if (s) s.uiHover = true; }
    }
    if (!p.cap) {
      const hit = show ? hitPanels(p.o, press ? p.dp : p.d) : null;
      if (hit) {
        if (s) s.uiHover = true;
        const w = hit.v <= hit.panel.H ? hit.panel.widgetAt(hit.u, hit.v) : null; setHov(p, w, hit.panel);
        if (hit.panel.barHov !== (hit.v > hit.panel.H - 4)) { hit.panel.barHov = hit.v > hit.panel.H - 4; hit.panel.dirty = true; }
        if (press) { if (w) activate(p, hit.panel, w, hit.u, hit.v); else pressPanelBg(p, hit); if (s) s.busy = true; }
        // clique ao manter o dedo parado (opcional)
        if (S.dwell && w && CLICK[w.t] && !p.down) { if (p.dwellW !== w) { p.dwellW = w; p.dwellT = 0; p.dwellDone = false; } else if (!p.dwellDone) { p.dwellT += dt; if (p.dwellT > 1.1) { p.dwellDone = true; activate(p, hit.panel, w, hit.u, hit.v); setTimeout(() => { w.prs = false; hit.panel.dirty = true; }, 140); } } }
        res = { point: hit.point, mode: 'ui' };
      } else {
        setHov(p, null); if (s) s.uiHover = false;
        res = VR.world.pointer({ o: p.o, d: press ? p.dp : p.d, idx: i }, press, s || VR.MH); if (res) res.mode = res.kind;
        if (!res) VR.world.clearHover(i);
        // mouse/toque: mostra a mira também no vazio? não — só quando há alvo
      }
    }
    if (rel && p.pressW) { p.pressW.prs = false; if (p.pressP) p.pressP.dirty = true; p.pressW = null; }
    if (res && res.point) {
      const dist = res.point.distanceTo(HEAD); cm.m.visible = true; cm.m.position.copy(res.point); cm.m.lookAt(HEAD); cm.m.scale.setScalar(clamp(dist * 0.85, 0.5, 3.5));
      const prog = p.dwellW && !p.dwellDone ? clamp(p.dwellT / 1.1, 0, 1) : 0; drawCursor(cm, res.mode || 'ui', prog, p.down);
    } else cm.m.visible = false;
  }
  if (mouse.pend) { mouse.pend = false; if (!mouse.down && mouse.touch) mouse.on = false; }
  // animação de abrir/fechar e redesenho só do que mudou
  for (const pn of ui.list) {
    const tgt = pn.vis && show ? 1 : 0; pn.anim += (tgt - pn.anim) * VR.damp(16, dt); if (Math.abs(tgt - pn.anim) < 0.01) pn.anim = tgt;
    const vis = pn.anim > 0.01; pn.g.visible = vis; if (!vis) continue;
    pn.mat.opacity = pn.anim; pn.g.scale.setScalar(0.9 + 0.1 * pn.anim);
    if (pn.dirty || pn.anyAnim()) pn.draw();
  }
};
VR.hook(30, ui.updatePointers);

// ---------- mouse/toque (tela normal ou dividida) ----------
(() => {
  const canvas = VR.$('scene');
  function setRay(e) {
    const w = innerWidth, h = innerHeight; let cam = VR.camMain, nx = e.clientX / w * 2 - 1;
    if (S.vr) { const ew = (w / 2) * S.eyeW, ox = (w / 2 - ew) / 2, eyeI = e.clientX < w / 2 ? 0 : 1; cam = eyeI ? VR.camR : VR.camL; nx = clamp((e.clientX - (eyeI * w / 2 + ox)) / ew, 0, 1) * 2 - 1; }
    cam.updateMatrixWorld(); mouse.o.copy(cam.position); mouse.d.set(nx, -(e.clientY / h) * 2 + 1, 0.5).unproject(cam).sub(mouse.o).normalize(); mouse.on = true;
  }
  canvas.addEventListener('pointerdown', e => {
    if (!S.started || ui.noPointer) return; setRay(e);
    const hit = ui.list.some(p => p.vis) ? hitPanels(mouse.o, mouse.d) : null;
    if (hit || VR.world.peek(mouse.o, mouse.d)) { mouse.down = true; mouse.pend = true; mouse.touch = e.pointerType !== 'mouse'; mouse.id = e.pointerId; canvas.setPointerCapture(e.pointerId); ui.touchUsed = true; e.stopImmediatePropagation(); e.preventDefault(); }
  }, true);
  canvas.addEventListener('pointermove', e => { if (!S.started) return; if (e.pointerType === 'mouse' || mouse.down) { setRay(e); if (mouse.down) e.stopImmediatePropagation(); } }, true);
  const up = e => { if (mouse.down && e.pointerId === mouse.id) { mouse.down = false; mouse.id = null; if (e.pointerType !== 'mouse' && !mouse.pend) mouse.on = false; setTimeout(() => { ui.touchUsed = false; }, 50); } };
  addEventListener('pointerup', up, true); addEventListener('pointercancel', up, true);
  canvas.addEventListener('pointerleave', e => { if (!mouse.down && e.pointerType === 'mouse') mouse.on = false; });
  canvas.addEventListener('wheel', e => {
    if (!S.started) return; setRay(e); const hit = hitPanels(mouse.o, mouse.d);
    if (hit && hit.panel.sc) { hit.panel.scrollTo(hit.panel.scrollY + e.deltaY * 0.6); e.preventDefault(); }
    else if (VR.MH.held) { VR.MH.wheel = (VR.MH.wheel || 0) - e.deltaY * 0.002; e.preventDefault(); }
  }, { passive: false });
})();
})();
