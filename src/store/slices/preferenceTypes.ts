/**
 * Preference enums + defaults, in a leaf module with no imports:
 * `preferencesSlice` and `applyAppearance` form an import cycle, so the runtime
 * enum values must be reachable from either side without an
 * initialization-order crash.
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
 * The one source of defaults — read by `initialPreferencesState`, the
 * `applyAppearance` null-fallbacks and the pantry-sort component defaults.
 */
export const PREFERENCE_DEFAULTS = {
  theme: ThemePreference.SYSTEM,
  density: DensityPreference.COMFORTABLE,
  fontScale: FontScalePreference.MD,
  pantrySortOption: PantrySortOption.RECENT,
  pantrySortDirection: PantrySortDirection.DESC,
};
