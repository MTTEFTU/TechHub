// Legacy category schema; catalog categories now come from Shopify product types.
const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  image: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Category', categorySchema);