import { appConfig } from '#/config/appConfig';
import { derivePalette, type DerivedPalette } from '../derivePalette';
import { colors } from './colors';

/**
 * The single source of truth for the app's brand color. At the built-in `jaffa`
 * anchor the hand-tuned palette is used verbatim; any other
 * `appConfig.branding.primaryColor` gets an 11-stop palette from `derivePalette`,
 * so a rebrand touches `appConfig` alone.
 */
const isDefaultBrand =
  appConfig.branding.primaryColor.toLowerCase() ===
  colors.jaffa[500].toLowerCase();

export const brand: DerivedPalette = isDefaultBrand
  ? colors.jaffa
  : derivePalette(appConfig.branding.primaryColor);
