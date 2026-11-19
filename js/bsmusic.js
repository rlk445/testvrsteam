/* Beat Saber: música procedural (WebAudio, sem arquivos de som), efeitos sonoros e gerador de fases (1 ou 2 sabres).
   As músicas são sintetizadas em tempo real; o relógio da fase é o relógio do áudio, então blocos e batida ficam sincronizados. */
(() => {
'use strict';
const BSM = window.BSM = {};
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

// ---------- músicas e dificuldades ----------
// prog: um acorde por compasso [semitons a partir da tônica, tipo]; bars: compassos (os 2 primeiros são introdução, os 2 últimos encerramento)
BSM.SONGS = [
  { name: 'Neon Pulse', short: 'Neon', bpm: 110, root: 57, bars: 44, style: 0, prog: [[0, 'm'], [-4, 'M'], [3, 'M'], [-2, 'M']] },
  { name: 'Cyber Drive', short: 'Cyber', bpm: 124, root: 52, bars: 48, style: 1, prog: [[0, 'm'], [-4, 'M'], [3, 'M'], [-2, 'M']] },
  { name: 'Laser Storm', short: 'Laser', bpm: 140, root: 50, bars: 56, style: 2, prog: [[0, 'm'], [0, 'm'], [-4, 'M'], [-2, 'M']] }
];
// speed: m/s dos blocos; p4: chance de bloco em cada batida; p8: chance nos contratempos; horiz/diag/dot: variedade de setas; dbl: blocos duplos; bomb: bombas; cross: cruzar de lado
BSM.DIFFS = [
  { n: 'Fácil',   speed: 6,  p4: 0.55, p8: 0,    horiz: 0.08, diag: 0,    dot: 0,    dbl: 0,    bomb: 0,    cross: 0 },
  { n: 'Normal',  speed: 8,  p4: 0.75, p8: 0.18, horiz: 0.25, diag: 0,    dot: 0,    dbl: 0.05, bomb: 0,    cross: 0 },
  { n: 'Difícil', speed: 10, p4: 0.88, p8: 0.45, horiz: 0.3,  diag: 0.3,  dot: 0.05, dbl: 0.1,  bomb: 0.07, cross: 0.05 },
  { n: 'Expert',  speed: 12, p4: 0.96, p8: 0.7,  horiz: 0.3,  diag: 0.45, dot: 0.1,  dbl: 0.18, bomb: 0.11, cross: 0.1 }
];

// ---------- gerador de fases ----------
function rng(seed) { let s = (seed >>> 0) || 1; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; }
BSM.multFor = c => c < 2 ? 1 : c < 6 ? 2 : c < 14 ? 4 : 8;
// dir: 0 cima, 1 baixo, 2 esquerda, 3 direita, 4 cima-esq, 5 cima-dir, 6 baixo-esq, 7 baixo-dir, 8 ponto (qualquer direção)
// c: 0 vermelho (mão esquerda) / 1 azul (mão direita). Com 1 sabre todos os blocos têm a cor do sabre (single).
BSM.makeChart = (si, lvl, sabers, single, bombsOn) => {
  const song = BSM.SONGS[si], d = BSM.DIFFS[lvl], bt = 60 / song.bpm, r = rng(1234 + si * 977 + lvl * 31 + sabers * 7);
  const ri = (a, b) => a + Math.floor(r() * (b - a + 1)), one = sabers === 1, dens = one ? 0.8 : 1;
  const notes = [], st = [{ ud: 0, lr: 2, lane: 0, n: 0 }, { ud: 0, lr: 3, lane: 3, n: 0 }];
  if (one) st[single].lane = 1 + ri(0, 1);
  const free = (beat, lane, row) => !notes.some(n => Math.abs(n.beat - beat) < 0.45 && n.lane === lane && n.row === row);
  function note(c, beat) {
    const s = st[c]; let dir, lane, row;
    if (s.n > 0 && r() < d.horiz) { s.lr = s.lr === 2 ? 3 : 2; dir = s.lr; }
    else { const up = s.ud; s.ud ^= 1; dir = up ? 0 : 1; if (r() < d.diag) dir = up ? (r() < 0.5 ? 4 : 5) : (r() < 0.5 ? 6 : 7); }
    if (r() < d.dot) dir = 8;
    if (one) { lane = clamp(s.lane + ri(-1, 1), 0, 3); s.lane = lane; }
    else { lane = c === 0 ? ri(0, 1) : ri(2, 3); if (d.cross && r() < d.cross) lane = ri(0, 3); }
    if (dir === 0 || dir === 4 || dir === 5) row = r() < 0.65 ? 0 : 1;
    else if (dir === 1 || dir === 6 || dir === 7) row = r() < 0.65 ? 2 : 1;
    else row = r() < 0.6 ? 1 : (r() < 0.5 ? 0 : 2);
    for (let k = 0; k < 3 && !free(beat, lane, row); k++) row = (row + 1) % 3;
    s.n++; notes.push({ t: beat * bt, beat, lane, row, c: one ? single : c, dir, type: 'n' });
  }
  let turn = 0;
  for (let bar = 2; bar < song.bars - 2; bar++) {
    const brk = ((bar - 2) % 16) >= 14;                                     // dois compassos de "respiro" antes de cada bloco de 16
    for (let q = 0; q < 4; q++) for (let h = 0; h < 2; h++) {
      const beat = bar * 4 + q + h * 0.5; let p = (h ? d.p8 : d.p4) * dens * (brk ? 0.35 : 1);
      if (!h && q === 0) p = Math.min(1, p + 0.1);
      if (r() < p) {
        if (!one && r() < d.dbl && !brk) { note(0, beat); note(1, beat); turn = r() < 0.5 ? 0 : 1; }
        else { note(one ? single : turn, beat); if (!one) turn ^= 1; }
      } else if (h && bombsOn && d.bomb && !brk && r() < d.bomb) {
        const lane = ri(0, 3), row = ri(0, 2);
        if (free(beat, lane, row) && !notes.some(n => Math.abs(n.beat - beat) < 0.6 && n.lane === lane)) notes.push({ t: beat * bt, beat, lane, row, c: 0, dir: 8, type: 'b' });
      }
    }
  }
  notes.sort((a, b) => a.t - b.t || a.lane - b.lane);
  let max = 0, count = 0; notes.forEach(n => { if (n.type === 'n') { max += 115 * BSM.multFor(count); count++; } });
  return { notes, count, maxScore: max, dur: song.bars * 4 * bt, speed: d.speed, song, lvl };
};

// ---------- áudio ----------
let ctx = null, comp = null, sfxBus = null, noiseBuf = null, mus = null, dlySend = null, timer = 0;
let cur = null, bt = 0.5, stepDur = 0.125, step = 0, nextT = 0, t0 = 0, est = 0, running = false, paused = false, vol = 0.8;
function getCtx() {
  if (ctx) return ctx;
  const A = window.AudioContext || window.webkitAudioContext; if (!A) return null;
  try { ctx = new A({ latencyHint: 'interactive' }); } catch (e) { try { ctx = new A(); } catch (e2) { return null; } }
  comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.2; comp.connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(comp);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  return ctx;
}
BSM.ctx = getCtx;
// os navegadores só liberam o áudio depois de um toque/tecla: o primeiro toque na tela (Iniciar) já prepara tudo
function unlock() {
  const c = getCtx(); if (!c) return;
  if (!paused && c.state !== 'running') c.resume().catch(() => {});
  try { const s = c.createBufferSource(); s.buffer = c.createBuffer(1, 1, 22050); s.connect(c.destination); s.start(0); } catch (e) {}
}
['pointerdown', 'touchstart', 'touchend', 'click', 'keydown'].forEach(e => addEventListener(e, unlock, { capture: true, passive: true }));

function out(dest) { return dest || mus; }
function kick(t, v) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(155, t); o.frequency.exponentialRampToValueAtTime(46, t + 0.12);
  g.gain.setValueAtTime(0.95 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3); o.connect(g); g.connect(mus); o.start(t); o.stop(t + 0.32); }
function noise(t, dur, type, freq, q, peak, dest, f2) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); if (f2) f.frequency.exponentialRampToValueAtTime(f2, t + dur); f.Q.value = q;
  const g = ctx.createGain(); g.gain.setValueAtTime(peak, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); s.connect(f); f.connect(g); g.connect(out(dest)); s.start(t, Math.random() * 0.6); s.stop(t + dur + 0.03);
}
function snare(t) { noise(t, 0.17, 'bandpass', 1900, 0.8, 0.5); const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(210, t); o.frequency.exponentialRampToValueAtTime(120, t + 0.1);
  g.gain.setValueAtTime(0.4, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12); o.connect(g); g.connect(mus); o.start(t); o.stop(t + 0.14); }
