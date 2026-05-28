import { useEffect } from 'react';
import { useStore } from '#store';
import { useIsHydrated } from '#store/useAppStore';
import { applyAppearanceToRuntime } from '#/theme/applyAppearance';

/**
 * Applies the persisted appearance preferences (App Color, density, font
 * scale, high contrast) to the Unistyles runtime once on cold start, as
 * soon as the Zustand store has rehydrated from MMKV.
 *
 * Runtime updates triggered *after* startup (a user picking a new swatch on
 * AppearanceScreen) flow through the `setPrimaryColorOverride` /
 * `setDensityPreference` / `setFontScalePreference` / `setHighContrast`
 * setters in `preferencesSlice`, each of which calls
 * `applyAppearanceToRuntime` synchronously before mutating state — mirroring
 * the established `setTheme` → `applyThemePreferenceToRuntime` pattern. This
 * hook therefore only needs to handle the cold-start sync and doesn't
 * subscribe to per-preference selectors.
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
