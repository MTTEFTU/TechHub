const express = require('express');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();
const admin = [authenticate, requireAdmin];

router.post('/', authenticate, async (req, res, next) => {
  const decremented = [];
  try {
    const { items, shippingAddress, paymentMethod = 'cash_on_delivery' } = req.body;
    if (!Array.isArray(items) || items.length === 0 || !shippingAddress) return res.status(400).json({ message: 'Add items and complete the shipping address.' });
    if (paymentMethod !== 'cash_on_delivery') return res.status(400).json({ message: 'That payment method is not available yet.' });
    const lineItems = [];
    for (const item of items) {
      if (!mongoose.isValidObjectId(item.productId) || !Number.isInteger(item.quantity) || item.quantity < 1) throw Object.assign(new Error('Invalid product or quantity.'), { status: 400 });
      const product = await Product.findOneAndUpdate(
        { _id: item.productId, stock: { $gte: item.quantity } },
        { $inc: { stock: -item.quantity } },
        { new: true },
      );
      if (!product) throw Object.assign(new Error('A product is unavailable or has insufficient stock.'), { status: 409 });
      decremented.push({ id: product.id, quantity: item.quantity });
      lineItems.push({ product: product.id, name: product.name, image: product.images[0] || '', price: product.discountPrice ?? product.price, quantity: item.quantity });
    }
    const subtotal = lineItems.reduce((total, item) => total + item.price * item.quantity, 0);
    const shippingAmount = subtotal >= 75 ? 0 : 9;
    const totalAmount = subtotal + shippingAmount;
    const order = await Order.create({ user: req.user.id, products: lineItems, totalAmount, shippingAmount, shippingAddress, paymentMethod });
    res.status(201).json({ order });
  } catch (error) {
    await Promise.all(decremented.map((item) => Product.updateOne({ _id: item.id }, { $inc: { stock: item.quantity } })));
    next(error);
  }
});

router.get('/my-orders', authenticate, async (req, res, next) => {
  try { res.json({ orders: await Order.find({ user: req.user.id }).sort({ createdAt: -1 }) }); }
  catch (error) { next(error); }
});
router.get('/', ...admin, async (_req, res, next) => {
  try { res.json({ orders: await Order.find().populate('user', 'name email').sort({ createdAt: -1 }) }); }
  catch (error) { next(error); }
});
router.put('/:id/status', ...admin, async (req, res, next) => {
  try {
    const allowed = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!allowed.includes(req.body.orderStatus)) return res.status(400).json({ message: 'Invalid order status.' });
    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, orderStatus: { $nin: ['cancelled', 'delivered'] } },
      { $set: { orderStatus: req.body.orderStatus } },
      { new: true },
    );
    if (!order) {
      if (!await Order.exists({ _id: req.params.id })) return res.status(404).json({ message: 'Order not found.' });
      return res.status(409).json({ message: 'This order can no longer be changed.' });
    }
    if (req.body.orderStatus === 'cancelled') await Promise.all(order.products.map((item) => Product.updateOne({ _id: item.product }, { $inc: { stock: item.quantity } })));
    res.json({ order });
  } catch (error) { next(error); }
});
module.exports = router;