const express = require('express');
const Order = require('../models/Order');
const Product = require('../models/Product');
const ShopifyCheckout = require('../models/ShopifyCheckout');
const { verifyWebhook } = require('../services/shopify');

const router = express.Router();

function attributeValue(order, key) {
  const attributes = order.note_attributes || order.custom_attributes || [];
  return attributes.find((attribute) => attribute.name === key || attribute.key === key)?.value;
}

router.post('/', express.raw({ type: 'application/json', limit: '2mb' }), async (req, res, next) => {
  try {
    if (!verifyWebhook(req.body, req.get('x-shopify-hmac-sha256'))) return res.status(401).send('Invalid webhook signature');
    const topic = req.get('x-shopify-topic') || '';
    const webhookId = req.get('x-shopify-webhook-id') || '';
    const shopDomain = req.get('x-shopify-shop-domain') || '';
    const configuredDomain = (process.env.SHOPIFY_STORE_DOMAIN || '').replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();
    if (configuredDomain && shopDomain.toLowerCase() !== configuredDomain) return res.status(401).send('Invalid shop domain');
    const payload = JSON.parse(req.body.toString('utf8'));
    const checkoutId = attributeValue(payload, 'tech_hub_checkout_id');
    let checkout = checkoutId ? await ShopifyCheckout.findById(checkoutId) : null;
    if (!checkout && topic === 'refunds/create' && payload.order_id) {
      const existingOrder = await Order.findOne({ shopifyOrderId: { $in: [String(payload.order_id), `gid://shopify/Order/${payload.order_id}`] } });
      if (existingOrder) checkout = await ShopifyCheckout.findOne({ order: existingOrder.id });
    }
    if (!checkout) return res.status(200).send('Ignored');
    if (webhookId && checkout.lastWebhookId === webhookId) return res.status(200).send('Already processed');

    if (topic === 'orders/paid') {
      const shopifyOrderId = String(payload.admin_graphql_api_id || payload.id);
      let order = await Order.findOne({ shopifyOrderId });
      if (!order) {
        const products = await Product.find({ _id: { $in: checkout.items.map((item) => item.product) } });
        const byId = new Map(products.map((product) => [product.id, product]));
        const lineItems = checkout.items.map((item) => {
          const product = byId.get(String(item.product));
          if (!product) throw Object.assign(new Error('Mapped product no longer exists.'), { status: 409 });
          const shopifyLine = (payload.line_items || []).find((line) => String(line.variant_id) === item.shopifyVariantId.split('/').pop());
          const unitPrice = shopifyLine ? Number(shopifyLine.price) : 0;
          return { product: product.id, name: shopifyLine?.name || product.name, image: product.images[0] || '', price: unitPrice, quantity: item.quantity };
        });
        const shopifyAddress = payload.shipping_address || {};
        order = await Order.create({
          user: checkout.user, products: lineItems,
          totalAmount: Number(payload.total_price || 0),
          shippingAmount: Number(payload.total_shipping_price_set?.shop_money?.amount || 0),
          shippingAddress: {
            fullName: shopifyAddress.name || checkout.shippingAddress.fullName,
            phone: shopifyAddress.phone || checkout.shippingAddress.phone,
            email: payload.email || checkout.shippingAddress.email,
            address: [shopifyAddress.address1, shopifyAddress.address2].filter(Boolean).join(', ') || checkout.shippingAddress.address,
            city: shopifyAddress.city || checkout.shippingAddress.city,
            postalCode: shopifyAddress.zip || checkout.shippingAddress.postalCode,
          },
          paymentMethod: 'shopify', paymentStatus: 'paid', orderStatus: 'confirmed',
          shopifyOrderId, shopifyOrderName: payload.name || '', shopifyCartId: checkout.shopifyCartId,
          shopifyFinancialStatus: payload.financial_status || 'paid',
        });
        await Promise.all(checkout.items.map((item) => Product.updateOne({ _id: item.product }, { $inc: { stock: -item.quantity } })));
      }
      checkout.status = 'paid'; checkout.order = order.id; checkout.shopifyOrderId = shopifyOrderId; checkout.shopifyOrderName = payload.name || '';
    } else if (topic === 'refunds/create' && checkout.order) {
      await Order.updateOne({ _id: checkout.order }, { $set: { paymentStatus: 'refunded', shopifyFinancialStatus: 'refunded' } });
    }
    checkout.lastWebhookId = webhookId;
    await checkout.save();
    res.status(200).send('OK');
  } catch (error) { next(error); }
});

module.exports = router;
