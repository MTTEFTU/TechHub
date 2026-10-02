require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const { storefrontRequest } = require('../services/shopify');
const { PRODUCT_GID, VARIANT_GID } = require('../services/catalog');
// Explicit maintenance tool only. The live application never reads this collection.
async function migrate() {
  const apply = process.argv.includes('--apply');
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required.');
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const legacy = await db.collection('products').find({}).toArray();
  const mappings = new Map();
  for (const product of legacy) {
    let gid = product.shopifyProductId;
    if (!PRODUCT_GID.test(gid || '') && VARIANT_GID.test(product.shopifyVariantId || '')) {
      const data = await storefrontRequest(`query LegacyVariant($id: ID!) {
        node(id: $id) { ... on ProductVariant { product { id } } } }`, { id: product.shopifyVariantId });
      gid = data.node?.product?.id;
    }
    if (PRODUCT_GID.test(gid || '')) mappings.set(String(product._id), gid);
  }
  let reviews = 0, wishlists = 0, orderLines = 0, conflicts = 0;
  for (const [legacyId, gid] of mappings) {
    const oldIds = [new mongoose.Types.ObjectId(legacyId), legacyId];
    const docs = await db.collection('reviews').find({ product: { $in: oldIds } }).toArray();
    for (const review of docs) {
      reviews++;
      if (apply) {
        try { await db.collection('reviews').updateOne({ _id: review._id, product: review.product }, { $set: { product: gid } }); }
        catch (error) { if (error.code !== 11000) throw error; conflicts++; }
      }
    }
  }
  const users = await db.collection('users').find({ 'wishlist.0': { $exists: true } }).toArray();
  for (const user of users) {
    const wishlist = [...new Map(user.wishlist.map(id => {
      const value = mappings.get(String(id)) || id; return [String(value), value];
    })).values()];
    if (JSON.stringify(wishlist) !== JSON.stringify(user.wishlist)) {
      wishlists++;
      if (apply) await db.collection('users').updateOne({ _id: user._id, wishlist: user.wishlist }, { $set: { wishlist } });
    }
  }
  for (const collection of ['orders', 'shopifycheckouts']) {
    const field = collection === 'orders' ? 'products' : 'items';
    const docs = await db.collection(collection).find({ [field + '.0']: { $exists: true } }).toArray();
    for (const doc of docs) {
      let changed = false;
      const lines = doc[field].map(line => {
        const product = mappings.get(String(line.product));
        if (!product || product === String(line.product)) return line;
        changed = true; orderLines++;
        return { ...line, product };
      });
      if (apply && changed) await db.collection(collection).updateOne({ _id: doc._id, [field]: doc[field] }, { $set: { [field]: lines } });
    }
  }
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', legacyProducts: legacy.length,
    mappedProducts: mappings.size, unresolvedProductIds: legacy.filter(p => !mappings.has(String(p._id))).map(p => String(p._id)),
    reviews, wishlists, orderLines, reviewConflicts: conflicts }, null, 2));
}
if (require.main === module) migrate().catch(() => { console.error('Reference migration failed. Check database/Shopify connectivity and review the migration report.'); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
module.exports = { migrate };
