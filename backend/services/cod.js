const { adminRequest, checkPayload } = require('./catalog');
function validateAddress(address) {
  return address && ['fullName','phone','email','address','city','postalCode']
    .every(field => typeof address[field] === 'string' && address[field].trim());
}
async function createCodOrder(order) {
  const address = order.shippingAddress;
  const currencyCode = order.currencyCode;
  const data = await adminRequest(`mutation CreateCodOrder($order: OrderCreateOrderInput!, $options: OrderCreateOptionsInput) {
    orderCreate(order: $order, options: $options) {
      order { id name totalPriceSet { presentmentMoney { amount currencyCode } } }
      userErrors { field message }
    } }`, {
    order: {
      financialStatus: 'PENDING', currency: currencyCode, presentmentCurrency: currencyCode,
      email: address.email, note: 'Tech Hub cash on delivery', tags: ['tech-hub', 'cash-on-delivery', 'tech-hub-cod-' + order.id],
      sourceIdentifier: order.id, customAttributes: [{ key: 'tech_hub_cod_order_id', value: order.id }],
      shippingAddress: { firstName: address.fullName, phone: address.phone, address1: address.address,
        city: address.city, zip: address.postalCode, countryCode: process.env.SHOPIFY_COD_COUNTRY_CODE || 'BD' },
      lineItems: order.products.map(line => ({ variantId: line.variantId, quantity: line.quantity,
        priceSet: { shopMoney: { amount: String(line.price), currencyCode },
          presentmentMoney: { amount: String(line.price), currencyCode } } })),
      shippingLines: [{ title: 'Tech Hub delivery', priceSet: {
        shopMoney: { amount: String(order.shippingAmount), currencyCode },
        presentmentMoney: { amount: String(order.shippingAmount), currencyCode } } }],
    },
    options: { inventoryBehaviour: 'DECREMENT_OBEYING_POLICY', sendReceipt: false, sendFulfillmentReceipt: false },
  });
  if (data.orderCreate?.order && data.orderCreate.userErrors?.length) throw Object.assign(new Error('COD creation needs review. Retry using the same request ID.'), { status: 502 });
  const result = checkPayload(data.orderCreate).order;
  if (!result) throw Object.assign(new Error('Shopify could not create the COD order.'), { status: 502 });
  return result;
}
async function findCodOrder(localId) {
  const data = await adminRequest(`query FindCodOrder($query: String!) {
    orders(first: 1, query: $query) { nodes { id name totalPriceSet { presentmentMoney { amount currencyCode } } } }
  }`, { query: 'tag:tech-hub-cod-' + localId });
  return data.orders.nodes[0] || null;
}
async function cancelCodOrder(id) {
  const existing = await adminRequest(`query CodOrderStatus($id: ID!) { order(id: $id) { cancelledAt } }`, { id });
  if (existing.order?.cancelledAt) return { done: true };
  const data = await adminRequest(`mutation CancelCodOrder($id: ID!) {
    orderCancel(orderId: $id, reason: CUSTOMER, restock: true, notifyCustomer: false,
      refundMethod: { originalPaymentMethodsRefund: false }) {
      job { id done } orderCancelUserErrors { field message } userErrors { field message }
    } }`, { id });
  const payload = checkPayload(data.orderCancel);
  // Shopify processes cancellation asynchronously; surface that state instead of claiming completion.
  return payload.job;
}
module.exports = { validateAddress, createCodOrder, cancelCodOrder, findCodOrder };
