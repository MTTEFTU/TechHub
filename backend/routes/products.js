const express = require('express');
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Review = require('../models/Review');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();
const admin = [authenticate, requireAdmin];

router.get('/', async (req, res, next) => {
  try {
    const { search, category, minPrice, maxPrice, inStock, featured, sort } = req.query;
    const filter = {};
    if (search) filter.$text = { $search: search };
    if (category) filter.category = category;
    if (inStock === 'true') filter.stock = { $gt: 0 };
    if (featured === 'true') filter.featured = true;
    if (minPrice || maxPrice) filter.price = { ...(minPrice && { $gte: Number(minPrice) }), ...(maxPrice && { $lte: Number(maxPrice) }) };
    const sortMap = { 'price-asc': { price: 1 }, 'price-desc': { price: -1 }, rating: { rating: -1 }, newest: { createdAt: -1 } };
    const products = await Product.find(filter).sort(sortMap[sort] || { featured: -1, createdAt: -1 }).limit(100);
    res.json({ products });
  } catch (error) { next(error); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const product = mongoose.isValidObjectId(req.params.id)
      ? await Product.findById(req.params.id)
      : await Product.findOne({ slug: req.params.id });
    if (!product) return res.status(404).json({ message: 'Product not found.' });
    const [reviews, related] = await Promise.all([
      Review.find({ product: product.id }).populate('user', 'name').sort({ createdAt: -1 }).limit(20),
      Product.find({ category: product.category, _id: { $ne: product.id } }).limit(4),
    ]);
    res.json({ product, reviews, related });
  } catch (error) { next(error); }
});

router.post('/', ...admin, async (req, res, next) => {
  try { res.status(201).json({ product: await Product.create(req.body) }); }
  catch (error) { next(error); }
});
router.put('/:id', ...admin, async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!product) return res.status(404).json({ message: 'Product not found.' });
    res.json({ product });
  } catch (error) { next(error); }
});
router.delete('/:id', ...admin, async (req, res, next) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found.' });
    res.json({ message: 'Product deleted.' });
  } catch (error) { next(error); }
});

router.post('/:id/reviews', authenticate, async (req, res, next) => {
  try {
    const rating = Number(req.body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ message: 'Rating must be between 1 and 5.' });
    if (!await Product.exists({ _id: req.params.id })) return res.status(404).json({ message: 'Product not found.' });
    const review = await Review.create({ user: req.user.id, product: req.params.id, rating, comment: req.body.comment || '' });
    const average = await Review.aggregate([{ $match: { product: new mongoose.Types.ObjectId(req.params.id) } }, { $group: { _id: null, rating: { $avg: '$rating' } } }]);
    await Product.updateOne({ _id: req.params.id }, { $set: { rating: average[0]?.rating || 0 } });
    res.status(201).json({ review });
  } catch (error) { next(error); }
});

module.exports = router;