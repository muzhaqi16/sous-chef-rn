import { useStoreWithEqualityFn } from 'zustand/traditional';
import { useShallow } from 'zustand/react/shallow';
import { storeApi, RootState } from './index';

/** Core store hook. Prefer the named hooks below; use this for one-offs. */
export function useAppStore<T>(
  selector: (state: RootState) => T,
  equalityFn?: (a: T, b: T) => boolean,
): T {
  return useStoreWithEqualityFn(storeApi, selector, equalityFn);
}

const selectUser = (state: RootState) => state.user;
const selectUserId = (state: RootState) => state.user?.id;
const selectUpdateUser = (state: RootState) => state.updateUser;
const selectIsLoggingOut = (state: RootState) => state.isLoggingOut;
const selectHydrated = (state: RootState) => state.isHydrated;
const selectIsAdminUser = (state: RootState) =>
  state.user?.role === 'ADMIN' || state.user?.role === 'SUPER_ADMIN';
const selectCanAccessDevTools = (state: RootState) =>
  state.user?.canAccessDevTools === true;

const selectSelectedHomeId = (state: RootState) => state.selectedHomeId;
const selectSelectedPantryId = (state: RootState) => state.selectedPantryId;
const selectSelectedShoppingListId = (state: RootState) =>
  state.selectedShoppingListId;
const selectSetSelectedPantryId = (state: RootState) =>
  state.setSelectedPantryId;

const selectIsHomeSelectionReady = (state: RootState) =>
  state.isHomeSelectionReady;
const selectSetIsHomeSelectionReady = (state: RootState) =>
  state.setIsHomeSelectionReady;
const selectSetIsPantryQueryComplete = (state: RootState) =>
  state.setIsPantryQueryComplete;
const selectIsPantryQueryComplete = (state: RootState) =>
  state.isPantryQueryComplete;

const selectSetHomeAndPantry = (state: RootState) => state.setHomeAndPantry;

const selectIsOnline = (state: RootState) => state.isOnline;

const selectNavigationState = (state: RootState) => state.navigationState;

// Plain boolean rather than the nav-state object, so consumers re-render only
// when the "skip for now" flag itself flips.
const selectVerificationSkipped = (state: RootState) => {
  const userId = state.user?.id;
  return userId
    ? state.userNavigationStates[userId]?.verificationSkipped === true
    : false;
};

const selectHasUnverifiedEmail = (state: RootState) =>
  state.user != null && !state.user.emailVerified;

const selectTheme = (state: RootState) => state.theme;
const selectShowNavigationLabels = (state: RootState) =>
  state.showNavigationLabels;

// Grouped selectors return fresh object literals — always via useShallow.
const selectAuthTokens = (state: RootState) => ({
  user: state.user,
  accessToken: state.accessToken,
  refreshToken: state.refreshToken,
  isAutoLoggingIn: state.isAutoLoggingIn,
  isLoggingOut: state.isLoggingOut,
});

const selectAuthActions = (state: RootState) => ({
  setAuth: state.setAuth,
  clearAuth: state.clearAuth,
  setTokens: state.setTokens,
  updateUser: state.updateUser,
  setEmailVerified: state.setEmailVerified,
  setOnboarded: state.setOnboarded,
  setRememberMe: state.setRememberMe,
  setIsAutoLoggingIn: state.setIsAutoLoggingIn,
  setUserNavigationState: state.setUserNavigationState,
});

const selectPostLoginState = (state: RootState) => ({
  navigationState: state.navigationState,
  showBiometricSetup: state.showBiometricSetup,
  postLoginCredentials: state.postLoginCredentials,
  setNavigationState: state.setNavigationState,
  setShowBiometricSetup: state.setShowBiometricSetup,
  setPostLoginCredentials: state.setPostLoginCredentials,
});

const selectPantryState = (state: RootState) => ({
  selectedPantryId: state.selectedPantryId,
  setSelectedPantryId: state.setSelectedPantryId,
  selectedHomeId: state.selectedHomeId,
  setSelectedHomeId: state.setSelectedHomeId,
});

