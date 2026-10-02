const express = require('express');
const Review = require('../models/Review');
const catalog = require('../services/catalog');
const { authenticate, requireAdmin } = require('../middleware/auth');
const router = express.Router();
const admin = [authenticate, requireAdmin];
router.get('/', async (req, res, next) => {
  try { res.set('Cache-Control', 'no-store').json({ products: await catalog.listProducts(req.query) }); }
  catch (error) { next(error); }
});
router.post('/quote', async (req, res, next) => {
  try {
    const lines = await catalog.validateLines(req.body.items, req.body.countryCode, 'quote');
    res.set('Cache-Control', 'no-store').json({ products: lines.map(line => ({
      id: line.product, handle: line.handle, variantId: line.variantId, name: line.name,
      category: line.category, price: line.price, currencyCode: line.currencyCode,
      compareAtPrice: line.compareAtPrice, image: line.image || '/product-placeholder.svg', blurb: '',
      availableForSale: true, stock: line.stock, selectedOptions: line.selectedOptions,
    })) });
  } catch (error) { next(error); }
});
router.get('/:id/reviews', async (req, res, next) => {
  try { res.json({ reviews: await Review.find({ product: req.params.id }).populate('user', 'name').sort({ createdAt: -1 }).limit(20) }); }
  catch (error) { next(error); }
});
router.get('/:id', async (req, res, next) => {
  try {
    const product = await catalog.getProduct(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found.' });
    res.set('Cache-Control', 'no-store').json({ product, reviews: [], related: [] });
  } catch (error) { next(error); }
});
router.post('/', ...admin, async (req, res, next) => {
  try { res.status(201).json({ product: await catalog.saveProduct(null, req.body) }); }
  catch (error) { next(error); }
});
router.put('/:id', ...admin, async (req, res, next) => {
  try { res.json({ product: await catalog.saveProduct(req.params.id, req.body) }); }
  catch (error) { next(error); }
});
router.delete('/:id', ...admin, async (req, res, next) => {
  try { await catalog.deleteProduct(req.params.id); res.json({ message: 'Product deleted from Shopify.' }); }
  catch (error) { next(error); }
});
router.post('/:id/reviews', authenticate, async (req, res, next) => {
  try {
    const rating = Number(req.body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ message: 'Rating must be between 1 and 5.' });
    const product = await catalog.getProduct(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found.' });
    const review = await Review.create({ user: req.user.id, product: product._id, rating, comment: req.body.comment || '' });
    res.status(201).json({ review });
  } catch (error) { next(error); }
});
module.exports = router;
