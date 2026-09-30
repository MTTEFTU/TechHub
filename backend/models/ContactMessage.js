const mongoose = require('mongoose');

const contactMessageSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  phone: { type: String, trim: true, default: '' },
  subject: { type: String, required: true, trim: true },
  message: { type: String, required: true, trim: true, maxlength: 5000 },
  readAt: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('ContactMessage', contactMessageSchema);