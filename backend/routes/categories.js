const express = require('express');
const { listProducts } = require('../services/catalog');
const router = express.Router();
router.get('/', async (_req, res, next) => {
  try {
    const products = await listProducts();
    const categories = [...new Set(products.map(p => p.productType).filter(Boolean))].sort().map(name => ({ _id: name, name }));
    res.json({ categories });
  } catch (error) { next(error); }
});
module.exports = router;
