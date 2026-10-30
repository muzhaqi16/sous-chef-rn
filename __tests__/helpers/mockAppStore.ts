import {
  MIRRORED_SETTINGS,
  mirroredFrom,
  type MirroredSettings,
} from '#/domain/serverSettings';
import type { RootState } from '#store/index';

/**
 * Creates a mock module for `jest.mock('#store/useAppStore', () => mockAppStore({...}))`.
 *
 * The returned object mirrors the real module shape: a `useAppStore` function that
 * applies the caller's selector to the provided state, plus hook functions that
 * return the appropriate slice of state.
 *
 * Usage:
 * ```ts
 * import { mockAppStore } from '#/test-utils/mockAppStore';
 * jest.mock('#store/useAppStore', () => mockAppStore({ user: { id: '1' }, isOnline: true }));
 * ```
 */
export function mockAppStore(state: Partial<RootState>) {
  const useAppStore: jest.Mock & {
    getState: () => Partial<RootState>;
    setState: jest.Mock;
    subscribe: jest.Mock;
  } = Object.assign(
    jest.fn(
      <T>(selector: (s: RootState) => T): T => selector(state as RootState),
    ),
    {
      getState: jest.fn(() => state),
      setState: jest.fn(),
      subscribe: jest.fn(),
    },
  );

  return {
    useAppStore,

    // ── Atomic hooks ─────────────────────────────────────────────────────
    useUser: jest.fn(() => state.user),
    useSelectedHomeId: jest.fn(() => state.selectedHomeId),
    useSelectedPantryId: jest.fn(() => state.selectedPantryId),
    useSelectedShoppingListId: jest.fn(() => state.selectedShoppingListId),
    useIsHydrated: jest.fn(() => state.isHydrated),
    useIsOnline: jest.fn(() => state.isOnline),
    useMirroredSetting: jest.fn(
      (key: keyof MirroredSettings) =>
        ({ ...MIRRORED_SETTINGS, ...state }[key]),
    ),
    useMirroredSettings: jest.fn(() =>
      mirroredFrom({ ...MIRRORED_SETTINGS, ...state }),
    ),
    useCanAccessDevTools: jest.fn(() => state.user?.canAccessDevTools === true),
    useIsHomeSelectionReady: jest.fn(() => state.isHomeSelectionReady),
    useSetIsHomeSelectionReady: jest.fn(() => state.setIsHomeSelectionReady),
    useSetIsPantryQueryComplete: jest.fn(() => state.setIsPantryQueryComplete),
    useSetHomeAndPantry: jest.fn(() => state.setHomeAndPantry),

    // ── Grouped hooks ────────────────────────────────────────────────────
    usePostLoginState: jest.fn(() => ({
      navigationState: state.navigationState,
      postLoginCredentials: state.postLoginCredentials,
      setNavigationState: state.setNavigationState,
      setPostLoginCredentials: state.setPostLoginCredentials,
    })),
    usePantryState: jest.fn(() => ({
      selectedPantryId: state.selectedPantryId,
      setSelectedPantryId: state.setSelectedPantryId,
      selectedHomeId: state.selectedHomeId,
      setSelectedHomeId: state.setSelectedHomeId,
    })),
    useShoppingListState: jest.fn(() => ({
      selectedShoppingListId: state.selectedShoppingListId,
      setSelectedShoppingListId: state.setSelectedShoppingListId,
    })),
    useHomeState: jest.fn(() => ({
      selectedHomeId: state.selectedHomeId,
      setSelectedHomeId: state.setSelectedHomeId,
    })),
    usePreferences: jest.fn(() => ({
      theme: state.theme,
      language: state.language,
      setTheme: state.setTheme,
      setLanguage: state.setLanguage,
    })),
    useNavigationUtils: jest.fn(() => ({
      getUserNavigationState: state.getUserNavigationState,
      setUserNavigationState: state.setUserNavigationState,
      setOnboarded: state.setOnboarded,
    })),
  };
}
