import { Platform } from 'react-native';
import { ReceiptStructuring } from '#/native/ReceiptStructuring';
import {
  LABELLING_TIMEOUT_MS,
  onDeviceStructuring,
} from '../utils/onDeviceStructuring';
import {
  isUsableReceipt,
  linesThroughTotal,
  structureReceipt,
  type ParsedReceipt,
} from '../utils/structureReceipt';

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