function clap(t) { for (let i = 0; i < 3; i++) noise(t + i * 0.011, 0.05 + (i === 2 ? 0.1 : 0), 'bandpass', 1500, 1.2, 0.3); }
function hat(t, open, v) { noise(t, open ? 0.2 : 0.045, 'highpass', 7500, 0.7, 0.13 * v); }
function crash(t) { noise(t, 1.4, 'highpass', 4800, 0.6, 0.22); }
function riser(t, dur) { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(7000, t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.002, t); g.gain.exponentialRampToValueAtTime(0.2, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 0.05); s.connect(f); f.connect(g); g.connect(mus); s.start(t); s.stop(t + dur + 0.08); }
function bass(t, m, dur, v) {
  const o = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = 'sawtooth'; o2.type = 'sine'; o.frequency.value = o2.frequency.value = mtof(m);
  f.type = 'lowpass'; f.Q.value = 3; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(220, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.32 * v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.05);
  o.connect(f); o2.connect(f); f.connect(g); g.connect(mus); o.start(t); o2.start(t); o.stop(t + dur + 0.08); o2.stop(t + dur + 0.08);
}
function arp(t, m, dur, wave, v) {
  const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = wave; o.frequency.value = mtof(m);
  f.type = 'lowpass'; f.Q.value = 5; f.frequency.setValueAtTime(4200, t); f.frequency.exponentialRampToValueAtTime(900, t + 0.14);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.11 * v, t + 0.006); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(f); f.connect(g); g.connect(mus); g.connect(dlySend); o.start(t); o.stop(t + dur + 0.05);
}
function pad(t, notes, dur, v) {
  notes.forEach(m => [-7, 7].forEach(det => {
    const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = det;
    f.type = 'lowpass'; f.frequency.value = 1300; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.034 * v, t + 0.3); g.gain.setValueAtTime(0.034 * v, t + dur - 0.25); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(f); f.connect(g); g.connect(mus); o.start(t); o.stop(t + dur + 0.05);
  }));
}
const TRIAD = { m: [0, 3, 7], M: [0, 4, 7] };
// 16 passos por compasso
const STY = [
  { kick: [0, 8, 10], snare: [4, 12], hat: 2, bass: [0, 3, 6, 8, 11, 14], arpWave: 'triangle', arpFrom: 4 },
  { kick: [0, 4, 8, 12], snare: [4, 12], hat: 2, bass: [0, 2, 4, 6, 8, 10, 12, 14], arpWave: 'sawtooth', arpFrom: 4 },
  { kick: [0, 4, 8, 11, 12], snare: [4, 12], hat: 1, bass: [0, 1, 4, 6, 8, 9, 12, 14], arpWave: 'square', arpFrom: 4 }
];
function sched(stp, t) {
  const bar = (stp / 16) | 0, s = stp % 16, total = cur.bars; if (bar >= total) return;
  const sty = STY[cur.style], ch = cur.prog[bar % cur.prog.length], cr = cur.root + ch[0], tri = TRIAD[ch[1]];
  const intro = bar < 2, outro = bar >= total - 2, rel = bar - 2, brk = !intro && !outro && (rel % 16) >= 14, main = !intro && !outro && !brk;
  if (s === 0) { pad(t, tri.map(x => cr + x), stepDur * 16 + 0.1, outro ? 0.7 : 1); if (main && rel % 8 === 0) crash(t); if (rel % 16 === 15 && !outro) riser(t, stepDur * 16); }
  if (sty.hat === 2 ? s % 2 === 0 : true) hat(t, s === 14 && main, s % 4 === 2 ? 1 : 0.55);
  if (main) {
    if (sty.kick.includes(s)) kick(t, 1);
    if (sty.snare.includes(s)) { snare(t); if (cur.style === 1) clap(t); }
    const bi = sty.bass.indexOf(s); if (bi >= 0) bass(t, cr - 12, stepDur * 1.8, s === 0 ? 1 : 0.8);
  } else if (outro && bar === total - 2 && s % 4 === 0) kick(t, 0.7);
  if (!intro && rel >= (sty.arpFrom - 2) && !outro || brk) {                    // arpejo nos acordes
    const idx = s % 4, note = tri[idx % 3] + (idx === 3 ? 12 : 0), skip = cur.style === 0 && s % 2 === 1;
    if (!skip) arp(t, cr + note + 12, stepDur * (cur.style === 0 ? 2.2 : 1.4), sty.arpWave, brk ? 1.3 : 0.9);
  }
}
function tick() { if (!running || paused || !ctx) return; let n = 0; while (nextT < ctx.currentTime + 0.25 && n++ < 64) { try { sched(step, nextT); } catch (e) {} step++; nextT += stepDur; } }

