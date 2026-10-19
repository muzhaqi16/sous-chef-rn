import type { ReceiptMatchState } from '../hooks/useReceiptMatches';

interface StoreRef {
  id: string;
  name: string;
}

/**
 * The unlocated store a check-in would locate, once matching settles: the
 * API's, which alone knows the household's own, else the device's guess when
 * the API was not asked. None without a server parse, or once there is a store.
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
