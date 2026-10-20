import { useEffect } from 'react';
import { useStore } from '#store';
import { useIsHydrated } from '#store/useAppStore';
import { applyAppearanceToRuntime } from '#/theme/applyAppearance';

/**
 * Cold-start sync only: applies the rehydrated appearance preferences to the
 * Unistyles runtime once. Later changes go through the `preferencesSlice`
 * setters, which call `applyAppearanceToRuntime` themselves — hence no
 * per-preference subscription here.
 */
export function useAppearance() {
  const isHydrated = useIsHydrated();

  useEffect(() => {
    if (!isHydrated) return;
    const state = useStore.getState();
    applyAppearanceToRuntime({
      primaryColorOverride: state.primaryColorOverride,
      densityPreference: state.densityPreference,
      fontScalePreference: state.fontScalePreference,
      highContrast: state.highContrast,
    });
  }, [isHydrated]);
}
