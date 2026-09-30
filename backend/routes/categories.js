const express = require('express');
const Category = require('../models/Category');
const Product = require('../models/Product');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.get('/', async (_req, res, next) => {
  try { res.json({ categories: await Category.find().sort({ name: 1 }) }); }
  catch (error) { next(error); }
});
router.post('/', authenticate, requireAdmin, async (req, res, next) => {
  try { res.status(201).json({ category: await Category.create(req.body) }); }
  catch (error) { next(error); }
});
router.put('/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const category = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!category) return res.status(404).json({ message: 'Category not found.' });
    res.json({ category });
  } catch (error) { next(error); }
});
router.delete('/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ message: 'Category not found.' });
    if (await Product.exists({ category: category.name })) return res.status(409).json({ message: 'Move or remove products in this category first.' });
    await category.deleteOne();
    res.json({ message: 'Category deleted.' });
  } catch (error) { next(error); }
});
module.exports = router;