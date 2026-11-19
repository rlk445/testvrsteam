/* Ambientes: Quarto 3D, Cidade destrutível, Panorama 360, Campo aberto, Chroma verde e Transparente */
(() => {
'use strict';
const VR = window.VR, T = VR.T, S = VR.S, scene = VR.scene, P = VR.phys, world = P.world, G = P.G, PL = VR.PL, ui = VR.ui, log = VR.log;
const env = VR.env = { cur: null, home: true };
env.label = id => { const e = ui.ENVS.find(x => x.id === id); return e ? e.label : id; };

// ---------- campo aberto (chão + grade) ----------
const floor = new T.Mesh(new T.PlaneGeometry(200, 200), new T.MeshLambertMaterial({ color: 0x4d6b4a })); floor.rotation.x = -Math.PI / 2; floor.visible = false; scene.add(floor);
const grid = new T.GridHelper(60, 60, 0x33503a, 0x3f6347); grid.position.y = 0.01; grid.material.transparent = true; grid.material.opacity = 0.35; grid.visible = false; scene.add(grid);

// ---------- cidade destrutível (somente blocos que você pega, empurra e joga) ----------
const road = new T.Mesh(new T.PlaneGeometry(5, 60), new T.MeshLambertMaterial({ color: 0x555a60 })); road.rotation.x = -Math.PI / 2; road.position.set(0, 0.015, -12); road.visible = false; scene.add(road);
const MAXB = 1300, bricks = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), new T.MeshLambertMaterial(), MAXB); bricks.frustumCulled = false; bricks.count = 0; bricks.visible = false; scene.add(bricks);
const blocks = P.blocks, _m = new T.Matrix4(), _s = new T.Vector3(), _c = new T.Color();
function writeBlock(i) { const o = blocks[i], b = o.b; _s.set(o.sx, o.sy, o.sz); _m.compose(b.position, b.quaternion, _s); bricks.setMatrixAt(i, _m); }
function addBlock(x, y, z, sx, sy, sz, color, dens) {
  if (blocks.length >= MAXB) return;
  const k = 0.996, b = new CANNON.Body({ mass: sx * sy * sz * (dens || 300), shape: new CANNON.Box(new CANNON.Vec3(sx * k / 2, sy * k / 2, sz * k / 2)), position: new CANNON.Vec3(x, y, z), sleepSpeedLimit: 0.25, sleepTimeLimit: 0.5, linearDamping: 0.02, angularDamping: 0.1, collisionFilterGroup: G.BLOCK });
  world.addBody(b); b.sleep(); b.m0 = b.mass; b.blk = blocks.length; b.wr = 0;
  blocks.push({ b, sx, sy, sz }); writeBlock(b.blk); bricks.setColorAt(b.blk, color); bricks.count = blocks.length;
}
function segs(L, odd, bw) { const n = Math.max(1, Math.round(L / bw)), s = L / n, a = []; if (!odd || n < 2) for (let i = 0; i < n; i++) a.push([-L / 2 + s * (i + 0.5), s]); else { a.push([-L / 2 + s / 4, s / 2]); for (let i = 1; i < n; i++) a.push([-L / 2 + s * i, s]); a.push([L / 2 - s / 4, s / 2]); } return a; }
function building(cx, cz, w, d, floors, hue, big) {                          // paredes em fiadas de blocos amarrados, janelas, porta e lajes
  const bw = big ? 0.9 : 0.8, bh = 0.55, bt = 0.35, rows = 5, SL = 0.2, base = new T.Color().setHSL(hue, 0.4, 0.62);
  const col = dl => _c.copy(base).offsetHSL(0, 0, (Math.random() - 0.5) * 0.08 + (dl || 0)).clone();
  for (let f = 0; f < floors; f++) {
    const y0 = f * (rows * bh + SL);
    for (let r = 0; r < rows; r++) {
      const y = y0 + (r + 0.5) * bh, odd = r % 2;
      [['x', -d / 2 + bt / 2, odd ? w - 2 * bt : w], ['x', d / 2 - bt / 2, odd ? w - 2 * bt : w], ['z', -w / 2 + bt / 2, odd ? d : d - 2 * bt], ['z', w / 2 - bt / 2, odd ? d : d - 2 * bt]].forEach(([ax, off, L], si) => segs(L, odd, bw).forEach(([c, len]) => {
        if (f === 0 && si === 1 && r < 4 && Math.abs(c) < 0.55) return;
        if ((r === 2 || r === 3) && !(f === 0 && si === 1) && Math.abs(Math.abs(c) - L * 0.27) < 0.4 && L > 2.5) return;
        if (ax === 'x') addBlock(cx + c, y, cz + off, len, bh, bt, col()); else addBlock(cx + off, y, cz + c, bt, bh, len, col());
      }));
    }
    addBlock(cx, y0 + rows * bh + SL / 2, cz, w, SL, d, col(-0.15), 450);
  }
}
function buildCity() {
  building(-5.5, -7.5, 4.2, 3.4, 1, 0.08); building(5.5, -8, 4.2, 3.4, 1, 0.55); building(0, -15, 3.6, 3.6, S.q ? 4 : 3, 0.6, true);
  if (S.q) { building(11, -14, 4.2, 3.4, 1, 0.15); building(-11, -13, 3.6, 3.6, 3, 0.02, true); }
  bricks.instanceMatrix.needsUpdate = true; if (bricks.instanceColor) bricks.instanceColor.needsUpdate = true;
}
function destroyCity() { [VR.H[0], VR.H[1], VR.MH].forEach(s => { if (s.held && s.held.pick && s.held.pick.block) P.release(s); }); blocks.forEach(o => world.removeBody(o.b)); blocks.length = 0; bricks.count = 0; }
P.syncs.push(() => {
  if (env.cur !== 'city') return; let dirty = false;
  for (let i = 0; i < blocks.length; i++) { const b = blocks[i].b; if (b.sleepState !== 2 || b.wr) { writeBlock(i); b.wr = b.sleepState !== 2 ? 1 : 0; dirty = true; } if (b.position.y < -20) { b.position.set(0, 50, -50); b.velocity.setZero(); } }
  if (dirty) bricks.instanceMatrix.needsUpdate = true;
});

