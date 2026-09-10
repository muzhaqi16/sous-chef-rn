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

  /**
   * Where a tapped push notification of this category lands. Strings, so it
   * costs the launch path nothing — the alternative is a switch in the push
   * service that has to be remembered whenever a feature comes or goes.
   */
  pushRoute?: {
    /** `NotificationCategory` value this feature answers for. */
    category: string;
    /** The tab's `screenName`, then the screen inside its stack. */
    tab: string;
    screen: string;
  };
}
