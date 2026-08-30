import type { ImageSourcePropType } from 'react-native';

/**
 * Single source of truth for brand identity, and the first file to edit when
 * forking. Does NOT replace `app.json` or the native project names, which still
 * drive bundle ids and OS-level display names. Design tokens stay in
 * `src/theme/foundations/`.
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
     * Reverse-DNS namespace for keychain entries. **Changing it on a shipped
     * app orphans every user's stored credentials and session** — the keychain
     * is keyed by service name, so everyone is silently signed out with
     * biometrics unenrolled. Set once, when forking; a test pins the strings.
     */
    keychainNamespace: string;
    /**
     * Keychain key for the last biometric-login email. Deliberately NOT derived
     * from `keychainNamespace` — re-deriving it strands the stored value.
     */
    lastBiometricEmailKey: string;
  };
  assets: {
    /** Primary app logo used on landing/auth screens. */
    logo: ImageSourcePropType;
  };
  /**
   * Which features ship; absent means shipped. The FORK-level switch, where a
   * manifest's own `enabled` is the feature-owner's. A tabbed feature also needs
   * removing from `HomeTabs`' literal — `HomeTabs.test.tsx` says so if not.
   */
  features: Partial<Record<string, boolean>>;
  /**
   * Locales this app bundles, in menu order. Must match the JSON files
   * registered in `src/i18n/config.ts`.
   */
  locales: string[];
  branding: {
    /**
     * Brand primary in hex. `src/theme/foundations/brand.ts` derives the full
     * 11-stop palette from it (using the hand-tuned `jaffa` palette verbatim
     * when it matches the default), so a rebrand is one line here.
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
