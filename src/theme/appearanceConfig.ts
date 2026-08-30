import {
  DensityPreference,
  FontScalePreference,
} from '#store/slices/preferenceTypes';

/**
 * The single source for each density / font-scale option's runtime multiplier and
 * i18n label key. Keyed by the enum, so adding a member updates both the theme
 * math (`applyAppearance`) and the UI (`AppearanceScreen`) at once.
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
