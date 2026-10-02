const mongoose = require('mongoose');

const shopifyCheckoutSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  shopifyCartId: { type: String, required: true, unique: true },
  checkoutUrl: { type: String, required: true },
  status: { type: String, enum: ['pending', 'paid', 'failed', 'expired'], default: 'pending' },
  shippingAddress: {
    fullName: String, phone: String, email: String, address: String, city: String, postalCode: String, countryCode: String,
  },
  items: [{
    product: { type: String, required: true },
    name: String, image: String, price: Number, currencyCode: String,
    shopifyVariantId: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
  }],
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
  shopifyOrderId: { type: String, default: '', index: true },
  shopifyOrderName: { type: String, default: '' },
  lastWebhookId: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('ShopifyCheckout', shopifyCheckoutSchema);
