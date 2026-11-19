/* Janela do YouTube dentro do VR: dois iframes (um por olho) posicionados sobre a janela 3D */
(() => {
'use strict';
const VR = window.VR, T = VR.T, S = VR.S, ui = VR.ui, C = ui.C, UPM = ui.UPM, clamp = VR.clamp;
let id = '', list = '', playing = true, loaded = '';
const parseYT = v => { v = (v || '').trim(); let i = '', l = ''; const m = v.match(/(?:v=|youtu\.be\/|shorts\/|embed\/|live\/)([\w-]{11})/) || v.match(/^([\w-]{11})$/); if (m) i = m[1]; const q = v.match(/[?&]list=([\w-]+)/); if (q) l = q[1]; return { id: i, list: l }; };
function setLink(v) { const r = parseYT(v); if (!r.id && !r.list) return false; id = r.id; list = r.list; try { localStorage.setItem('ytlink', v); } catch (e) {} if (yt.vis) load(); yt.dirty = true; return true; }
try { const v = localStorage.getItem('ytlink'); if (v) { const r = parseYT(v); id = r.id; list = r.list; } } catch (e) {}
const box = document.createElement('div'); box.id = 'ytBox'; document.body.appendChild(box);
const eyes = [0, 1].map(i => { const w = document.createElement('div'); w.className = 'eye'; const f = document.createElement('iframe'); f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen'; f.setAttribute('playsinline', ''); w.appendChild(f); box.appendChild(w); return { w, f, on: false }; });
const src = i => { const q = new URLSearchParams({ autoplay: '1', playsinline: '1', rel: '0', enablejsapi: '1', controls: '0', modestbranding: '1', mute: i ? '1' : '0' }); if (list) q.set('list', list); else if (id) { q.set('loop', '1'); q.set('playlist', id); } return 'https://www.youtube.com/embed/' + (id || 'videoseries') + '?' + q; };
function load() { const key = id + '|' + list; if ((!id && !list) || loaded === key) return; loaded = key; eyes.forEach((e, i) => { e.f.src = src(i); }); setTimeout(() => setVolume(S.ytVol), 2500); }
const cmd = (func, args, both) => eyes.forEach((e, i) => { if ((both || i === 0) && e.f.contentWindow) try { e.f.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args: args || [] }), '*'); } catch (er) {} });
function setVolume(v) { S.ytVol = v; cmd('setVolume', [v]); }
const VX = 25, VY = 86, VW = 720, VH = 405;
const yt = ui.panel({ id: 'yt', mw: 1.1, mh: 0.88, title: 'YouTube', titleIcon: 'play', dist: 1.7, dy: 0.12, order: 11, onOpen: () => { load(); if (loaded) { playing = true; cmd('playVideo', [], true); } },
  extra(g) {
    g.fillStyle = '#000'; g.fillRect(VX, VY, VW, VH);
    if (!id && !list) { ui.text(g, 'Nenhum vídeo escolhido.', yt.W / 2, VY + VH / 2 - 24, 30, '#aab', 'center'); ui.text(g, 'Use "Alterar link" ou cole o link na tela inicial.', yt.W / 2, VY + VH / 2 + 24, 24, '#889', 'center'); }
  },
  build(p) {
    const y = VY + VH + 14, mk = (x, w, label, icon, fn) => ({ t: 'button', x, y, w, h: 74, label, icon, chev: false, onClick: fn });
    return [mk(25, 210, () => playing ? 'Pausar' : 'Tocar', 'play', () => { playing = !playing; cmd(playing ? 'playVideo' : 'pauseVideo', [], true); p.dirty = true; }),
      mk(250, 130, '− Vol', null, () => { setVolume(clamp(S.ytVol - 10, 0, 100)); VR.save(); }), mk(392, 130, '+ Vol', null, () => { setVolume(clamp(S.ytVol + 10, 0, 100)); VR.save(); }),
      mk(535, 210, 'Alterar link', null, () => {
        const apply = v => { if (v && !setLink(v)) VR.toast('Link do YouTube não reconhecido'); };
        if (VR.kb) { let cur = ''; try { cur = localStorage.getItem('ytlink') || ''; } catch (e) {} VR.kb.open({ label: 'Link do YouTube', value: cur, onEnter: apply }); return; }   // teclado dentro do VR (o prompt() não aparece na tela dividida)
        let v = ''; try { v = prompt('Cole o link do YouTube:', localStorage.getItem('ytlink') || '') || ''; } catch (e) {} apply(v); })];
  } });
yt.fixedNoSc = true;
const pv = new T.Vector3(), pw = new T.Vector3(), a = new T.Vector3(), b = new T.Vector3();
function sync(w, h) {
  const show = yt.vis && yt.anim > 0.9 && yt.g.visible && (id || list) && !S.obs;
  if (!show) { eyes.forEach(e => { if (e.on) { e.w.style.display = 'none'; e.on = false; } }); if (yt._wasOn) { yt._wasOn = false; cmd('pauseVideo', [], true); } return; }
  if (!yt._wasOn) { yt._wasOn = true; if (playing) cmd('playVideo', [], true); }
  yt.g.updateMatrixWorld(true);
  a.set((VX - yt.W / 2) / UPM, (yt.H / 2 - VY) / UPM, 0); b.set((VX + VW - yt.W / 2) / UPM, (yt.H / 2 - VY - VH) / UPM, 0); yt.g.localToWorld(a); yt.g.localToWorld(b);
  const eye = [{ cam: S.vr ? VR.camL : VR.camMain, x: 0, w: S.vr ? (w / 2) * S.eyeW : w }, { cam: VR.camR, x: 0, w: (w / 2) * S.eyeW }];
  if (S.vr) { const ox = (w / 2 - eye[0].w) / 2; eye[0].x = ox; eye[1].x = w / 2 + ox; }
  eyes.forEach((e, i) => {
    if (i && !S.vr) { if (e.on) { e.w.style.display = 'none'; e.on = false; } return; }
    const v = eye[i], c = v.cam; pv.copy(a).project(c); pw.copy(b).project(c);
    if (pv.z > 1 || pw.z > 1) { if (e.on) { e.w.style.display = 'none'; e.on = false; } return; }
    const x0 = v.x + (pv.x * 0.5 + 0.5) * v.w, x1 = v.x + (pw.x * 0.5 + 0.5) * v.w, y0 = (-pv.y * 0.5 + 0.5) * h, y1 = (-pw.y * 0.5 + 0.5) * h;
    const s = e.w.style; s.display = 'block'; e.on = true; s.left = v.x + 'px'; s.top = '0px'; s.width = v.w + 'px'; s.height = h + 'px';
    const f = e.f.style; f.left = (x0 - v.x) + 'px'; f.top = y0 + 'px'; f.width = Math.max(1, x1 - x0) + 'px'; f.height = Math.max(1, y1 - y0) + 'px';
  });
}
VR.post.push(sync);
VR.yt = { setLink, setVolume, toggle() { if (!id && !list && !yt.vis) VR.toast('Escolha um vídeo: "Alterar link" na janela'); ui.toggleWin('yt'); } };
})();
