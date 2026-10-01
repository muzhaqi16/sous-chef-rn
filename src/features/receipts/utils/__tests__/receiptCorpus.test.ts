import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { redactReceiptText } from '../redactReceiptText';

// Redacted text of photographed receipts (`scripts/receipt-corpus/build.mjs`).
const CORPUS = join(
  __dirname,
  '../../../../../__tests__/fixtures/receipts/corpus',
);

interface CorpusReceipt {
  id: string;
  pages: string[];
}

const receipts = readdirSync(CORPUS)
  .filter(file => file.endsWith('.json'))
  .map(file => {
    const receipt = JSON.parse(
      readFileSync(join(CORPUS, file), 'utf8'),
    ) as CorpusReceipt;
    return { ...receipt, lines: receipt.pages.map(page => page.split('\n')) };
  });

// Worded apart from the deny-list, so a rule loosened and the corpus rebuilt
// with it still fails here: a payment field's name, then an identifier.
const PAYMENT_FIELD =
  /\b(?:AUTH(?:ORI[SZ]ATION)?|APPROVAL|APPR|REF(?:ERENCE)?|SEQ|TRACE|AID|TVR|TSI|IAD|ARQC|MERCHANT\s*ID|TERMINAL\s*ID|ACCOUNT|ACCT)\b\W{0,4}[A-Z]*\d{4,}/i;
const CARD_TAIL =
  /(?:[*Xx#•]{4,}|\b(?:VISA|MC|AMEX|DISCOVER)\s+)\d{4}\b(?![.,]\d)/;

describe('receipt corpus', () => {
  it('holds receipts', () => {
    expect(receipts.length).toBeGreaterThanOrEqual(15);
  });

  it.each(receipts.map(receipt => [receipt.id, receipt.lines] as const))(
    '%s: the deny-list keeps every line the corpus kept',
    (_id, lines) => {
      expect(redactReceiptText(lines)).toEqual(lines);
    },
  );

  it.each(receipts.map(receipt => [receipt.id, receipt.lines.flat()] as const))(
    '%s: no payment field or card tail survives',
    (_id, lines) => {
      expect(
        lines.filter(line => PAYMENT_FIELD.test(line) || CARD_TAIL.test(line)),
      ).toEqual([]);
    },
  );
});
