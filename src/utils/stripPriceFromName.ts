/**
 * Strips a trailing price token (" $2.48") at the client→API boundary: the API
 * trusts names verbatim, and one loaded from the backend can carry a price in.
 * Discarded, not recovered — the canonical value is `estimatedPrice`. Anchored
 * to the end so a legitimate name is never truncated.
 */
const TRAILING_PRICE_RE = /\s\$\d{1,9}\.?\d{0,2}$/;

export function stripPriceFromName(name: string): string {
  return name.trim().replace(TRAILING_PRICE_RE, '').trimEnd();
}
