const express = require('express');
const ContactMessage = require('../models/ContactMessage');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.post('/', async (req, res, next) => {
  try {
    const { name, email, subject, message } = req.body;
    if (!name?.trim() || !/^\S+@\S+\.\S+$/.test(email || '') || !subject?.trim() || !message?.trim()) return res.status(400).json({ message: 'Complete all required contact fields with a valid email.' });
    const saved = await ContactMessage.create(req.body);
    res.status(201).json({ message: 'Your message has been sent.', contact: saved });
  } catch (error) { next(error); }
});
router.get('/admin/messages', authenticate, requireAdmin, async (_req, res, next) => {
  try { res.json({ messages: await ContactMessage.find().sort({ createdAt: -1 }) }); }
  catch (error) { next(error); }
});
module.exports = router;