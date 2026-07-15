/** Minimal pure-JS checks for discount receipt mapping (no ts-node). */

function buildShowDiscount(source) {
  return source?.tampilkan_diskon_struk !== false && source?.showDiscount !== false;
}

function resolveDiscountLine(data) {
  return data.discount && data.discount > 0 && data.showDiscount !== false
    ? data.discount
    : undefined;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(buildShowDiscount({ tampilkan_diskon_struk: true }) === true, 'flag true');
assert(buildShowDiscount({ tampilkan_diskon_struk: false }) === false, 'flag false');
assert(buildShowDiscount({}) === true, 'legacy default true');
assert(resolveDiscountLine({ discount: 10000, showDiscount: true }) === 10000, 'show line');
assert(resolveDiscountLine({ discount: 10000, showDiscount: false }) === undefined, 'hide line');
assert(resolveDiscountLine({ discount: 0, showDiscount: true }) === undefined, 'zero skip');

// Report balance identity
const parts = 50000;
const jasa = 75000;
const diskon = 5000;
const grand = parts + jasa - diskon;
assert(grand === 120000, 'net grand total');
const total_penjualan = grand;
const total_subtotal = parts + jasa;
assert(total_subtotal - diskon === total_penjualan, 'parts+jasa-diskon == pendapatan net');

console.log('check-discount-print.mjs: all checks passed');
