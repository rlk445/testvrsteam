/* Visual das mãos: realista (malha com esqueleto), contorno (estilo Quest), esqueleto de esferas ou oculta */
(() => {
'use strict';
const VR = window.VR, T = VR.T, S = VR.S, H = VR.H, hov = VR.hov, PT_D = VR.PT_D, G = window.VRHandGeo, clamp = VR.clamp;
const NL = 21;
VR.SKINS = [{ n: 'Claro', c: 0xf3cfb7 }, { n: 'Médio', c: 0xd9a37c }, { n: 'Moreno', c: 0xa97250 }, { n: 'Escuro', c: 0x6c4533 }, { n: 'Neutro', c: 0xcdd6e4 }];
const vis = [0, 1].map(() => { const g = new T.Group(); g.visible = false; hov.add(g); return g; });   // um grupo por mão (escala para a passagem da câmera)

// ---------- esqueleto de esferas ----------
const handMats = [new T.MeshBasicMaterial({ color: 0x40e0ff }), new T.MeshBasicMaterial({ color: 0xff55cc })], sphereGeo = new T.SphereGeometry(0.008, 8, 6);
const skel = [0, 1].map(h => Array.from({ length: NL }, (_, i) => { const m = new T.Mesh(sphereGeo, handMats[h]); m.visible = false; m.scale.setScalar([4, 8, 12, 16, 20].includes(i) ? 1.8 : 1); vis[h].add(m); return m; }));

// ---------- contorno: silhueta desenhada num plano preso à cabeça, na mesma posição do vídeo da passagem ----------
const HN = 256, CHAINS = G.CHAINS, PALM = [0, 1, 5, 9, 13, 17], c2 = Array.from({ length: NL }, () => [0, 0]);
function mkCv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return { c, g: c.getContext('2d'), t }; }
const outline = [0, 1].map(() => { const cv = mkCv(HN, HN), m = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: cv.t, transparent: true, depthTest: false, depthWrite: false, fog: false })); m.renderOrder = 15; m.visible = false; hov.add(m); return { cv, m }; });
function handPath(g, c) {
  g.beginPath(); PALM.forEach((i, k) => { if (k) g.lineTo(c[i][0], c[i][1]); else g.moveTo(c[i][0], c[i][1]); }); g.closePath();
  CHAINS.forEach(ch => { g.moveTo(c[ch[0]][0], c[ch[0]][1]); for (let k = 1; k < ch.length; k++) g.lineTo(c[ch[k]][0], c[ch[k]][1]); });
}
function paintHand(o, c, Tk, rgb) {
  const g = o.cv.g, ow = Math.max(2.4, HN * 0.013);
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, HN, HN);
  g.lineJoin = 'round'; g.lineCap = 'round'; handPath(g, c);
  g.strokeStyle = 'rgba(' + rgb + ',0.16)'; g.lineWidth = Tk + ow * 2 + 10; g.stroke();         // brilho suave
  g.strokeStyle = 'rgba(' + rgb + ',0.96)'; g.lineWidth = Tk + ow * 2; g.stroke();              // borda
  g.globalCompositeOperation = 'destination-out'; g.fillStyle = g.strokeStyle = '#000'; g.lineWidth = Tk; g.fill(); g.stroke();   // esvazia o miolo
  g.globalCompositeOperation = 'source-over'; g.fillStyle = g.strokeStyle = 'rgba(' + rgb + ',0.07)'; g.fill(); g.stroke();       // tom leve por dentro
  o.cv.t.needsUpdate = true;
}
function updateOutline(h, s) {
  const o = outline[h], L = s.P, OD = S.pass ? PT_D : 0.8; let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (let i = 0; i < NL; i++) { const k = OD / Math.max(-L[i].z, 0.1), u = L[i].x * k, v = L[i].y * k; c2[i][0] = u; c2[i][1] = v; if (u < x0) x0 = u; if (u > x1) x1 = u; if (v < y0) y0 = v; if (v > y1) y1 = v; }
  const palmW = Math.max(Math.hypot(c2[5][0] - c2[17][0], c2[5][1] - c2[17][1]), 0.004), sz = Math.max(x1 - x0, y1 - y0) / 2 + palmW * 0.7, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, kk = HN / (2 * sz);
  for (let i = 0; i < NL; i++) { c2[i][0] = (c2[i][0] - cx) * kk + HN / 2; c2[i][1] = HN / 2 - (c2[i][1] - cy) * kk; }
  const Tk = Math.max(palmW * kk * 0.24, 3);
  CHAINS.forEach(ch => { const a = c2[ch[3]], b = c2[ch[2]], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; a[0] += dx / l * Tk * 0.38; a[1] += dy / l * Tk * 0.38; });   // a ponta do dedo não passa do landmark
  paintHand(o, c2, Tk, (s.pinch || s.fist || s.held) ? '120,205,255' : '255,255,255');
  o.m.material.opacity = s.fade; o.m.position.set(cx, cy, -OD); o.m.scale.set(2 * sz, 2 * sz, 1); o.m.visible = true;
}

