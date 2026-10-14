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

// A tender line naming the card's network and last four: Giant Eagle's
// `MC 4242  4.49`. An amount (`VISA 1234.56`) is not a card.
const NETWORK_LAST_FOUR =
  /\b(?:MC|VISA|AMEX|DISC(?:OVER)?|MASTER\s?CARD)\s+\d{4}\b(?![.,]\d)/i;

// A full card number: groups of four (the last of one to three) or Amex's
// 4-6-5, split by one separator or none, that passes the Luhn check. An item
// code beside a short number (`041220576054 1234`) is no card.
const CARD_NUMBER =
  /\b\d{4}([ -]?)(?:\d{4}\1\d{4}\1\d{4}(?:\1\d{1,3})?|\d{6}\1\d{5})\b/g;

const passesLuhn = (digits: string) => {
  const sum = [...digits].reverse().reduce((total, char, at) => {
    const digit = Number(char) * (at % 2 === 1 ? 2 : 1);
    return total + (digit > 9 ? digit - 9 : digit);
  }, 0);
  return sum % 10 === 0;
};

// A short last group can be the next figure on the line, not the card's.
const hasCardNumber = (line: string) =>
  [...line.matchAll(CARD_NUMBER)].some(([number]) => {
    const digits = number.replace(/\D/g, '');
    return passesLuhn(digits) || passesLuhn(digits.slice(0, 16));
  });

// A label that names only a payment field, whatever follows it.
const PAYMENT_LABEL =
  /^\W*(?:AUTH(?:ORI[SZ]ATION)?|APPROVAL|APPROVED|APPR|ARQC|TVR|TSI|IAD|AAC|CVM)(?![A-Z])/i;

// A label that is a payment field only with an identifier after it, so an item
// such as `TRACE MINERALS` or `AIDELLS SAUSAGE` survives. The identifier may be
// partly masked: ALDI's `Merchant ID: **12345`.
const PAYMENT_ID =
  /^\W*(?:REF(?:ERENCE)?|TRACE|AID|ATC|SEQ|TRANS?(?:ACTION)?\s*ID|TERMINAL|TERM|MID|TID|MERCHANT\s*(?:ID|#)|APP|VALIDATION|EFT)\s*(?:#|NO\.?|NUM(?:BER)?|ID)?\s*[:#-]?\s*[A-Z0-9*•]*\d/i;

// The British spelling too: ALDI UK's `Authorisation Code: 654321`.
const AUTH_CODE_ANYWHERE =
  /\b(?:AUTH(?:ORI[SZ]ATION)?|APPROVAL|APPR)\s*(?:CODE|#|NO\b|:)/i;

// After a date on the same line, out of reach of the start-anchored label:
// ALDI US's `09/30/26 09:51 Ref/Seq # 123456`.
const REFERENCE_ANYWHERE =
  /\b(?:REF(?:ERENCE)?|SEQ|TRACE)(?:\s*\/\s*SEQ)?\s*(?:#|NO\b\.?|NUM(?:BER)?\b|:)\s*\d/i;

// A chip record's hex run, longer than any item code, bare or under a short
// label: the second line of ALDI US's IAD, Trader Joe's `C: 0123456789ABCDEF`.
const CHIP_DATA = /^\W*(?:[A-Z]{1,4}\s*[:#]\s*)?[0-9A-F]{16,}\W*$/;

// Recognition can read a digit as `|`, `I`, `l` or `!` (Costco's `Member 123| 456`).
const MEMBER_NUMBER =
  /\b(?:MEMBER(?:SHIP)?|LOYALTY|REWARDS?|CLUB|PLUS\s*CARD|ACCOUNT|ACCT|CARD)\s*(?:#|NO\.?|NUM(?:BER)?|ID)?\s*[:#-]?\s*[\d*Xx#•][\d*Xx#•|Il! -]{3,}/i;

// The change or balance line of the payment block. Only one carrying an amount
// ends the receipt, so a header such as `BALANCE REWARDS` cannot cut the items.
// Recognition can read margin noise before it (Walmart's `801  CHANGE DUE`) and
// drop the amount's last digit (Giant Eagle's `154.7`).
const PAYMENT_BLOCK_END =
  /^\W*(?:\d{1,4}\s+)?(?:CHANGE|BALANCE)(?:\s+DUE)?\b[^A-Za-z]*\d+[.,]\d{1,2}\W*$/i;

const isPaymentDetail = (line: string) =>
  MASKED_CARD.test(line) ||
  STARRED_LAST_FOUR.test(line) ||
  NETWORK_LAST_FOUR.test(line) ||
  hasCardNumber(line) ||
  PAYMENT_LABEL.test(line) ||
  PAYMENT_ID.test(line) ||
  AUTH_CODE_ANYWHERE.test(line) ||
  REFERENCE_ANYWHERE.test(line) ||
  CHIP_DATA.test(line) ||
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
