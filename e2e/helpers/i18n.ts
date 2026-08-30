/**
 * Resolves the copy the app renders, so a spec asserts the binding rather than
 * a literal that rots when `en.json` is reworded. English only, matching the
 * emulator's locale; Detox runs in Node outside the app's i18next instance, so
 * it reads the bundle directly (the runtime config would pull in React Native).
 */
import en from '../../src/i18n/locales/en.json';

/** Interpolates i18next's `{{name}}` placeholders. */
const interpolate = (text: string, vars: Record<string, string | number>) =>
  text.replace(/\{\{(\w+)\}\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );

/**
 * Looks up a dotted key, e.g. `t('addItemForm.modes.edit.subtitle')`.
 *
 * Throws on a missing key rather than returning the key: asserting on the key
 * itself fails as "element not found", which says nothing about the cause.
 */
export const t = (
  key: string,
  vars?: Record<string, string | number>,
): string => {
  const value = key
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === 'object'
          ? (node as Record<string, unknown>)[part]
          : undefined,
      en,
    );

  if (typeof value !== 'string') {
    throw new Error(
      `i18n key "${key}" is missing from en.json (or is not a string). ` +
        'Check the key against the locale bundle.',
    );
  }

  return vars ? interpolate(value, vars) : value;
};
