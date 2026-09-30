const express = require('express');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const ContactMessage = require('../models/ContactMessage');
const Review = require('../models/Review');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, requireAdmin);
router.get('/stats', async (_req, res, next) => {
  try {
    const [totalProducts, totalUsers, totalOrders, pendingOrders, completedOrders, lowStockProducts, sales] = await Promise.all([
      Product.countDocuments(), User.countDocuments({ role: 'user' }), Order.countDocuments(),
      Order.countDocuments({ orderStatus: 'pending' }), Order.countDocuments({ orderStatus: 'delivered' }),
      Product.countDocuments({ stock: { $lt: 5 } }),
      Order.aggregate([{ $match: { orderStatus: { $ne: 'cancelled' } } }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }]),
    ]);
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
  try { res.json({ reviews: await Review.find().populate('user', 'name email').populate('product', 'name').sort({ createdAt: -1 }) }); }
  catch (error) { next(error); }
});
router.delete('/reviews/:id', async (req, res, next) => {
  try {
    const review = await Review.findByIdAndDelete(req.params.id);
    if (!review) return res.status(404).json({ message: 'Review not found.' });
    const average = await Review.aggregate([{ $match: { product: review.product } }, { $group: { _id: null, rating: { $avg: '$rating' } } }]);
    await Product.updateOne({ _id: review.product }, { $set: { rating: average[0]?.rating || 0 } });
    res.json({ message: 'Review removed.' });
  } catch (error) { next(error); }
});
module.exports = router;