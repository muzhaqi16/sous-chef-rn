import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { zustandStorage } from '#/storage/mmkv';
import { registerSessionScopedStore } from '#store/sessionScopedStores';

/** Whether this user lets receipt photos go to the server to be read; null until asked. */
export type ReceiptPhotoConsent = 'granted' | 'declined' | null;

interface ReceiptPhotoConsentState {
  consent: ReceiptPhotoConsent;
  setConsent: (consent: 'granted' | 'declined') => void;
}

export const useReceiptPhotoConsentStore = create<ReceiptPhotoConsentState>()(
  persist(
    set => ({
      consent: null,
      setConsent: consent => set({ consent }),
    }),
    {
      name: 'sous-chef-receipt-photo-consent',
      storage: createJSONStorage(() => zustandStorage),
      version: 1,
      partialize: state => ({ consent: state.consent }),
    },
  ),
);

/**
 * The stored answer once it has loaded. The store hydrates asynchronously, and
 * a first read in a handler (Metro's inline requires create it there) would
 * otherwise see null and ask again.
 */
export async function storedReceiptPhotoConsent(): Promise<ReceiptPhotoConsent> {
  const stored = useReceiptPhotoConsentStore.persist;
  if (!stored.hasHydrated()) await stored.rehydrate();
  return useReceiptPhotoConsentStore.getState().consent;
}

// The next person on the phone answers for themselves.
registerSessionScopedStore('receiptPhotoConsent', () =>
  useReceiptPhotoConsentStore.setState({ consent: null }),
);
