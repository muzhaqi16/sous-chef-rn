import { createTestStore } from '#/test-utils/createTestStore';
import { isApiUnavailable, shouldTreatAsOffline } from '../networkSlice';

jest.mock('../../../apollo/links/tokenScheduler');
jest.mock('../../../apollo/links/refreshToken');

describe('networkSlice', () => {
  // Nearly every action here runs `syncOfflineBanner`, which schedules a real
  // dwell timer. Left on real timers those outlive the suite and are what force
  // Jest to kill the worker. Faking them suite-wide also lets `clearAllTimers`
  // drop whatever a test left armed.
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('initializes as online', () => {
    const store = createTestStore();
    expect(store.getState().isOnline).toBe(true);
    expect(store.getState().isInternetReachable).toBeNull();
    expect(store.getState().networkType).toBeNull();
  });

  describe('setNetworkStatus', () => {
    it('updates network status', () => {
      const store = createTestStore();
      store.getState().setNetworkStatus({
        isOnline: false,
        isInternetReachable: false,
        networkType: 'cellular',
      });
      expect(store.getState().isOnline).toBe(false);
      expect(store.getState().isInternetReachable).toBe(false);
      expect(store.getState().networkType).toBe('cellular');
    });

    it('records lastOfflineTime on transition to offline', () => {
      const store = createTestStore({ isOnline: true });
      const before = Date.now();
      store.getState().setNetworkStatus({
        isOnline: false,
        isInternetReachable: false,
        networkType: null,
      });
      expect(store.getState().lastOfflineTime).toBeGreaterThanOrEqual(before);
    });

    it('records lastOnlineTime on transition to online', () => {
      const store = createTestStore({ isOnline: false });
      const before = Date.now();
      store.getState().setNetworkStatus({
        isOnline: true,
        isInternetReachable: true,
        networkType: 'wifi',
      });
      expect(store.getState().lastOnlineTime).toBeGreaterThanOrEqual(before);
    });

    it('does not update timestamps when state does not change', () => {
      const store = createTestStore({ isOnline: true });
      store.getState().setNetworkStatus({
        isOnline: true,
        isInternetReachable: true,
        networkType: 'wifi',
      });
      expect(store.getState().lastOnlineTime).toBeNull();
      expect(store.getState().lastOfflineTime).toBeNull();
    });
  });

  describe('setOnline', () => {
    it('transitions from offline to online', () => {
      const store = createTestStore({ isOnline: false });
      store.getState().setOnline();
      expect(store.getState().isOnline).toBe(true);
      expect(store.getState().lastOnlineTime).not.toBeNull();
    });

    it('is a no-op when already online', () => {
      const store = createTestStore({ isOnline: true });
      store.getState().setOnline();
      expect(store.getState().lastOnlineTime).toBeNull();
    });
  });

  describe('setOffline', () => {
    it('transitions from online to offline', () => {
      const store = createTestStore({ isOnline: true });
      store.getState().setOffline();
      expect(store.getState().isOnline).toBe(false);
      expect(store.getState().lastOfflineTime).not.toBeNull();
    });

    it('is a no-op when already offline', () => {
      const store = createTestStore({ isOnline: false });
      store.getState().setOffline();
      expect(store.getState().lastOfflineTime).toBeNull();
    });
  });

  describe('apiReachable', () => {
    it('defaults to true (reachable until proven otherwise)', () => {
      const store = createTestStore();
      expect(store.getState().apiReachable).toBe(true);
    });

    it('setApiReachable toggles the flag', () => {
      const store = createTestStore();
      store.getState().setApiReachable(false);
      expect(store.getState().apiReachable).toBe(false);
      store.getState().setApiReachable(true);
      expect(store.getState().apiReachable).toBe(true);
    });
  });

  describe('offlineBannerCause (debounced presentation state)', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    const goOffline = (store: ReturnType<typeof createTestStore>) =>
      store.getState().setNetworkStatus({
        isOnline: false,
        isInternetReachable: false,
        networkType: null,
      });

    const goOnline = (store: ReturnType<typeof createTestStore>) =>
      store.getState().setNetworkStatus({
        isOnline: true,
        isInternetReachable: true,
        networkType: 'wifi',
      });

    it('starts hidden', () => {
      expect(createTestStore().getState().offlineBannerCause).toBeNull();
    });

    it('shows nothing while the API failure is still within the dwell window', () => {
      const store = createTestStore();
      store.getState().setApiReachable(false);
      jest.advanceTimersByTime(4_000);
      expect(store.getState().offlineBannerCause).toBeNull();
    });

    it('shows api-unreachable once the failure has held for the full dwell', () => {
      const store = createTestStore();
      store.getState().setApiReachable(false);
      jest.advanceTimersByTime(5_000);
      expect(store.getState().offlineBannerCause).toBe('api-unreachable');
    });

    it('never shows when the API recovers inside the dwell window', () => {
      const store = createTestStore();
      store.getState().setApiReachable(false);
      jest.advanceTimersByTime(2_000);
      store.getState().setApiReachable(true);
      jest.advanceTimersByTime(10_000);
      expect(store.getState().offlineBannerCause).toBeNull();
    });

    it('does not accumulate dwell across a flapping circuit', () => {
      const store = createTestStore();
      for (let i = 0; i < 5; i += 1) {
        store.getState().setApiReachable(false);
        jest.advanceTimersByTime(3_000);
        store.getState().setApiReachable(true);
        jest.advanceTimersByTime(1_000);
      }
      expect(store.getState().offlineBannerCause).toBeNull();
    });

    it('uses the shorter dwell for a device-level disconnect', () => {
      const store = createTestStore();
      goOffline(store);
      jest.advanceTimersByTime(2_000);
      expect(store.getState().offlineBannerCause).toBe('device-offline');
    });

    it('shows offline mode immediately — the user just flipped the switch', () => {
      const store = createTestStore();
      store.getState().setOfflineModeEnabled(true);
      expect(store.getState().offlineBannerCause).toBe('offline-mode');
    });

    it('stays visible for the minimum duration after recovery', () => {
      const store = createTestStore();
      goOffline(store);
      jest.advanceTimersByTime(2_000);
      goOnline(store);
      jest.advanceTimersByTime(2_000);
      expect(store.getState().offlineBannerCause).toBe('device-offline');
      jest.advanceTimersByTime(1_000);
      expect(store.getState().offlineBannerCause).toBeNull();
    });

    it('swaps the cause without hiding while it is already visible', () => {
      const store = createTestStore();
      goOffline(store);
      jest.advanceTimersByTime(2_000);
      expect(store.getState().offlineBannerCause).toBe('device-offline');

      // Device back, API still down: relabel in place, no flicker.
      store.getState().setApiReachable(false);
      goOnline(store);
      expect(store.getState().offlineBannerCause).toBe('api-unreachable');
    });
  });

  describe('going offline expires what we knew about the API', () => {
    const dropLink = (store: ReturnType<typeof createTestStore>) =>
      store.getState().setNetworkStatus({
        isOnline: false,
        isInternetReachable: false,
        networkType: 'none',
      });

    it('moves apiReachable to unknown when the link drops', () => {
      // Not `false` — that would claim proof we do not have — and not `true`,
      // which would let an assumption override NetInfo. Nothing has been tried
      // since the link went, so the honest answer is that we do not know.
      const store = createTestStore();
      store.getState().setApiReachable(true);

      dropLink(store);

      expect(store.getState().apiReachable).toBeNull();
    });

    it('expires it on the setOffline path too', () => {
      // The invariant lives in the store rather than in the breaker so it holds
      // for every path into the offline state, not just the wired one.
      const store = createTestStore();
      store.getState().setApiReachable(true);

      store.getState().setOffline();

      expect(store.getState().apiReachable).toBeNull();
    });
  });

  describe('shouldTreatAsOffline', () => {
    it('blocks traffic while the device is offline and the API is unproven', () => {
      expect(
        shouldTreatAsOffline({ isOnline: false, apiReachable: null }),
      ).toBe(true);
    });

    it('allows traffic once a probe proves the API reachable', () => {
      expect(
        shouldTreatAsOffline({ isOnline: false, apiReachable: true }),
      ).toBe(false);
    });

    it('keeps blocking when the API is proven unreachable', () => {
      expect(
        shouldTreatAsOffline({ isOnline: false, apiReachable: false }),
      ).toBe(true);
    });

    it("says nothing about an online device — that is the breaker's job", () => {
      // Online with the breaker open must stay FALSE here: `offlineModeLink`
      // forwards that cache miss as an organic probe, which is how the
      // API-down case recovers. Folding it in would remove that.
      expect(
        shouldTreatAsOffline({ isOnline: true, apiReachable: false }),
      ).toBe(false);
    });
  });

  describe('isApiUnavailable', () => {
    it('is true when the device is offline and the API is unproven', () => {
      // `null` is what going offline leaves behind: nothing has been tried
      // since the link dropped, so we know nothing about the API.
      expect(isApiUnavailable({ isOnline: false, apiReachable: null })).toBe(
        true,
      );
    });

    it('is false when the API is PROVEN reachable despite NetInfo', () => {
      // NetInfo probes a generic endpoint, so it describes the route to the
      // public internet, not the route to us. A `/health` success is direct
      // evidence and outranks it — otherwise the app refuses traffic that
      // would have succeeded, and nothing can ever discover otherwise.
      expect(isApiUnavailable({ isOnline: false, apiReachable: true })).toBe(
        false,
      );
    });

    it('is true when the breaker is open (apiReachable === false)', () => {
      expect(isApiUnavailable({ isOnline: true, apiReachable: false })).toBe(
        true,
      );
    });

    it('is false when online and reachable', () => {
      expect(isApiUnavailable({ isOnline: true, apiReachable: true })).toBe(
        false,
      );
    });
  });
});