const selectShoppingListState = (state: RootState) => ({
  selectedShoppingListId: state.selectedShoppingListId,
  setSelectedShoppingListId: state.setSelectedShoppingListId,
});

const selectHomeState = (state: RootState) => ({
  selectedHomeId: state.selectedHomeId,
  setSelectedHomeId: state.setSelectedHomeId,
});

const selectPreferences = (state: RootState) => ({
  theme: state.theme,
  language: state.language,
  setTheme: state.setTheme,
  setLanguage: state.setLanguage,
});

const selectNavigationUtils = (state: RootState) => ({
  getUserNavigationState: state.getUserNavigationState,
  setUserNavigationState: state.setUserNavigationState,
  setOnBoardingStep: state.setOnBoardingStep,
  setOnboarded: state.setOnboarded,
});

const selectHapticSettings = (state: RootState) => ({
  hapticFeedbackEnabled: state.hapticFeedbackEnabled,
  setHapticFeedbackEnabled: state.setHapticFeedbackEnabled,
});

const selectThemePreferences = (state: RootState) => ({
  primaryColorOverride: state.primaryColorOverride,
  densityPreference: state.densityPreference,
  fontScalePreference: state.fontScalePreference,
  highContrast: state.highContrast,
  setPrimaryColorOverride: state.setPrimaryColorOverride,
  setDensityPreference: state.setDensityPreference,
  setFontScalePreference: state.setFontScalePreference,
  setHighContrast: state.setHighContrast,
});

export const useUser = () => useAppStore(selectUser);
export const useUserId = () => useAppStore(selectUserId);
export const useUpdateUser = () => useAppStore(selectUpdateUser);
export const useSelectedHomeId = () => useAppStore(selectSelectedHomeId);
export const useSelectedPantryId = () => useAppStore(selectSelectedPantryId);
export const useSetSelectedPantryId = () =>
  useAppStore(selectSetSelectedPantryId);
export const useSelectedShoppingListId = () =>
  useAppStore(selectSelectedShoppingListId);
export const useIsLoggingOut = () => useAppStore(selectIsLoggingOut);
export const useIsHydrated = () => useAppStore(selectHydrated);
export const useIsOnline = () => useAppStore(selectIsOnline);
export const useCanAccessDevTools = () => useAppStore(selectCanAccessDevTools);
export const useIsAdminUser = () => useAppStore(selectIsAdminUser);
export const useIsHomeSelectionReady = () =>
  useAppStore(selectIsHomeSelectionReady);
export const useSetIsHomeSelectionReady = () =>
  useAppStore(selectSetIsHomeSelectionReady);
export const useSetIsPantryQueryComplete = () =>
  useAppStore(selectSetIsPantryQueryComplete);
export const useIsPantryQueryComplete = () =>
  useAppStore(selectIsPantryQueryComplete);
export const useSetHomeAndPantry = () => useAppStore(selectSetHomeAndPantry);
export const useNavigationState = () => useAppStore(selectNavigationState);
export const useVerificationSkipped = () =>
  useAppStore(selectVerificationSkipped);
export const useHasUnverifiedEmail = () =>
  useAppStore(selectHasUnverifiedEmail);
export const useTheme = () => useAppStore(selectTheme);
export const useShowNavigationLabels = () =>
  useAppStore(selectShowNavigationLabels);

export const useAuthTokens = () => useAppStore(useShallow(selectAuthTokens));
export const useAuthActions = () => useAppStore(useShallow(selectAuthActions));
export const usePostLoginState = () =>
  useAppStore(useShallow(selectPostLoginState));
export const usePantryState = () => useAppStore(useShallow(selectPantryState));
export const useShoppingListState = () =>
  useAppStore(useShallow(selectShoppingListState));
export const useHomeState = () => useAppStore(useShallow(selectHomeState));
export const usePreferences = () => useAppStore(useShallow(selectPreferences));
export const useNavigationUtils = () =>
  useAppStore(useShallow(selectNavigationUtils));
export const useHapticSettings = () =>
  useAppStore(useShallow(selectHapticSettings));
export const useThemePreferences = () =>
  useAppStore(useShallow(selectThemePreferences));
