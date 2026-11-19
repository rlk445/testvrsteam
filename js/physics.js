/* Física (cannon-es), jogador, pegar objetos (perto e de longe), arremessar e interagir com objetos do cenário */
(() => {
'use strict';
const VR = window.VR, T = VR.T, S = VR.S, H = VR.H, HEAD = VR.HEAD, headQ = VR.headQ, log = VR.log, clamp = VR.clamp;
const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
world.broadphase = new CANNON.SAPBroadphase(world);
world.allowSleep = true; world.solver.iterations = VR.IOS ? 6 : 8; world.solver.tolerance = 0.01;
world.defaultContactMaterial.friction = 0.6; world.defaultContactMaterial.restitution = 0.05;
const G = { STATIC: 1, HAND: 2, PROP: 4, BLOCK: 8 };
const M = { stat: new CANNON.Material('stat'), prop: new CANNON.Material('prop'), ball: new CANNON.Material('ball') };
const cm = (a, b, f, r) => world.addContactMaterial(new CANNON.ContactMaterial(a, b, { friction: f, restitution: r }));
cm(M.prop, M.stat, 0.55, 0.12); cm(M.prop, M.prop, 0.5, 0.08); cm(M.ball, M.stat, 0.45, 0.72); cm(M.ball, M.prop, 0.4, 0.45); cm(M.ball, M.ball, 0.3, 0.7);
const gnd = new CANNON.Body({ mass: 0, shape: new CANNON.Plane(), collisionFilterGroup: G.STATIC, material: M.stat });
gnd.quaternion.setFromEuler(-Math.PI / 2, 0, 0); world.addBody(gnd);
const P = VR.phys = { world, G, M, gnd, props: [], statics: [], blocks: [], syncs: [] };
const PL = VR.PL = { x: 0, z: 0 }, JOY = VR.JOY = { x: 0, y: 0 };
VR.bounds = { x0: -40, x1: 40, z0: -40, z1: 40 };

// ---------- criação de corpos ----------
P.staticBox = (cx, cy, cz, hx, hy, hz, qy) => {
  const b = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(hx, hy, hz)), position: new CANNON.Vec3(cx, cy, cz), collisionFilterGroup: G.STATIC, material: M.stat });
  if (qy) b.quaternion.setFromEuler(0, qy, 0);
  world.addBody(b); P.statics.push(b); return b;
};
P.clearStatics = () => { P.statics.forEach(b => world.removeBody(b)); P.statics.length = 0; };
P.setStaticsOn = on => P.statics.forEach(b => { b.collisionFilterGroup = on ? G.STATIC : 0; b.collisionFilterMask = on ? -1 : 0; });
// objeto que pode ser pego: { mesh, shapes:[{shape, offset}], mass, pos:[x,y,z], mat, r, damping, name }
P.addProp = o => {
  const b = new CANNON.Body({ mass: o.mass, position: new CANNON.Vec3(...o.pos), material: o.mat || M.prop, sleepSpeedLimit: 0.2, sleepTimeLimit: 0.6, linearDamping: o.damping || 0.05, angularDamping: o.adamp || 0.25, collisionFilterGroup: G.PROP });
  (o.shapes || [{ shape: o.shape }]).forEach(s => b.addShape(s.shape, s.offset ? new CANNON.Vec3(...s.offset) : undefined));
  if (o.quat) b.quaternion.set(...o.quat);
  b.m0 = o.mass; world.addBody(b);
  const p = { b, mesh: o.mesh, mass: o.mass, r: o.r || 0.1, name: o.name || '', home: { p: o.pos.slice(), q: [b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w] } };
  o.mesh.traverse(m => { m.userData.prop = p; }); o.mesh.position.copy(b.position); o.mesh.quaternion.copy(b.quaternion);
  P.props.push(p); P.rebuildPick(); return p;
};
P.removeProps = () => { P.props.forEach(p => { world.removeBody(p.b); }); P.props.length = 0; P.rebuildPick(); };
P.resetProps = () => {
  [...H, MH].forEach(s => { if (s.held) release(s); });
  P.props.forEach(p => { const b = p.b; b.type = CANNON.Body.DYNAMIC; b.mass = p.mass; b.updateMassProperties(); b.position.set(...p.home.p); b.quaternion.set(...p.home.q); b.velocity.setZero(); b.angularVelocity.setZero(); b.wakeUp(); p.mesh.position.copy(b.position); p.mesh.quaternion.copy(b.quaternion); });
};
const mkKin = shape => { const b = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC, allowSleep: false, collisionFilterGroup: G.HAND, collisionFilterMask: G.PROP | G.BLOCK }); b.addShape(shape); b.position.set(0, -100, 0); world.addBody(b); return b; };
const playerB = mkKin(new CANNON.Box(new CANNON.Vec3(0.22, 0.8, 0.22)));
const handB = [0, 1].map(() => [mkKin(new CANNON.Sphere(0.055)), mkKin(new CANNON.Sphere(0.026))]);   // palma + ponta do indicador
function drive(b, tx, ty, tz, dt) {
  if (b.position.y < -50) { b.position.set(tx, ty, tz); b.velocity.setZero(); return; }
  const v = b.velocity, k = 1 / Math.max(dt, 1 / 120); v.set((tx - b.position.x) * k, (ty - b.position.y) * k, (tz - b.position.z) * k);
  const sp = v.length(); if (sp > 14) v.scale(14 / sp, v);
}

