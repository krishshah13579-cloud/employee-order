/**
 * Psychological / Charm Pricing Rounding Rules
 *
 * Requirements:
 * - Prices end in 99 or 49 (e.g. 1999, 1549, 1299, 1249).
 * - If last 2 digits are between 75 and 25 (e.g. 1275 to 1325) -> ends in 99 (e.g. 1299).
 * - If last 2 digits are between 26 and 74 (e.g. 1226 to 1274) -> ends in 49 (e.g. 1249).
 */
export function roundToPsychologicalPrice(rawPrice: number): number {
  if (rawPrice <= 0) return 0;
  const rounded = Math.round(rawPrice);
  const lastTwo = rounded % 100;
  const hundreds = Math.floor(rounded / 100);

  if (lastTwo >= 75) {
    // 75 to 99: e.g. 1275 -> 1299, 1290 -> 1299
    return hundreds * 100 + 99;
  } else if (lastTwo <= 25) {
    // 00 to 25: e.g. 1300 -> 1299, 1325 -> 1299
    return Math.max(99, (hundreds - 1) * 100 + 99);
  } else {
    // 26 to 74: e.g. 1226 -> 1249, 1250 -> 1249, 1274 -> 1249
    return hundreds * 100 + 49;
  }
}

/**
 * Calculates discounted price with psychological 99/49 rounding
 * @param basePrice Original or comparePrice (e.g. 1999)
 * @param discountPercentage Discount (e.g. 25 or 35)
 */
export function calculateDiscountedPrice(basePrice: number, discountPercentage: number): number {
  if (!basePrice || basePrice <= 0) return 0;
  if (!discountPercentage || discountPercentage <= 0) return basePrice;
  const rawDiscounted = basePrice * (1 - discountPercentage / 100);
  return roundToPsychologicalPrice(rawDiscounted);
}
