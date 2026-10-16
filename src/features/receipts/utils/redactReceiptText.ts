import { isItemLine } from './hasItemLines';

/**
 * Payment and loyalty details never leave the phone: a line carrying one is
 * dropped whole, and everything after the payment block's change or balance
 * line is cut. A staff member's or card member's name is masked, and so are an
 * email and a phone below the store's header. A deny-list, so what survives
 * is predictable and tested per chain (`__tests__/redactReceiptText.test.ts`);
 * the API re-applies it as defence in depth.
 */

// Some tills print dots for spaces (Giant Eagle's duplicate receipt prints
// `***.REF.#.51833069687`), so a line is also read with every dot that is no
// decimal point as a space.
const SPACING_DOT = /(?<!\d)\.|\.(?!\d)/g;

const spacedDots = (line: string) =>
  line.replace(SPACING_DOT, ' ').replace(/\s+/g, ' ').trim();

// The name after the label that opens its line (`Helped by GEORGETTE N`,
// `Cashier: Pat`), masked as the API masks it. Recognition misspells the words
// around a cashier (`Yaur Cashier Todey vas`).
const STAFF_NAME =
  /^(\W*(?:\S{3,5}\s+CASHIER(?:\s+\S{3,6})?\s+(?:[WV][AO]S|[IL1]S)|HELPED BY|SERVED BY|YOUR CASHIER(?: TODAY)?(?: WAS| IS)?|CASHIER|CHECKER|OPERATOR|ASSOCIATE|CLERK|SERVER|TEAM MEMBER)\b\W*)[A-Za-z\u00C0-\u024F].*$/i;

// Walmart prints its manager after the phone number: `(412) 555-0100 Mgr. PAT`.
const MANAGER_NAME = /(\b(?:MGR|MANAGER)\b\W*)[A-Za-z\u00C0-\u024F].*$/i;