// ---------- andar (analógico, teclado, controle), pular e agachar ----------
const PY = VR.PY = { y: 0, vy: 0, crouch: 0 };                             // y: altura do pulo; crouch: 0 em pé … 1 agachado
const JUMP_V = 3.0, CROUCH_DROP = 0.6;                                     // pulo ≈ 46 cm; agachado a cabeça desce 60 cm
function movePlayer(dt) {
  const yaw = VR.headYaw(), sy = Math.sin(yaw), cy = Math.cos(yaw), KEYS = VR.KEYS, ctl = VR.ctl;
  let jx = JOY.x + (KEYS.KeyD || KEYS.ArrowRight ? 1 : 0) - (KEYS.KeyA || KEYS.ArrowLeft ? 1 : 0), jy = JOY.y + (KEYS.KeyW || KEYS.ArrowUp ? 1 : 0) - (KEYS.KeyS || KEYS.ArrowDown ? 1 : 0);
  { const l = Math.hypot(jx, jy); if (l > 1) { jx /= l; jy /= l; } }
  const ax = ctl && ctl.axes(); if (ax) { jx = ax.x; jy = ax.y; }          // analógico do controle: só serve para andar
  const wantJump = ctl && ctl.takeJump();
  if (PY.y > 0 || PY.vy > 0) { PY.vy -= 9.82 * dt; PY.y += PY.vy * dt; if (PY.y <= 0) { PY.y = 0; PY.vy = 0; } }
  else if (wantJump && PY.crouch < 0.35) PY.vy = JUMP_V;
  const wantCrouch = ctl && ctl.crouching() && PY.y === 0 ? 1 : 0;
  PY.crouch += (wantCrouch - PY.crouch) * VR.damp(14, dt);
  if (Math.abs(PY.crouch - wantCrouch) < 0.002) PY.crouch = wantCrouch;
  const B = VR.bounds, sp = 2.2 * (1 - 0.5 * PY.crouch);
  PL.x = clamp(PL.x + (jx * cy - jy * sy) * sp * dt, B.x0, B.x1); PL.z = clamp(PL.z + (-jx * sy - jy * cy) * sp * dt, B.z0, B.z1);
  HEAD.set(PL.x, 1.6 + PY.y - CROUCH_DROP * PY.crouch, PL.z);
  drive(playerB, PL.x, HEAD.y - 0.8, PL.z, dt);
}
VR.hook(10, movePlayer);

