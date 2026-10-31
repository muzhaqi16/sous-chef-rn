import type { ReceiptMatchState } from '../hooks/useReceiptMatches';

interface StoreRef {
  id: string;
  name: string;
}

/**
 * The unlocated store a check-in would locate, once matching settles: the
 * API's, which alone knows the household's own, else the device's guess when
 * the API was not asked. None when the receipt names no place to locate it
 * from (a server parse, or an address or store number the phone read), or
 * once there is a store.
 */
export function storeOfferOf(
  receipt: { locates: boolean; store: StoreRef | null },
  matchState: ReceiptMatchState,
  offers: { api: StoreRef | null; device: StoreRef | null },
): StoreRef | null {
  if (!receipt.locates || receipt.store) return null;
  switch (matchState) {
    case 'done':
      return offers.api;
    case 'failed':
      return offers.device;
    case 'matching':
      return null;
  }
}
