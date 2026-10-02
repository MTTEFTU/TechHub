const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { getProduct } = require('../services/catalog');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const publicUser = (user) => ({ id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role });
const createToken = (user) => jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, phone, password } = req.body;
    if (!name?.trim() || !/^\S+@\S+\.\S+$/.test(email || '') || (password || '').length < 8) {
      return res.status(400).json({ message: 'Enter a name, valid email, and password with at least 8 characters.' });
    }
    if (await User.exists({ email: email.toLowerCase().trim() })) return res.status(409).json({ message: 'An account with that email already exists.' });
    const user = await User.create({ name, email, phone, password: await bcrypt.hash(password, 12) });
    res.status(201).json({ token: createToken(user), user: publicUser(user) });
  } catch (error) { next(error); }
});

router.post('/login', async (req, res, next) => {
  try {
    const user = await User.findOne({ email: (req.body.email || '').toLowerCase().trim() }).select('+password');
    if (!user || !(await bcrypt.compare(req.body.password || '', user.password))) return res.status(401).json({ message: 'Email or password is incorrect.' });
    res.json({ token: createToken(user), user: publicUser(user) });
  } catch (error) { next(error); }
});

router.get('/profile', authenticate, (req, res) => res.json({ user: publicUser(req.user) }));
router.put('/profile', authenticate, async (req, res, next) => {
  try {
    const { name, phone } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Name is required.' });
    req.user.name = name.trim();
    req.user.phone = phone || '';
    await req.user.save();
    res.json({ user: publicUser(req.user) });
  } catch (error) { next(error); }
});

router.get('/wishlist', authenticate, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    const products = await Promise.all(user.wishlist.filter(id => String(id).startsWith('gid://shopify/Product/')).map(id => getProduct(String(id))));
    res.json({ products: products.filter(Boolean) });
  } catch (error) { next(error); }
});
router.put('/wishlist/:productId', authenticate, async (req, res, next) => {
  try {
    const product = await getProduct(req.params.productId);
    if (!product) return res.status(404).json({ message: 'Product not found.' });
    const user = await User.findById(req.user.id);
    const index = user.wishlist.findIndex((id) => id.toString() === product._id);
    const added = index < 0;
    if (added) user.wishlist.push(product._id);
    else user.wishlist.splice(index, 1);
    await user.save();
    res.json({ added, productId: req.params.productId });
  } catch (error) { next(error); }
});

module.exports = router;