import { createTestStore } from '#/test-utils/createTestStore';
import type { NavigationState } from '../appSlice';

describe('appSlice', () => {
  it('initializes with default values', () => {
    const store = createTestStore();
    const state = store.getState();
    expect(state.navigationState).toBe('loading');
    expect(state.postLoginCredentials).toBeNull();
    expect(state.cachedUnits).toEqual([]);
    expect(state.lastUnitsFetchedAt).toBeNull();
  });

  describe('setHydrated', () => {
    it('sets isHydrated to true', () => {
      const store = createTestStore({ isHydrated: false });
      store.getState().setHydrated(true);
      expect(store.getState().isHydrated).toBe(true);
    });

    it('sets isHydrated to false', () => {
      const store = createTestStore({ isHydrated: true });
      store.getState().setHydrated(false);
      expect(store.getState().isHydrated).toBe(false);
    });
  });

  describe('setNavigationState', () => {
    it.each<NavigationState>([
      'loading',
      'auth',
      'verification',
      'biometric_setup',
      'onboarding',
      'main_app',
    ])('sets navigation state to %s', navState => {
      const store = createTestStore();
      store.getState().setNavigationState(navState);
      expect(store.getState().navigationState).toBe(navState);
    });
  });

  describe('setPostLoginCredentials', () => {
    it('sets credentials', () => {
      const store = createTestStore();
      const creds = { email: 'test@test.com' };
      store.getState().setPostLoginCredentials(creds);
      expect(store.getState().postLoginCredentials).toEqual(creds);
    });

    it('clears credentials by setting null', () => {
      const store = createTestStore({
        postLoginCredentials: { email: 'a@b.com' },
      });
      store.getState().setPostLoginCredentials(null);
      expect(store.getState().postLoginCredentials).toBeNull();
    });
  });

  describe('cached units', () => {
    it('sets cached units', () => {
      const store = createTestStore();
      const units = [
        { id: '1', name: 'Gram', symbol: 'g' },
        { id: '2', name: 'Kilogram', symbol: 'kg' },
      ];
      store.getState().setCachedUnits(units);
      expect(store.getState().cachedUnits).toEqual(units);
    });

    it('sets last units fetched timestamp', () => {
      const store = createTestStore();
      const now = Date.now();
      store.getState().setLastUnitsFetchedAt(now);
      expect(store.getState().lastUnitsFetchedAt).toBe(now);
    });
  });
});
