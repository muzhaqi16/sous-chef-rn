/**
 * Payment and loyalty details never leave the phone: a line carrying one is
 * dropped whole, and everything after the payment block's change or balance
 * line is cut. A deny-list, so what survives is predictable and tested per chain
 * (`__tests__/redactReceiptText.test.ts`); the API re-applies it as defence in
 * depth.
 */

// `************4242`, `XXXX XXXX XXXX 4242`, `#####42`.
const MASKED_CARD = /[*Xx#•]{4,}[\s-]*\d{2,4}\b/;

// Target's `*4242 DEBIT`: a short star mask needs all four digits and no
// decimals, so a price marked `*12.99` survives.
const STARRED_LAST_FOUR = /(?:^|\s)[*•]{1,3}\d{4}\b(?![.,]\d)/;

// A full card number: 16–19 digits, optionally in groups. Item codes (UPC, EAN,
// PLU) are at most 14 digits.
const CARD_DIGITS = /\b(?:\d[ -]?){15,18}\d\b/;

// A label that names only a payment field, whatever follows it.
const PAYMENT_LABEL =
  /^\W*(?:AUTH(?:ORIZATION)?|APPROVAL|APPROVED|APPR|ARQC|TVR|TSI|IAD|AAC|CVM)(?![A-Z])/i;

// A label that is a payment field only with an identifier after it, so an item
// such as `TRACE MINERALS` or `AIDELLS SAUSAGE` survives.
const PAYMENT_ID =
  /^\W*(?:REF(?:ERENCE)?|TRACE|AID|ATC|SEQ|TRANS?(?:ACTION)?\s*ID|TERMINAL|TERM|MID|TID|MERCHANT\s*(?:ID|#)|APP|VALIDATION)\s*(?:#|NO\.?|NUM(?:BER)?|ID)?\s*[:#-]?\s*[A-Z0-9]*\d/i;

const AUTH_CODE_ANYWHERE =
  /\b(?:AUTH(?:ORIZATION)?|APPROVAL|APPR)\s*(?:CODE|#|NO\b|:)/i;

const MEMBER_NUMBER =
  /\b(?:MEMBER(?:SHIP)?|LOYALTY|REWARDS?|CLUB|PLUS\s*CARD|ACCOUNT|ACCT|CARD)\s*(?:#|NO\.?|NUM(?:BER)?|ID)?\s*[:#-]?\s*[\d*Xx#•][\d*Xx#• -]{3,}/i;

// The change or balance line of the payment block. Only one carrying an amount
// ends the receipt, so a header such as `BALANCE REWARDS` cannot cut the items.
const PAYMENT_BLOCK_END =
  /^\W*(?:CHANGE|BALANCE)(?:\s+DUE)?\b[^A-Za-z]*\d+[.,]\d{2}\W*$/i;

const isPaymentDetail = (line: string) =>
  MASKED_CARD.test(line) ||
  STARRED_LAST_FOUR.test(line) ||
  CARD_DIGITS.test(line) ||
  PAYMENT_LABEL.test(line) ||
  PAYMENT_ID.test(line) ||
  AUTH_CODE_ANYWHERE.test(line) ||
  MEMBER_NUMBER.test(line);

/** Redacts a receipt's pages in order; the pages after the cut come back empty. */
export function redactReceiptText(
  pages: readonly (readonly string[])[],
): string[][] {
  let ended = false;
  return pages.map(page => {
    const kept: string[] = [];
    for (const line of page) {
      if (ended) break;
      if (!isPaymentDetail(line)) kept.push(line);
      if (PAYMENT_BLOCK_END.test(line)) ended = true;
    }
    return kept;
  });
}
