import type { ImageSourcePropType } from 'react-native';

/**
 * Single source of truth for app brand identity.
 *
 * Forking this repo for a sibling app? This is the file to edit first. It
 * does NOT replace `app.json` or native project names — those still drive
 * bundle IDs / display names at the OS level and must be updated alongside.
 *
 * Intentionally narrow: only values that are genuinely shared brand
 * references live here. Design tokens (color palettes, typography) remain
 * in `src/theme/foundations/` and are updated independently.
 */
export interface AppConfig {
  identity: {
    /** Must match `app.json` → `name`. Used for bundle/keychain naming contexts. */
    name: string;
    /** Must match `app.json` → `displayName`. Shown to users. */
    displayName: string;
    /** Default base URL for external web links (privacy, terms, marketing). */
    webAppUrl: string;
    deepLink: {
      /** Custom URL scheme, without `://`. */
      scheme: string;
      /** Universal/app-link hosts, without protocol. */
      hosts: string[];
    };
    /**
     * Reverse-DNS namespace for keychain entries (`<namespace>.credentials`,
     * `.session.tokens`, …).
     *
     * **Changing this on a shipped app orphans every existing user's stored
     * credentials and session** — the OS keychain is keyed by service name, so
     * the old entries become unreachable and everyone is silently signed out
     * with biometrics no longer enrolled. Set it once, when forking.
     * `src/storage/__tests__/keychainServiceNames.test.ts` pins the derived
     * strings so a rename cannot happen by accident.
     */
    keychainNamespace: string;
    /**
     * Keychain key holding the last email used for biometric login.
     *
     * Deliberately NOT derived from `keychainNamespace`: it predates that
     * convention and re-deriving it would strand the stored value, with the
     * same consequence as above.
     */
    lastBiometricEmailKey: string;
  };
  assets: {
    /** Primary app logo used on landing/auth screens. */
    logo: ImageSourcePropType;
  };
  /**
   * Which features this app ships.
   *
   * Absent means shipped. A `false` here drops the feature from
   * `FEATURE_REGISTRY`'s enabled set without touching the feature itself — the
   * fork-level switch, where a manifest's own `enabled` is the feature-owner's.
   * A tabbed feature also needs its entry removed from `HomeTabs`' literal;
   * `HomeTabs.test.tsx` says so when it does not.
   */
  features: Partial<Record<string, boolean>>;
  /**
   * Locales this app bundles, in menu order. Must match the JSON files
   * registered in `src/i18n/config.ts`.
   */
  locales: string[];
  branding: {
    /**
     * Brand primary color in hex. Single source of truth for the theme's
     * `primary*` / brand-accent roles: `src/theme/foundations/brand.ts` derives
     * the full 11-stop palette from this hex (and uses the hand-tuned `jaffa`
     * palette verbatim when it matches the shipping default), so rebranding is
     * a one-line change here.
     */
    primaryColor: string;
  };
}

export const appConfig: AppConfig = {
  identity: {
    name: 'SousChef',
    displayName: 'Sous Chef',
    webAppUrl: 'https://souschef.dev',
    deepLink: {
      scheme: 'souschef',
      hosts: ['app.souschef.dev'],
    },
    keychainNamespace: 'dev.souschef.app',
    lastBiometricEmailKey: 'souschefrn-email',
  },
  features: {},
  locales: ['en', 'it', 'es', 'sq'],
  assets: {
    logo: require('../assets/images/logo.png'),
  },
  branding: {
    primaryColor: '#f97416',
  },
};
