/* Geometria procedural da mão realista (malha única: pele, nós dos dedos, unhas, polegar, pele entre os dedos e pulso) + dados do esqueleto.
   Convenção: mão direita aberta, palma para +Z, dedos para +Y, polegar em +X, unidades em metros, pulso na origem. */
(() => {
'use strict';
const T = window.THREE;
// posições de repouso dos 21 pontos (mesma numeração do MediaPipe)
const REST = [
  [0, 0, 0],
  [0.020, 0.014, 0.006], [0.044, 0.040, 0.014], [0.058, 0.066, 0.016], [0.066, 0.088, 0.014],           // polegar
  [0.031, 0.093, 0], [0.035, 0.136, 0], [0.037, 0.161, 0], [0.038, 0.182, 0],                           // indicador
  [0.009, 0.099, 0], [0.010, 0.147, 0], [0.010, 0.176, 0], [0.010, 0.199, 0],                           // médio
  [-0.013, 0.094, 0], [-0.017, 0.139, 0], [-0.019, 0.165, 0], [-0.020, 0.187, 0],                       // anelar
  [-0.034, 0.083, 0], [-0.041, 0.119, 0], [-0.044, 0.138, 0], [-0.046, 0.156, 0]];                      // mindinho
const CHAINS = [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [17, 18, 19, 20]];
const BONE_LM = [0, 1, 2, 3, 5, 6, 7, 9, 10, 11, 13, 14, 15, 17, 18, 19];       // ossos do esqueleto (cada um começa numa articulação)
const BONE_OF = {}; BONE_LM.forEach((lm, i) => { BONE_OF[lm] = i; });
// raio (metros) na articulação 1, 2, 3 e na ponta de cada dedo
const RAD = { 1: [0.0138, 0.0124, 0.0110, 0.0092], 5: [0.0090, 0.0082, 0.0074, 0.0064], 9: [0.0094, 0.0085, 0.0076, 0.0066], 13: [0.0088, 0.0080, 0.0072, 0.0062], 17: [0.0078, 0.0070, 0.0063, 0.0055] };
const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const interp = (xs, ys, x) => { if (x <= xs[0]) return ys[0]; for (let i = 1; i < xs.length; i++) if (x <= xs[i]) { const t = (x - xs[i - 1]) / (xs[i] - xs[i - 1]); return ys[i - 1] + (ys[i] - ys[i - 1]) * t; } return ys[ys.length - 1]; };

function build(side) {                                                           // side: +1 mão direita, -1 esquerda (espelhada)
  const pos = [], col = [], sIdx = [], sW = [], fade = [], idx = [], WHITE = [1, 1, 1];
  const V = (x, y, z, c, b0, w0, b1, fd) => { pos.push(x * side, y, z); col.push(c[0], c[1], c[2]); sIdx.push(b0, b1, 0, 0); sW.push(w0, 1 - w0, 0, 0); fade.push(fd === undefined ? 1 : fd); return pos.length / 3 - 1; };
  const v3 = a => new T.Vector3(a[0], a[1], a[2]);
  const quads = (rows, n) => { for (let i = 0; i < rows.length - 1; i++) for (let j = 0; j < n; j++) { const a = rows[i][j], b = rows[i][(j + 1) % n], c = rows[i + 1][j], d = rows[i + 1][(j + 1) % n]; idx.push(a, c, b, b, c, d); } };

  // ---- dedos e polegar: tubo elíptico com anéis ao longo da cadeia ----
  const N = 16;
  function addTube(ch) {
    const J = ch.map(i => v3(REST[i])), rad = RAD[ch[0]], thumb = ch[0] === 1, asp = thumb ? 0.84 : 0.87, bs = [BONE_OF[ch[0]], BONE_OF[ch[1]], BONE_OF[ch[2]]];
    const L = [J[0].distanceTo(J[1]), J[1].distanceTo(J[2]), J[2].distanceTo(J[3])], d2 = J[3].clone().sub(J[2]).normalize();
    const rEnd = rad[3], tipC = J[3].clone().addScaledVector(d2, -rEnd), j1 = L[0], j2 = L[0] + L[1], sTip = L[0] + L[1] + L[2] - rEnd;
    const pt = s => {                                                            // ponto da cadeia a 's' metros da 1ª articulação (s<0: prolongamento para dentro da palma)
      const d0 = J[1].clone().sub(J[0]).normalize(); if (s < 0) return J[0].clone().addScaledVector(d0, s);
      if (s <= j1) return J[0].clone().lerp(J[1], s / L[0]); if (s <= j2) return J[1].clone().lerp(J[2], (s - j1) / L[1]); return J[2].clone().lerp(tipC, Math.min(1, (s - j2) / (sTip - j2)));
    };
    const rAt = s => { let r; if (s <= j1) r = rad[0] + (rad[1] - rad[0]) * Math.max(0, s) / j1; else if (s <= j2) r = rad[1] + (rad[2] - rad[1]) * (s - j1) / L[1]; else r = rad[2] + (rad[3] - rad[2]) * Math.min(1, (s - j2) / (sTip - j2));
      const dj = Math.min(Math.abs(s - j1), Math.abs(s - j2)); return r * (s < 0 ? 1.04 : 1 + 0.07 * (1 - ss(0, 0.007, dj))); };     // nó do dedo um pouco mais grosso
    const ss_ = [-0.016, -0.008, 0, 0.2 * L[0], 0.4 * L[0], 0.6 * L[0], 0.8 * L[0], j1, j1 + 0.25 * L[1], j1 + 0.5 * L[1], j1 + 0.75 * L[1], j2, j2 + 0.3 * L[2], j2 + 0.6 * L[2], sTip];
    const samples = ss_.map(s => ({ s, c: pt(s), r: rAt(s), dome: 0 }));
    [0.40, 0.72, 0.93].forEach(ph => { const a = ph * Math.PI / 2; samples.push({ s: sTip + Math.sin(a) * rEnd, c: tipC.clone().addScaledVector(d2, Math.sin(a) * rEnd), r: rEnd * Math.cos(a), dome: 1 }); });
    const weights = s => {                                                       // [osso A, osso B, peso de A]
      const wp = thumb ? 0.011 : 0.008;
      if (s < -wp) return [0, 0, 1]; if (s < wp) return [0, bs[0], 1 - ss(-wp, wp, s)];
      if (s < j1 - 0.006) return [bs[0], bs[0], 1]; if (s < j1 + 0.006) return [bs[0], bs[1], 1 - ss(j1 - 0.006, j1 + 0.006, s)];
      if (s < j2 - 0.005) return [bs[1], bs[1], 1]; if (s < j2 + 0.005) return [bs[1], bs[2], 1 - ss(j2 - 0.005, j2 + 0.005, s)]; return [bs[2], bs[2], 1];
    };
    const sN0 = j2 + 0.28 * L[2], nailTh = thumb ? -1.0 : -Math.PI / 2;            // a unha fica no dorso; no polegar ela fica virada de lado
    const rows = samples.map((sm, i) => {
      const a = samples[Math.max(0, i - 1)].c, b = samples[Math.min(samples.length - 1, i + 1)].c, d = b.clone().sub(a).normalize();
      const xa = new T.Vector3().crossVectors(d, new T.Vector3(0, 0, 1)); if (xa.lengthSq() < 1e-6) xa.set(1, 0, 0); xa.normalize();
      const za = new T.Vector3().crossVectors(xa, d).normalize(), [bA, bB, wA] = weights(sm.s), row = [], kn = (1 - ss(0, 0.006, Math.min(Math.abs(sm.s - j1), Math.abs(sm.s - j2)))) * (sm.s > 0.01 ? 1 : 0);
      const nax = ss(sN0, sN0 + 0.005, sm.s) * (1 - ss(sTip + 0.30 * rEnd, sTip + 0.85 * rEnd, sm.s));
      for (let j = 0; j < N; j++) {
        const th = j / N * Math.PI * 2, ct = Math.cos(th), st = Math.sin(th), dors = Math.cos(th - nailTh), palmar = Math.cos(th - (thumb ? nailTh + Math.PI : Math.PI / 2));
        let c = [1, 1, 1], off = 0;
        const k = ss(0.1, 0.9, dors) * kn * 0.12; c = [1 - k * 0.5, 1 - k, 1 - k];                     // nó do dedo: dorso mais escuro/avermelhado
        const nm = ss(0.50, 0.80, dors) * nax;                                                          // unha: mais clara e levemente saliente
        if (nm > 0) { c = [c[0] * (1 + 0.20 * nm), c[1] * (1 + 0.15 * nm), c[2] * (1 + 0.14 * nm)]; off = 0.0005 * nm; }
        else if (sm.s > sTip - 0.012) { const p = ss(0.3, 0.95, palmar) * 0.07; c = [1 + p, 1 - p * 0.8, 1 - p * 0.8]; }   // polpa da ponta, mais rosada
        const r = Math.max(sm.r, 0.0003), p = sm.c.clone().addScaledVector(xa, ct * (r + off)).addScaledVector(za, st * (r * asp + off));
        row.push(V(p.x, p.y, p.z, c, bA, wA, bB));
      }
      return row;
    });
    quads(rows, N);
  }
  CHAINS.forEach(ch => addTube(ch));

  // ---- palma e antebraço: casca lofada (superelipse) com músculos do polegar e do mindinho ----
  const KY = [-0.052, -0.030, -0.008, 0.000, 0.030, 0.060, 0.082, 0.094, 0.103, 0.109];
  const KA = [0.026, 0.028, 0.030, 0.031, 0.037, 0.040, 0.0405, 0.039, 0.033, 0.020];          // meia-largura
  const KC = [0.000, 0.000, 0.001, 0.001, 0.000, -0.001, -0.003, -0.003, -0.003, -0.003];      // deslocamento lateral
  const KB = [0.0200, 0.0190, 0.0180, 0.0178, 0.0170, 0.0150, 0.0133, 0.0118, 0.0085, 0.0035]; // meia-espessura
  const NY = 30, NP = 28, prow = [], gauss = (x, y, cx, cy, sx, sy) => Math.exp(-(((x - cx) / sx) ** 2) - (((y - cy) / sy) ** 2));
  for (let k = 0; k < NY; k++) {
    const y = KY[0] + (KY[KY.length - 1] - KY[0]) * k / (NY - 1), a = interp(KY, KA, y), c0 = interp(KY, KC, y), b = interp(KY, KB, y), row = [], fd = ss(-0.052, -0.024, y);
    for (let j = 0; j < NP; j++) {
      const th = j / NP * Math.PI * 2, ct = Math.cos(th), st = Math.sin(th), e = 2 / 3.2;
      let x = c0 + a * Math.sign(ct) * Math.pow(Math.abs(ct), e), z = b * Math.sign(st) * Math.pow(Math.abs(st), e);
      const gT = gauss(x, y, 0.027, 0.032, 0.013, 0.022), gP = gauss(x, y, -0.029, 0.050, 0.010, 0.026), ps = Math.max(0, st);   // tenar e hipotenar (só do lado da palma)
      z += (0.0068 * gT + 0.0030 * gP) * Math.pow(ps, 0.7); x += 0.0045 * gT * Math.max(0, ct) - 0.0015 * gP * Math.max(0, -ct);
      row.push(V(x, y, z, [1 - 0.04 * gP * ps, 1, 1], 0, 1 - 0.55 * gT * ps, BONE_OF[1], fd));
    }
    prow.push(row);
  }
  quads(prow, NP);
  { const last = prow[prow.length - 1], cen = V(KC[KC.length - 1], KY[KY.length - 1] + 0.0004, 0, WHITE, 0, 1, 0, 1); for (let j = 0; j < NP; j++) idx.push(last[j], last[(j + 1) % NP], cen); }

  // ---- pele entre os dedos e entre o polegar e o indicador ----
  function blob(cx, cy, cz, ra, rb, rc, rot, w0, bB) {
    const NU = 12, NV = 8, ca = Math.cos(rot), sa = Math.sin(rot), rows = [];
    for (let v = 0; v <= NV; v++) { const row = [], ph = v / NV * Math.PI; for (let u = 0; u < NU; u++) { const th = u / NU * Math.PI * 2, lx = ra * Math.sin(ph) * Math.cos(th), ly = rb * Math.cos(ph), lz = rc * Math.sin(ph) * Math.sin(th);
      row.push(V(cx + lx * ca + ly * sa, cy - lx * sa + ly * ca, cz + lz, WHITE, 0, w0, bB)); } rows.push(row); }
    for (let v = 0; v < NV; v++) for (let u = 0; u < NU; u++) { const a = rows[v][u], b = rows[v][(u + 1) % NU], c = rows[v + 1][u], d = rows[v + 1][(u + 1) % NU]; idx.push(a, b, c, b, d, c); }
  }
  [[5, 9], [9, 13], [13, 17]].forEach(([a, b]) => { const A = REST[a], B = REST[b]; blob((A[0] + B[0]) / 2, (A[1] + B[1]) / 2 + 0.0035, 0, 0.0060, 0.0090, 0.0050, 0, 1, 0); });
  blob(0.0425, 0.066, 0.003, 0.0075, 0.026, 0.0060, -0.24, 0.5, BONE_OF[2]);

  if (side < 0) for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }   // espelhar inverte a face dos triângulos
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
  g.setAttribute('skinIndex', new T.Uint16BufferAttribute(sIdx, 4)); g.setAttribute('skinWeight', new T.Float32BufferAttribute(sW, 4));
  g.setAttribute('aFade', new T.Float32BufferAttribute(fade, 1)); g.setIndex(idx); g.computeVertexNormals();
  // eixo e comprimento de repouso de cada osso (da articulação até a próxima)
  const rest = REST.map(r => [r[0] * side, r[1], r[2]]), axis = {}, len = {};
  CHAINS.forEach(ch => { for (let k = 0; k < 3; k++) { const a = v3(rest[ch[k]]), b = v3(rest[ch[k + 1]]); len[ch[k]] = a.distanceTo(b); axis[ch[k]] = b.sub(a).normalize(); } });
  return { geo: g, rest, axis, len };
}
window.VRHandGeo = { build, REST, CHAINS, BONE_LM, BONE_OF };
})();
