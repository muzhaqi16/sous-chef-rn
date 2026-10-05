import { Platform } from 'react-native';
import { ReceiptStructuring } from '#/native/ReceiptStructuring';
import { withinMs } from '#/utils/withinMs';
import {
  LABELLING_TIMEOUT_MS,
  onDeviceStructuring,
} from './onDeviceStructuring';
import {
  isUsableReceipt,
  linesThroughTotal,
  structureReceipt,
  type ParsedReceipt,
} from './structureReceipt';

/**
 * Structures the draft's pages with the phone's own model, or answers null:
 * turned off on this platform, no capable model, a timeout, or a result not
 * worth keeping. The draft's text stands, and the server reads it.
 */
export async function parseReceiptOnDevice(
  pages: readonly string[],
): Promise<ParsedReceipt | null> {
  if (onDeviceStructuring[Platform.OS] !== true) return null;
  if ((await ReceiptStructuring.availability()) !== 'available') return null;

  const lines = linesThroughTotal(pages.flatMap(page => page.split('\n')));
  const labels = await withinMs(
    ReceiptStructuring.labelLines(lines),
    LABELLING_TIMEOUT_MS,
    null,
  );
  if (!labels) return null;

  const parsed = structureReceipt(lines, labels);
  return isUsableReceipt(parsed, labels) ? parsed : null;
}
