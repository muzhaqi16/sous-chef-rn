import { appConfig } from '#/config/appConfig';
import { derivePalette, type DerivedPalette } from '../derivePalette';
import { colors } from './colors';

/**
 * The brand palette consumed by `themes.ts` for every `primary*` / brand-accent
 * color role. This is the single source of truth for the app's brand color.
 *
 * When `appConfig.branding.primaryColor` matches the built-in `jaffa` anchor
 * (the shipping default), the hand-tuned `jaffa` palette is used verbatim so
 * the designed shades are preserved exactly. A fork that sets a different
 * `appConfig.branding.primaryColor` gets a full 11-stop palette derived from
 * that single hex via `derivePalette` — so rebranding is a one-file change in
 * `appConfig`, with no edits to `colors.ts` or `themes.ts`.
 */
const isDefaultBrand =
  appConfig.branding.primaryColor.toLowerCase() ===
  colors.jaffa[500].toLowerCase();

export const brand: DerivedPalette = isDefaultBrand
  ? colors.jaffa
  : derivePalette(appConfig.branding.primaryColor);
