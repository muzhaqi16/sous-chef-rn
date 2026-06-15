/**
 * Strip a trailing price token (e.g. " $2.48") from an item / ingredient name.
 *
 * The API trusts client input verbatim — it does not clean names — so the
 * client is the gatekeeper: it must never send a price baked into a name. A
 * price can ride in on a name that was loaded from the backend (legacy data)
 * and round-tripped through an edit / add-to-list flow. This sanitizes the name
 * at the client→API boundary regardless of whether the source was clean.
 *
 * The price itself is intentionally discarded, not recovered — the canonical
 * price lives in the dedicated `estimatedPrice` field and is never derived from
 * the name (display reads `estimatedPrice` on its own line, never parses it out
 * of the name). The pattern mirrors the price token an older client used to
 * append: a single whitespace, "$", then up to 9 integer digits and an optional
 * ".dd" — anchored to the end so a legitimate name is never truncated.
 */
const TRAILING_PRICE_RE = /\s\$\d{1,9}\.?\d{0,2}$/;

export function stripPriceFromName(name: string): string {
  return name.trim().replace(TRAILING_PRICE_RE, '').trimEnd();
}