// ---------- mão realista ----------
function skinMat() {
  const mat = new T.MeshStandardMaterial({ color: 0xd9a37c, roughness: 0.55, metalness: 0, vertexColors: true });
  mat.customProgramCacheKey = () => 'vrhandskin';
  mat.onBeforeCompile = sh => {
    sh.uniforms.uA = mat.userData.uA = { value: 1 }; sh.uniforms.uRim = mat.userData.uRim = { value: new T.Color(0.55, 0.28, 0.2) };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aFade;\nvarying float vFade;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvFade = aFade;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uA;\nuniform vec3 uRim;\nvarying float vFade;')
      .replace('void main() {', 'void main() {\n  float _n = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));\n  if (vFade * uA < _n) discard;')    // esmaece o pulso/antebraço e a mão inteira ao sumir (pontilhado, sem transparência)
      .replace('#include <output_fragment>', '  float _rim = pow(1.0 - saturate(dot(normalize(normal), normalize(vViewPosition))), 2.4);\n  outgoingLight += uRim * _rim;\n#include <output_fragment>');   // brilho suave de pele nas bordas
  };
  return mat;
}
function makeModel(side) {
  const g = G.build(side), bones = G.BONE_LM.map(lm => { const b = new T.Bone(); b.position.fromArray(g.rest[lm]); return b; });
  const root = new T.Group(); bones.forEach(b => root.add(b)); root.updateMatrixWorld(true);
  const skeleton = new T.Skeleton(bones), mat = skinMat(), mesh = new T.SkinnedMesh(g.geo, mat);
  mesh.frustumCulled = false; mesh.renderOrder = 5; root.add(mesh); mesh.bind(skeleton, new T.Matrix4()); root.visible = false;
  return { root, bones, mesh, mat, g, hs: 1, init: false };
}
const models = [0, 1].map(h => [makeModel(1), makeModel(-1)]);                  // [mão direita, mão esquerda] por posição
models.forEach((pair, h) => pair.forEach(m => vis[h].add(m.root)));
const J = new T.Vector3(), Qp = new T.Quaternion(), Qk = new T.Quaternion(), dq = new T.Quaternion(), cur = new T.Vector3(), dir = new T.Vector3();
function setBone(b, p, q, hs) { b.position.copy(p); b.quaternion.copy(q); b.scale.setScalar(hs); }
function pose(m, s, dt) {                                                       // cada osso aponta para o próximo ponto rastreado; o comprimento dos ossos é fixo (sem tremer)
  const P = s.P, R = s.q, g = m.g, target = clamp((P[9].distanceTo(P[0]) / 0.0995 + P[5].distanceTo(P[17]) / 0.065) * 0.5, 0.5, 3);
  m.hs = m.init ? m.hs + (target - m.hs) * VR.damp(6, dt) : target; m.init = true;
  const hs = m.hs; setBone(m.bones[0], P[0], R, hs);
  for (let c = 0; c < G.CHAINS.length; c++) {
    const ch = G.CHAINS[c];
    J.fromArray(g.rest[ch[0]]).multiplyScalar(hs).applyQuaternion(R).add(P[0]); Qp.copy(R);
    for (let k = 0; k < 3; k++) {
      const a = ch[k], b = ch[k + 1]; dir.copy(P[b]).sub(P[a]); const l = dir.length();
      if (l > 1e-5) { dir.divideScalar(l); cur.copy(g.axis[a]).applyQuaternion(Qp); dq.setFromUnitVectors(cur, dir); Qk.copy(dq).multiply(Qp); } else Qk.copy(Qp);
      setBone(m.bones[G.BONE_OF[a]], J, Qk, hs);
      if (l > 1e-5) J.addScaledVector(dir, g.len[a] * hs); Qp.copy(Qk);
    }
  }
}
const skinC = new T.Color(), glow = new T.Color(0.15, 0.4, 0.8);
function setSkin(i) {
  const sk = VR.SKINS[i] || VR.SKINS[1]; S.skin = VR.SKINS.indexOf(sk); VR.save();
  models.forEach(p => p.forEach(m => { m.mat.color.set(sk.c); m.mat.userData.base = skinC.set(sk.c).clone().multiplyScalar(0.28); m.mat.emissive.copy(m.mat.userData.base);
    if (m.mat.userData.uRim) m.mat.userData.uRim.value.copy(skinC.set(sk.c)).multiplyScalar(0.45).lerp(new T.Color(0.7, 0.3, 0.2), 0.3); }));
}

// ---------- por quadro ----------
function update(dt) {
  const mode = S.hand;
  for (let h = 0; h < 2; h++) {
    const s = H[h], v = vis[h], show = s.vis && s.on && mode !== 'off';
    if (!show) { v.visible = false; outline[h].m.visible = false; continue; }
    v.visible = mode !== 'outline'; v.scale.setScalar(S.pass ? PT_D / Math.max(S.reach * s.Z, 0.15) : 1);
    const sk = skel[h], pr = models[h];
    for (let i = 0; i < NL; i++) { sk[i].visible = mode === 'skeleton'; if (mode === 'skeleton') sk[i].position.copy(s.P[i]); }
    const mi = s.right ? 0 : 1; pr[1 - mi].root.visible = false; pr[mi].root.visible = mode === 'model';
    if (mode === 'model') {
      const m = pr[mi]; pose(m, s, dt);
      const ud = m.mat.userData; if (ud.uA) ud.uA.value = s.fade;
      if (ud.base) m.mat.emissive.copy(ud.base).lerp(glow, s.pinch ? 0.18 : s.fist ? 0.08 : 0);
    }
    if (mode === 'outline') updateOutline(h, s); else outline[h].m.visible = false;
  }
}
VR.hook(25, update);
VR.handvis = { setSkin, refresh() { outline.forEach(o => { o.m.visible = false; }); } };
setSkin(S.skin);
})();
