// The verified field is price_cents; divide by 100, not by a guessed currency exponent.
export function formatPrice(cents, currency) {
  if (!Number.isSafeInteger(cents) || cents < 0) return "Price unavailable";
  if (!/^[A-Z]{3}$/.test(currency)) return `${(cents / 100).toFixed(2)} (currency unavailable)`;
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} (currency unavailable)`;
  }
}