BSM.start = (idx, v) => {
  const c = getCtx(); if (!c) return false; BSM.stop(true);
  cur = BSM.SONGS[idx]; bt = 60 / cur.bpm; stepDur = bt / 4; vol = v;
  mus = c.createGain(); mus.gain.value = vol; mus.connect(comp);
  const dly = c.createDelay(2), fb = c.createGain(), wet = c.createGain(); dlySend = c.createGain(); dly.delayTime.value = bt * 0.75; fb.gain.value = 0.32; wet.gain.value = 0.38;
  dlySend.connect(dly); dly.connect(wet); wet.connect(mus); dly.connect(fb); fb.connect(dly);
  if (c.state !== 'running') c.resume().catch(() => {});
  paused = false; running = true; step = 0; t0 = c.currentTime + 0.3; nextT = t0; est = c.currentTime;
  clearInterval(timer); timer = setInterval(tick, 25); tick(); return true;
};
BSM.stop = quick => {
  clearInterval(timer); if (!running) return; running = false;
  const m = mus; if (!m || !ctx) return;
  try { m.gain.cancelScheduledValues(ctx.currentTime); if (paused || quick) m.gain.setValueAtTime(0, ctx.currentTime); else { m.gain.setValueAtTime(m.gain.value, ctx.currentTime); m.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.25); } } catch (e) {}
  setTimeout(() => { try { m.disconnect(); } catch (e) {} }, 700);
  if (paused) { paused = false; ctx.resume().catch(() => {}); }
};
BSM.pause = () => { if (!running || paused || !ctx) return; paused = true; ctx.suspend().catch(() => {}); };
BSM.resume = () => { if (!paused || !ctx) return; paused = false; ctx.resume().catch(() => {}); };
BSM.isRunning = () => running;
BSM.setVol = v => { vol = v; if (mus && running && ctx) try { mus.gain.setTargetAtTime(v, ctx.currentTime, 0.03); } catch (e) {} };
// relógio suave da fase: avança com o quadro e se corrige pelo relógio do áudio (que anda aos saltos em alguns aparelhos)
BSM.update = dt => {
  if (!running || paused || !ctx) return; est += dt;
  if (ctx.state === 'running') { const err = ctx.currentTime - est; if (Math.abs(err) > 0.08) est = ctx.currentTime; else est += err * 0.12; }
};
BSM.now = () => est - t0;
BSM.lat = () => (ctx && (ctx.outputLatency || ctx.baseLatency)) || 0;
BSM.beatPhase = () => { if (!cur) return 0; const b = (est - t0) / bt; return b - Math.floor(b); };

