/* Ping-Pong: lógica da partida (sem gráficos). Bola, quique, rede, regras, placar e IA com 4 dificuldades.
   Coordenadas locais da mesa: y = 0 é o tampo; o jogador fica no lado +Z e a IA no lado −Z. Unidades em metros.
   O visual e a ligação com a mão estão em pong.js. */
(function (root) {
'use strict';
const ZP = 0.20, ZN = -0.75, ZA = -1.70, HW = 0.42, NH = 0.11, BR = 0.025;      // ponta do jogador, rede, ponta da IA, meia-largura, altura da rede, raio da bola
const AIZ = ZA + 0.05, HZ = -0.30, G = 5.5, E_TABLE = 0.88, E_PAD = 0.95;       // plano de batida da IA, z típico da sua mão, gravidade, quiques
const NAMES = ['Fácil', 'Médio', 'Difícil', 'Expert'];
// spd: velocidade lateral da IA (m/s) · react: atraso de reação (s) · noise: erro de leitura (m) · tf: tempo de voo da devolução (s) · mist: chance de errar · reach: alcance da raquete (m) · away: mira longe da sua raquete
const LV = [
  { spd: 0.80, react: 0.45, noise: 0.16, tf: 0.86, mist: 0.22, reach: 0.11, away: 0 },
  { spd: 1.30, react: 0.28, noise: 0.09, tf: 0.72, mist: 0.10, reach: 0.13, away: 0.3 },
  { spd: 2.10, react: 0.14, noise: 0.045, tf: 0.60, mist: 0.04, reach: 0.15, away: 0.75 },
  { spd: 3.20, react: 0.05, noise: 0.015, tf: 0.50, mist: 0.012, reach: 0.17, away: 1 }];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rnd = () => Math.random();
const gauss = () => { let s = 0; for (let i = 0; i < 4; i++) s += rnd(); return (s - 2) * 1.7; };

// velocidade inicial para a bola sair de (x0,y0,z0) e quicar em (xt, zt) depois de tf segundos
function plan(x0, y0, z0, xt, zt, tf) { return { vx: (xt - x0) / tf, vz: (zt - z0) / tf, vy: (BR - y0 + 0.5 * G * tf * tf) / tf }; }
function clears(v, y0, z0) {                                                  // passa por cima da rede com folga?
  if (v.vz === 0 || (ZN - z0) * v.vz <= 0) return true;
  const t = (ZN - z0) / v.vz; return y0 + v.vy * t - 0.5 * G * t * t > NH + BR + 0.04;
}
function planSafe(x0, y0, z0, xt, zt, tf) {
  let v = plan(x0, y0, z0, xt, zt, tf);
  for (let k = 0; k < 24 && !clears(v, y0, z0); k++) { tf *= 1.07; v = plan(x0, y0, z0, xt, zt, tf); }
  return v;
}

class Sim {
  constructor() {
    this.level = 1; this.to = 11; this.assist = 0.5; this.ev = [];
    this.ball = { x: 0, y: 0.3, z: HZ - 0.17, vx: 0, vy: 0, vz: 0 };
    this.ai = { x: 0, y: 0.25, z: AIZ };
    this.padX = 0; this.first = 'P'; this.restart();
  }
  setLevel(i) { this.level = clamp(i | 0, 0, 3); }
  restart() {
    this.score = { p: 0, a: 0 }; this.server = 'P'; this.rally = 0; this.msg = 'Prepare-se…'; this.phase = 'ready'; this.timer = 1.3; this.t = 0;
    this.lastHit = null; this.bn = 0; this.ownAllow = 0; this.live = false; this.hitCd = 0; this.shot = 0; this.pred = null; this.reactT = 0; this.noise = 0; this.ev.length = 0;
    this.parkBall(); this.ai.x = 0;
  }
  get params() { return LV[this.level]; }
  parkBall() { const b = this.ball; b.x = 0; b.y = 0.26; b.z = HZ - 0.17; b.vx = b.vy = b.vz = 0; }
  // ---------- saque ----------
  beginServe() {
    this.lastHit = null; this.bn = 0; this.ownAllow = 0; this.rally = 0; this.live = false; this.pred = null;
    const b = this.ball; b.vx = b.vy = b.vz = 0;
    if (this.server === 'P') { this.phase = 'serveP'; this.msg = 'Seu saque: acerte a bolinha'; this.parkBall(); }
    else { this.phase = 'serveA'; this.msg = 'Saque da IA'; this.timer = 1.1; b.x = this.ai.x; b.y = 0.24; b.z = ZA + 0.24; }
  }
  nextServer() {
    const n = this.score.p + this.score.a, deuce = this.score.p >= this.to - 1 && this.score.a >= this.to - 1, k = deuce ? n - (this.to - 1) : n >> 1;
    return k % 2 === 0 ? this.first : (this.first === 'P' ? 'A' : 'P');
  }
  // ---------- pontos ----------
  point(who, why) {
    if (!this.live) return; this.live = false;
    if (who === 'P') this.score.p++; else this.score.a++;
    const p = this.score.p, a = this.score.a, to = this.to;
    this.ev.push({ t: 'point', who });
    if ((p >= to || a >= to) && Math.abs(p - a) >= 2) {
      this.phase = 'over'; this.timer = 8; this.msg = (p > a ? 'Você venceu! ' : 'A IA venceu. ') + p + ' × ' + a; this.ev.push({ t: 'over', who: p > a ? 'P' : 'A' }); return;
    }
    this.phase = 'point'; this.timer = 1.7; this.msg = (who === 'P' ? 'Ponto seu! ' : 'Ponto da IA. ') + (why || '');
    this.server = this.nextServer();
  }
  // ---------- batidas ----------
  paddleNormal(pad) {                                                         // normal da raquete virada para a IA, suavizada para facilitar
    let nx = pad.n[0], ny = pad.n[1], nz = pad.n[2]; if (nz > 0) { nx = -nx; ny = -ny; nz = -nz; }
    const k = 0.3 + 0.4 * this.assist; nx *= 1 - k; ny = ny * (1 - k) + 0.1 * k; nz = nz * (1 - k) - k;
    const l = Math.hypot(nx, ny, nz) || 1; return [nx / l, ny / l, nz / l];
  }
  tryPaddle(pad, n, a0, a1, p0x, p0y, p0z) {
    const b = this.ball, L = (u, v, f) => u + (v - u) * f;
    const c0 = [L(pad.pc[0], pad.c[0], a0), L(pad.pc[1], pad.c[1], a0), L(pad.pc[2], pad.c[2], a0)], c1 = [L(pad.pc[0], pad.c[0], a1), L(pad.pc[1], pad.c[1], a1), L(pad.pc[2], pad.c[2], a1)];
    const d0 = (p0x - c0[0]) * n[0] + (p0y - c0[1]) * n[1] + (p0z - c0[2]) * n[2], d1 = (b.x - c1[0]) * n[0] + (b.y - c1[1]) * n[1] + (b.z - c1[2]) * n[2], Th = BR + 0.006;
    if (d0 <= 0 || d1 > Th || d1 >= d0) return false;                         // a bola precisa estar na frente da raquete e vir de encontro a ela
    const f = d0 > Th ? clamp((d0 - Th) / (d0 - d1), 0, 1) : 0;
    const px = L(p0x, b.x, f), py = L(p0y, b.y, f), pz = L(p0z, b.z, f), cx = L(c0[0], c1[0], f), cy = L(c0[1], c1[1], f), cz = L(c0[2], c1[2], f);
    const rx = px - cx, ry = py - cy, rz = pz - cz, dn = rx * n[0] + ry * n[1] + rz * n[2], lx = rx - dn * n[0], ly = ry - dn * n[1], lz = rz - dn * n[2];
    if (Math.hypot(lx, ly, lz) > pad.r + BR * 0.6) return false;
    // resposta: reflexo em relação à raquete em movimento
    const vr = (b.vx - pad.v[0]) * n[0] + (b.vy - pad.v[1]) * n[1] + (b.vz - pad.v[2]) * n[2];
    if (this.phase === 'serveP' && vr > -0.25) return false;                  // saque: só vale se a raquete vier para a bola
    let vx = b.vx - (1 + E_PAD) * vr * n[0], vy = b.vy - (1 + E_PAD) * vr * n[1], vz = b.vz - (1 + E_PAD) * vr * n[2];
    const sp = Math.hypot(vx, vy, vz); if (sp > 7) { vx *= 7 / sp; vy *= 7 / sp; vz *= 7 / sp; }
    // ajuda: mistura com uma trajetória que quica do outro lado; a força e o lado vêm do seu movimento
    const as = this.assist;
    if (as > 0) {
      const swing = Math.max(0, -pad.v[2]), tf = clamp(0.95 - 0.12 * swing, 0.5, 0.95), zt = clamp(ZA + 0.5 + 0.1 * swing, ZA + 0.4, ZN - 0.3);
      const xt = clamp(pad.v[0] * 0.12 + n[0] * 0.35 + px * 0.25, -(HW - 0.07), HW - 0.07);
      const iv = planSafe(px, Math.max(py, BR + 0.02), pz, xt, zt, tf);
      vx = vx * (1 - as) + iv.vx * as; vy = vy * (1 - as) + iv.vy * as; vz = vz * (1 - as) + iv.vz * as;
    }
    if (vz > -0.4) vz = -0.4;
    if (as >= 0.25) { const y0 = Math.max(py, BR + 0.02), tn = (ZN - pz) / vz; if (tn > 0) { const need = (NH + BR + 0.05 - y0 + 0.5 * G * tn * tn) / tn; if (vy < need) vy = need; } }   // com ajuda, a bola nunca bate na rede por pouco
    if (as >= 0.25) {                                                          // com ajuda, a bola também não passa do fim da mesa nem sai pelos lados
      const y0 = Math.max(py, BR + 0.02), tb = (vy + Math.sqrt(vy * vy + 2 * G * (y0 - BR))) / G;
      if (tb > 0.05) { const zl = pz + vz * tb, xl = px + vx * tb; if (zl < ZA + 0.12) vz = (ZA + 0.12 - pz) / tb; if (Math.abs(xl) > HW - 0.03) vx = (Math.sign(xl) * (HW - 0.03) - px) / tb; }
    }
    b.x = cx + lx + n[0] * (Th + 0.002); b.y = cy + ly + n[1] * (Th + 0.002); b.z = cz + lz + n[2] * (Th + 0.002); b.vx = vx; b.vy = vy; b.vz = vz;
    this.ownAllow = this.phase === 'serveP' ? 1 : 0; this.lastHit = 'P'; this.bn = 0; this.rally++; this.shot++; this.hitCd = 0.18; this.msg = '';
    if (this.phase === 'serveP') { this.phase = 'rally'; this.live = true; }
    this.ev.push({ t: 'hit', who: 'P' }); return true;
  }
  aiHit() {
    const b = this.ball, L = this.params, pdx = this.padX;
    let xt = L.away > rnd() ? -Math.sign(pdx || rnd() - 0.5) * (0.35 + 0.5 * rnd()) * HW : (rnd() * 2 - 1) * HW * 0.75;
    xt = clamp(xt + gauss() * L.noise * 0.4, -(HW - 0.05), HW - 0.05);
    let zt = ZN + 0.18 + rnd() * ((ZP - 0.35) - (ZN + 0.18));
    if (rnd() < L.mist) zt = ZP + 0.25 + rnd() * 0.3;                          // erro: bola longa
    const v = planSafe(b.x, Math.max(b.y, BR + 0.02), b.z, xt, zt, L.tf * (0.92 + 0.16 * rnd()));
    b.vx = v.vx; b.vy = v.vy; b.vz = v.vz; this.lastHit = 'A'; this.bn = 0; this.ownAllow = 0; this.rally++; this.shot++; this.pred = null; this.reactT = 0;
    this.ev.push({ t: 'hit', who: 'A' });
  }
  aiServe() {
    const b = this.ball, xt = (rnd() * 2 - 1) * HW * 0.6, zt = ZN + 0.25 + rnd() * 0.3;
    const v = planSafe(b.x, 0.26, b.z, xt, zt, this.params.tf * 1.15);
    b.y = 0.26; b.vx = v.vx; b.vy = v.vy; b.vz = v.vz; this.lastHit = 'A'; this.bn = 0; this.ownAllow = 0; this.rally = 1; this.shot++; this.phase = 'rally'; this.live = true; this.msg = ''; this.pred = null; this.reactT = 0;
    this.ev.push({ t: 'hit', who: 'A' });
  }
  // ---------- física da bola ----------
  step(h) {
    const b = this.ball, px = b.x, py = b.y, pz = b.z;
    b.vy -= G * h; b.x += b.vx * h; b.y += b.vy * h; b.z += b.vz * h;
    // rede
    if ((pz - ZN) * (b.z - ZN) < 0 && Math.abs(b.vz) > 1e-6) {
      const f = (ZN - pz) / (b.z - pz), y = py + (b.y - py) * f, x = px + (b.x - px) * f;
      if (Math.abs(x) <= HW + 0.08 && y < NH + BR && y > -0.1) {
        const side = pz > ZN ? 1 : -1; b.z = ZN + side * (BR + 0.003); b.x = x; b.y = Math.max(y, BR); b.vz = -b.vz * 0.25; b.vx *= 0.5; b.vy = Math.max(b.vy, 0) * 0.3;
        this.ev.push({ t: 'net' }); if (this.live && this.lastHit) this.point(this.lastHit === 'P' ? 'A' : 'P', 'Na rede');
      }
    }
    // tampo
    if (b.vy < 0 && b.y < BR && py >= BR - 0.06 && Math.abs(b.x) <= HW + 0.01 && b.z >= ZA - 0.01 && b.z <= ZP + 0.01) {
      b.y = BR; b.vy = -b.vy * E_TABLE; b.vx *= 0.985; b.vz *= 0.985; this.ev.push({ t: 'bounce' });
      if (this.live && this.lastHit) this.onBounce(b.z > ZN ? 'P' : 'A');
    }
    if (this.live && b.y < -0.05) this.out();                                   // caiu fora da mesa
    if (b.y < -3) { b.y = -3; b.vx = b.vy = b.vz = 0; }
  }
  onBounce(side) {
    const hs = this.lastHit;
    if (side === hs) { if (this.ownAllow > 0) this.ownAllow--; else this.point(hs === 'P' ? 'A' : 'P', hs === 'P' ? 'Quicou do seu lado' : 'Quicou do lado da IA'); }
    else { this.bn++; if (this.bn >= 2) this.point(hs, hs === 'P' ? 'A IA não devolveu' : 'Você não devolveu'); }
  }
  out() {
    const hs = this.lastHit; if (!hs) return;
    if (this.bn >= 1) this.point(hs, hs === 'P' ? 'A IA não alcançou' : 'Você não alcançou'); else this.point(hs === 'P' ? 'A' : 'P', hs === 'P' ? 'Bola fora' : 'Bola da IA fora');
  }
  // onde a bola vai estar quando chegar ao plano da IA (com quique)
  predict() {
    const b = this.ball; let x = b.x, y = b.y, z = b.z, vx = b.vx, vy = b.vy, vz = b.vz, t = 0; const h = 1 / 120;
    while (t < 3) {
      vy -= G * h; x += vx * h; y += vy * h; z += vz * h; t += h;
      if (vy < 0 && y < BR && Math.abs(x) <= HW && z >= ZA && z <= ZP) { y = BR; vy = -vy * E_TABLE; vx *= 0.985; vz *= 0.985; }
      if (z <= AIZ + 0.06) return { x, y, t };
      if (y < -0.1) break;
    }
    return null;
  }
  updateAI(dt) {
    const L = this.params, a = this.ai, b = this.ball; let tx = 0, spd = 0.5, ty = 0.22, sy = 0.6;
    if (this.phase === 'rally' && this.lastHit === 'P' && b.vz < 0) {
      if (!this.pred) { this.pred = this.predict() || { x: b.x, y: 0.2, t: 1 }; this.noise = gauss() * L.noise; this.reactT = 0; }
      this.reactT += dt; if (this.reactT >= L.react) { tx = clamp(this.pred.x + this.noise, -HW - 0.1, HW + 0.1); spd = L.spd; }
      ty = clamp(b.y, 0.04, 0.5); sy = 2.5;
    } else if (this.phase === 'serveA') { tx = 0; spd = 0.8; }
    const dx = tx - a.x, m = spd * dt; a.x += Math.abs(dx) < m ? dx : Math.sign(dx) * m;
    const dy = ty - a.y, my = sy * dt; a.y += Math.abs(dy) < my ? dy : Math.sign(dy) * my; a.z = AIZ;
    if (this.phase === 'rally' && this.live && this.lastHit === 'P' && this.bn >= 1 && b.vz < 0 && b.z <= AIZ + 0.08 && b.z >= AIZ - 0.25 && b.y > 0 && Math.abs(b.x - a.x) < L.reach && Math.abs(b.y - a.y) < 0.2) this.aiHit();
  }
  // ---------- quadro ----------
  update(dt, pad, run) {
    if (run === false) return; dt = Math.min(dt, 0.05); this.t += dt; if (this.hitCd > 0) this.hitCd -= dt;
    if (pad) this.padX = pad.c[0];
    const b = this.ball;
    switch (this.phase) {
      case 'ready': this.timer -= dt; if (this.timer <= 0) this.beginServe(); break;
      case 'point': this.timer -= dt; if (this.timer <= 0) this.beginServe(); break;
      case 'over': this.timer -= dt; if (this.timer <= 0) this.restart(); break;
      case 'serveA': this.timer -= dt; b.x = this.ai.x; this.updateAI(dt); if (this.timer <= 0) this.aiServe(); break;
      case 'serveP': b.y = 0.26 + Math.sin(this.t * 4) * 0.008; this.updateAI(dt); break;
    }
    const physics = this.phase === 'rally' || this.phase === 'point' || this.phase === 'over';
    const n = pad ? this.paddleNormal(pad) : null, canHit = pad && this.hitCd <= 0 && (this.phase === 'serveP' || (this.phase === 'rally' && this.live && this.lastHit !== 'P' && b.z > ZN));
    if (physics) {
      const k = Math.max(1, Math.ceil(dt / (1 / 240))), h = dt / k;
      for (let i = 0; i < k; i++) {
        const px = b.x, py = b.y, pz = b.z; this.step(h);
        if (pad && this.phase === 'rally' && this.live && this.hitCd <= 0 && this.lastHit !== 'P' && pz > ZN - 0.02) this.tryPaddle(pad, n, i / k, (i + 1) / k, px, py, pz);
      }
      if (this.phase === 'rally') this.updateAI(dt);
    } else if (canHit && this.phase === 'serveP') {
      const px = b.x, py = b.y, pz = b.z, k = 4;                               // saque: bola parada, só a raquete se mexe
      for (let i = 0; i < k; i++) if (this.tryPaddle(pad, n, i / k, (i + 1) / k, px, py, pz)) break;
    }
  }
}
const api = { Sim, ZP, ZN, ZA, HW, NH, BR, AIZ, HZ, G, NAMES, LV, plan, planSafe };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.PongSim = api;
})(typeof window !== 'undefined' ? window : globalThis);
