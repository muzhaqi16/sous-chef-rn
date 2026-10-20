import { assembleReceiptRows } from './assembleReceiptRows';
import { receiptPhotoMasks } from './receiptPhotoMasks';
import { redactReceiptText } from './redactReceiptText';
import type { RecognizedPage } from '#/types/textRecognition';

// The most pages the API reads as text. iOS's scanner takes any number, so the
// text of later shots continues the last page sent.
const MAX_PAGES = 10;

// The most photos the API reads of one receipt, and so the most pages Android's
// scanner takes: a scan the phone cannot read goes as its photos.
export const MAX_PHOTOS = 4;

const capPages = (pages: string[]) =>
  pages.length <= MAX_PAGES
    ? pages
    : [...pages.slice(0, MAX_PAGES - 1), pages.slice(MAX_PAGES - 1).join('\n')];

/**
 * A scan's pages as the app keeps and sends them: rows rebuilt, payment details
 * removed, capped at the API's page limit, with each photo's masks. Stages too:
 * the day is read before redaction cuts it, and the corpus scorer measures each.
 */
export function receiptText(recognized: readonly RecognizedPage[]) {
  const rows = assembleReceiptRows(recognized);
  const assembled = rows.map(page => page.rows.map(row => row.text));
  const redacted = redactReceiptText(assembled);
  return {
    assembled,
    redacted,
    pages: capPages(redacted.map(page => page.join('\n'))),
    masks: receiptPhotoMasks(rows),
  };
}
