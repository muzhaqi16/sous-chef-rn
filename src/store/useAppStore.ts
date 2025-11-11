import { useStore, RootState } from './index';

/**
 * Typed selector hook for Zustand store
 *
 * Usage:
 * ```tsx
 * // Instead of:
 * const { user, accessToken } = useStore();  // ❌ Re-renders on ANY state change
 *
 * // Do this:
 * const user = useAppStore(state => state.user);  // ✅ Only re-renders when user changes
 * const accessToken = useAppStore(state => state.accessToken);  // ✅ Only re-renders when accessToken changes
 * ```
 *
 * With equality function for complex objects:
 * ```tsx
 * import { shallow } from 'zustand/shallow';
 *
 * const homeState = useAppStore(
 *   state => ({ homeId: state.selectedHomeId, pantryId: state.selectedPantryId }),
 *   shallow
 * );
 * ```
 */
export function useAppStore<T>(
  selector: (state: RootState) => T,
  equalityFn?: (a: T, b: T) => boolean,
): T {
  // Zustand's useStore supports an optional equality function as second parameter
  // Cast to any to work around TypeScript middleware type inference limitations
  return (useStore as any)(selector, equalityFn);
}

// Common selectors for frequently accessed state
export const selectUser = (state: RootState) => state.user;
export const selectAccessToken = (state: RootState) => state.accessToken;
export const selectRefreshToken = (state: RootState) => state.refreshToken;
export const selectSelectedHomeId = (state: RootState) => state.selectedHomeId;
export const selectSelectedPantryId = (state: RootState) => state.selectedPantryId;
export const selectSelectedShoppingListId = (state: RootState) => state.selectedShoppingListId;
export const selectIsLoggedOut = (state: RootState) => !state.accessToken;
export const selectIsLoggingOut = (state: RootState) => state.isLoggingOut;
export const selectHydrated = (state: RootState) => state.isHydrated;

// Auth-related selectors
export const selectAuthState = (state: RootState) => ({
  user: state.user,
  accessToken: state.accessToken,
  refreshToken: state.refreshToken,
});

// Navigation-related selectors
export const selectNavigationState = (state: RootState) => ({
  selectedHomeId: state.selectedHomeId,
  selectedPantryId: state.selectedPantryId,
  selectedShoppingListId: state.selectedShoppingListId,
});

// Actions (non-selector exports for setting state)
export const selectSetters = (state: RootState) => ({
  updateUser: state.updateUser,
  setTokens: state.setTokens,
  setSelectedHomeId: state.setSelectedHomeId,
  setSelectedPantryId: state.setSelectedPantryId,
  setSelectedShoppingListId: state.setSelectedShoppingListId,
  logout: state.logout,
});
