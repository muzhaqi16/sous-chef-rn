import { ReceiptStructuring } from '#/native/ReceiptStructuring';
import {
  isUsableReceipt,
  linesThroughTotal,
  structureReceipt,
  type ParsedReceipt,
} from '../utils/structureReceipt';

// Labelling took 4–8 s for ten lines on the simulator; a long receipt on an
// older phone takes longer. Set from device runs (tasks 5.1).
const LABELLING_TIMEOUT_MS = 20_000;

/**
 * Structures the draft's pages with the phone's own model, or answers null:
 * no capable model, a timeout, or a result not worth keeping. The draft's text
 * stands either way.
 */
export async function parseReceiptOnDevice(
  pages: readonly string[],
): Promise<ParsedReceipt | null> {
  if ((await ReceiptStructuring.availability()) !== 'available') return null;

  const lines = linesThroughTotal(pages.flatMap(page => page.split('\n')));
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<null>(resolve => {
    timer = setTimeout(() => resolve(null), LABELLING_TIMEOUT_MS);
  });
  const labels = await Promise.race([
    ReceiptStructuring.labelLines(lines),
    expired,
  ]);
  clearTimeout(timer);
  if (!labels) return null;

  const parsed = structureReceipt(lines, labels);
  return isUsableReceipt(parsed, labels) ? parsed : null;
}
