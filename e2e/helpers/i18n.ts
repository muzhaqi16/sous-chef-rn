/**
 * Resolves the copy the app will actually render, so specs can assert on it
 * without duplicating the string.
 *
 * A literal in a spec silently rots: reword `en.json` and the assertion keeps
 * passing against text nobody sees, or fails for a change that was intentional.
 * Looking the key up means the spec asserts the *binding* — "this element shows
 * the edit-mode subtitle" — which is the thing worth pinning.
 *
 * English only, matching the emulator's locale. Detox runs in Node, outside the
 * app's i18next instance, so this reads the bundle directly rather than
 * importing the runtime config (which would drag in React Native).
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
 * Throws on a missing key rather than returning the key itself: a spec that
 * asserts `by.text('addItemForm.modes.edit.subtitle')` would fail with a
 * "element not found" that says nothing about the real cause.
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
