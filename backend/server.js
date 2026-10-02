require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { connectToDatabase } = require('./config/database');

const app = express();
function reqCatalog(req) { return (req.method === 'POST' && req.path === '/products/quote') || req.method === 'GET' && (req.path === '/products' || req.path === '/categories' || /^\/products\/[^/]+$/.test(req.path)); }
const allowedOrigins = (process.env.CLIENT_URL || '')
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter((origin) => origin && origin !== '*');
if (process.env.NODE_ENV !== 'production') allowedOrigins.push('http://localhost:3000');

app.use(helmet());
app.use(cors({ origin: allowedOrigins, credentials: true }));
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/shopify/webhooks', require('./routes/shopifyWebhook'));
app.use('/api', async (_req, _res, next) => {
  if (process.env.NODE_ENV === 'test' || (reqCatalog(_req))) return next();
  try { await connectToDatabase(); next(); }
  catch (error) { next(error); }
});
app.use(express.json({ limit: '1mb' }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/shopify', require('./routes/shopify'));
app.use('/api/contact', require('./routes/contact'));
app.use('/api/admin', require('./routes/admin'));
app.use((req, res) => res.status(404).json({ message: `Route ${req.method} ${req.path} not found.` }));
app.use((error, _req, res, _next) => {
  const status = error.status || (error.name === 'ValidationError' ? 400 : error.code === 11000 ? 409 : 500);
  const message = status === 500 ? 'Something went wrong on the server.' : error.message;
  if (status === 500) console.error('API request failed:', error.name || 'Error');
  res.status(status).json({ message });
});

async function start() {
  if (!process.env.MONGODB_URI || !process.env.JWT_SECRET) throw new Error('MONGODB_URI and JWT_SECRET must be configured.');
  await connectToDatabase();
  const port = Number(process.env.PORT) || 4000;
  app.listen(port, () => console.log(`Tech Hub API listening on port ${port}`));
}

if (require.main === module) start().catch(() => {
  console.error('Tech Hub API failed to start. Check required environment variables and database connectivity.');
  process.exit(1);
});
module.exports = app;
