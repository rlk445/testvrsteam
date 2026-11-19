/* pcmenu.js — painel "PC" no menu VR do pasteo
   Aparece como uma nova aba no menu lateral de Ajustes.
   Permite digitar o IP do PC e ligar/desligar o modo PC-VR.
   Usa o sistema de painéis do ui_kit.js (VR.ui.panel).
*/
(() => {
'use strict';
const VR = window.VR, S = VR.S, ui = VR.ui, log = VR.log;

// Aguarda o ui estar pronto (menu.js já rodou)
function init() {
  if (!ui || !ui.panel) { setTimeout(init, 200); return; }

  // ---- painel PC ----
  const panel = ui.panel({
    id: 'pc',
    title: '🖥 PC',
    icon: 'ti-device-desktop',
    order: 60,
    build() {
      const ip = S.pcIp || '';
      return [
        { type: 'title', label: 'Modo PC-VR' },
        { type: 'info',  label: VR.pc.on ? '🟢 Conectado' : '🔴 Desconectado' },
        { type: 'input', label: 'IP do PC', value: ip, placeholder: '192.168.1.X',
          onChange(v) { S.pcIp = v.trim(); } },
        { type: 'button', label: VR.pc.on ? 'Desconectar' : 'Conectar',
          accent: !VR.pc.on,
          onClick() {
            if (VR.pc.on) { VR.pcview.disable(); }
            else {
              const ipVal = S.pcIp || '';
              if (!ipVal) { VR.toast('Digite o IP do PC primeiro'); return; }
              VR.pcview.enable(ipVal);
            }
            panel.rebuild && panel.rebuild();
          }
        },
        { type: 'sep' },
        { type: 'title', label: 'Diagnóstico' },
        { type: 'info',  label: 'FPS vídeo: ' + (VR.pc.fps || '—') },
        { type: 'info',  label: 'Latência: ' + (VR.pc.on ? VR.pc.latMs + ' ms' : '—') },
        { type: 'sep' },
        { type: 'title', label: 'Como usar' },
        { type: 'info',  label: '1. Feche o SteamVR no PC' },
        { type: 'info',  label: '2. Rode INICIAR_SERVIDOR.bat no PC' },
        { type: 'info',  label: '3. Digite o IP e toque Conectar' },
        { type: 'info',  label: '4. Ligue Modo VR nos Ajustes rápidos' },
      ];
    }
  });

  // Atualiza o painel a cada 2 s quando está aberto
  setInterval(() => {
    if (ui.curPanel && ui.curPanel.id === 'pc') panel.rebuild && panel.rebuild();
  }, 2000);

  log('pcmenu: painel PC adicionado');
}

// Espera o menu.js terminar
if (document.readyState === 'complete') init();
else addEventListener('load', init);
})();
