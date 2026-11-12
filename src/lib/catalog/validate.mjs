export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAX_PRICE_CENTS = 9007199254740991n; // Exact JSON integer; narrower than bigint.
const text = (value, label, max, required = true) => {
  if (typeof value !== "string") throw new Error(`${label} is required.`);
  const result = value.trim();
  if ((required && !result) || result.length > max) throw new Error(`${label} must be ${required ? "1" : "0"}–${max} characters.`);
  return result;
};
export function priceCents(value) {
  const price = text(value, "Price", 30);
  if (!/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(price)) throw new Error("Price must be nonnegative with at most two decimal places.");
  const [whole, fraction = ""] = price.split(".");
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  if (cents > MAX_PRICE_CENTS) throw new Error("Price exceeds the supported exact-integer limit.");
  return Number(cents);
}
export function decimalPrice(cents) {
  if (!Number.isSafeInteger(cents) || cents < 0) return "";
  const integer = BigInt(cents);
  return `${integer / 100n}.${String(integer % 100n).padStart(2, "0")}`;
}
export function validateProduct(input) {
  const name = text(input.name, "Name", 200);
  const slug = text(input.slug, "Slug", 160);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error("Slug must use lowercase letters, numbers and single hyphens.");
  const description = text(input.description ?? "", "Description", 10000, false);
  const category = input.category_id;
  if (typeof category !== "string" || (category && !UUID.test(category))) throw new Error("Select a valid category.");
  if (typeof input.is_published !== "boolean") throw new Error("Choose a publication status.");
  return { name, slug, description, category_id: category || null, is_published: input.is_published };
}
export function validateVariant(input) {
  if (!input || typeof input !== "object") throw new Error("Each variant must contain valid fields.");
  const size = text(input.size, "Size", 60);
  const color = text(input.color, "Color", 60);
  const sku = text(input.sku, "SKU", 100);
  const stock = text(input.stock_quantity, "Stock", 10);
  if (!/^(0|[1-9]\d*)$/.test(stock) || BigInt(stock) > 2147483647n) throw new Error("Stock must be an integer from 0 to 2147483647.");
  if (typeof input.is_published !== "boolean") throw new Error("Choose a publication status.");
  return { size, color, sku, price_cents: priceCents(input.price), stock_quantity: Number(stock), is_published: input.is_published };
}
export function validateVariants(input) {
  if (!Array.isArray(input) || input.length < 1 || input.length > 20) throw new Error("Add between 1 and 20 variants.");
  const rows = input.map(validateVariant);
  const combinations = new Set();
  const skus = new Set();
  for (const row of rows) {
    const combination = JSON.stringify([row.size.toLowerCase(), row.color.toLowerCase()]);
    const sku = row.sku.toLowerCase();
    if (combinations.has(combination) || skus.has(sku)) throw new Error("Each variant needs a unique SKU and size/color combination.");
    combinations.add(combination); skus.add(sku);
  }
  return rows;
}
