// Usando qr-scanner (autohospedado)
import QrScanner from '/vendor/qr-scanner.min.js';
QrScanner.WORKER_PATH = '/vendor/qr-scanner-worker.min.js';

const videoEl   = document.getElementById('preview');
const statusEl  = document.getElementById('status');
const overlayEl = document.getElementById('scanOverlay');

const RESULT_HOLD_MS = 2600; // tiempo en pantalla del cartel

function setStatus(text, cls) {
  statusEl.textContent = text;
  statusEl.className = cls || '';
}

function showOverlay(kind, title, sub) {
  overlayEl.className = `scan-overlay show ${kind || ''}`;
  overlayEl.innerHTML = `
    <div class="box">
      <div class="title">${title}</div>
      ${sub ? `<div class="sub">${sub}</div>` : ''}
    </div>`;
}
function hideOverlay() {
  overlayEl.className = 'scan-overlay';
  overlayEl.innerHTML = '';
}

function isSecureOrigin() {
  return location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
}

async function markUsed(payload) {
  const res = await fetch('/api/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload })
  });
  let data;
  try { data = await res.json(); } catch { data = null; }
  if (!res.ok || !data) throw new Error(`HTTP ${res.status}`);
  return data;
}

let scanner;
let busy = false;

async function startScanner() {
  if (!isSecureOrigin()) {
    setStatus('⚠️ En el celular necesitás HTTPS para usar la cámara.', 'warn');
  }

  scanner = new QrScanner(
    videoEl,
    async (result) => {
      if (busy) return;
      busy = true;

      try {
        // Pausamos la cámara para que no siga leyendo detrás del cartel
        await scanner.stop();
      } catch {}

      setStatus('Verificando…');

      try {
        const payload = result?.data || result;
        const data = await markUsed(payload);

        if (data.status === 'ok') {
          showOverlay('ok', `✅ Entrada OK`, `#${data.ticketNo} · ${data.buyer} (${data.vendorName})`);
        } else if (data.status === 'already_used') {
          showOverlay('warn', `⚠️ Ya usada`, `#${data.ticketNo} · ${data.buyer} (${data.vendorName})`);
        } else {
          showOverlay('err', `❌ No encontrada / inválida`, `Mostrá otra entrada`);
        }
      } catch (e) {
        showOverlay('err', `❌ Error de red/servidor`, `Reintentá en unos segundos`);
      }

      // Mantenemos el cartel en pantalla y luego reanudamos el escaneo
      setTimeout(async () => {
        hideOverlay();
        try {
          await scanner.start(); // vuelve a abrir cámara
        } catch (e) {
          setStatus('❌ No se pudo reanudar la cámara. Recargá la página.', 'err');
        }
        setStatus('Apuntá la cámara al QR…');
        busy = false;
      }, RESULT_HOLD_MS);
    },
    {
      maxScansPerSecond: 8,
      highlightScanRegion: true,
      highlightCodeOutline: true,
      preferredCamera: 'environment'
    }
  );

  try {
    await scanner.start();
    setStatus('Apuntá la cámara al QR…');
  } catch (err) {
    console.error(err);
    if (String(err.name).includes('NotAllowedError')) {
      setStatus('🚫 Permiso de cámara denegado. Permitilo en ajustes y recargá.', 'err');
    } else if (String(err.name).includes('NotFoundError')) {
      setStatus('❌ No hay cámara disponible en este dispositivo.', 'err');
    } else if (String(err.name).includes('NotReadableError')) {
      setStatus('❌ Otra app está usando la cámara.', 'err');
    } else {
      setStatus('❌ No se pudo iniciar el escáner. Revisá HTTPS y permisos.', 'err');
    }
  }
}

startScanner();

// Limpieza al salir de la página
window.addEventListener('pagehide', () => { try { scanner?.stop(); } catch {} });
