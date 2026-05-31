/**
 * Preference value enums + their defaults, in a leaf module with no imports.
 *
 * These enums are consumed by `preferencesSlice` (initial state) and the
 * appearance layer (`appearanceConfig` multipliers, read by `applyAppearance`).
 * `preferencesSlice` and `applyAppearance` form an import cycle, so the runtime
 * enum values live here — importable from either side without an
 * initialization-order crash. Keeping them as enums (rather than string unions)
 * also gives every preference a single nominal source of truth across the app.
 */
export enum FontScalePreference {
  SM = 'sm',
  MD = 'md',
  LG = 'lg',
  XL = 'xl',
}

export enum DensityPreference {
  COMPACT = 'compact',
  COMFORTABLE = 'comfortable',
  SPACIOUS = 'spacious',
}

export enum PantrySortOption {
  NAME = 'name',
  EXPIRY = 'expiry',
  QUANTITY = 'quantity',
  RECENT = 'recent',
}

export enum PantrySortDirection {
  ASC = 'asc',
  DESC = 'desc',
}

export enum ThemePreference {
  LIGHT = 'LIGHT',
  DARK = 'DARK',
  SYSTEM = 'SYSTEM',
}

/**
 * Single source of truth for default preference values. Referenced by the
 * store's `initialPreferencesState`, the `applyAppearance` null-fallbacks, and
 * the pantry-sort component defaults — so changing a default happens in one
 * place instead of being re-typed across layers.
 */
export const PREFERENCE_DEFAULTS = {
  theme: ThemePreference.SYSTEM,
  density: DensityPreference.COMFORTABLE,
  fontScale: FontScalePreference.MD,
  pantrySortOption: PantrySortOption.RECENT,
  pantrySortDirection: PantrySortDirection.DESC,
};
