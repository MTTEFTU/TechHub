// Legacy schema retained for inspection only; never used by live application routes.
const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  brand: { type: String, default: '', trim: true },
  category: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  discountPrice: { type: Number, min: 0, default: null },
  images: { type: [String], default: [] },
  description: { type: String, default: '' },
  shortDescription: { type: String, default: '' },
  specifications: { type: mongoose.Schema.Types.Mixed, default: {} },
  stock: { type: Number, default: 0, min: 0 },
  rating: { type: Number, default: 0, min: 0, max: 5 },
  featured: { type: Boolean, default: false },
  shopifyProductId: { type: String, default: '', trim: true, match: [/^$|^gid:\/\/shopify\/Product\/\d+$/, 'Invalid Shopify product GID.'] },
  shopifyVariantId: { type: String, default: '', trim: true, match: [/^$|^gid:\/\/shopify\/ProductVariant\/\d+$/, 'Invalid Shopify variant GID.'] },
}, { timestamps: true });

productSchema.index({ name: 'text', brand: 'text', category: 'text', description: 'text' });

productSchema.virtual('effectivePrice').get(function effectivePrice() {
  return this.discountPrice ?? this.price;
});

module.exports = mongoose.model('Product', productSchema);
