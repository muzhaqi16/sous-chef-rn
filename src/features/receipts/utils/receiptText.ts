import type { RecognizedPage } from '#/native/TextRecognition';
import { assembleReceiptLines } from './assembleReceiptLines';
import { redactReceiptText } from './redactReceiptText';

// The most pages the API reads as text. Android's scanner stops at it; iOS's
// takes any number, so the text of later shots continues the last page sent.
export const MAX_PAGES = 10;

// The most photos the API reads of one receipt.
export const MAX_PHOTOS = 4;

const capPages = (pages: string[]) =>
  pages.length <= MAX_PAGES
    ? pages
    : [...pages.slice(0, MAX_PAGES - 1), pages.slice(MAX_PAGES - 1).join('\n')];

/**
 * A scan's recognised pages as the app keeps and sends them: rows rebuilt,
 * payment details removed, no more pages than the API reads. The stages come
 * too: the day is read before redaction cuts it, and the corpus scorer
 * measures each.
 */
export function receiptText(recognized: readonly RecognizedPage[]) {
  const assembled = assembleReceiptLines(recognized);
  const redacted = redactReceiptText(assembled);
  return {
    assembled,
    redacted,
    pages: capPages(redacted.map(page => page.join('\n'))),
  };
}
