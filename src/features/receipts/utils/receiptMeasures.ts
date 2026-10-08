// The units a receipt states a pack size or weight in. `ea` and `each` count
// rather than measure, so a code before one (a PLU's `4046 EA`) stays a code.
const PACK_UNITS = 'lbs?|kg|g|oz|fl\\.?\\s?oz|l|ml|ct|pk|pkg|gal|qt|pt|dz|doz';

/**
 * Follows a digit run that is a pack size (`1750ML`, `2000 G`), not a code.
 * Compile with the `i` flag.
 */
export const NOT_BEFORE_PACK_UNIT = `(?!\\s?(?:${PACK_UNITS})\\b)`;
