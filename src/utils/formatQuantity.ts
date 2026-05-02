/**
 * Shared quantity formatting utilities.
 *
 * Previously duplicated across QuantityBadge, QuantityEditSheet,
 * ConsumePantryItemModal, RecordWastePantryItemModal, RestockPantryItemModal,
 * and usePantryItemTransformation.
 */

/**
 * Format a numeric quantity to at most 2 decimal places, stripping trailing zeros.
 *
 * Examples: 3 → "3", 1.50 → "1.5", 0.333 → "0.33"
 */
export function formatQuantity(value: number): string {
  if (Number.isInteger(value)) return value.toString();
  return value.toFixed(2).replace(/\.?0+$/, '');
}

/**
 * Format quantity for primary display with optional g→kg / ml→L upscaling.
 *
 * Examples: 1500g → "1.5kg", 3 pc → "3 pc"
 */
export function formatQuantityDisplay(quantity: number, unit?: string): string {
  const unitStr = unit || '';
  if (quantity >= 1000 && (unitStr === 'g' || unitStr === 'ml')) {
    return `${(quantity / 1000).toFixed(1)}${unitStr === 'g' ? 'kg' : 'L'}`;
  }
  if (Number.isInteger(quantity)) {
    return `${quantity} ${unitStr}`.trim();
  }
  return `${quantity.toFixed(quantity < 10 ? 2 : 1)} ${unitStr}`.trim();
}

/**
 * Format a quantity as a fraction or mixed number when possible.
 *
 * Examples: 0.5 → "1/2", 1.25 → "1 1/4", 2.7 → "2.7"
 */
/**
 * Get display text for a unit, preferring symbol over name.
 */
export function getUnitDisplayText(
  unit?: { symbol?: string; name?: string } | null,
): string {
  return unit?.symbol || unit?.name || '';
}

/**
 * Format a quantity as a fraction or mixed number when possible.
 *
 * Examples: 0.5 → "1/2", 1.25 → "1 1/4", 2.7 → "2.7"
 */
export function formatQuantityAsFraction(qty: number): string {
  if (qty == null) return '0';
  if (qty === 0) return '0';
  if (Number.isInteger(qty)) return qty.toString();

  const whole = Math.floor(qty);
  const fractional = qty - whole;

  // Common fractions with tolerance-based matching for floating point
  const commonFractions = [
    { value: 0.125, display: '1/8' },
    { value: 0.25, display: '1/4' },
    { value: 1 / 3, display: '1/3' },
    { value: 0.375, display: '3/8' },
    { value: 0.5, display: '1/2' },
    { value: 0.625, display: '5/8' },
    { value: 2 / 3, display: '2/3' },
    { value: 0.75, display: '3/4' },
    { value: 0.875, display: '7/8' },
  ];

  const tolerance = 0.02; // Allow small floating point differences
  const matchedFraction = commonFractions.find(
    f => Math.abs(fractional - f.value) < tolerance,
  );

  if (matchedFraction) {
    return whole === 0
      ? matchedFraction.display
      : `${whole} ${matchedFraction.display}`;
  }

  // Fall back to decimal with smart formatting
  const formatted = qty.toFixed(2).replace(/\.?0+$/, '');
  return formatted || '0';
}
