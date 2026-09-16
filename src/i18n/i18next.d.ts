import 'i18next';
import type { TranslationResources } from './localeTypes';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: TranslationResources };
  }
}
