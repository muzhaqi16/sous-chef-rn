/**
 * Region → currency, for the currencies the API offers. Keyed on REGION, never
 * on language: the app ships four languages against eleven currencies and the
 * mapping between them is many-to-many — Spanish spans USD and EUR, English
 * spans five, and only Albanian maps cleanly to one.
 */
const REGION_CURRENCY: Record<string, string> = {
  // EUR — the eurozone, plus the states that adopted it.
  AD: 'EUR',
  AT: 'EUR',
  BE: 'EUR',
  CY: 'EUR',
  DE: 'EUR',
  EE: 'EUR',
  ES: 'EUR',
  FI: 'EUR',
  FR: 'EUR',
  GR: 'EUR',
  HR: 'EUR',
  IE: 'EUR',
  IT: 'EUR',
  LT: 'EUR',
  LU: 'EUR',
  LV: 'EUR',
  MC: 'EUR',
  ME: 'EUR',
  MT: 'EUR',
  NL: 'EUR',
  PT: 'EUR',
  SI: 'EUR',
  SK: 'EUR',
  SM: 'EUR',
  VA: 'EUR',
  XK: 'EUR',
  // USD — the United States, its territories, and the dollarized economies.
  AS: 'USD',
  BQ: 'USD',
  EC: 'USD',
  GU: 'USD',
  MP: 'USD',
  PA: 'USD',
  PR: 'USD',
  SV: 'USD',
  TL: 'USD',
  US: 'USD',
  VI: 'USD',
  ZW: 'USD',
  // AUD, and the Pacific states using it.
  AU: 'AUD',
  CC: 'AUD',
  CX: 'AUD',
  KI: 'AUD',
  NF: 'AUD',
  NR: 'AUD',
  TV: 'AUD',
  // NZD, and the realms using it.
  CK: 'NZD',
  NU: 'NZD',
  NZ: 'NZD',
  PN: 'NZD',
  TK: 'NZD',
  AL: 'LEK',
  CA: 'CAD',
  CH: 'CHF',
  CN: 'CNY',
  GB: 'GBP',
  JP: 'JPY',
  LI: 'CHF',
  SE: 'SEK',
};

/**
 * This device's region, from the resolved locale. Absent when the user's
 * language carries no region ("sq" rather than "sq-AL"), which is why every
 * caller needs a fallback rather than a guess.
 */
export function deviceRegion(): string | null {
  let locale = '';
  try {
    locale = Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return null;
  }

  // "en-US" / "sq-AL" / "zh-Hans-CN" — the region is the 2-letter subtag.
  const match = /(?:^|-)([A-Z]{2})(?:-|$)/.exec(locale);
  if (!match) return null;
  return match[1];
}

/**
 * The currency to record new costs in on a device we have not been told about.
 * Null when the region is unknown or uses a currency the API does not offer —
 * the account then keeps whatever the server chose, rather than being moved to
 * a currency that is merely nearby.
 */
export function deviceRegionCurrency(): string | null {
  const region = deviceRegion();
  if (!region) return null;
  return REGION_CURRENCY[region] ?? null;
}

/**
 * True when the account has never been denominated. Absence is the only signal:
 * `User.preferredCurrency` is nullable, and a stored code cannot say whether it
 * was chosen or defaulted — reading the app's own default as "unchosen" moves
 * an account whose holder deliberately picked it.
 */
export function isUnchosenCurrency(code: string | null | undefined): boolean {
  return !code;
}
