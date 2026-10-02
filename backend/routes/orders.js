const express = require('express');
const Order = require('../models/Order');
const { validateLines } = require('../services/catalog');
const { validateAddress, createCodOrder, cancelCodOrder, findCodOrder } = require('../services/cod');
const { authenticate, requireAdmin } = require('../middleware/auth');
const router = express.Router();
const admin = [authenticate, requireAdmin];
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { items, shippingAddress, paymentMethod = 'cash_on_delivery', idempotencyKey } = req.body;
    if (typeof idempotencyKey !== 'string' || !/^[a-zA-Z0-9-]{8,100}$/.test(idempotencyKey)) return res.status(400).json({ message: 'A checkout request ID is required.' });
    const existing = await Order.findOne({ user: req.user.id, idempotencyKey });
    if (existing && existing.creationStatus !== 'failed') {
      if (existing.creationStatus === 'ready') return res.status(200).json({ order: existing });
      const remote = await findCodOrder(existing.id);
      if (remote) {
        existing.shopifyOrderId = remote.id; existing.shopifyOrderName = remote.name;
        existing.creationStatus = 'ready'; existing.shopifyFinancialStatus = 'pending';
        if (remote.totalPriceSet?.presentmentMoney) { existing.totalAmount = Number(remote.totalPriceSet.presentmentMoney.amount); existing.currencyCode = remote.totalPriceSet.presentmentMoney.currencyCode; }
        await existing.save();
        return res.status(200).json({ order: existing });
      }
      return res.status(409).json({ message: 'This COD request is still processing or needs review. Contact support with reference ' + existing.id + ' before starting another order.' });
    }
    if (!validateAddress(shippingAddress)) return res.status(400).json({ message: 'Complete the shipping address.' });
    if (paymentMethod !== 'cash_on_delivery') return res.status(400).json({ message: 'That payment method is not available here.' });
    const products = await validateLines(items);
    const precision = new Intl.NumberFormat('en', { style: 'currency', currency: products[0].currencyCode }).resolvedOptions().maximumFractionDigits;
    const factor = 10 ** precision;
    const subtotal = products.reduce((total, line) => total + Math.round(line.price * factor) * line.quantity, 0) / factor;
    const shippingAmount = subtotal >= 75 ? 0 : 9;
    const data = { user: req.user.id, products, currencyCode: products[0].currencyCode,
      totalAmount: subtotal + shippingAmount, shippingAmount, shippingAddress, paymentMethod, idempotencyKey, creationStatus: 'creating' };
    // A definite Shopify rejection can be retried after revalidation. Claim that retry atomically.
    const order = existing ? await Order.findOneAndUpdate(
      { _id: existing.id, creationStatus: 'failed' }, { $set: data }, { new: true, runValidators: true },
    ) : new Order(data);
    if (!order) return res.status(409).json({ message: 'This COD request is already processing.' });
    // Save the reference before contacting Shopify so a failed local write never loses an order reference.
    if (!existing) await order.save();
    let remote;
    try { remote = await createCodOrder(order); }
    catch (error) {
      if (error.status === 409) { order.creationStatus = 'failed'; await order.save(); }
      // Network failures may have created a Shopify order; reuse the request ID to recover it.
      throw error;
    }
    order.shopifyOrderId = remote.id;
    order.shopifyOrderName = remote.name;
    order.shopifyFinancialStatus = 'pending';
    order.creationStatus = 'ready';
    const total = remote.totalPriceSet?.presentmentMoney;
    if (total) { order.totalAmount = Number(total.amount); order.currencyCode = total.currencyCode; }
    await order.save();
    res.status(201).json({ order });
  } catch (error) { next(error); }
});
router.get('/my-orders', authenticate, async (req, res, next) => {
  try { res.json({ orders: await Order.find({ user: req.user.id, creationStatus: { $nin: ['creating', 'failed'] } }).sort({ createdAt: -1 }) }); }
  catch (error) { next(error); }
});
router.get('/', ...admin, async (_req, res, next) => {
  try { res.json({ orders: await Order.find().populate('user', 'name email').sort({ createdAt: -1 }) }); }
  catch (error) { next(error); }
});
router.put('/:id/status', ...admin, async (req, res, next) => {
  try {
    if (!['pending','confirmed','processing','shipped','delivered','cancelled'].includes(req.body.orderStatus))
      return res.status(400).json({ message: 'Invalid order status.' });
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found.' });
    if (['cancelled','delivered'].includes(order.orderStatus)) return res.status(409).json({ message: 'This order can no longer be changed.' });
    if (req.body.orderStatus === 'cancelled' && order.paymentMethod === 'cash_on_delivery' && order.shopifyOrderId) {
      const job = await cancelCodOrder(order.shopifyOrderId);
      if (job && !job.done) return res.status(202).json({ order, message: 'Shopify cancellation is processing. Refresh and retry after it completes.' });
    }
    order.orderStatus = req.body.orderStatus;
    await order.save();
    res.json({ order });
  } catch (error) { next(error); }
});
module.exports = router;
