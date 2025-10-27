import mongoose from 'mongoose';

const VendorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  token: { type: String, required: true, unique: true }, // 6 dígitos (según tu idea)
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Vendor', VendorSchema);
