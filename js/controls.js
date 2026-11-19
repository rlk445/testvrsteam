/* Controle Bluetooth: analógico = andar; botões configuráveis (Pular, Agachar).
   Funciona com controle em modo "gamepad" (Gamepad API) e em modo "teclado" (muitos controles de óculos VR mandam teclas). */
(() => {
'use strict';
const VR = window.VR, S = VR.S;
const ACTIONS = [
  { id: 'jump', key: 'bindJump', label: 'Pular' },
  { id: 'crouch', key: 'bindCrouch', label: 'Agachar' }
];
const byId = id => ACTIONS.find(a => a.id === id);
const DEAD = 0.18;
let listenId = '', listenT = 0, last = '', jumpFlag = false, crouchHeld = false, crouchTog = false;
const down = {};                                   // entradas atualmente pressionadas (código → true)
const prevPad = {};                                // estado anterior dos botões do gamepad

const refresh = () => { try { const p = VR.ui && VR.ui.panels && VR.ui.panels.settings; if (p) p.dirty = true; } catch (e) {} };
const say = m => { try { VR.toast && VR.toast(m); } catch (e) {} };
const pads = () => { try { return [...(navigator.getGamepads ? navigator.getGamepads() : [])].filter(g => g && g.connected !== false); } catch (e) { return []; } };

function name(code) {
  if (!code) return '';
  if (code.indexOf('pad:') === 0) return 'Botão ' + (+code.slice(4) + 1);
  const k = code.slice(4);
  return k.replace(/^Key/, '').replace(/^Digit/, '').replace('Arrow', 'Seta ').replace('Space', 'Espaço').replace('ShiftLeft', 'Shift').replace('ControlLeft', 'Ctrl') || k;
}
function bindTo(a, code) {
  ACTIONS.forEach(o => { if (o.id !== a.id && S[o.key] === code) S[o.key] = ''; });   // o mesmo botão não pode ter duas funções
  S[a.key] = code; listenId = ''; VR.save(); refresh(); say(a.label + ' = ' + name(code));
}
// um botão/tecla foi pressionado (rising edge)
function onDown(code) {
  last = name(code) + ' (' + (code.indexOf('pad:') === 0 ? 'controle' : 'tecla') + ')'; refresh();
  if (listenId) { bindTo(byId(listenId), code); return true; }
  let used = false;
  ACTIONS.forEach(a => {
    if (S[a.key] !== code) return; used = true;
    if (a.id === 'jump') jumpFlag = true;
    else if (S.ctlCrouchMode === 1) crouchTog = !crouchTog; else crouchHeld = true;
  });
  return used;
}
function onUp(code) {
  ACTIONS.forEach(a => { if (S[a.key] === code && a.id === 'crouch' && S.ctlCrouchMode !== 1) crouchHeld = false; });
}
// ---------- teclado (controles que se comportam como teclado) ----------
const ARROWS = { ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1, KeyW: 1, KeyA: 1, KeyS: 1, KeyD: 1 };   // reservadas para andar
function kcode(e) { return e.code || e.key || ''; }
addEventListener('keydown', e => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
  const c = kcode(e); if (!c) return;
  if (listenId) {
    e.preventDefault(); e.stopImmediatePropagation();
    if (c === 'Escape') { listenId = ''; refresh(); say('Cancelado'); return; }
    if (ARROWS[c]) { say('Setas e WASD servem para andar. Aperte outro botão'); return; }
    if (!e.repeat) onDown('key:' + c);
    return;
  }
  const bound = ACTIONS.some(a => S[a.key] === 'key:' + c);
  if (bound) { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat && !down['key:' + c]) { down['key:' + c] = true; onDown('key:' + c); } return; }
  // atalhos de teclado (PC) quando nada está configurado
  if (!e.repeat) {
    if (c === 'Space' && !S.bindJump) jumpFlag = true;
    if ((c === 'KeyC' || c === 'ControlLeft') && !S.bindCrouch) { if (S.ctlCrouchMode === 1) crouchTog = !crouchTog; else crouchHeld = true; }
  }
}, true);
addEventListener('keyup', e => {
  const c = kcode(e); down['key:' + c] = false;
  if (S.bindCrouch === 'key:' + c) { e.stopImmediatePropagation(); onUp('key:' + c); }
  if (!S.bindCrouch && (c === 'KeyC' || c === 'ControlLeft') && S.ctlCrouchMode !== 1) crouchHeld = false;
  if (S.bindJump === 'key:' + c) e.stopImmediatePropagation();
}, true);
addEventListener('blur', () => { crouchHeld = false; for (const k in down) down[k] = false; });
// ---------- gamepad: lido a cada quadro ----------
function pollPads() {
  const list = pads(), seen = {};
  list.forEach((g, gi) => g.buttons.forEach((b, i) => {
    const code = 'pad:' + i, pr = !!(b.pressed || b.value > 0.6);
    seen[code] = seen[code] || pr;
  }));
  for (const code in seen) {
    const was = !!prevPad[code], now = seen[code];
    if (now && !was) onDown(code); else if (!now && was) onUp(code);
    prevPad[code] = now;
  }
  for (const code in prevPad) if (!(code in seen)) { if (prevPad[code]) onUp(code); prevPad[code] = false; }
  if (listenId && performance.now() - listenT > 15000) { listenId = ''; refresh(); say('Tempo esgotado'); }
}
VR.hook(5, pollPads);

VR.ctl = {
  actions: ACTIONS, name,
  listen(id) { listenId = listenId === id ? '' : id; listenT = performance.now(); refresh(); if (listenId) say('Aperte o botão do controle (Esc cancela)'); },
  listening: id => listenId === id,
  clear(id) { const a = byId(id); S[a.key] = ''; if (id === 'crouch') { crouchHeld = false; crouchTog = false; } VR.save(); refresh(); },
  clearAll() { ACTIONS.forEach(a => { S[a.key] = ''; }); listenId = ''; crouchHeld = false; crouchTog = false; VR.save(); },
  padName() { const g = pads()[0]; return g ? String(g.id).replace(/\(.*$/, '').trim().slice(0, 26) || 'controle' : ''; },
  lastText: () => last,
  // analógico: só serve para andar. Retorna {x, y} (y>0 = frente) ou null se parado/sem controle
  axes() {
    for (const g of pads()) {
      if (!g.axes || g.axes.length < 2) continue;
      let x = g.axes[0] || 0, y = -(g.axes[1] || 0); const l = Math.hypot(x, y);
      if (l > DEAD) { const k = Math.min(1, (l - DEAD) / (1 - DEAD)) / l; return { x: x * k, y: y * k }; }
    }
    return null;
  },
  takeJump() { const j = jumpFlag; jumpFlag = false; return j; },
  crouching: () => S.ctlCrouchMode === 1 ? crouchTog : crouchHeld,
  _poll: pollPads, _onDown: onDown
};
})();
