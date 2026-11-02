import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { zustandStorage } from '#/store/deviceStorage';
import { hydrateWhenStarted } from '#store/persistedStores';
import { registerSessionScopedStore } from '#store/sessionScopedStores';

interface StorePickerState {
  /** The zip the store picker last listed stores near; null until one. */
  lastZip: string | null;
  setLastZip: (zip: string) => void;
}

export const useStorePickerStore = create<StorePickerState>()(
  persist(
    set => ({
      lastZip: null,
      setLastZip: zip => set({ lastZip: zip }),
    }),
    {
      name: 'sous-chef-store-picker',
      storage: createJSONStorage(() => zustandStorage),
      skipHydration: true,
      version: 1,
      partialize: state => ({ lastZip: state.lastZip }),
    },
  ),
);

hydrateWhenStarted(useStorePickerStore);

// Where one person shops says where they live: the next person starts blank.
registerSessionScopedStore('storePicker', () =>
  useStorePickerStore.setState({ lastZip: null }),
);
