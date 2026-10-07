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

// The next person on the phone answers for themselves.
registerSessionScopedStore('receiptPhotoConsent', () =>
  useReceiptPhotoConsentStore.setState({ consent: null }),
);
