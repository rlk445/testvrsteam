/* Sinuca (bola 8): física das bolas, regras e IA do bot. Sem gráficos.
   Unidades em metros. Origem no centro da mesa; x = lado comprido, z = lado curto. Bola 0 = branca, 1–7 lisas, 8 preta, 9–15 listradas.
   O visual e a ligação com a mão/mouse estão em sinuca.js. */
(function (root) {
'use strict';
const R = 0.0286, L = 1.90, W = 0.95, HL = L / 2, HW = W / 2, D2 = 4 * R * R;
const FA = 0.42, E_BALL = 0.96, E_RAIL = 0.80, STEP = 1 / 180, VMAX = 7;            // desaceleração (m/s²), quique bola-bola, quique na tabela, passo fixo, velocidade máxima
const RX = L / 4, CX = -L / 4;                                                      // ponto do triângulo (pé) e ponto da branca (cabeça)
const POCKETS = [[-HL - 0.012, -HW - 0.012, 0.078], [HL + 0.012, -HW - 0.012, 0.078], [-HL - 0.012, HW + 0.012, 0.078], [HL + 0.012, HW + 0.012, 0.078], [0, -HW - 0.026, 0.068], [0, HW + 0.026, 0.068]];
const NAMES = ['Fácil', 'Médio', 'Difícil', 'Expert'];
// nível: n = quantas tacadas o bot simula · sa/sv = erro de ângulo (rad) e de força · rnd = chance de errar de propósito · brk = força da quebra
const LV = [{ n: 5, sa: 0.050, sv: 0.16, rnd: 0.35, brk: 4.2 }, { n: 10, sa: 0.024, sv: 0.09, rnd: 0.12, brk: 5.0 }, { n: 18, sa: 0.011, sv: 0.05, rnd: 0.03, brk: 5.8 }, { n: 30, sa: 0.003, sv: 0.02, rnd: 0, brk: 6.4 }];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const grp = i => i === 0 ? '' : i === 8 ? '8' : i < 8 ? 'S' : 'L';                 // S = lisas, L = listradas
const rnd = () => Math.random();
const gauss = () => { let s = 0; for (let i = 0; i < 4; i++) s += rnd(); return (s - 2) * 1.7; };
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0, t = a[i]; a[i] = a[j]; a[j] = t; } return a; };

