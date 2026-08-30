/**
 * Which home carries `isDefault` only because this device wrote it —
 * `remoteDefaultHomeId` reads the same field and cannot tell the difference.
 * Memory-only: a queued write replays from the persisted queue.
 */
import { create } from 'zustand';
import { registerSessionScopedStore } from '#store/sessionScopedStores';

interface DefaultHomeSyncState {
  pendingDefaultHomeId: string | null;
  markPending: (homeId: string) => void;
  markConfirmed: (homeId: string) => void;
  clearPending: () => void;
}

export const useDefaultHomeSyncStore = create<DefaultHomeSyncState>()(
  (set, get) => ({
    pendingDefaultHomeId: null,
    markPending: homeId => set({ pendingDefaultHomeId: homeId }),
    // Per home: an unconditional clear would settle a later, in-flight switch.
    markConfirmed: homeId =>
      set(
        get().pendingDefaultHomeId === homeId
          ? { pendingDefaultHomeId: null }
          : {},
      ),
    clearPending: () => set({ pendingDefaultHomeId: null }),
  }),
);

// Root SESSION_SCOPED_STATE does not reach a feature store.
registerSessionScopedStore('useDefaultHomeSyncStore', () =>
  useDefaultHomeSyncStore.getState().clearPending(),
);

/** True when `homeId` is default locally but unconfirmed by the server. */
export const isDefaultHomeSyncPending = (homeId: string | null) =>
  !!homeId &&
  useDefaultHomeSyncStore.getState().pendingDefaultHomeId === homeId;
