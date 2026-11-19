/* Menu 3D estilo Meta Quest: botão flutuante, dock, ajustes rápidos, configurações, ambientes e avisos */
(() => {
'use strict';
const VR = window.VR, S = VR.S, ui = VR.ui, C = ui.C, T = VR.T, clamp = VR.clamp;
const main = () => VR.main || {};
const scratch = document.createElement('canvas').getContext('2d');
function wrap(str, maxW, size) {
  scratch.font = '400 ' + size + 'px ' + ui.FONT; const out = [];
  String(str).split('\n').forEach(par => { let line = ''; par.split(' ').forEach(wd => { const t = line ? line + ' ' + wd : wd; if (scratch.measureText(t).width > maxW && line) { out.push(line); line = wd; } else line = t; }); out.push(line); });
  return out;
}
// ---------- construtores de linhas das configurações ----------
const R = {
  toggle: (label, key, o = {}) => Object.assign({ t: 'toggle', h: o.sub ? 90 : 80, label, get: () => !!S[key], set: v => { S[key] = v; } }, o),
  slider: (label, key, min, max, step, fmt, o = {}) => Object.assign({ t: 'slider', h: 106, label, min, max, step, fmt, get: () => S[key], set: v => { S[key] = v; } }, o),
  choice: (label, key, opts, o = {}) => Object.assign({ t: 'choice', h: 122, label, opts, get: () => S[key], set: v => { S[key] = v; } }, o),
  button: (label, onClick, o = {}) => Object.assign({ t: 'button', h: o.sub ? 90 : 80, label, onClick }, o),
  info: (label, val) => ({ t: 'info', h: 64, label, val }),
  head: label => ({ t: 'head', h: 58, label }),
  note: (str, o = {}) => { const size = o.size || 23, lh = o.lh || 31, lines = wrap(str, (o.w || 530) - 16, size); return Object.assign({ t: 'note', h: lines.length * lh + 22, lines, lh, size }, o); }
};
const pct = v => Math.round(v * 100) + '%', ms = v => Math.round(v) + ' ms', onOff = v => v ? 'ligado' : 'desligado';
const camLabel = () => { const l = VR.tracker.cams; const c = l.find(x => x.id === S.devId); return c ? c.label.slice(0, 22) : 'automática'; };
function restartCam() { VR.tracker.retryCam(); }
let confirmReset = false;
const envName = () => (VR.env && VR.env.label(S.env)) || S.env;
const ACT_ROWS = f => VR.ctl.actions.map(f);
const PAGES = [
  { id: 'maos', label: 'Mãos', icon: 'hand', rows: () => [
    R.choice('Visual da mão', 'hand', [['model', 'Realista'], ['outline', 'Contorno'], ['skeleton', 'Ossos'], ['off', 'Oculta']], { on: () => VR.handvis.refresh(), rebuild: true }),
    R.choice('Tom da pele', 'skin', VR.SKINS.map((k, i) => [i, k.n, '#' + k.c.toString(16).padStart(6, '0')]), { swatch: true, on: v => VR.handvis.setSkin(v), show: () => S.hand === 'model' }),
    R.choice('Número de mãos', 'maxHands', [[1, '1 mão'], [2, '2 mãos']], { on: () => VR.tracker.setOpts() }),
    R.toggle('Inverter esquerda/direita', 'swapHands', { sub: 'Use se a mão realista aparecer espelhada' }),
    R.toggle('Clique segurando o dedo', 'dwell', { sub: 'Segure o ponteiro 1 s sobre um botão' }),
    R.head('Teclado de superfície'),
    R.button('Abrir teclado (teste)', () => { VR.kb.open({ label: 'Teste do teclado' }); }, { icon: 'keyboard', sub: 'Mesa: apoie as mãos abertas e fique parado' }),
    R.slider('Tamanho do teclado', 'kbSize', 0.9, 2.0, 0.05, v => v.toFixed(2) + '×'),
    R.toggle('Calibrar na mesa ao abrir', 'kbSurface', { sub: 'Desligado: abre flutuando (pinça)' }),
    R.toggle('Precisão alta ao digitar', 'kbPrecise', { sub: 'Usa o modelo preciso enquanto o teclado está aberto' }),
    R.toggle('Som das teclas', 'kbSound')
  ] },
  { id: 'rast', label: 'Rastreamento', icon: 'target', rows: () => [
    R.choice('Precisão', 'cx', [[0, 'Rápida'], [1, 'Alta']], { sub: 'Alta usa mais bateria', set: v => { VR.tracker.setPrecision(!!v).then(ok => { if (ok) ui.panels.settings.dirty = true; }); }, get: () => S.cx }),
    R.choice('Sensibilidade do rastreio', 'trkSens', [[0, 'Estável'], [1, 'Normal'], [2, 'Sensível']], { sub: 'Sensível segura a mão em poses difíceis', on: () => VR.tracker.setOpts() }),
    R.slider('Suavização das mãos', 'smoothH', 0, 1, 0.05, pct),
    R.slider('Antecipação (compensa atraso)', 'lead', 0, 100, 5, ms),
    R.choice('Taxa de rastreamento', 'rate', [[0, 'Auto'], [20, '20 Hz'], [30, '30 Hz'], [60, '60 Hz']], { on: () => VR.tracker.autoRate() }),
    R.slider('Alcance dos braços', 'reach', 0.8, 2.2, 0.05, v => v.toFixed(2) + '×'),
    R.toggle('Mostrar dados na tela', 'debug', { on: () => main().setHud && main().setHud() })
  ] },
  { id: 'cam', label: 'Câmera', icon: 'camera', rows: () => [
    R.toggle('Passagem da câmera', 'pass', { sub: 'Mostra o mundo real ao fundo', set: v => { VR.setPass(v); } }),
    R.slider('Zoom da passagem', 'ptZoom', 0.6, 1.6, 0.05, pct),
    R.choice('Câmera', 'facing', [['environment', 'Traseira'], ['user', 'Frontal']], { on: () => { S.devId = ''; restartCam(); } }),
    R.button('Dispositivo', () => { const l = VR.tracker.cams; if (!l.length) { VR.tracker.listCams(); return; } const i = l.findIndex(x => x.id === S.devId); S.devId = i + 1 < l.length ? l[i + 1].id : ''; VR.save(); restartCam(); }, { val: camLabel, chev: false }),
    R.button('Tentar a câmera de novo', restartCam, { icon: 'refresh' }),
    R.toggle('Miniatura da câmera', 'preview', { sub: 'Na tela normal, canto inferior' })
  ] },
  { id: 'vr', label: 'Óculos VR', icon: 'vr', rows: () => [
    R.toggle('Modo VR (tela dividida)', 'vr', { sub: 'Para usar com o celular no óculos', on: () => main().setHud && main().setHud() }),
    R.button('Recentralizar a visão', () => VR.recenter(), { icon: 'target' }),
    R.slider('Sensibilidade', 'sens', 0.5, 1.5, 0.05, v => v.toFixed(2)),
    R.slider('Suavização da cabeça', 'smoothHead', 0, 1, 0.05, pct),
    R.slider('Predição de movimento', 'headPred', 0, 60, 5, ms),
    R.slider('Distância entre os olhos', 'ipd', 0.04, 0.08, 0.001, v => (v * 100).toFixed(1) + ' cm'),
    R.slider('Tamanho da imagem', 'eyeW', 0.5, 1, 0.01, pct),
    R.slider('Alinhamento das imagens', 'shift', -0.3, 0.3, 0.01, v => v.toFixed(2))
  ] },
  { id: 'ctl', label: 'Controles', icon: 'gamepad', rows: () => {
    const ctl = VR.ctl, img = ctl.img || (ctl.img = (() => { const i = new Image(); i.onload = () => { ui.panels.settings.dirty = true; }; i.src = 'icons/controle.png?v=24'; return i; })());
    const bindRow = a => ({ t: 'bind', h: 122, label: a.label, get: () => S[a.key], fmt: ctl.name, listening: () => ctl.listening(a.id),
      onPress: (u, w) => { if (S[a.key] && !ctl.listening(a.id) && u > w.w - 76) ctl.clear(a.id); else ctl.listen(a.id); ui.panels.settings.dirty = true; } });
    const pic = { t: 'pic', h: 254, img, label: 'Controle Bluetooth', sub: 'Analógico = andar' };
    const rest = [
      R.choice('Agachar', 'ctlCrouchMode', [[0, 'Segurar'], [1, 'Alternar']], { sub: 'Segurar: agacha enquanto aperta' }),
      R.info('Controle detectado', () => ctl.padName() || 'nenhum'),
      R.info('Último botão apertado', () => ctl.lastText() || '—'),
      R.button('Limpar os botões', () => { ctl.clearAll(); ui.toast('Botões limpos'); ui.panels.settings.dirty = true; }, { icon: 'refresh', chev: false }),
      R.note('Como usar: toque na caixinha de Pular (ou Agachar) e depois aperte o botão do controle: ele fica salvo. O analógico serve só para andar. Pareie o controle antes em Ajustes > Bluetooth do iPhone. Se ele tiver modo Android/iOS e nada aparecer em "Último botão apertado", teste o outro modo.')
    ];
    return { custom: true, pic, binds: ACT_ROWS(bindRow), rest };
  }, layout: (p, r) => {
    const X = 256, W = 548, PW = 200, BX = X + PW + 10, BW = W - PW - 10, out = [];
    r.pic.x = X; r.pic.w = PW; r.pic.y = 0; out.push(r.pic);
    r.binds.forEach((b, i) => { b.x = BX; b.w = BW; b.y = i * 132; out.push(b); });
    let y = 264; r.rest.forEach(w => { w.x = X; w.w = W; w.y = y; y += w.h + 10; out.push(w); });
    out.forEach(w => { w.sc = true; }); p.contentH = Math.max(0, y - 10); return out;
  } },
  { id: 'pong', label: 'Ping-Pong', icon: 'target', rows: () => [
    R.button(() => S.env === 'pong' ? 'Jogando Ping-Pong' : 'Jogar Ping-Pong', () => { VR.env.set('pong', true); }, { icon: 'play' }),
    R.choice('Dificuldade', 'pongLvl', [[0, 'Fácil'], [1, 'Médio'], [2, 'Difícil'], [3, 'Expert']], { on: v => VR.pong.setLevel(v, true) }),
    R.choice('Jogar até', 'pongTo', [[5, '5'], [7, '7'], [11, '11'], [21, '21']]),
    R.slider('Ajuda de mira', 'pongAssist', 0, 1, 0.05, pct),
    R.choice('Mão da raquete', 'pongHand', [[0, 'Auto'], [1, 'Direita'], [2, 'Esquerda']]),
    R.toggle('Mesa acompanha sua mão', 'pongAuto', { sub: 'Ajusta altura e distância entre um ponto e outro', rebuild: true }),
    R.slider('Altura da mesa', 'pongH', 0.7, 1.3, 0.01, v => Math.round(v * 100) + ' cm', { show: () => !S.pongAuto }),
    R.info('Placar', () => VR.pong.scoreText()),
    R.button('Nova partida', () => { VR.pong.restart(); ui.toast('Nova partida'); }, { icon: 'refresh' }),
    R.note('Abra a mão: a raquete fica presa a ela, sem precisar fechar. Com a palma virada para a IA, empurre a mão para frente para bater. No saque, acerte a bolinha que flutua à sua frente. Ajuda de mira alta deixa a bola mais fácil de colocar na mesa.')
  ] },
  { id: 'sinuca', label: 'Sinuca', icon: 'target', rows: () => [
    R.button(() => S.env === 'sinuca' ? 'Jogando Sinuca' : 'Jogar Sinuca', () => { VR.env.set('sinuca', true); }, { icon: 'play' }),
    R.choice('Dificuldade do bot', 'sinLvl', [[0, 'Fácil'], [1, 'Médio'], [2, 'Difícil'], [3, 'Expert']], { on: v => VR.sinuca.setLevel(v, true) }),
    R.toggle('Linha de mira', 'sinGuide', { sub: 'Mostra a trajetória da branca e da bola atingida' }),
    R.slider('Ajuda de mira', 'sinAssist', 0, 1, 0.05, pct),
    R.choice('Mão que taca', 'sinHand', [[0, 'Auto'], [1, 'Direita'], [2, 'Esquerda']]),
    R.slider('Altura da mesa', 'sinH', 0.6, 1.1, 0.01, v => Math.round(v * 100) + ' cm'),
    R.info('Placar', () => VR.sinuca.scoreText()), R.info('Histórico', () => VR.sinuca.bestText()),
    R.button('Nova partida', () => { VR.sinuca.restart(); ui.toast('Nova partida'); }, { icon: 'refresh' }),
    R.note('Aponte o dedo para onde quer bater (a linha sai da bola branca). Junte polegar e indicador (pinça) e AFASTE a mão segurando: quanto mais longe, mais força. Solte para tacar; voltar ao início antes de soltar cancela. Com a bola na mão, aponte e pince para posicionar. Bola 8: encaçape todas as do seu grupo antes. No PC: mouse aponta, segure, arraste e solte; teclas 1-4 nível, N nova partida.')
  ] },
  { id: 'saber', label: 'Beat Saber', icon: 'bolt', rows: () => [
    R.button(() => S.env === 'saber' ? 'Jogando Beat Saber' : 'Jogar Beat Saber', () => { if (S.env === 'saber') VR.saber.start(); else VR.env.set('saber', true); }, { icon: 'play' }),
    R.choice('Sabres', 'bsSabers', [[1, '1 sabre'], [2, '2 sabres']], { on: () => VR.saber.relayout() }),
    R.choice('Música', 'bsSong', window.BSM.SONGS.map((s, i) => [i, s.short])),
    R.choice('Nível', 'bsLvl', window.BSM.DIFFS.map((d, i) => [i, d.n])),
    R.choice('Mão do sabre (1 sabre)', 'bsHand', [[0, 'Auto'], [1, 'Direita'], [2, 'Esquerda']], { show: () => S.bsSabers === 1 }),
    R.toggle('Bombas', 'bsBombs', { sub: 'Não corte as bombas (Difícil e Expert)' }),
    R.toggle('Cortar na direção da seta', 'bsDir'),
    R.toggle('Sem falhar', 'bsNoFail', { sub: 'A energia zerada não encerra a fase' }),
    R.slider('Volume da música', 'bsVol', 0, 1, 0.05, pct, { on: v => window.BSM.setVol(v) }),
    R.slider('Altura dos blocos', 'bsH', -0.7, 0.1, 0.01, v => Math.round(v * 100) + ' cm', { on: () => VR.saber.relayout() }),
    R.slider('Espaçamento dos blocos', 'bsSpread', 0.7, 1.5, 0.05, pct, { on: () => VR.saber.relayout() }),
    R.slider('Comprimento do sabre', 'bsLen', 0.5, 1.4, 0.05, v => Math.round(v * 100) + ' cm'),
    R.slider('Velocidade mínima do corte', 'bsMin', 0.3, 2.5, 0.1, v => v.toFixed(1) + ' m/s'),
    R.slider('Ajuste de atraso', 'bsLat', -200, 200, 10, ms),
    R.info('Placar', () => VR.saber.scoreText()), R.info('Recorde (música/nível/modo)', () => VR.saber.bestText()),
    R.note('Vermelho = mão esquerda, azul = mão direita. Com 1 sabre, todos os blocos têm a cor do seu sabre. Corte cada bloco na direção da seta (ponto = qualquer direção) e desvie das bombas. No lobby, corte os botões: música, nível, 1 ou 2 sabres e JOGAR. PC sem mãos: o sabre segue o mouse, Tab troca de sabre, 1/2 escolhem o modo, Enter começa.')
  ] },
  { id: 'amb', label: 'Ambiente', icon: 'cube', rows: () => [
    R.button('Ambiente', () => ui.openWin('envs'), { icon: 'cube', val: envName }),
    R.toggle('Luz do teto', 'ceiling', { on: v => VR.room && VR.room.setCeiling(v) }),
    R.toggle('Noite', 'night', { on: v => VR.room && VR.room.setNight(v) }),
    R.button('Reorganizar objetos', () => VR.env.resetObjects(), { icon: 'refresh' }),
    R.choice('Cidade', 'q', [[0, 'Leve'], [1, 'Completa']], { sub: 'Recarrega a cidade', on: () => VR.env.reloadCity() })
  ] },
  { id: 'perf', label: 'Desempenho', icon: 'bolt', rows: () => [
    R.choice('Resolução', 'res', [[0, 'Auto'], [1, 'Baixa'], [2, 'Média'], [3, 'Alta']], { on: () => VR.applyRes() }),
    R.info('Quadros por segundo', () => S.fps + ' fps'),
    R.info('Resolução atual', () => VR.renderer.getPixelRatio().toFixed(2) + '×'),
    R.info('Rastreamento de mãos', () => S.handsReady ? S.trkHz.toFixed(0) + ' Hz · ' + S.inferMs.toFixed(0) + ' ms' : 'desligado'),
    R.note('Em "Auto" a resolução e a taxa de rastreamento se ajustam sozinhas para manter os quadros por segundo estáveis. Se estiver pesado, use Resolução "Baixa" e Precisão "Rápida".')
  ] },
  { id: 'sys', label: 'Sistema', icon: 'help', rows: () => [
    R.toggle('Modo OBS (esconder o menu)', 'obs', { sub: 'Tecla H volta o menu', on: v => main().setObs && main().setObs(v) }),
    R.button('Limpar cache e recarregar', () => main().clearCache && main().clearCache(), { icon: 'refresh' }),
    R.button(() => confirmReset ? 'Toque de novo para confirmar' : 'Restaurar padrões', () => { if (!confirmReset) { confirmReset = true; setTimeout(() => { confirmReset = false; ui.panels.settings.dirty = true; }, 3500); ui.panels.settings.dirty = true; } else { VR.defaults(); location.reload(); } }, { style: 'danger', chev: false }),
    R.info('Versão', () => 'v' + VR.version),
    R.head('Registro'), R.note(VR.logLines.slice(-9).join('\n') || 'sem mensagens', { size: 19, lh: 26, w: 530 })
  ] }
];
// ---------- janela de configurações ----------
const settings = ui.panel({ id: 'settings', mw: 1.2, mh: 0.86, primary: true, title: 'Configurações', titleIcon: 'gear', dist: 1.35, dy: 0.12, page: 'maos', order: 11,
  onOpen: () => { ui.lastPrimary = 'settings'; settings.rebuild(); },
  build(p) {
    const tp = PAGES.length > 10 ? 44 : 49;
    PAGES.forEach((pg, i) => p.fixed.push({ t: 'tab', x: 16, y: 96 + i * tp, w: 222, h: tp - 4, label: pg.label, icon: pg.icon, active: () => p.page === pg.id, onClick: () => { p.page = pg.id; p.scrollY = 0; p.rebuild(); } }));
    const pg = PAGES.find(x => x.id === p.page) || PAGES[0], raw = pg.rows();
    p.sc = { x: 256, y: 92, w: 548, h: 496 };
    if (pg.layout) return pg.layout(p, raw);
    return p.layoutRows(raw.filter(w => !w.show || w.show()), 256, 548, 10);
  } });
ui.openSettings = page => { if (page) { settings.page = page; settings.scrollY = 0; } ui.openWin('settings'); settings.rebuild(); };
// ---------- ajustes rápidos ----------
const hhmm = () => { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
const tileDef = [
  { icon: 'camera', label: 'Passagem', active: () => S.pass, state: () => onOff(S.pass), onClick: () => VR.setPass(!S.pass) },
  { icon: 'vr', label: 'Modo VR', active: () => S.vr, state: () => onOff(S.vr), onClick: () => { S.vr = !S.vr; VR.save(); main().setHud && main().setHud(); } },
  { icon: 'target', label: 'Centralizar', state: () => 'recentrar visão', onClick: () => VR.recenter() },
  { icon: 'bulb', label: 'Luz do teto', active: () => S.ceiling && S.env === 'room', state: () => S.env === 'room' ? onOff(S.ceiling) : 'só no quarto', onClick: () => { if (S.env === 'room') { S.ceiling = !S.ceiling; VR.save(); VR.room.setCeiling(S.ceiling); } } },
  { icon: 'moon', label: 'Noite', active: () => S.night && S.env === 'room', state: () => S.env === 'room' ? onOff(S.night) : 'só no quarto', onClick: () => { if (S.env === 'room') { S.night = !S.night; VR.save(); VR.room.setNight(S.night); } } },
  { icon: 'refresh', label: 'Reorganizar', state: () => 'objetos', onClick: () => VR.env.resetObjects() }
];
ui.panel({ id: 'quick', mw: 1.0, mh: 0.88, primary: true, title: 'Ajustes rápidos', titleIcon: 'tune', dist: 1.3, dy: 0.1, order: 11, onOpen: () => { ui.lastPrimary = 'quick'; },
  extra(g) { ui.text(g, hhmm(), 700 - 112, 48, 30, C.dim, 'right', 600); },
  build(p) {
    const w = [R.slider('Volume do vídeo', 'ytVol', 0, 100, 5, v => Math.round(v) + '%', { on: v => VR.yt && VR.yt.setVolume(v), x: 30, y: 96, w: 640, h: 100 })]; w[0].sc = false;
    tileDef.forEach((d, i) => { const col = i % 3, row = (i / 3) | 0; p.fixed.push(Object.assign({ t: 'tile', x: 30 + col * 216, y: 212 + row * 190, w: 208, h: 184 }, d)); });
    return w;
  } });
// ---------- ambientes ----------
const ENVS = [
  { id: 'room', label: 'Quarto 3D', icon: 'room', c0: '#b9833f', c1: '#3b2a1b' }, { id: 'city', label: 'Cidade', icon: 'city', c0: '#6c7b95', c1: '#232a38' },
  { id: 'pano', label: 'Panorama 360°', icon: 'image', c0: '#d1805a', c1: '#26365a' }, { id: 'sky', label: 'Campo aberto', icon: 'sky', c0: '#7fb2e5', c1: '#3d5a45' }, { id: 'pong', label: 'Ping-Pong', icon: 'target', c0: '#2d7ff9', c1: '#12264d' }, { id: 'sinuca', label: 'Sinuca', icon: 'target', c0: '#1f8a52', c1: '#3a2112' }, { id: 'saber', label: 'Beat Saber', icon: 'bolt', c0: '#ff2447', c1: '#1f2a8a' },
  { id: 'green', label: 'Chroma verde', icon: 'chroma', c0: '#0fc14e', c1: '#04642a' }, { id: 'alpha', label: 'Transparente', icon: 'chroma', c0: '#6a6f7a', c1: '#2b2e36' }];
ui.ENVS = ENVS;
ui.panel({ id: 'envs', mw: 1.5, mh: 1.06, primary: true, title: 'Ambientes', titleIcon: 'cube', dist: 1.35, dy: 0.03, order: 11, onOpen: () => { ui.lastPrimary = 'envs'; },
  build() { return ENVS.map((e, i) => ({ t: 'card', x: 20 + (i % 4) * 257, y: 100 + ((i / 4) | 0) * 205, w: 245, h: 190, label: e.label, icon: e.icon, c0: e.c0, c1: e.c1, active: () => S.env === e.id, onClick: () => VR.env.set(e.id) })); } });
// ---------- dock ----------
const DOCK = [
  { icon: 'cube', label: 'Ambientes', active: () => ui.panels.envs.vis, onClick: () => ui.toggleWin('envs') },
  { icon: 'play', label: 'YouTube', active: () => ui.panels.yt && ui.panels.yt.vis, onClick: () => VR.yt.toggle() },
  { icon: 'camera', label: 'Câmera', active: () => S.pass, onClick: () => VR.setPass(!S.pass) },
  { icon: 'hand', label: 'Mãos', active: () => settings.vis && settings.page === 'maos', onClick: () => ui.openSettings('maos') },
  { icon: 'gear', label: 'Ajustes', active: () => settings.vis && settings.page !== 'maos', onClick: () => ui.openSettings(settings.page === 'maos' ? 'rast' : settings.page) },
  { icon: 'tune', label: 'Rápidos', active: () => ui.panels.quick.vis, onClick: () => ui.toggleWin('quick') },
  { icon: 'close', label: 'Fechar', onClick: () => ui.closeMenu() }];
ui.panel({ id: 'dock', mw: 1.06, mh: 0.2, closable: false, dist: 1.12, dy: -0.5, order: 12, radius: 70,
  build(p) { return DOCK.map((d, i) => Object.assign({ t: 'dock', x: 14 + i * 102, y: 6, w: 94, h: 128 }, d)); } });
// ---------- botão flutuante (menu fechado) e avisos ----------
const orb = ui.panel({ id: 'orb', space: 'head', mw: 0.19, mh: 0.19, glass: false, closable: false, bar: false, order: 12, vis: false, build() { return [{ t: 'orb', x: 0, y: 0, w: 133, h: 133, onClick: () => ui.openMenu() }]; } });
orb.g.position.set(0, -0.23, -0.8); orb.placed = true;
const toast = ui.panel({ id: 'toast', space: 'head', mw: 1.3, mh: 0.14, glass: false, closable: false, bar: false, order: 13, noHit: true, msg: '', until: 0,
  extra(g, p) { if (!p.msg) return; g.font = '600 34px ' + ui.FONT; const tw = Math.min(p.W - 40, g.measureText(p.msg).width + 70); ui.rr(g, (p.W - tw) / 2, 16, tw, 70, 35); g.fillStyle = 'rgba(18,20,27,.9)'; g.fill(); g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,.25)'; g.stroke(); ui.text(g, p.msg, p.W / 2, 52, 34, '#fff', 'center', 600); } });
toast.g.position.set(0, 0.3, -0.9); toast.placed = true;
ui.toast = (msg, ms) => { toast.msg = String(msg).slice(0, 70); toast.until = performance.now() + (ms || 3200); toast.dirty = true; ui.show(toast, true); };
VR.toast = ui.toast;
VR.status = t => { const el = VR.$('status'); if (el) el.textContent = t; if (S.started) ui.toast(t.length > 70 ? t.slice(0, 67) + '…' : t, 4500); };
// ---------- atualização periódica (estado dos botões, relógio, números ao vivo) ----------
let acc = 0;
VR.hook(36, dt => {
  if (performance.now() > toast.until && toast.vis) ui.show(toast, false);
  acc += dt; if (acc < 0.3) return; acc = 0;
  ui.list.forEach(p => { if (p.vis && p.id !== 'toast' && p.id !== 'yt') p.dirty = true; });
});
})();