// ---------- física ----------
class Phy {
  constructor() { this.x = new Float64Array(16); this.z = new Float64Array(16); this.vx = new Float64Array(16); this.vz = new Float64Array(16); this.on = new Uint8Array(16); this.ev = []; this.pk = []; this.first = -1; this.rail = 0; }
  copy(o) { this.x.set(o.x); this.z.set(o.z); this.vx.set(o.vx); this.vz.set(o.vz); this.on.set(o.on); return this; }
  clearShot() { this.first = -1; this.pk = []; this.ev.length = 0; this.rail = 0; }
  moving() { for (let i = 0; i < 16; i++) if (this.on[i] && (this.vx[i] || this.vz[i])) return true; return false; }
  step(h) {
    const x = this.x, z = this.z, vx = this.vx, vz = this.vz, on = this.on;
    for (let i = 0; i < 16; i++) {
      if (!on[i]) continue; const sx = vx[i], sz = vz[i]; if (!sx && !sz) continue;
      const s = Math.sqrt(sx * sx + sz * sz), ns = s - FA * h;
      if (ns <= 0.012) { vx[i] = vz[i] = 0; continue; }
      const k = ns / s; vx[i] = sx * k; vz[i] = sz * k; x[i] += vx[i] * h; z[i] += vz[i] * h;
    }
    for (let i = 0; i < 16; i++) {
      if (!on[i]) continue;
      for (let j = i + 1; j < 16; j++) {
        if (!on[j]) continue; const dx = x[j] - x[i], dz = z[j] - z[i], d2 = dx * dx + dz * dz; if (d2 >= D2 || d2 < 1e-12) continue;
        const d = Math.sqrt(d2), nx = dx / d, nz = dz / d, ov = (2 * R - d) / 2;
        x[i] -= nx * ov; z[i] -= nz * ov; x[j] += nx * ov; z[j] += nz * ov;
        const rel = (vx[i] - vx[j]) * nx + (vz[i] - vz[j]) * nz;
        if (rel > 0) {
          const imp = rel * (1 + E_BALL) / 2; vx[i] -= imp * nx; vz[i] -= imp * nz; vx[j] += imp * nx; vz[j] += imp * nz;
          this.ev.push({ t: 'hit', a: i, b: j, v: rel }); if (this.first < 0 && (i === 0 || j === 0)) this.first = i === 0 ? j : i;
        }
      }
    }
    for (let i = 0; i < 16; i++) {
      if (!on[i]) continue;
      for (let p = 0; p < 6; p++) {
        const P = POCKETS[p], dx = x[i] - P[0], dz = z[i] - P[1];
        if (dx * dx + dz * dz < P[2] * P[2]) { on[i] = 0; this.pk.push(i); this.ev.push({ t: 'pk', i, p, v: Math.hypot(vx[i], vz[i]) }); vx[i] = vz[i] = 0; break; }
      }
      if (!on[i]) continue;
      const lx = HL - R, lz = HW - R;
      if (x[i] > lx) { x[i] = lx; if (vx[i] > 0) { this.ev.push({ t: 'rail', i, v: vx[i] }); vx[i] = -vx[i] * E_RAIL; vz[i] *= 0.985; this.rail = 1; } }
      else if (x[i] < -lx) { x[i] = -lx; if (vx[i] < 0) { this.ev.push({ t: 'rail', i, v: -vx[i] }); vx[i] = -vx[i] * E_RAIL; vz[i] *= 0.985; this.rail = 1; } }
      if (z[i] > lz) { z[i] = lz; if (vz[i] > 0) { this.ev.push({ t: 'rail', i, v: vz[i] }); vz[i] = -vz[i] * E_RAIL; vx[i] *= 0.985; this.rail = 1; } }
      else if (z[i] < -lz) { z[i] = -lz; if (vz[i] < 0) { this.ev.push({ t: 'rail', i, v: -vz[i] }); vz[i] = -vz[i] * E_RAIL; vx[i] *= 0.985; this.rail = 1; } }
    }
  }
}

// ---------- regras (função pura: serve para a partida e para o bot simular tacadas) ----------
// ctx = { group: {P, A}, brk, eight0 } · who = quem tacou · first = primeira bola tocada pela branca (−1 = nenhuma) · pk = bolas encaçapadas
function judge(ctx, who, first, pk) {
  const opp = who === 'P' ? 'A' : 'P', mine = ctx.group[who], cue = pk.includes(0);
  let objs = pk.filter(i => i > 0), foul = false, why = '';
  const bad = s => { foul = true; why = why ? why + ' · ' + s : s; };
  if (first < 0) bad('não tocou em nenhuma bola');
  else if (!mine) { if (first === 8) bad('tocou primeiro na bola 8'); }
  else if (ctx.eight0) { if (first !== 8) bad('tinha que bater na bola 8'); }
  else if (grp(first) !== mine) bad('bateu na bola errada');
  if (cue) bad('a branca caiu');
  const r = { foul: false, why: '', win: '', assign: null, cont: false, respot8: false, own: 0, theirs: 0, cue };
  if (objs.includes(8)) {
    if (ctx.brk) { r.respot8 = true; objs = objs.filter(i => i !== 8); }
    else if (foul || !ctx.eight0) { r.win = opp; r.why = foul ? 'bola 8 encaçapada com falta' : 'bola 8 encaçapada antes da hora'; r.foul = foul; return r; }
    else { r.win = who; r.why = 'encaçapou a bola 8'; return r; }
  }
  let g = mine;
  if (!foul && !mine && !ctx.brk) { const f = objs.find(i => i !== 8); if (f) { g = grp(f); r.assign = {}; r.assign[who] = g; r.assign[opp] = g === 'S' ? 'L' : 'S'; } }
  if (g) { r.own = objs.filter(i => grp(i) === g).length; r.theirs = objs.filter(i => grp(i) !== g).length; } else r.own = objs.length;
  r.foul = foul; r.why = why; r.cont = !foul && r.own > 0; return r;
}