// ---------- troca de ambiente ----------
function exit(id) {
  if (id === 'room') VR.room.exit(); else if (id === 'city') destroyCity(); else if (id === 'pong') VR.pong.exit(); else if (id === 'sinuca') VR.sinuca.exit(); else if (id === 'saber') VR.saber.exit();
}
function enter(id) {
  VR.bounds = { x0: -40, x1: 40, z0: -40, z1: 40 }; PL.x = 0; PL.z = 0;
  if (id === 'room') VR.room.enter(); else if (id === 'city') buildCity(); else if (id === 'pong') VR.pong.enter(); else if (id === 'sinuca') VR.sinuca.enter(); else if (id === 'saber') VR.saber.enter();
  VR.HEAD.set(PL.x, 1.6, PL.z);                                              // a cabeça já vai para o novo ponto (as janelas abrem em volta dele)
}
env.refresh = () => {
  const e = env.home ? 'pano' : S.env, pass = S.pass, pano = VR.pano.mesh;
  const showPano = !pass && (e === 'pano' || e === 'room' || e === 'pong'), ground = !pass && (e === 'city' || e === 'sky');
  if (pano) pano.visible = showPano;
  floor.visible = grid.visible = ground; road.visible = ground && e === 'city'; bricks.visible = e === 'city';
  VR.room && VR.room.setVisible(e === 'room', pass);
  VR.pong && VR.pong.setVisible(e === 'pong', pass);
  VR.sinuca && VR.sinuca.setVisible(e === 'sinuca', pass);
  VR.saber && VR.saber.setVisible(e === 'saber', pass);
  const R = VR.renderer;
  if (pass || e === 'alpha') { scene.background = null; scene.fog = null; R.setClearColor(0x000000, 0); }
  else if (e === 'saber') { scene.background = VR.saber.bg; scene.fog = VR.saber.fog; }
  else if (e === 'sinuca') { scene.background = VR.sinuca.bg; scene.fog = VR.sinuca.fog; }
  else if (e === 'green') { scene.background = new T.Color(0x00b140); scene.fog = null; }
  else if (e === 'pano' || e === 'room' || e === 'pong') { scene.background = VR.pano.fog; scene.fog = null; }
  else { scene.background = VR.skyBg; scene.fog = VR.skyFog; }
  const room = e === 'room' && !pass;
  VR.hemi.visible = VR.sun.visible = true;
  if (!room) { VR.hemi.color.set(0xdfefff); VR.hemi.groundColor.set(0x445544); VR.hemi.intensity = 0.9; VR.sun.color.set(0xffffff); VR.sun.intensity = 0.8; VR.sun.position.set(5, 10, 3); }
  else VR.room.applyLights(true);
};
env.set = (id, force) => {
  if (!force && env.cur === id && !env.home) return;
  if (env.cur) exit(env.cur); env.home = false; env.cur = id; S.env = id; VR.save(); enter(id); env.refresh(); ui.replaceAll();
  if (id === 'pong') { ui.closeMenu(); VR.ui.toast('Ping-Pong: abra a mão, pegue a raquete e acerte a bolinha', 5000); }
  else if (id === 'sinuca') { ui.closeMenu(); VR.ui.toast('Sinuca: aponte, pince e afaste a mão para dar a tacada', 5000); }
  else if (id === 'saber') { ui.closeMenu(); VR.ui.toast('Beat Saber: corte o botão JOGAR com o sabre', 5000); } else VR.ui.toast('Ambiente: ' + env.label(id));
};
env.begin = () => { env.home = false; if (env.cur) exit(env.cur); env.cur = S.env; enter(S.env); env.refresh(); ui.replaceAll(); };
env.resetObjects = () => { if (env.cur === 'room') VR.room.reset(); else if (env.cur === 'city') { destroyCity(); buildCity(); } VR.ui.toast('Objetos reorganizados'); };
env.reloadCity = () => { if (env.cur === 'city') { destroyCity(); buildCity(); } };
VR.hook(50, (dt, t) => { if (env.cur === 'room') VR.room.update(dt, t); });
env.refresh();
})();
