import { createTestStore } from '#/test-utils/createTestStore';

jest.mock('../../../apollo/links/tokenScheduler');
jest.mock('../../../apollo/links/refreshToken');

describe('networkSlice', () => {
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
});