// ---------- efeitos sonoros ----------
BSM.sfx = (name, a) => {
  const c = getCtx(); if (!c || c.state !== 'running') return; const t = c.currentTime;
  const tone = (type, f0, f1, dur, peak, dly) => { const o = c.createOscillator(), g = c.createGain(); const s = t + (dly || 0); o.type = type; o.frequency.setValueAtTime(f0, s); if (f1) o.frequency.exponentialRampToValueAtTime(f1, s + dur);
    g.gain.setValueAtTime(peak, s); g.gain.exponentialRampToValueAtTime(0.0008, s + dur); o.connect(g); g.connect(sfxBus); o.start(s); o.stop(s + dur + 0.02); };
  const nz = (dur, type, f, q, peak, f2) => { const s = c.createBufferSource(); s.buffer = noiseBuf; s.loop = true; const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur); fl.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(peak, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur); s.connect(fl); fl.connect(g); g.connect(sfxBus); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02); };
  switch (name) {
    case 'cut': { const k = clamp((a || 0.5), 0, 1); nz(0.1, 'bandpass', 5200, 1.1, 0.42); tone('triangle', 520 + k * 520, 0, 0.12, 0.2); tone('sine', 1040 + k * 1040, 0, 0.18, 0.1); break; }
    case 'bad': nz(0.16, 'lowpass', 700, 0.8, 0.45, 160); tone('square', 120, 70, 0.18, 0.2); break;
    case 'miss': tone('sine', 150, 90, 0.09, 0.14); break;
    case 'bomb': nz(0.5, 'lowpass', 1800, 0.7, 0.7, 90); tone('sine', 90, 35, 0.45, 0.6); break;
    case 'tick': tone('sine', 880, 0, 0.07, 0.2); tone('sine', 1320, 0, 0.1, 0.12, 0.04); break;
    case 'beep': tone('sine', 740, 0, 0.16, 0.28); break;
    case 'go': tone('sine', 1480, 0, 0.35, 0.3); tone('triangle', 740, 0, 0.35, 0.2); break;
    case 'win': [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, 0, 0.3, 0.22, i * 0.11)); break;
    case 'fail': tone('sawtooth', 330, 80, 0.9, 0.25); nz(0.8, 'lowpass', 900, 0.8, 0.3, 120); break;
  }
};
})();
