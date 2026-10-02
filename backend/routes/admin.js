const express = require('express');
const User = require('../models/User');
const { listProducts } = require('../services/catalog');
const Order = require('../models/Order');
const ContactMessage = require('../models/ContactMessage');
const Review = require('../models/Review');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, requireAdmin);
router.get('/products', async (_req, res, next) => {
  try { res.json({ products: await listProducts({}, true) }); } catch (error) { next(error); }
});
router.get('/stats', async (_req, res, next) => {
  try {
    const [products, totalUsers, totalOrders, pendingOrders, completedOrders, sales] = await Promise.all([
      listProducts({}, true), User.countDocuments({ role: 'user' }), Order.countDocuments({ creationStatus: { $nin: ['creating', 'failed'] } }),
      Order.countDocuments({ orderStatus: 'pending', creationStatus: { $nin: ['creating', 'failed'] } }), Order.countDocuments({ orderStatus: 'delivered' }),
      Order.aggregate([{ $match: { orderStatus: { $ne: 'cancelled' }, creationStatus: { $nin: ['creating', 'failed'] } } }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }]),
    ]);
    const totalProducts = products.length;
    const lowStockProducts = products.filter(p => p.variants.some(v => v.quantityAvailable !== null && v.quantityAvailable < 5)).length;
    res.json({ stats: { totalProducts, totalUsers, totalOrders, pendingOrders, completedOrders, lowStockProducts, totalSales: sales[0]?.total || 0 } });
  } catch (error) { next(error); }
});
router.get('/users', async (_req, res, next) => {
  try { res.json({ users: await User.find().select('-password').sort({ createdAt: -1 }) }); }
  catch (error) { next(error); }
});
router.delete('/users/:id', async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) return res.status(400).json({ message: 'You cannot delete your own admin account.' });
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json({ message: 'User deleted.' });
  } catch (error) { next(error); }
});
router.get('/messages', async (_req, res, next) => {
  try { res.json({ messages: await ContactMessage.find().sort({ createdAt: -1 }) }); }
  catch (error) { next(error); }
});
router.get('/reviews', async (_req, res, next) => {
  try {
    const [reviews, products] = await Promise.all([Review.find().populate('user', 'name email').sort({ createdAt: -1 }), listProducts({}, true)]);
    const byId = new Map(products.map(p => [p._id, p.name]));
    res.json({ reviews: reviews.map(review => ({ ...review.toObject(), product: { name: byId.get(String(review.product)) || 'Archived product' } })) });
  }
  catch (error) { next(error); }
});
router.delete('/reviews/:id', async (req, res, next) => {
  try {
    const review = await Review.findByIdAndDelete(req.params.id);
    if (!review) return res.status(404).json({ message: 'Review not found.' });
    res.json({ message: 'Review removed.' });
  } catch (error) { next(error); }
});
module.exports = router;