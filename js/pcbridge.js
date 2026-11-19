/* pcbridge.js — ponte entre o iPhone e o PC (StormVR)
   - Conecta via WebSocket ao servidor no PC (porta 5560)
   - Envia pose da cabeça + mãos a cada frame renderizado
   - Recebe frames H.264 (Annex-B) com cabeçalho de pose, decodifica com VideoDecoder
   - Expõe VR.pc.frame como ImageBitmap pronto para virar textura Three.js
*/
(() => {
'use strict';
const VR = window.VR, S = VR.S, log = VR.log;

// ---- estado público ----
const pc = VR.pc = {
  on: false,          // true enquanto conectado e recebendo vídeo
  frame: null,        // ImageBitmap do último frame decodificado (null = ainda sem frame)
  frameDirty: false,  // true quando frame foi atualizado desde o último render
  latMs: 0,           // latência estimada (ms) dos últimos frames
  fps: 0,             // fps de vídeo recebido
  connect,
  disconnect,
  sendPose,
};

// ---- parâmetros ----
const WS_PORT   = 5560;   // porta WebSocket no PC
const POSE_HZ   = 90;     // máximo de envios de pose por segundo
const HDR_BYTES = 56;     // cabeçalho: 1 byte tipo + 3 pad + 1×uint32 frameId + 12×float32 (pose)
                          // layout: [type u8][pad 3][frameId u32][qx f32][qy f32][qz f32][qw f32]
                          //         [px f32][py f32][pz f32][lx f32][ly f32][lz f32][rx f32][ry f32][rz f32]
// tipos de mensagem (1 byte)
const MSG_POSE  = 0x01;   // iPhone → PC: pose
const MSG_VIDEO = 0x02;   // PC → iPhone: frame H.264 + pose embedded

// ---- websocket ----
let ws = null, reconnTimer = null, lastPoseSend = 0;
let frameCount = 0, fpsT = performance.now();

function connect(ip) {
  disconnect();
  const url = 'ws://' + ip + ':' + WS_PORT;
  log('pcbridge: conectando a ' + url);
  try {
    ws = new WebSocket(url);
    ws.binaryType = 'arraybuffer';
    ws.onopen    = onOpen;
    ws.onclose   = onClose;
    ws.onerror   = onError;
    ws.onmessage = onMessage;
  } catch (e) {
    log('pcbridge: erro ao criar WebSocket: ' + e.message);
    scheduleReconnect(ip);
  }
  pc._ip = ip;
}

function disconnect() {
  clearTimeout(reconnTimer);
  if (ws) { try { ws.close(); } catch (_) {} ws = null; }
  pc.on = false;
  if (decoder) { try { decoder.close(); } catch (_) {} decoder = null; }
}

function onOpen() {
  log('pcbridge: conectado');
  pc.on = true;
  initDecoder();
  VR.toast && VR.toast('PC conectado — recebendo vídeo', 3000);
}

function onClose(e) {
  log('pcbridge: desconectado (code=' + e.code + ')');
  pc.on = false;
  scheduleReconnect(pc._ip);
}

function onError() {
  log('pcbridge: erro de conexão');
}

function scheduleReconnect(ip) {
  if (!ip) return;
  clearTimeout(reconnTimer);
  reconnTimer = setTimeout(() => connect(ip), 3000);
}

// ---- envio de pose ----
// Formato (56 bytes):
//  [0]      u8  tipo = MSG_POSE
//  [1-3]    u8  padding
//  [4-7]    u32 timestamp ms (para medir RTT)
//  [8-23]   4×f32 quaternion cabeça (xyzw)
//  [24-35]  3×f32 posição cabeça (xyz) — zeros se 3DoF
//  [36-47]  3×f32 posição mão esquerda (xyz) — NaN se não visível
//  [48-55]  não usados nesta versão (pad)
const poseBuf = new ArrayBuffer(56);
const poseU8  = new Uint8Array(poseBuf);
const poseU32 = new Uint32Array(poseBuf);
const poseF32 = new Float32Array(poseBuf);

function sendPose() {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  const now = performance.now();
  if (now - lastPoseSend < 1000 / POSE_HZ) return;
  lastPoseSend = now;

  const hq = VR.headQ, hp = VR.HEAD;
  poseU8[0]  = MSG_POSE;
  poseU8[1]  = poseU8[2] = poseU8[3] = 0;
  poseU32[1] = now & 0xffffffff;   // timestamp (mod 2^32)
  poseF32[2] = hq.x; poseF32[3] = hq.y; poseF32[4] = hq.z; poseF32[5] = hq.w;
  poseF32[6] = hp.x; poseF32[7] = hp.y; poseF32[8] = hp.z;

  // mãos: posição do ponto 8 (ponta do indicador) no mundo
  const H = VR.H;
  if (H && H[0] && H[0].vis) {
    const a = H[0].anchor; poseF32[9] = a.x; poseF32[10] = a.y; poseF32[11] = a.z;
  } else {
    poseF32[9] = poseF32[10] = poseF32[11] = NaN;
  }
  // bytes 48-55: versão do protocolo
  poseF32[12] = poseF32[13] = 0;

  try { ws.send(poseBuf); } catch (_) {}
}

// ---- recepção de vídeo ----
// Cabeçalho do frame (HDR_BYTES = 56):
//  [0]     u8  tipo = MSG_VIDEO
//  [1-3]   u8  flags (0x01 = keyframe)
//  [4-7]   u32 frameId
//  [8-11]  u32 timestamp PC (ms, para latência)
//  [12-27] 4×f32 quaternion da pose usada para renderizar
//  [28-55] reservado
// seguido de bytes Annex-B do frame H.264

let decoder = null;
const decodeQ = [];   // fila de chunks aguardando decodificação
let decodeBusy = false;

function initDecoder() {
  if (!window.VideoDecoder) {
    log('pcbridge: VideoDecoder não disponível — requer iOS 16+');
    pc._noDecoder = true;
    return;
  }
  try {
    decoder = new VideoDecoder({
      output: onVideoFrame,
      error: e => log('pcbridge: decoder erro: ' + e.message),
    });
    // O PC envia SPS/PPS no primeiro keyframe (Annex-B); o decoder é configurado
    // com 'avc1.42E01E' (baseline L3.0 — compatível com todos os iPhones).
    // O PC pode enviar perfil diferente; o log do runtime mostra qual.
    decoder.configure({
      codec: 'avc1.42E01E',
      hardwareAcceleration: 'prefer-hardware',
      optimizeForLatency: true,
    });
    log('pcbridge: VideoDecoder iniciado (H.264 hardware)');
  } catch (e) {
    log('pcbridge: VideoDecoder configure falhou: ' + e.message);
    pc._noDecoder = true;
  }
}

function onMessage(ev) {
  if (!(ev.data instanceof ArrayBuffer) || ev.data.byteLength < HDR_BYTES) return;
  const u8  = new Uint8Array(ev.data);
  const u32 = new Uint32Array(ev.data);
  const f32 = new Float32Array(ev.data);

  if (u8[0] !== MSG_VIDEO) return;

  const keyframe  = !!(u8[1] & 0x01);
  const frameId   = u32[1];
  const tsPC      = u32[2];        // timestamp do PC em ms
  const poseQx    = f32[3], poseQy = f32[4], poseQz = f32[5], poseQw = f32[6];

  // latência: baseada no timestamp de envio da pose que gerou este frame
  // (simplificação: usamos o clock local como aproximação)
  const arrivalMs = performance.now();
  pc._lastFrameId  = frameId;
  pc._lastPoseQ    = [poseQx, poseQy, poseQz, poseQw];

  // FPS contador
  frameCount++;
  if (arrivalMs - fpsT >= 1000) {
    pc.fps = Math.round(frameCount * 1000 / (arrivalMs - fpsT));
    frameCount = 0; fpsT = arrivalMs;
  }

  if (!decoder || pc._noDecoder) return;
  if (decoder.state === 'closed') { initDecoder(); return; }

  const nalData = new Uint8Array(ev.data, HDR_BYTES);
  const chunk = new EncodedVideoChunk({
    type: keyframe ? 'key' : 'delta',
    timestamp: frameId * (1000000 / 60),  // microsegundos
    data: nalData,
  });

  try {
    decoder.decode(chunk);
  } catch (e) {
    // se falhar num delta frame, aguarda o próximo keyframe
    if (!keyframe) log('pcbridge: decode delta falhou, aguardando keyframe');
  }
}

function onVideoFrame(vf) {
  // Converte VideoFrame → ImageBitmap de forma assíncrona (não bloqueia o render)
  createImageBitmap(vf).then(bmp => {
    if (pc.frame) pc.frame.close();   // libera o anterior
    pc.frame      = bmp;
    pc.frameDirty = true;
    // latência estimada: diferença entre agora e o timestamp de envio da pose
    // (impreciso sem RTT, mas suficiente para mostrar no HUD)
    pc.latMs = Math.round(performance.now() - lastPoseSend);
  }).catch(() => {}).finally(() => vf.close());
}

// ---- hook no loop de render: envia pose e sinaliza textura nova ----
VR.hook(5, () => {
  if (!pc.on) return;
  sendPose();
});

// ---- API para o menu ligar/desligar ----
VR.pc.toggle = ip => {
  if (pc.on) { disconnect(); VR.toast && VR.toast('PC desconectado'); }
  else        { connect(ip || S.pcIp || ''); }
};

// salva o IP nas configurações
Object.defineProperty(S, 'pcIp', {
  get() { try { return localStorage.getItem('stormvr_ip') || ''; } catch (_) { return ''; } },
  set(v) { try { localStorage.setItem('stormvr_ip', v); } catch (_) {} },
});

log('pcbridge: módulo carregado');
})();
