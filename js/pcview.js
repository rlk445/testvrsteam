/* pcview.js — exibe o frame de vídeo do PC como fundo da cena Three.js
   Quando o PC está conectado e enviando:
     - Cria um plano renderizado antes de tudo (renderOrder = -20)
     - Atualiza a textura a cada novo frame (pc.frameDirty)
     - Aplica reprojeção simples: rotaciona o plano para compensar a diferença
       entre a pose com que o PC renderizou e a pose atual do iPhone
     - Chama automaticamente VR.pc.connect(ip) ao ligar o modo VR do PC
*/
(() => {
'use strict';
const VR = window.VR, T = VR.T, S = VR.S, log = VR.log;

// ---- plano de fundo (criado uma vez, visível só quando PC está ligado) ----
const PC_D = 5;   // distância do plano (metros) — igual ao PT_D da passagem da câmera
let bgMesh = null, bgTex = null, bgMat = null;

function ensureBg() {
  if (bgMesh) return;
  bgTex = new T.Texture();
  bgTex.minFilter = bgTex.magFilter = T.LinearFilter;
  bgTex.generateMipmaps = false;
  bgTex.colorSpace = T.SRGBColorSpace;

  bgMat  = new T.MeshBasicMaterial({
    map: bgTex, depthTest: false, depthWrite: false, fog: false, toneMapped: false,
  });
  bgMesh = new T.Mesh(new T.PlaneGeometry(1, 1), bgMat);
  bgMesh.renderOrder = -20;
  bgMesh.frustumCulled = false;
  bgMesh.visible = false;
  VR.scene.add(bgMesh);
}

// ---- reprojeção: quaternion da pose do PC vs pose atual ----
// Quando o frame chegou, o PC o renderizou com uma certa orientação (poseQ).
// Agora o iPhone já virou um pouco. Calculamos a diferença e rotacionamos o plano.
// Isso reduz o "judder" causado pela latência do vídeo.
const _qPC    = new T.Quaternion();
const _qCur   = new T.Quaternion();
const _qDelta = new T.Quaternion();
const _qInv   = new T.Quaternion();
const _fwd    = new T.Vector3();

function updateBg() {
  const pc = VR.pc;
  if (!pc || !pc.on || !pc.frame) {
    if (bgMesh) bgMesh.visible = false;
    return;
  }

  ensureBg();

  // --- atualiza textura quando há frame novo ---
  if (pc.frameDirty) {
    bgTex.image  = pc.frame;
    bgTex.needsUpdate = true;
    pc.frameDirty = false;
  }

  // --- tamanho: usa a resolução do frame para calcular o aspect ---
  const fw = pc.frame.width  || 1266;
  const fh = pc.frame.height || 1170;   // resolução por olho que o PC envia
  const aspect = fw / fh;
  // campo de visão horizontal usado no PC (90° por olho, igual a STORMVR_FOV_H)
  const fovH = (S.pcFovH || 90) * Math.PI / 180;
  const H  = 2 * PC_D * Math.tan(fovH / 2);
  const W  = H * aspect;
  bgMesh.scale.set(W, H, 1);

  // --- reprojeção: aplica diferença de quaternion entre pose do frame e pose atual ---
  if (pc._lastPoseQ) {
    _qPC.set(pc._lastPoseQ[0], pc._lastPoseQ[1], pc._lastPoseQ[2], pc._lastPoseQ[3]);
    _qCur.copy(VR.headQ);
    _qInv.copy(_qPC).invert();
    _qDelta.copy(_qInv).multiply(_qCur);
    // plano fica na pose do PC, ligeiramente corrigida pela diferença
    bgMesh.quaternion.copy(_qPC).multiply(_qDelta.slerp(new T.Quaternion(), 0.3));
  } else {
    bgMesh.quaternion.copy(VR.headQ);
  }

  bgMesh.position.copy(VR.HEAD).add(
    _fwd.set(0, 0, -PC_D).applyQuaternion(bgMesh.quaternion)
  );
  bgMesh.visible = true;
}

// ---- hook no loop de render (prioridade 8: antes das mãos, depois da pose) ----
VR.hook(8, updateBg);

// ---- API pública ----
VR.pcview = {
  // Liga o modo PC-VR: esconde o panorama, liga o plano de vídeo, conecta o WebSocket
  enable(ip) {
    if (!ip) { VR.toast && VR.toast('Digite o IP do PC primeiro'); return; }
    S.pcIp = ip;
    // Esconde o panorama (que seria a "janela" da cena normal)
    if (VR.pano && VR.pano.mesh) VR.pano.mesh.visible = false;
    // Desliga a passagem da câmera (evita conflito de fundo)
    if (S.pass) VR.setPass(false);
    // Conecta
    VR.pc.connect(ip);
    log('pcview: modo PC-VR ligado, conectando a ' + ip);
  },
  disable() {
    VR.pc.disconnect();
    if (bgMesh) bgMesh.visible = false;
    // Restaura o panorama se quiser
    if (VR.pano && VR.pano.mesh) VR.pano.mesh.visible = true;
    log('pcview: modo PC-VR desligado');
  },
};

// ---- Configuração padrão ----
// S.pcFovH: campo de visão horizontal (graus) por olho que o PC usa — deve bater com STORMVR_FOV_H
if (!('pcFovH' in S)) S.pcFovH = 90;

log('pcview: módulo carregado');
})();