// ---------- geometria ----------
function blocked(ph, ax, az, bx, bz, s1, s2, md) {                                  // algum outro corpo atrapalha o segmento a→b?
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
  for (let k = 0; k < 16; k++) {
    if (!ph.on[k] || k === s1 || k === s2) continue; const px = ph.x[k] - ax, pz = ph.z[k] - az;
    const u = l2 > 1e-9 ? clamp((px * dx + pz * dz) / l2, 0, 1) : 0, qx = dx * u - px, qz = dz * u - pz;
    if (qx * qx + qz * qz < md * md) return true;
  }
  return false;
}
function freeAt(ph, x, z, skip, m) { for (let k = 0; k < 16; k++) { if (!ph.on[k] || k === skip) continue; const dx = ph.x[k] - x, dz = ph.z[k] - z; if (dx * dx + dz * dz < m * m) return false; } return Math.abs(x) <= HL - R && Math.abs(z) <= HW - R; }

class Game {
  constructor() { this.ph = new Phy(); this.tmp = new Phy(); this.newGame('P'); }
  newGame(first) {
    const ph = this.ph; ph.on.fill(0); ph.vx.fill(0); ph.vz.fill(0); ph.clearShot();
    const sol = shuffle([1, 2, 3, 4, 5, 6, 7]), str = shuffle([9, 10, 11, 12, 13, 14, 15]), slot = new Array(15).fill(0);
    slot[4] = 8; slot[10] = sol.pop(); slot[14] = str.pop(); const rest = shuffle(sol.concat(str)); for (let p = 0; p < 15; p++) if (!slot[p]) slot[p] = rest.pop();
    const dx = 2 * R * 0.8660254 * 1.003, dz = 2 * R * 1.003; let p = 0;
    for (let r = 0; r < 5; r++) for (let k = 0; k <= r; k++, p++) { const b = slot[p]; ph.x[b] = RX + r * dx; ph.z[b] = (k - r / 2) * dz; ph.on[b] = 1; }
    ph.x[0] = CX; ph.z[0] = 0; ph.on[0] = 1;
    this.turn = first; this.group = { P: '', A: '' }; this.brk = true; this.inHand = false; this.over = false; this.win = ''; this.shooter = first; this.eight0 = false;
  }
  remaining(g) { let n = 0; for (let i = 1; i < 16; i++) if (this.ph.on[i] && grp(i) === g) n++; return n; }
  onEight(who) { const g = this.group[who]; return !!g && this.remaining(g) === 0; }
  targets(who) {
    const g = this.group[who], a = [];
    for (let i = 1; i < 16; i++) { if (!this.ph.on[i]) continue; if (!g) { if (i !== 8) a.push(i); } else if (this.onEight(who)) { if (i === 8) a.push(i); } else if (grp(i) === g) a.push(i); }
    return a;
  }
  beginShot(who) { this.shooter = who; this.ph.clearShot(); this.eight0 = this.onEight(who); }
  shoot(a, v) { v = clamp(v, 0, VMAX); this.ph.vx[0] = Math.cos(a) * v; this.ph.vz[0] = Math.sin(a) * v; }
  ctx() { return { group: this.group, brk: this.brk, eight0: this.eight0 }; }
  respot(b) {
    const ph = this.ph; ph.vx[b] = ph.vz[b] = 0;
    for (let k = 0; k < 40; k++) { const x = RX + k * 0.03; if (x < HL - R && freeAt(ph, x, 0, b, 2 * R + 0.002)) { ph.x[b] = x; ph.z[b] = 0; ph.on[b] = 1; return; } }
    for (let k = 1; k < 40; k++) { const x = RX - k * 0.03; if (freeAt(ph, x, 0, b, 2 * R + 0.002)) { ph.x[b] = x; ph.z[b] = 0; ph.on[b] = 1; return; } }
    ph.x[b] = RX; ph.z[b] = 0; ph.on[b] = 1;
  }
  resolve() {                                                                         // depois que tudo parou: aplica as regras
    const who = this.shooter, opp = who === 'P' ? 'A' : 'P', ph = this.ph, j = judge(this.ctx(), who, ph.first, ph.pk.slice());
    j.who = who; j.pk = ph.pk.slice();
    if (j.assign) { this.group.P = j.assign.P; this.group.A = j.assign.A; }
    if (j.respot8) this.respot(8);
    if (j.win) { this.over = true; this.win = j.win; return j; }
    if (!ph.on[0]) { ph.on[0] = 1; ph.x[0] = CX; ph.z[0] = 0; ph.vx[0] = ph.vz[0] = 0; }
    this.inHand = j.foul; this.turn = j.cont ? who : opp; this.brk = false; j.next = this.turn;
    return j;
  }
  // ---------- ajuda de mira: ângulos de tacadas boas (bola → caçapa) ----------
  candidates(who) {
    const ph = this.ph, cx = ph.x[0], cz = ph.z[0], out = [];
    for (const t of this.targets(who)) {
      const tx = ph.x[t], tz = ph.z[t];
      for (let pi = 0; pi < 6; pi++) {
        const P = POCKETS[pi], ax = P[0] - Math.sign(P[0]) * 0.014, az = P[1] - Math.sign(P[1]) * 0.014, vx = ax - tx, vz = az - tz, dtp = Math.hypot(vx, vz); if (dtp < 0.02) continue;
        const ux = vx / dtp, uz = vz / dtp, gx = tx - ux * 2 * R, gz = tz - uz * 2 * R;
        if (Math.abs(gx) > HL - R || Math.abs(gz) > HW - R) continue;
        const cgx = gx - cx, cgz = gz - cz, dcg = Math.hypot(cgx, cgz); if (dcg < 0.01) continue;
        const cs = (cgx * ux + cgz * uz) / dcg; if (cs < 0.25) continue;
        if (blocked(ph, cx, cz, gx, gz, 0, t, 2 * R * 0.97) || blocked(ph, tx, tz, ax, az, 0, t, 2 * R * 0.97)) continue;
        const vt = Math.sqrt(2 * FA * dtp) + 0.45, vc = vt / Math.max(cs, 0.3), v0 = Math.sqrt(vc * vc + 2 * FA * dcg);
        out.push({ a: Math.atan2(cgz, cgx), v: clamp(v0, 0.5, 6.8), q: cs * cs / (1 + 0.8 * dcg + 0.5 * dtp), t, p: pi });
      }
    }
    out.sort((a, b) => b.q - a.q); return out;
  }
  assist(a, cand, tol, k) {                                                           // puxa o ângulo para a tacada boa mais próxima
    let best = null, bd = 9;
    for (const c of cand) { let d = c.a - a; d = Math.atan2(Math.sin(d), Math.cos(d)); if (Math.abs(d) < Math.abs(bd)) { bd = d; best = c; } }
    if (!best || Math.abs(bd) >= tol) return a;
    const w = Math.pow(1 - Math.abs(bd) / tol, 0.6); return a + bd * w * k;
  }
  // ---------- bot ----------
  evalShot(who, a, v) {
    const g = this.tmp.copy(this.ph); g.clearShot(); g.vx[0] = Math.cos(a) * v; g.vz[0] = Math.sin(a) * v;
    let n = 0; while (g.moving() && n < 1800) { g.step(STEP); n++; }
    const j = judge({ group: this.group, brk: this.brk, eight0: this.onEight(who) }, who, g.first, g.pk);
    if (j.win) return j.win === who ? 1000 : -1000;
    let s = 0; if (j.foul) s -= 60; if (j.cue) s -= 25; s += 30 * j.own - 12 * j.theirs; if (j.cont) s += 8;
    if (!j.foul && g.on[0]) { let dm = 3; const tg = this.targets(who); for (const t of tg) dm = Math.min(dm, Math.hypot(g.x[t] - g.x[0], g.z[t] - g.z[0])); s += 3 * (1 - clamp(dm / 1.3, 0, 1)); }
    return s + rnd() * 0.8;
  }
  think(who, level) {                                                                 // devolve um objeto que avalia as tacadas aos poucos (step) e guarda a melhor
    const lv = LV[clamp(level | 0, 0, 3)], game = this, ph = this.ph, cx = ph.x[0], cz = ph.z[0];
    let list = [];
    if (this.brk) { const a = Math.atan2(0 - cz, RX - cx); list = [{ a, v: lv.brk }]; }
    else {
      const c = this.candidates(who), top = c.slice(0, Math.max(3, lv.n >> 1));
      for (const k of top) { list.push({ a: k.a, v: k.v }); if (list.length < lv.n) list.push({ a: k.a, v: clamp(k.v * 1.3, 0.5, 6.8) }); if (list.length < lv.n) list.push({ a: k.a, v: clamp(k.v * 0.85, 0.4, 6.8) }); }
      const tg = this.targets(who).map(t => ({ t, d: Math.hypot(ph.x[t] - cx, ph.z[t] - cz) })).sort((p, q) => p.d - q.d).slice(0, 4);
      for (const k of tg) { const a = Math.atan2(ph.z[k.t] - cz, ph.x[k.t] - cx); list.push({ a, v: 1.6 }); list.push({ a, v: 3 }); }
      list = list.slice(0, lv.n + 4);
      if (!list.length) list.push({ a: rnd() * 6.28, v: 2.5 });
      if (rnd() < lv.rnd) { const t = this.targets(who); if (t.length) { const b = t[(rnd() * t.length) | 0]; list = [{ a: Math.atan2(ph.z[b] - cz, ph.x[b] - cx), v: 2 + rnd() * 2.5 }]; } }
    }
    const th = { best: null, bs: -1e9, i: 0, n: list.length, done: false, lv };
    th.step = (cnt) => {
      for (let k = 0; k < cnt && th.i < th.n; k++, th.i++) { const c = list[th.i], s = game.brk ? 0 : game.evalShot(who, c.a, c.v); if (s > th.bs) { th.bs = s; th.best = c; } }
      if (th.i >= th.n) { th.done = true; }
      return th.done;
    };
    th.result = () => {                                                               // aplica o erro humano do nível
      const c = th.best || { a: 0, v: 2 }; return { a: c.a + gauss() * lv.sa, v: clamp(c.v * (1 + gauss() * lv.sv), 0.35, VMAX), score: th.bs };
    };
    return th;
  }
  placement(who) {                                                                    // bola na mão: escolhe uma posição boa para a branca
    const ph = this.ph; let best = null, bs = -1, tg = this.targets(who);
    const sv = { x: ph.x[0], z: ph.z[0], on: ph.on[0] }; ph.on[0] = 0;
    for (let ix = 0; ix <= 14; ix++) for (let iz = 0; iz <= 6; iz++) {
      const x = -HL + 0.12 + (L - 0.24) * ix / 14, z = -HW + 0.1 + (W - 0.2) * iz / 6; if (!freeAt(ph, x, z, -1, 2 * R + 0.03)) continue;
      ph.x[0] = x; ph.z[0] = z; ph.on[0] = 1; let q = 0.0001;
      for (const t of tg) for (let pi = 0; pi < 6; pi++) {
        const P = POCKETS[pi], ax = P[0] - Math.sign(P[0]) * 0.014, az = P[1] - Math.sign(P[1]) * 0.014, tx = ph.x[t], tz = ph.z[t], vx = ax - tx, vz = az - tz, dtp = Math.hypot(vx, vz), ux = vx / dtp, uz = vz / dtp, gx = tx - ux * 2 * R, gz = tz - uz * 2 * R;
        if (Math.abs(gx) > HL - R || Math.abs(gz) > HW - R) continue;
        const cgx = gx - x, cgz = gz - z, dcg = Math.hypot(cgx, cgz); if (dcg < 0.02) continue; const cs = (cgx * ux + cgz * uz) / dcg; if (cs < 0.4) continue;
        if (blocked(ph, x, z, gx, gz, 0, t, 2 * R * 0.97) || blocked(ph, tx, tz, ax, az, 0, t, 2 * R * 0.97)) continue;
        q = Math.max(q, cs * cs / (1 + 0.8 * dcg + 0.5 * dtp));
      }
      if (q > bs) { bs = q; best = { x, z }; }
    }
    ph.x[0] = sv.x; ph.z[0] = sv.z; ph.on[0] = sv.on;
    return best || { x: CX, z: 0 };
  }
}
root.SinSim = { Phy, Game, judge, blocked, freeAt, R, L, W, HL, HW, RX, CX, POCKETS, NAMES, LV, STEP, VMAX, FA, grp, clamp };
})(typeof window !== 'undefined' ? window : globalThis);
