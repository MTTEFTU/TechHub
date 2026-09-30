const mongoose = require('mongoose');

const shopifyCheckoutSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  shopifyCartId: { type: String, required: true, unique: true },
  checkoutUrl: { type: String, required: true },
  status: { type: String, enum: ['pending', 'paid', 'failed', 'expired'], default: 'pending' },
  shippingAddress: {
    fullName: String, phone: String, email: String, address: String, city: String, postalCode: String,
  },
  items: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    shopifyVariantId: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
  }],
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
  shopifyOrderId: { type: String, default: '', index: true },
  shopifyOrderName: { type: String, default: '' },
  lastWebhookId: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('ShopifyCheckout', shopifyCheckoutSchema);