// ---------- segurar, arremessar ----------
const MH = VR.MH = { vis: false, held: null, pinch: false, pe: false, aim: new T.Vector3(), anchor: new T.Vector3(), q: new T.Quaternion(), vel: new T.Vector3(), Z: 1, busy: false, mouse: true };   // "mão" do mouse/toque
const hs = [H[0], H[1], MH];
const qW = new T.Quaternion(), dq = new T.Quaternion(), qa = new T.Quaternion(), vA = new T.Vector3(), vB = new T.Vector3(), vC = new T.Vector3();
const isHeld = b => hs.some(o => o.held && o.held.b === b);
function startHold(s, pick, mode, hit) {
  const b = pick.b; if (!b || isHeld(b)) return false;
  b.wakeUp(); b.type = CANNON.Body.KINEMATIC; b.mass = 0; b.updateMassProperties(); b.velocity.setZero(); b.angularVelocity.setZero(); b.sleepState = 0; b.allowSleep = false;
  const h = { b, pick, mode, mass: pick.mass || b.m0, hv: new T.Vector3(), off: new T.Vector3(), qh0: new T.Quaternion(), qb0: new T.Quaternion(), dist: 1, Z0: s.Z || 1 };
  vA.set(b.position.x, b.position.y, b.position.z);
  if (mode === 'far') { vB.copy(hit); h.off.copy(vA).sub(vB); h.dist = hit.distanceTo(HEAD); }
  else if (!pick.block) h.off.copy(vA).sub(s.anchor);
  qW.copy(headQ).multiply(s.q); h.qh0.copy(qW); h.qb0.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
  s.held = h; return true;
}
function release(s) {
  const h = s.held; if (!h) return; const b = h.b;
  b.allowSleep = true; b.type = CANNON.Body.DYNAMIC; b.mass = b.m0 || h.mass; b.updateMassProperties(); b.wakeUp();
  const v = h.mode === 'far' || s.mouse ? h.hv : s.vel, sp = v.length(), k = sp > 12 ? 12 / sp : 1; b.velocity.set(v.x * k, v.y * k, v.z * k); b.angularVelocity.setZero(); s.held = null;
}
P.release = release;
function grabNear(s) {
  const pt = s.anchor; let best = 0.2, pick = null;
  for (const p of P.props) { if (isHeld(p.b)) continue; const d = Math.hypot(p.b.position.x - pt.x, p.b.position.y - pt.y, p.b.position.z - pt.z) - p.r * 0.5; if (d < best) { best = d; pick = p; } }
  if (!pick) { best = 0.25; const bl = P.blocks; for (let i = 0; i < bl.length; i++) { const b = bl[i].b; if (b.m0 > 150) continue; const d = Math.hypot(b.position.x - pt.x, b.position.y - pt.y, b.position.z - pt.z); if (d < best) { best = d; pick = { b, mass: b.m0, block: true }; } } }
  return pick ? startHold(s, pick, 'near') : false;
}
function updateHeld(s, dt) {
  const h = s.held; if (!h) return; const b = h.b, pick = h.pick, B = VR.bounds;
  qW.copy(headQ).multiply(s.q); dq.copy(qW).multiply(qa.copy(h.qh0).invert());
  if (h.mode === 'far') {
    const dist = clamp(h.dist * Math.pow((s.Z || 1) / h.Z0, s.mouse ? 0 : 1.7) + (s.wheel || 0), 0.4, 7);
    vA.copy(s.aim).multiplyScalar(dist).add(HEAD); vB.copy(h.off); if (!s.mouse) vB.applyQuaternion(dq); vA.add(vB);
  } else if (pick.block) vA.copy(s.anchor);
  else { vB.copy(h.off).applyQuaternion(dq); vA.copy(s.anchor).add(vB); }
  vA.set(clamp(vA.x, B.x0 + 0.2, B.x1 - 0.2), clamp(vA.y, 0.1, 2.5), clamp(vA.z, B.z0 + 0.2, B.z1 - 0.2));
  vC.set(b.position.x, b.position.y, b.position.z);
  drive(b, vA.x, vA.y, vA.z, dt);
  h.hv.lerp(vB.set(b.velocity.x, b.velocity.y, b.velocity.z), 0.4);
  if (!pick.block && !s.mouse) { qa.copy(dq).multiply(h.qb0); b.quaternion.set(qa.x, qa.y, qa.z, qa.w); b.angularVelocity.setZero(); }
}
// ---------- interação com o cenário por raio (cabeça → ponta dos dedos): interruptores, TV, objetos pegáveis à distância ----------
const rc = new T.Raycaster(); rc.far = 12;
let iMeshes = [], pMeshes = [], hoverI = [null, null, null];
const W = VR.world = { interactives: [] };
W.setInteractives = list => { W.interactives = list; iMeshes = []; list.forEach(it => it.meshes.forEach(m => { m.userData.inter = it; iMeshes.push(m); })); };
P.rebuildPick = () => { pMeshes = P.props.map(p => p.mesh); };
const _o = new T.Vector3(), _d = new T.Vector3();
// p = ponteiro {o, d, idx}; s = estado da mão. Retorna { point, kind } do que está sob o ponteiro (para o cursor)
W.pointer = (p, press, s) => {
  rc.set(p.o, p.d);
  const hi = iMeshes.length ? rc.intersectObjects(iMeshes, false)[0] : null, hp = pMeshes.length ? rc.intersectObjects(pMeshes, true)[0] : null;
  const useI = hi && (!hp || hi.distance <= hp.distance), it = useI ? hi.object.userData.inter : null;
  if (hoverI[p.idx] !== it) { if (hoverI[p.idx] && hoverI[p.idx].hover) hoverI[p.idx].hover(false); hoverI[p.idx] = it; if (it && it.hover) it.hover(true); }
  if (it) { if (press) { it.click(hi.point); if (s) s.busy = true; } return { point: hi.point, kind: 'int' }; }
  if (hp) {
    if (press && s && !s.held && !s.busy) { let o = hp.object; while (o && !o.userData.prop) o = o.parent; if (o) startHold(s, o.userData.prop, 'far', hp.point); }
    return { point: hp.point, kind: 'prop' };
  }
  return null;
};
W.peek = (o, d) => { rc.set(o, d); return !!((iMeshes.length && rc.intersectObjects(iMeshes, false)[0]) || (pMeshes.length && rc.intersectObjects(pMeshes, true)[0])); };
W.clearHover = idx => { if (hoverI[idx]) { if (hoverI[idx].hover) hoverI[idx].hover(false); hoverI[idx] = null; } };

