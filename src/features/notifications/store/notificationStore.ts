import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { registerSessionScopedStore } from '#store/sessionScopedStores';
import type { ExpirationLinkData } from '#features/notifications/types';

/**
 * The expiration-enrichment buffer and the push a person tapped, the ONLY
 * notification state outside the Apollo cache. The enrichment's two halves
 * arrive on different subscriptions in either order, so an early one waits here
 * until `toDisplayNotification` merges it. NOT persisted: a stale entry would
 * enrich, or mark read, the wrong notification.
 */
interface NotificationStoreState {
  /** Enrichment keyed by the generic notification id it belongs to. */
  pendingExpirationLinks: Record<string, ExpirationLinkData>;
  /**
   * A notification opened from its push, waiting to be marked read: a tap can
   * land before the signed-in app is there to write it.
   */
  openedFromPush: string | null;

  setExpirationAction: (notificationId: string, action: string) => void;
  linkExpirationData: (
    genericNotificationId: string,
    expirationData: ExpirationLinkData,
  ) => void;
  /** Drop one entry once its notification has been acted on. */
  clearExpirationLink: (genericNotificationId: string) => void;
  noteOpenedFromPush: (notificationId: string | null) => void;
  resetNotifications: () => void;
}

const initialState: Pick<
  NotificationStoreState,
  'pendingExpirationLinks' | 'openedFromPush'
> = {
  pendingExpirationLinks: {},
  openedFromPush: null,
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

    noteOpenedFromPush: notificationId =>
      set(state => {
        state.openedFromPush = notificationId;
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
