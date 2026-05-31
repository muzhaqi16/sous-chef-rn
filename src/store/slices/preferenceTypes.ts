/**
 * Preference value enums, in a leaf module with no imports.
 *
 * These enums are consumed both by `preferencesSlice` (initial state) and by
 * `applyAppearance` (`FONT_SCALE_MULTIPLIER` / `DENSITY_MULTIPLIER` keys at
 * module init). Those two modules form an import cycle, so the runtime enum
 * values live here — importable from either side without an initialization-order
 * crash. Keeping them as enums (rather than string unions) also gives every
 * preference a single nominal source of truth across the app.
 */
export enum FontScalePreference {
  SYSTEM = 'system',
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
