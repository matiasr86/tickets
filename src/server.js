// src/server.js
import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoose from 'mongoose';
import cors from 'cors';

import Counter from './models/Counter.js';
import Vendor from './models/Vendor.js';
import Ticket from './models/Ticket.js';
import { signTicket, verifyPayload, makeQrPngDataUrl } from './utils/qr.js';

dotenv.config();

const app = express();
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));
app.use(cors());

const FIXED_AMOUNT = Number(process.env.FIXED_AMOUNT || 5000);


// === paths estáticos ===
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1) /public
const PUBLIC_DIR = fs.existsSync(path.join(__dirname, '..', 'public'))
  ? path.join(__dirname, '..', 'public')
  : path.join(process.cwd(), 'public');

console.log('🗂️ Static dir:', PUBLIC_DIR);
app.use(express.static(PUBLIC_DIR));

// 2) html5-qrcode desde node_modules o vendor fallback
const NM_MINIFIED = path.join(process.cwd(), 'node_modules', 'html5-qrcode', 'minified');
const VENDOR_DIR  = path.join(PUBLIC_DIR, 'vendor');

if (fs.existsSync(path.join(NM_MINIFIED, 'html5-qrcode.min.js'))) {
  console.log('📦 html5-qrcode desde node_modules:', NM_MINIFIED);
  app.use('/lib/html5-qrcode/minified', express.static(NM_MINIFIED));
} else if (fs.existsSync(path.join(VENDOR_DIR, 'html5-qrcode.min.js'))) {
  console.log('📦 html5-qrcode desde public/vendor (fallback):', VENDOR_DIR);
  app.use('/lib/html5-qrcode/minified', express.static(VENDOR_DIR));
} else {
  console.warn('⚠️ No se encontró html5-qrcode.min.js.');
  console.warn('   Ejecutá:  npm i html5-qrcode');
  console.warn('   O copiá el archivo a /public/vendor/html5-qrcode.min.js');
}

// Permitir cámara en mismo origen
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(self)');
  next();
});

// Fallback explícito para "/"
app.get('/', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

// === MongoDB ===
const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
(async () => {
  try {
    if (!uri) throw new Error('Falta MONGODB_URI (o MONGO_URI) en .env');
    if (!/^mongodb(\+srv)?:\/\//.test(uri)) throw new Error('MONGODB_URI inválida');
    await mongoose.connect(uri);   // usa la DB que venga en la URI (p.ej. /ticket)
    console.log('✅ MongoDB conectado');
  } catch (err) {
    console.error('Mongo error:', err);
    process.exit(1);
  }
})();

// === helpers ===
async function nextTicketNo() {
  const c = await Counter.findOneAndUpdate(
    { _id: 'tickets' },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return c.seq;
}

// === API ===

// Alta de vendedores
app.post('/api/admin/vendors', async (req, res) => {
  const adminKey = req.header('x-admin-key');
  if (adminKey !== process.env.ADMIN_KEY) return res.status(401).json({ error: 'unauthorized' });

  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name requerido' });

  const token = String(Math.floor(100000 + Math.random() * 900000)); // 6 dígitos
  try {
    const vendor = await Vendor.create({ name, token, active: true });
    return res.json({ id: vendor._id, name: vendor.name, token: vendor.token });
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
});

// 2) Crear ticket (vendedor) — monto fijo
app.post('/api/tickets', async (req, res) => {
  try {
    const { token, buyer } = req.body || {};
    if (!token || !buyer) {
      return res.status(400).json({ error: 'token y buyer son requeridos' });
    }

    const vendor = await Vendor.findOne({ token, active: true });
    if (!vendor) return res.status(401).json({ error: 'token inválido' });

    const ticketNo = await nextTicketNo();

    const temp = new Ticket({
      ticketNo,
      vendorId: vendor._id,
      vendorName: vendor.name,
      buyer,
      amount: FIXED_AMOUNT,        // <<— monto fijo
      status: 'unused',
      qrPayload: 'tmp'
    });
    await temp.save();

    const payload = signTicket(temp._id.toString(), process.env.APP_SECRET);
    const dataUrl = await makeQrPngDataUrl(payload);

    temp.qrPayload = payload;
    await temp.save();

    return res.json({
      ticket: {
        id: temp._id,
        ticketNo: temp.ticketNo,
        buyer: temp.buyer,
        amount: temp.amount,       // devolverá 5000
        vendorName: temp.vendorName,
        status: temp.status,
        createdAt: temp.createdAt
      },
      qrDataUrl: dataUrl,
      downloadName: `entrada-${temp.ticketNo}.png`
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});


// Listar tickets
app.get('/api/tickets', async (req, res) => {
  const { token } = req.query || {};
  let filter = {};
  if (token) {
    const vendor = await Vendor.findOne({ token });
    if (!vendor) return res.status(401).json({ error: 'token inválido' });
    filter.vendorId = vendor._id;
  }
  const items = await Ticket.find(filter).sort({ ticketNo: 1 }).lean();
  return res.json(items);
});

// Borrar ticket
app.delete('/api/tickets/:id', async (req, res) => {
  try {
    const token = req.header('x-vendor-token') || req.body?.token;
    if (!token) return res.status(400).json({ error: 'token requerido' });

    const vendor = await Vendor.findOne({ token });
    if (!vendor) return res.status(401).json({ error: 'token inválido' });

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'ticket no encontrado' });

    if (String(ticket.vendorId) !== String(vendor._id)) {
      return res.status(403).json({ error: 'no autorizado a borrar este ticket' });
    }

    await Ticket.deleteOne({ _id: ticket._id });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// Escanear/usar ticket
app.post('/api/scan', async (req, res) => {
  try {
    const { payload } = req.body || {};
    const { ok, id } = verifyPayload(payload, process.env.APP_SECRET);
    if (!ok) return res.json({ status: 'not_found' });

    const updated = await Ticket.findOneAndUpdate(
      { _id: id, status: 'unused' },
      { $set: { status: 'used', usedAt: new Date() } },
      { new: true }
    );

    if (!updated) {
      const t = await Ticket.findById(id);
      if (!t) return res.json({ status: 'not_found' });
      return res.json({
        status: 'already_used',
        ticketNo: t.ticketNo,
        buyer: t.buyer,
        vendorName: t.vendorName
      });
    }

    return res.json({
      status: 'ok',
      ticketNo: updated.ticketNo,
      buyer: updated.buyer,
      vendorName: updated.vendorName
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// Health
app.get('/health', (_, res) => res.json({ ok: true }));

// Start
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`🚀 Servidor en http://localhost:${port}`));
