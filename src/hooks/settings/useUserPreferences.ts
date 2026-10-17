import { useAppStore, useUserId } from '#store/useAppStore';
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
  const userId = useUserId();
  const userPreferencesMap = useAppStore(state => state.userPreferences);
  const setUserPreference = useAppStore(state => state.setUserPreference);
  const resetUserPreferences = useAppStore(state => state.resetUserPreferences);

  const preferences: UserPreferences = userId
    ? userPreferencesMap[userId] ?? defaultUserPreferences
    : defaultUserPreferences;

  const updatePreference = (prefs: Partial<UserPreferences>) => {
    if (userId) {
      setUserPreference(userId, prefs);
    }
  };

  const resetPreferences = () => {
    if (userId) {
      resetUserPreferences(userId);
    }
  };

  return { preferences, updatePreference, resetPreferences };
};

/**
 * One per-user preference and its setter, subscribed on its own so a change to
 * another preference does not re-render the reader.
 */
export function useUserPreference<K extends keyof UserPreferences>(
  key: K,
): [
  Required<UserPreferences>[K],
  (value: Required<UserPreferences>[K]) => void,
] {
  const userId = useUserId();
  const stored = useAppStore(state =>
    userId ? state.userPreferences[userId]?.[key] : undefined,
  );
  const setUserPreference = useAppStore(state => state.setUserPreference);

  const setValue = (value: Required<UserPreferences>[K]) => {
    if (!userId) return;
    const update: Partial<UserPreferences> = {};
    update[key] = value;
    setUserPreference(userId, update);
  };

  return [stored ?? defaultUserPreferences[key], setValue];
}

export const useShowShoppingListImages = (): boolean =>
  useUserPreference('showShoppingListImages')[0];
