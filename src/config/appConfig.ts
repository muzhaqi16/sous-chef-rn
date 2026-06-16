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
  };
  assets: {
    /** Primary app logo used on landing/auth screens. */
    logo: ImageSourcePropType;
  };
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
  },
  assets: {
    logo: require('../assets/images/logo.png'),
  },
  branding: {
    primaryColor: '#f97416',
  },
};
