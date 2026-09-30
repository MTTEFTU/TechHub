const express = require('express');
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Order = require('../models/Order');
const ShopifyCheckout = require('../models/ShopifyCheckout');
const { authenticate } = require('../middleware/auth');
const { createCart } = require('../services/shopify');

const router = express.Router();

function validateAddress(address) {
  const fields = ['fullName', 'phone', 'email', 'address', 'city', 'postalCode'];
  return address && fields.every((field) => typeof address[field] === 'string' && address[field].trim());
}

router.post('/checkout', authenticate, async (req, res, next) => {
  try {
    const { items, shippingAddress } = req.body;
    if (!Array.isArray(items) || !items.length || !validateAddress(shippingAddress)) return res.status(400).json({ message: 'Add items and complete the shipping address.' });
    const normalized = [];
    for (const item of items) {
      if (!mongoose.isValidObjectId(item.productId) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 100) return res.status(400).json({ message: 'Invalid product or quantity.' });
      normalized.push({ productId: String(item.productId), quantity: item.quantity });
    }
    const ids = [...new Set(normalized.map((item) => item.productId))];
    const products = await Product.find({ _id: { $in: ids } });
    const byId = new Map(products.map((product) => [product.id, product]));
    if (products.length !== ids.length) return res.status(409).json({ message: 'A selected product is no longer available.' });
    const missing = products.find((product) => !product.shopifyVariantId);
    if (missing) return res.status(409).json({ message: `${missing.name} is not configured for online payment. Choose cash on delivery or contact support.` });
    const unavailable = normalized.find((item) => byId.get(item.productId).stock < item.quantity);
    if (unavailable) return res.status(409).json({ message: `${byId.get(unavailable.productId).name} has insufficient stock.` });

    const checkout = new ShopifyCheckout({
      user: req.user.id,
      shopifyCartId: `pending:${new mongoose.Types.ObjectId()}`,
      checkoutUrl: 'pending',
      shippingAddress,
      items: normalized.map((item) => ({ product: item.productId, shopifyVariantId: byId.get(item.productId).shopifyVariantId, quantity: item.quantity })),
    });
    const cart = await createCart({
      checkoutId: checkout.id,
      email: shippingAddress.email,
      lines: checkout.items.map((item) => ({ merchandiseId: item.shopifyVariantId, quantity: item.quantity })),
    });
    checkout.shopifyCartId = cart.id;
    checkout.checkoutUrl = cart.checkoutUrl;
    await checkout.save();
    res.status(201).json({ checkoutId: checkout.id, checkoutUrl: cart.checkoutUrl });
  } catch (error) { next(error); }
});

router.get('/checkout/:id/status', authenticate, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Checkout not found.' });
    const checkout = await ShopifyCheckout.findOne({ _id: req.params.id, user: req.user.id });
    if (!checkout) return res.status(404).json({ message: 'Checkout not found.' });
    res.json({ checkout: { id: checkout.id, status: checkout.status, orderId: checkout.order, shopifyOrderName: checkout.shopifyOrderName } });
  } catch (error) { next(error); }
});

module.exports = router;
