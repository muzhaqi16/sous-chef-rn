import type { SupportedLanguage } from '#/i18n/config';

/** One feature's copy, one tree per supported language. */
export type FeatureLocales = Record<SupportedLanguage, Record<string, unknown>>;

/**
 * What a feature declares to the APP SHELL rather than to the navigator, whose
 * consumers run on the launch path. Nothing reachable from here may import a
 * screen or a component; `staticFeatureRegistry.test.ts` holds that.
 */
export interface StaticFeatureManifest {
  /** Equals the directory name under `src/features/`. */
  id: string;

  /** Feature-owned copy, merged into the core tree at i18n init. */
  locales?: FeatureLocales;
}
