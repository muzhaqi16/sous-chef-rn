import { useCallback, useMemo } from 'react';
import { useAppStore } from '#/store/useAppStore';
import {
  defaultUserPreferences,
  type UserPreferences,
} from '#/store/slices/preferencesSlice';

/**
 * Hook for accessing and updating the current user's per-user preferences.
 *
 * Preferences are keyed by userId so each user has independent settings.
 * Falls back to defaults when not logged in or when no preferences have been set.
 */
export const useUserPreferences = () => {
  const userId = useAppStore(state => state.user?.id);
  const userPreferencesMap = useAppStore(state => state.userPreferences);
  const setUserPreference = useAppStore(state => state.setUserPreference);
  const resetUserPreferences = useAppStore(state => state.resetUserPreferences);

  const preferences = useMemo<UserPreferences>(
    () =>
      userId
        ? userPreferencesMap[userId] ?? defaultUserPreferences
        : defaultUserPreferences,
    [userId, userPreferencesMap],
  );

  const updatePreference = useCallback(
    (prefs: Partial<UserPreferences>) => {
      if (userId) {
        setUserPreference(userId, prefs);
      }
    },
    [userId, setUserPreference],
  );

  const resetPreferences = useCallback(() => {
    if (userId) {
      resetUserPreferences(userId);
    }
  }, [userId, resetUserPreferences]);

  return { preferences, updatePreference, resetPreferences };
};

/**
 * Narrow selector hook for showShoppingListImages.
 * Minimizes re-renders by only subscribing to the boolean value.
 */
export const useShowShoppingListImages = (): boolean => {
  const userId = useAppStore(state => state.user?.id);
  const userPreferencesMap = useAppStore(state => state.userPreferences);

  if (!userId) return defaultUserPreferences.showShoppingListImages;
  return (
    userPreferencesMap[userId]?.showShoppingListImages ??
    defaultUserPreferences.showShoppingListImages
  );
};
