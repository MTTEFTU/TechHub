const express = require('express');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const ShopifyCheckout = require('../models/ShopifyCheckout');
const { verifyWebhook } = require('../services/shopify');
const { invalidateCatalog } = require('../services/catalog');
const router = express.Router();
function attributeValue(order, key) {
  return (order.note_attributes || order.custom_attributes || [])
    .find(attribute => attribute.name === key || attribute.key === key)?.value;
}
router.post('/', express.raw({ type: 'application/json', limit: '2mb' }), async (req, res, next) => {
  try {
    if (!Buffer.isBuffer(req.body) || !verifyWebhook(req.body, req.get('x-shopify-hmac-sha256')))
      return res.status(401).send('Invalid webhook signature');
    const topic = req.get('x-shopify-topic') || '';
    const webhookId = req.get('x-shopify-webhook-id') || '';
    const shopDomain = req.get('x-shopify-shop-domain') || '';
    const configuredDomain = (process.env.SHOPIFY_STORE_DOMAIN || '').replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();
    if (!configuredDomain || shopDomain.toLowerCase() !== configuredDomain) return res.status(401).send('Invalid shop domain');
    let payload;
    try { payload = JSON.parse(req.body.toString('utf8')); } catch { return res.status(400).send('Invalid JSON'); }
    if (['products/create','products/update','products/delete'].includes(topic)) {
      await invalidateCatalog();
      return res.status(200).send('Revalidated');
    }
    if (!['orders/paid','refunds/create'].includes(topic)) return res.status(200).send('Ignored');
    // Product notifications must remain independent of MongoDB.
    if (process.env.NODE_ENV !== 'test') await require('../config/database').connectToDatabase();
    const checkoutId = attributeValue(payload, 'tech_hub_checkout_id');
    let checkout = mongoose.isValidObjectId(checkoutId) ? await ShopifyCheckout.findById(checkoutId) : null;
    const existingOrder = await Order.findOne({ shopifyOrderId: { $in: [
      String(payload.order_id || payload.admin_graphql_api_id || payload.id),
      `gid://shopify/Order/${payload.order_id || payload.id}`,
    ] } });
    if (!checkout && existingOrder) checkout = await ShopifyCheckout.findOne({ order: existingOrder.id });
    if (!checkout) {
      if (existingOrder) {
        await Order.updateOne({ _id: existingOrder.id }, { $set: topic === 'orders/paid'
          ? { paymentStatus: 'paid', shopifyFinancialStatus: 'paid' }
          : { paymentStatus: 'refunded', shopifyFinancialStatus: 'refunded' } });
        return res.status(200).send('OK');
      }
      return res.status(200).send('Ignored');
    }
    if (webhookId && checkout.lastWebhookId === webhookId) return res.status(200).send('Already processed');
    if (topic === 'orders/paid') {
      const shopifyOrderId = String(payload.admin_graphql_api_id || `gid://shopify/Order/${payload.id}`);
      let order = existingOrder;
      if (!order) {
        // Use paid Shopify lines, including buyer changes made in Shopify Checkout.
        const products = (payload.line_items || []).map(line => ({
          product: line.product_id ? `gid://shopify/Product/${line.product_id}` : 'shopify-custom-line',
          variantId: line.variant_id ? `gid://shopify/ProductVariant/${line.variant_id}` : '',
          name: line.name || line.title, image: checkout.items.find(i => i.shopifyVariantId.endsWith('/' + line.variant_id))?.image || '',
          price: Number(line.price), quantity: line.quantity,
        }));
        if (!products.length || products.some(line => !line.name || !Number.isFinite(line.price) || !Number.isInteger(line.quantity) || line.quantity < 1))
          return res.status(400).send('Invalid paid order lines');
        const address = payload.shipping_address || {};
        const data = {
          user: checkout.user, products, totalAmount: Number(payload.total_price),
          currencyCode: payload.currency || '', shippingAmount: Number(payload.total_shipping_price_set?.shop_money?.amount || 0),
          shippingAddress: {
            fullName: address.name || checkout.shippingAddress.fullName, phone: address.phone || checkout.shippingAddress.phone,
            email: payload.email || checkout.shippingAddress.email,
            address: [address.address1,address.address2].filter(Boolean).join(', ') || checkout.shippingAddress.address,
            city: address.city || checkout.shippingAddress.city, postalCode: address.zip || checkout.shippingAddress.postalCode,
          },
          paymentMethod: 'shopify', paymentStatus: 'paid', orderStatus: 'confirmed',
          shopifyOrderId, shopifyOrderName: payload.name || '', shopifyCartId: checkout.shopifyCartId, shopifyFinancialStatus: 'paid',
        };
        try { order = await Order.create(data); }
        catch (error) {
          if (error.code !== 11000) throw error;
          order = await Order.findOne({ shopifyOrderId });
          if (!order) throw error;
        }
      }
      checkout.status = 'paid'; checkout.order = order.id;
      checkout.shopifyOrderId = shopifyOrderId; checkout.shopifyOrderName = payload.name || '';
    } else if (topic === 'refunds/create' && checkout.order) {
      await Order.updateOne({ _id: checkout.order }, { $set: { paymentStatus: 'refunded', shopifyFinancialStatus: 'refunded' } });
    }
    checkout.lastWebhookId = webhookId;
    await checkout.save();
    res.status(200).send('OK');
  } catch (error) { next(error); }
});
module.exports = router;
