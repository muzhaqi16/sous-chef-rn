import type { SupportedLanguage } from './config';
import { STATIC_FEATURE_REGISTRY } from '#features/registry.static';

type LocaleTree = Record<string, unknown>;

/**
 * Feature-owned copy, keyed by feature id. Read from the STATIC registry, which
 * carries no screen — the screen-bearing `FEATURE_REGISTRY` would pull the whole
 * component graph into the launch path, and `i18n/config` is imported near the
 * top of `index.js`.
 */
export const FEATURE_LOCALES: Record<
  string,
  Record<SupportedLanguage, LocaleTree>
> = Object.fromEntries(
  STATIC_FEATURE_REGISTRY.filter(f => f.locales).map(f => [
    f.id,
    f.locales as Record<SupportedLanguage, LocaleTree>,
  ]),
);

/**
 * Merge locale trees by COMBINING namespaces. A shallow `Object.assign` would
 * let a feature declaring `labels` or `errors` replace core's subtree wholesale,
 * silently taking every key in it. Arrays and scalars are replaced, not merged:
 * a locale value is a namespace or a string, never something to concatenate.
 */
const deepMergeLocale = (
  base: LocaleTree,
  incoming: LocaleTree,
): LocaleTree => {
  const merged: LocaleTree = { ...base };
  for (const [key, value] of Object.entries(incoming)) {
    const existing = merged[key];
    const bothAreNamespaces = isNamespace(existing) && isNamespace(value);
    merged[key] = bothAreNamespaces ? deepMergeLocale(existing, value) : value;
  }
  return merged;
};

const isNamespace = (value: unknown): value is LocaleTree =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Core copy plus every feature's, for one locale. */
export const mergeFeatureLocales = (
  locale: SupportedLanguage,
  core: LocaleTree,
): LocaleTree => {
  let merged: LocaleTree = { ...core };
  for (const byLocale of Object.values(FEATURE_LOCALES)) {
    merged = deepMergeLocale(merged, byLocale[locale]);
  }
  return merged;
};
