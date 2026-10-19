import { ReceiptStructuring } from '#/native/ReceiptStructuring';
import { withinMs } from '#/utils/withinMs';
import { LABELLING_TIMEOUT_MS } from '../utils/onDeviceStructuring';
import { linesThroughTotal, structureReceipt } from '../utils/structureReceipt';
import type { ParsedReceipt } from '../utils/parsedReceipt';

/**
 * Structures the draft's pages with the phone's own model, or answers null:
 * `enabled` off (`deviceReceiptModel`), no capable model, or a timeout.
 * Whether its reading is kept is the rules' check (`checkOnPhone`).
 */
export async function parseReceiptOnDevice(
  pages: readonly string[],
  enabled: boolean,
): Promise<ParsedReceipt | null> {
  if (!enabled) return null;
  if ((await ReceiptStructuring.availability()) !== 'available') return null;

  const lines = linesThroughTotal(pages.flatMap(page => page.split('\n')));
  const labels = await withinMs(
    ReceiptStructuring.labelLines(lines),
    LABELLING_TIMEOUT_MS,
    null,
  );
  if (!labels) return null;

  return structureReceipt(lines, labels);
}