// A member's name as the card carries it, alone on its line: the co-op's
// `DOE, JANE`. A town and its state (`CAMERON, MO`) is an address.
const CARDHOLDER_NAME =
  /^\W*[A-Z][A-Za-z'’-]+,\s?[A-Z][A-Za-z'’-]{2,}(?:\s[A-Z][A-Za-z'’-]*\.?)?\W*$/;

const maskName = (line: string) => {
  if (CARDHOLDER_NAME.test(line)) return '[name]';
  if (STAFF_NAME.test(line)) return line.replace(STAFF_NAME, '$1[name]');
  if (MANAGER_NAME.test(line)) return line.replace(MANAGER_NAME, '$1[name]');
  const spaced = spacedDots(line);
  return STAFF_NAME.test(spaced)
    ? spaced.replace(STAFF_NAME, '$1[name]')
    : line;
};

// As the API masks them. A domain ends in letters, so a count run into its
// price (`2@4.99`) is no email; a phone in the store's header is the store's.
const EMAIL = /[\w.+-]+@[\w-]+\.[A-Za-z][\w.-]*/g;
const PHONE = /\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/g;

const maskPersonal = (line: string, pastHeader: boolean) => {
  const masked = maskName(line).replace(EMAIL, '[email]');
  return pastHeader ? masked.replace(PHONE, '[phone]') : masked;
};

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
  /^\W*(?:REF(?:ERENCE)?|TRACE|AID|ATC|SEQ(?:UENCE)?|TRANS?(?:ACTION)?\s*ID|TERMINAL|TERM|MID|TID|MERCHANT\s*(?:ID|#)|APP|VALIDATION|EFT)\s*(?:#|NO\.?|NUM(?:BER)?|ID)?\s*[:#-]?\s*[A-Z0-9*•]*\d/i;

// The British spelling too: ALDI UK's `Authorisation Code: 654321`, and the
// co-op's `AUTHOR #: 654321`.
const AUTH_CODE_ANYWHERE =
  /\b(?:AUTH(?:OR(?:I[SZ]ATION)?)?|APPROVAL|APPR)\s*(?:CODE|#|NO\b|:)/i;

// After a date on the same line, out of reach of the start-anchored label:
// ALDI US's `09/30/26 09:51 Ref/Seq # 123456`, its `Seq` read as `Seg` too.
const REFERENCE_ANYWHERE =
  /\b(?:REF(?:ERENCE)?|SEQ(?:UENCE)?|TRACE)(?:\s*\/\s*SE[QG])?\s*(?:#|NO\b\.?|NUM(?:BER)?\b|:)\s*\d/i;

// A chip record's hex run, longer than any item code, bare or under a short
// label: the second line of ALDI US's IAD, Trader Joe's `C: 0123456789ABCDEF`.
const CHIP_DATA = /^\W*(?:[A-Z]{1,4}\s*[:#]\s*)?[0-9A-F]{16,}\W*$/;

// Recognition can read a digit as `|`, `I`, `l` or `!` (Costco's `Member 123| 456`),
// and the label's `m` as `n` or `rn` (`Menber`).
const MEMBER_NUMBER =
  /\b(?:ME(?:M|N|RN)BER(?:SHIP)?|LOYALTY|REWARDS?|CLUB|PLUS\s*CARD|ACCOUNT|ACCT|CARD)\s*(?:#|NO\.?|NUM(?:BER)?|ID)?\s*[:#-]?\s*[\d*Xx#•][\d*Xx#•|Il! -]{3,}/i;

// The change or balance line of the payment block. Only one carrying an amount
// ends the receipt, so a header such as `BALANCE REWARDS` cannot cut the items.
// Recognition can read margin noise before it (Walmart's `801  CHANGE DUE`) and
// drop the amount's last digit (Giant Eagle's `154.7`).
const PAYMENT_BLOCK_END =
  /^\W*(?:\d{1,4}\s+)?(?:CHANGE|BALANCE)(?:\s+DUE)?\b[^A-Za-z]*\d+[.,]\d{1,2}\W*$/i;

// A change line whose amount was read onto a row of its own. A bare balance is
// the total of some tills (`**** BALANCE` above `18.76`), so only change ends it.
const BARE_CHANGE = /^\W*(?:\d{1,4}\s+)?CHANGE(?:\s+DUE)?\W*$/i;

const readsAsPaymentField = (line: string) =>
  MASKED_CARD.test(line) ||
  STARRED_LAST_FOUR.test(line) ||
  NETWORK_LAST_FOUR.test(line) ||
  hasCardNumber(line) ||
  PAYMENT_LABEL.test(line) ||
  PAYMENT_ID.test(line) ||
  AUTH_CODE_ANYWHERE.test(line) ||
  REFERENCE_ANYWHERE.test(line) ||
  CHIP_DATA.test(line);

const readsEither = (line: string, reads: (text: string) => boolean) =>
  reads(line) || reads(spacedDots(line));

const endsPaymentBlock = (line: string) =>
  PAYMENT_BLOCK_END.test(line) ||
  PAYMENT_BLOCK_END.test(spacedDots(line)) ||
  BARE_CHANGE.test(line);

export interface RowRedaction {
  /**
   * `payment`: a card, authorisation or other payment field; `member`: a
   * member or loyalty number. Both drop the row; `named` masks a name or a
   * contact on it.
   */
  kind: 'kept' | 'named' | 'payment' | 'member';
  /** It follows the payment block's change or balance line. */
  cut: boolean;
  /** The row as it is kept, its names and contacts masked. */
  text: string;
}

const kindOf = (line: string, masked: string): RowRedaction['kind'] => {
  if (readsEither(line, readsAsPaymentField)) return 'payment';
  if (readsEither(line, text => MEMBER_NUMBER.test(text))) return 'member';
  return masked === line ? 'kept' : 'named';
};

/** What redaction does with each row of a receipt's pages, in order. */
export function rowRedactions(
  pages: readonly (readonly string[])[],
): RowRedaction[][] {
  let ended = false;
  let pastHeader = false;
  return pages.map(page =>
    page.map(line => {
      const cut = ended;
      if (endsPaymentBlock(line)) ended = true;
      const text = maskPersonal(line, pastHeader);
      pastHeader ||= isItemLine(line);
      return { kind: kindOf(line, text), cut, text };
    }),
  );
}

const isKept = ({ kind, cut }: RowRedaction) =>
  !cut && (kind === 'kept' || kind === 'named');

/** Redacts a receipt's pages in order; the pages after the cut come back empty. */
export function redactReceiptText(
  pages: readonly (readonly string[])[],
): string[][] {
  return rowRedactions(pages).map(rows =>
    rows.flatMap(row => (isKept(row) ? [row.text] : [])),
  );
}
