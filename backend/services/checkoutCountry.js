// ISO 3166-1 alpha-2 countries supported by Shopify CountryCode.
// Shared with the UI; deliberately excludes Shopify's unknown/legacy/non-ISO values.
const countryCodes = new Set(require('../data/checkout-countries.json'));
function validateCountryCode(value) {
  if (typeof value !== 'string' || !countryCodes.has(value)) {
    throw Object.assign(new Error('Select a valid shipping country.'), { status: 400 });
  }
  return value;
}
module.exports = { validateCountryCode };
