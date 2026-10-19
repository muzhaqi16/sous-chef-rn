import type { ImageSourcePropType } from 'react-native';
import type { FeatureFlag } from './featureFlags';
import logo from '../assets/images/logo.png';

/**
 * The first file to edit when forking. `app.json` and the native project names
 * still drive bundle ids and OS display names.
 */
export interface AppConfig {
  identity: {
    /** Must match `app.json` → `name`. */
    name: string;
    /** Must match `app.json` → `displayName`. */
    displayName: string;
    webAppUrl: string;
    deepLink: {
      /** Custom URL scheme, without `://`. */
      scheme: string;
      /** Universal/app-link hosts, without protocol. */
      hosts: string[];
    };
    /**
     * Changing it on a shipped app signs everyone out, biometrics unenrolled:
     * the keychain is keyed by service name. A test pins the strings.
     */
    keychainNamespace: string;
    /**
     * Keychain key for the last biometric-login email. Deliberately NOT derived
     * from `keychainNamespace` — re-deriving it strands the stored value.
     */
    lastBiometricEmailKey: string;
  };
  assets: {
    logo: ImageSourcePropType;
  };
  /**
   * Which features ship; absent means shipped. The FORK-level switch, where a
   * manifest's own `enabled` is the feature-owner's. A tabbed feature also needs
   * removing from `HomeTabs`' literal — `HomeTabs.test.tsx` says so if not.
   */
  features: Partial<Record<string, boolean>>;
  /**
   * Capabilities inside a feature (`src/config/featureFlags.ts`); absent takes
   * the default there. A build's `FEATURE_FLAGS` overrides this.
   */
  featureFlags: Partial<Record<FeatureFlag, boolean>>;
  /** In menu order; must match the JSON files `src/i18n/config.ts` registers. */
  locales: string[];
  branding: {
    /**
     * Hex; `src/theme/foundations/brand.ts` derives the 11-stop palette from it,
     * using the hand-tuned `jaffa` palette verbatim for the default.
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
  featureFlags: {},
  locales: ['en', 'it', 'es', 'sq'],
  assets: {
    logo,
  },
  branding: {
    primaryColor: '#f58234',
  },
};
