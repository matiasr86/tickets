import mongoose from 'mongoose';

const TicketSchema = new mongoose.Schema({
  ticketNo: { type: Number, required: true, index: true },
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
  vendorName: { type: String, required: true },
  buyer: { type: String, required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['unused', 'used'], default: 'unused', index: true },
  usedAt: { type: Date },
  qrPayload: { type: String, required: true }, // id.firma
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Ticket', TicketSchema);
