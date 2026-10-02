const express = require('express');
const mongoose = require('mongoose');
const ShopifyCheckout = require('../models/ShopifyCheckout');
const { authenticate } = require('../middleware/auth');
const { createCart } = require('../services/shopify');
const { validateLines } = require('../services/catalog');
const { validateAddress } = require('../services/cod');
const { validateCountryCode } = require('../services/checkoutCountry');
const router = express.Router();
router.post('/checkout', authenticate, async (req, res, next) => {
  try {
    const { items, shippingAddress } = req.body;
    if (!validateAddress(shippingAddress)) return res.status(400).json({ message: 'Complete the shipping address.' });
    const countryCode = validateCountryCode(shippingAddress.countryCode);
    const lines = await validateLines(items, countryCode, 'checkout');
    const checkout = new ShopifyCheckout({
      user: req.user.id, shopifyCartId: `pending:${new mongoose.Types.ObjectId()}`,
      checkoutUrl: 'pending', shippingAddress,
      items: lines.map(line => ({ ...line, shopifyVariantId: line.variantId })),
    });
    const cart = await createCart({ checkoutId: checkout.id, email: shippingAddress.email, countryCode,
      lines: lines.map(line => ({ merchandiseId: line.variantId, quantity: line.quantity })) });
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
