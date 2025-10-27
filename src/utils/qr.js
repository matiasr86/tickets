import crypto from 'crypto';
import QRCode from 'qrcode';

export function signTicket(id, secret) {
  const sig = crypto.createHmac('sha256', secret).update(String(id)).digest('hex');
  return `${id}.${sig}`;
}

export function verifyPayload(payload, secret) {
  const [id, sig] = (payload || '').split('.');
  if (!id || !sig) return { ok: false, id: null };
  const good = crypto.createHmac('sha256', secret).update(String(id)).digest('hex') === sig;
  return { ok: good, id };
}

export async function makeQrPngDataUrl(payload) {
  return QRCode.toDataURL(payload, { errorCorrectionLevel: 'M', margin: 1, scale: 6 });
}
