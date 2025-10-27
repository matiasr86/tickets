const form = document.getElementById('f');
const result = document.getElementById('result');

function drawLabeledQr(qrDataUrl, { buyer, ticketNo }) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // Dimensiones base (mobile-first)
      const W = 1000;
      const QR = 780; // lado del QR
      const PAD = 40;

      const canvas = document.createElement('canvas');
      const H = PAD + 70 + 28 + 20 + QR + 60 + 30 + PAD; // alto aproximado
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');

      // Fondo blanco (ideal para imprimir)
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#111';

      // Título evento
      ctx.font = 'bold 44px system-ui, -apple-system, Segoe UI, Roboto, Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Gran Peña Solidaria', W / 2, PAD + 44);

      // Subtítulo
      ctx.font = '700 26px system-ui, -apple-system, Segoe UI, Roboto, Arial';
      ctx.fillStyle = '#444';
      ctx.fillText('Todos por Juase', W / 2, PAD + 44 + 32);

      // Nombre comprador (ajustar tamaño si es largo)
      const maxWidth = W - PAD * 2;
      let size = 42;
      ctx.fillStyle = '#111';
      ctx.textAlign = 'center';
      while (size > 22) {
        ctx.font = `700 ${size}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
        if (ctx.measureText(buyer).width <= maxWidth) break;
        size -= 2;
      }
      ctx.fillText(buyer, W / 2, PAD + 44 + 32 + 32 + 10);

      // Dibujar QR centrado
      const qrX = (W - QR) / 2;
      const qrY = PAD + 44 + 32 + 32 + 10 + 20;
      ctx.drawImage(img, qrX, qrY, QR, QR);

      // Nro de entrada (abajo)
      ctx.font = '600 24px system-ui, -apple-system, Segoe UI, Roboto, Arial';
      ctx.fillStyle = '#333';
      ctx.fillText(`Entrada #${ticketNo}`, W / 2, qrY + QR + 40);

      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = qrDataUrl;
  });
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  result.innerHTML = '<span class="msg">Generando…</span>';

  const payload = {
    token: document.getElementById('token').value.trim(),
    buyer: document.getElementById('buyer').value.trim()
    // amount ya no se envía: el backend fija el precio en 5000
  };

  try {
    const res = await fetch('/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);

    // Componer PNG con el nombre arriba del QR
    const labeledPng = await drawLabeledQr(data.qrDataUrl, {
      buyer: data.ticket.buyer,
      ticketNo: data.ticket.ticketNo
    });

    const img = new Image();
    img.src = labeledPng;
    img.alt = 'QR';
    img.style.maxWidth = '360px';
    img.style.display = 'block';
    img.style.margin = '8px 0';

    const a = document.createElement('a');
    a.href = labeledPng;
    a.download = `entrada-${data.ticket.ticketNo}.png`;
    a.textContent = 'Descargar PNG';

    // Mostrar monto formateado que devuelve el server (5000)
    const montoFmt = Number(data.ticket.amount).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });

    result.innerHTML = `
      <p class="msg ok">Entrada #${data.ticket.ticketNo} para <strong>${data.ticket.buyer}</strong> — ${montoFmt}</p>
    `;
    result.appendChild(img);
    result.appendChild(a);
  } catch (err) {
    console.error(err);
    result.innerHTML = `<span class="msg err">Error: ${err.message}</span>`;
  }
});
