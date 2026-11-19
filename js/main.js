/* Tela inicial, permissões, eventos (teclado, joystick, toque) e ligação de tudo */
(() => {
'use strict';
const VR = window.VR, S = VR.S, $ = VR.$, log = VR.log, ui = VR.ui;
const setHud = () => {
  const flat = S.started && !S.vr && !S.obs;
  $('hud').style.display = S.debug && !S.obs ? 'block' : 'none'; $('preview').style.display = flat && S.preview ? 'block' : 'none';
  $('joy').style.display = flat ? 'block' : 'none'; $('gear').style.display = flat ? 'flex' : 'none';
  $('gear').style.alignItems = 'center'; $('gear').style.justifyContent = 'center';
  if (setHud.vr !== S.vr) { setHud.vr = S.vr; if (ui.replaceAll) ui.replaceAll(); }
};
const setObs = v => { S.obs = v; setHud(); VR.toast && !v && VR.toast('Menu de volta'); };
async function clearCache() {
  try { (await navigator.serviceWorker.getRegistrations()).forEach(r => r.unregister()); (await caches.keys()).forEach(k => caches.delete(k)); } catch (e) {}
  setTimeout(() => location.reload(), 400);
}
VR.main = { setHud, setObs, clearCache };
// link do YouTube na tela inicial
(() => { const i = $('ytIn'); try { i.value = localStorage.getItem('ytlink') || ''; } catch (e) {} i.addEventListener('input', () => { i.style.borderColor = !i.value ? '' : VR.yt.setLink(i.value) ? '#4fe08a' : '#ff6b6b'; }); i.addEventListener('keydown', e => e.stopPropagation()); })();
// ---------- iniciar ----------
$('start').onclick = async () => {
  if (S.started) { $('menu').style.display = 'none'; return; }
  if (!('ontouchstart' in window) && !navigator.maxTouchPoints) S.facing = 'user';          // PC: webcam
  try { const el = document.documentElement; if (el.requestFullscreen && !document.fullscreenElement) el.requestFullscreen({ navigationUI: 'hide' }).then(() => { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); }).catch(() => {}); } catch (e) {}
  const reqs = [];                                                                          // as permissões do iOS precisam ser pedidas dentro do toque
  if (window.DeviceOrientationEvent && DeviceOrientationEvent.requestPermission) reqs.push(DeviceOrientationEvent.requestPermission());
  if (window.DeviceMotionEvent && DeviceMotionEvent.requestPermission) reqs.push(DeviceMotionEvent.requestPermission());
  try { const res = await Promise.all(reqs); if (res.some(r => r !== 'granted')) { if ('ontouchstart' in window || navigator.maxTouchPoints) { VR.status('Permissão de movimento negada. Ajustes > Safari > Movimento e orientação (ou reabra o app).'); return; } log('sensores de movimento indisponíveis: usando o mouse para olhar'); } } catch (e) { VR.status('Erro ao pedir permissão de movimento: ' + e.message); return; }
  try { localStorage.setItem('vrlog', '[]'); } catch (e) {} log('toque em Iniciar (v24) ' + (/Android/.test(navigator.userAgent) ? 'Android' : 'Apple/outro') + ' ' + innerWidth + 'x' + innerHeight + ' dpr' + devicePixelRatio);
  VR.listenSensors(); VR.needCenter(); S.started = true; document.body.classList.add('started'); $('menu').style.display = 'none';
  VR.env.begin(); ui.openMenu(); setHud(); VR.toast('Aponte com a mão e junte polegar + indicador (pinça) para clicar', 6500);
  try { if (navigator.wakeLock) await navigator.wakeLock.request('screen'); } catch (e) {}
  VR.status('Sensores ativos. Iniciando câmera e rastreamento de mãos…');
  try { log('iniciando rastreador'); await VR.tracker.startHands(); log('abrindo câmera'); await VR.tracker.startCamera(); log('câmera aberta'); VR.status('Tudo ativo. Mostre as mãos para a câmera.'); if (S.pass) VR.setPass(true); }
  catch (e) { log('FALHA câmera/mãos: ' + (e && e.name) + ' ' + (e && e.message)); VR.status(VR.camMsg(e)); }
};
$('gear').onclick = () => ui.toggleMenu();
let installEv = null; addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEv = e; $('install').style.display = 'flex'; });
$('install').onclick = () => { if (installEv) { installEv.prompt(); installEv = null; $('install').style.display = 'none'; } };
// ---------- teclado ----------
addEventListener('keydown', e => {
  if (e.target && e.target.tagName === 'INPUT') return; VR.KEYS[e.code] = true;
  if (e.code === 'KeyR') VR.recenter(); if (e.code === 'KeyH') setObs(!S.obs); if (e.code === 'KeyM' && S.started) ui.toggleMenu();
  if (e.code === 'KeyV') { S.vr = !S.vr; VR.save(); setHud(); }
});
addEventListener('keyup', e => { VR.KEYS[e.code] = false; });
// ---------- joystick de toque ----------
(() => {
  const joy = $('joy'), knob = $('knob'), R = 45; let id = null;
  const set = (x, y) => { const l = Math.hypot(x, y), k = l > R ? R / l : 1; x *= k; y *= k; knob.style.transform = `translate(${x}px,${y}px)`; VR.JOY.x = x / R; VR.JOY.y = -y / R; };
  const pos = e => { const r = joy.getBoundingClientRect(); return [e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2]; };
  joy.addEventListener('pointerdown', e => { id = e.pointerId; joy.setPointerCapture(id); set(...pos(e)); e.preventDefault(); e.stopPropagation(); });
  joy.addEventListener('pointermove', e => { if (e.pointerId === id) set(...pos(e)); });
  const up = e => { if (e.pointerId === id) { id = null; set(0, 0); } }; joy.addEventListener('pointerup', up); joy.addEventListener('pointercancel', up);
})();
// ---------- toque no vazio: recentralizar; segurar 1 s: abre/fecha o menu; arrastar: olhar (PC sem giroscópio) ----------
(() => {
  const cv = $('scene'); let d = null;
  cv.addEventListener('pointerdown', e => { if (!S.started) return; d = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0, id: e.pointerId, timer: setTimeout(() => { if (d) { d.fired = true; ui.toggleMenu(); } }, 1000) }; });
  cv.addEventListener('pointermove', e => {
    if (!d || e.pointerId !== d.id) return; const dx = e.clientX - d.x, dy = e.clientY - d.y; d.moved += Math.abs(dx) + Math.abs(dy); d.x = e.clientX; d.y = e.clientY;
    if (d.moved > 12) clearTimeout(d.timer);
    if (!VR.haveOri() && d.moved > 4) { VR.MK.yaw -= dx * 0.005; VR.MK.pitch = Math.max(-1.4, Math.min(1.4, VR.MK.pitch - dy * 0.005)); }
  });
  const up = e => { if (!d || e.pointerId !== d.id) return; clearTimeout(d.timer); if (!d.fired && d.moved < 12 && performance.now() - d.t < 600 && e.pointerType === 'touch') VR.recenter(); d = null; };
  addEventListener('pointerup', up); addEventListener('pointercancel', up);
})();
// ---------- liga o loop ----------
VR.loadPano(); setHud(); VR.start();
})();
