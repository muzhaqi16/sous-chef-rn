import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { registerSessionScopedStore } from '#store/sessionScopedStores';
import type { ExpirationLinkData } from '#features/notifications/types';

/**
 * The expiration-enrichment buffer.
 *
 * `expirationNotificationChanged` and `notificationChanged` are separate events
 * and can arrive in either order. When the enrichment lands first there is no
 * notification to attach it to and nothing to key it against, so it waits here
 * until its partner arrives and `toDisplayNotification` merges it at read time.
 *
 * This is the only notification state the client owns: the feed, its read state
 * and its counts live in the Apollo cache (`notificationCacheWrites.ts`).
 *
 * A feature store rather than a slice of the root store, because nothing outside
 * notifications reads it — pantry writes to it through `useLinkExpirationData`.
 * Deliberately NOT persisted: it is a buffer for two in-flight events, and a
 * stale entry outliving the session would enrich the wrong notification.
 */
interface NotificationStoreState {
  /** Enrichment keyed by the generic notification id it belongs to. */
  pendingExpirationLinks: Record<string, ExpirationLinkData>;

  setExpirationAction: (notificationId: string, action: string) => void;
  linkExpirationData: (
    genericNotificationId: string,
    expirationData: ExpirationLinkData,
  ) => void;
  /** Drop one entry once its notification has been acted on. */
  clearExpirationLink: (genericNotificationId: string) => void;
  resetNotifications: () => void;
}

const initialState = {
  pendingExpirationLinks: {} as Record<string, ExpirationLinkData>,
};

export const useNotificationStore = create<NotificationStoreState>()(
  immer(set => ({
    ...initialState,

    setExpirationAction: (notificationId, action) =>
      set(state => {
        const existing = state.pendingExpirationLinks[notificationId];
        if (existing) {
          existing.expirationAction = action;
        } else {
          // The action can be taken before the enrichment event lands; hold it
          // so the merge still sees it. No `expirationNotificationId` — the
          // generic id is not the expiration row's, and consumers read a truthy
          // one as "already linked".
          state.pendingExpirationLinks[notificationId] = {
            expirationAction: action,
          };
        }
      }),

    linkExpirationData: (genericNotificationId, expirationData) =>
      set(state => {
        state.pendingExpirationLinks[genericNotificationId] = {
          ...state.pendingExpirationLinks[genericNotificationId],
          ...expirationData,
        };
      }),

    clearExpirationLink: genericNotificationId =>
      set(state => {
        delete state.pendingExpirationLinks[genericNotificationId];
      }),

    resetNotifications: () => set(() => ({ ...initialState })),
  })),
);

// A sign-out must empty this, and the root store's `SESSION_SCOPED_STATE` no
// longer reaches it. Registered at module init — which is exactly when the
// store first becomes capable of holding anything.
registerSessionScopedStore('notifications', () =>
  useNotificationStore.getState().resetNotifications(),
);
