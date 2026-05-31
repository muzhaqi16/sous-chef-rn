import {
  DensityPreference,
  FontScalePreference,
} from '#store/slices/preferenceTypes';

/**
 * Per-member appearance metadata — the single source for each density / font
 * scale option's runtime multiplier and its i18n label key.
 *
 * `applyAppearance` reads `.multiplier`; `AppearanceScreen` derives its option
 * lists from these tables. Because the maps are keyed by the enum, adding or
 * removing a member updates both the theme math and the UI without editing
 * them in separate places.
 */
export const DENSITY_META: Record<
  DensityPreference,
  { multiplier: number; labelKey: string }
> = {
  [DensityPreference.COMPACT]: {
    multiplier: 0.85,
    labelKey: 'appearance.densityCompact',
  },
  [DensityPreference.COMFORTABLE]: {
    multiplier: 1.0,
    labelKey: 'appearance.densityComfortable',
  },
  [DensityPreference.SPACIOUS]: {
    multiplier: 1.15,
    labelKey: 'appearance.densitySpacious',
  },
};

export const FONT_SCALE_META: Record<
  FontScalePreference,
  { multiplier: number; labelKey: string }
> = {
  [FontScalePreference.SM]: {
    multiplier: 0.9,
    labelKey: 'appearance.fontSmall',
  },
  [FontScalePreference.MD]: {
    multiplier: 1.0,
    labelKey: 'appearance.fontDefault',
  },
  [FontScalePreference.LG]: {
    multiplier: 1.15,
    labelKey: 'appearance.fontLarge',
  },
  [FontScalePreference.XL]: {
    multiplier: 1.3,
    labelKey: 'appearance.fontExtraLarge',
  },
};