// ---------- por quadro ----------
function interact(dt) {
  for (let h = 0; h < 2; h++) {
    const s = H[h], hb = handB[h];
    if (!s.vis || !s.on) { if (s.held) release(s); hb[0].position.set(0, -100, 0); hb[1].position.set(0, -100, 0); s.busy = false; continue; }
    const grip = s.pinch || s.fist;
    if (!s.pinch) s.busy = false;
    if (s.held && !grip) release(s);
    if (grip && !s.held && !s.busy && !s.uiHover) grabNear(s);
    updateHeld(s, dt);
    // mãos empurram objetos (a ponta do indicador sai do caminho enquanto você fecha a pinça para não empurrar o que vai pegar)
    VR.toWorld(vA, s.P[9]); drive(hb[0], vA.x, vA.y, vA.z, dt); VR.toWorld(vA, s.P[8]); drive(hb[1], vA.x, vA.y, vA.z, dt);
    hb[1].collisionFilterMask = (s.pr < 0.85 || s.pinch) ? 0 : (G.PROP | G.BLOCK);
  }
  if (MH.held) { if (!MH.pinch) release(MH); else updateHeld(MH, dt); }
}
VR.hook(31, interact);
VR.hook(40, dt => {
  try { world.step(1 / 60, dt, VR.IOS ? 2 : 3); } catch (e) { log('física: ' + e.message); }
  for (let i = 0; i < P.props.length; i++) {
    const p = P.props[i], b = p.b;
    if (b.sleepState !== 2 || p.wr) { p.mesh.position.set(b.position.x, b.position.y, b.position.z); p.mesh.quaternion.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w); p.wr = b.sleepState !== 2 ? 1 : 0; }
    if (b.position.y < -3 || Math.abs(b.position.x) > 30 || Math.abs(b.position.z) > 30) { release(hs.find(o => o.held && o.held.b === b) || { held: null }); b.position.set(...p.home.p); b.velocity.setZero(); b.angularVelocity.setZero(); }
  }
  for (let i = 0; i < P.syncs.length; i++) P.syncs[i](dt);
});
})();
