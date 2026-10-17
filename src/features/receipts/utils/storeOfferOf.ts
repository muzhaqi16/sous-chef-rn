import type { ReceiptMatchState } from '../hooks/useReceiptMatches';

interface StoreRef {
  id: string;
  name: string;
}

/**
 * The unlocated store a check-in would locate, offered once matching settles
 * whether the receipt names a store: the API's, which alone knows the
 * household's own, else the device's guess when the API could not be asked.
 * None without a server parse to locate it from, or once there is a store.
 */
export function storeOfferOf(
  receipt: { parseId: string | undefined; store: StoreRef | null },
  matchState: ReceiptMatchState,
  offers: { api: StoreRef | null; device: StoreRef | null },
): StoreRef | null {
  if (!receipt.parseId || receipt.store) return null;
  switch (matchState) {
    case 'done':
      return offers.api;
    case 'failed':
      return offers.device;
    case 'matching':
      return null;
  }
}
