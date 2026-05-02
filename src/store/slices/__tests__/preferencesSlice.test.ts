import { createTestStore } from '#/test-utils/createTestStore';
import { ThemePreference, defaultUserPreferences } from '../preferencesSlice';

// Mock authSlice dependencies
jest.mock('../../../apollo/links/tokenScheduler');
jest.mock('../../../apollo/links/refreshToken');

describe('preferencesSlice', () => {
  describe('initial state', () => {
    it('starts with system theme', () => {
      const store = createTestStore();
      expect(store.getState().theme).toBe(ThemePreference.SYSTEM);
    });

    it('has haptic feedback enabled by default', () => {
      const store = createTestStore();
      expect(store.getState().hapticFeedbackEnabled).toBe(true);
    });

    it('has navigation labels enabled by default', () => {
      const store = createTestStore();
      expect(store.getState().showNavigationLabels).toBe(true);
    });

    it('has "recent" sort with "desc" direction by default', () => {
      const store = createTestStore();
      expect(store.getState().pantrySortOption).toBe('recent');
      expect(store.getState().pantrySortDirection).toBe('desc');
    });
  });

  describe('theme', () => {
    it('sets theme', () => {
      const store = createTestStore();
      store.getState().setTheme(ThemePreference.DARK);
      expect(store.getState().theme).toBe(ThemePreference.DARK);
    });
  });

  describe('language', () => {
    it('sets language', () => {
      const store = createTestStore();
      store.getState().setLanguage('fr');
      expect(store.getState().language).toBe('fr');
    });
  });

  describe('notifications', () => {
    it('sets email notifications', () => {
      const store = createTestStore();
      store.getState().setEmailNotifications(true);
      expect(store.getState().emailNotifications).toBe(true);
    });

    it('sets push notifications', () => {
      const store = createTestStore();
      store.getState().setNotificationsEnabled(true);
      expect(store.getState().pushNotifications).toBe(true);
    });
  });

  describe('rememberMe', () => {
    it('sets rememberMe', () => {
      const store = createTestStore();
      store.getState().setRememberMe(true);
      expect(store.getState().rememberMe).toBe(true);
    });
  });

  describe('haptic feedback', () => {
    it('disables haptic feedback', () => {
      const store = createTestStore();
      store.getState().setHapticFeedbackEnabled(false);
      expect(store.getState().hapticFeedbackEnabled).toBe(false);
    });
  });

  describe('navigation labels', () => {
    it('hides navigation labels', () => {
      const store = createTestStore();
      store.getState().setShowNavigationLabels(false);
      expect(store.getState().showNavigationLabels).toBe(false);
    });
  });

  describe('pantry sort', () => {
    it('sets sort option', () => {
      const store = createTestStore();
      store.getState().setPantrySortOption('name');
      expect(store.getState().pantrySortOption).toBe('name');
    });

    it('sets sort direction', () => {
      const store = createTestStore();
      store.getState().setPantrySortDirection('asc');
      expect(store.getState().pantrySortDirection).toBe('asc');
    });
  });

  describe('user preferences', () => {
    it('returns default preferences for unknown user', () => {
      const store = createTestStore();
      expect(store.getState().getUserPreferences('user-1')).toEqual(
        defaultUserPreferences,
      );
    });

    it('sets user preferences', () => {
      const store = createTestStore();
      store
        .getState()
        .setUserPreference('user-1', { showShoppingListImages: false });
      expect(store.getState().getUserPreferences('user-1')).toEqual({
        showShoppingListImages: false,
      });
    });

    it('merges user preferences', () => {
      const store = createTestStore();
      store
        .getState()
        .setUserPreference('user-1', { showShoppingListImages: false });
      // Re-set with same key to test merge
      store
        .getState()
        .setUserPreference('user-1', { showShoppingListImages: true });
      expect(
        store.getState().getUserPreferences('user-1').showShoppingListImages,
      ).toBe(true);
    });

    it('resets user preferences to defaults', () => {
      const store = createTestStore();
      store
        .getState()
        .setUserPreference('user-1', { showShoppingListImages: false });
      store.getState().resetUserPreferences('user-1');
      expect(store.getState().getUserPreferences('user-1')).toEqual(
        defaultUserPreferences,
      );
    });
  });

  describe('resetPreferences', () => {
    it('resets all preferences to initial values', () => {
      const store = createTestStore();
      store.getState().setTheme(ThemePreference.DARK);
      store.getState().setLanguage('de');
      store.getState().setHapticFeedbackEnabled(false);
      store.getState().resetPreferences();
      expect(store.getState().theme).toBe(ThemePreference.SYSTEM);
      expect(store.getState().hapticFeedbackEnabled).toBe(true);
    });
  });
});
