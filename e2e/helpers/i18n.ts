/**
 * Resolves the copy the app renders, so a spec asserts the binding rather than
 * a literal that rots when `en.json` is reworded. English only, matching the
 * emulator's locale; Detox runs in Node outside the app's i18next instance, so
 * it reads the bundles directly (the runtime config would pull in React Native).
 */
import core from '../../src/i18n/locales/en.json';
import auth from '../../src/features/auth/locales/en.json';
import barcode from '../../src/features/barcode/locales/en.json';
import catalog from '../../src/features/catalog/locales/en.json';
import home from '../../src/features/home/locales/en.json';
import mealPlan from '../../src/features/mealPlan/locales/en.json';
import notifications from '../../src/features/notifications/locales/en.json';
import onboarding from '../../src/features/onboarding/locales/en.json';
import pantry from '../../src/features/pantry/locales/en.json';
import profile from '../../src/features/profile/locales/en.json';
import recipes from '../../src/features/recipes/locales/en.json';
import shoppingList from '../../src/features/shoppingList/locales/en.json';

/** Core copy first, then each feature's; a feature owns its own namespaces. */
const BUNDLES: object[] = [
  core,
  auth,
  barcode,
  catalog,
  home,
  mealPlan,
  notifications,
  onboarding,
  pantry,
  profile,
  recipes,
  shoppingList,
];

/** Interpolates i18next's `{{name}}` placeholders. */
const interpolate = (text: string, vars: Record<string, string | number>) =>
  text.replace(/\{\{(\w+)\}\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );

const lookup = (bundle: object, key: string): unknown =>
  key
    .split('.')
    .reduce<unknown>(
      (node, part): unknown =>
        node && typeof node === 'object' ? Reflect.get(node, part) : undefined,
      bundle,
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
  for (const bundle of BUNDLES) {
    const value = lookup(bundle, key);
    if (typeof value === 'string') {
      return vars ? interpolate(value, vars) : value;
    }
  }

  throw new Error(
    `i18n key "${key}" is missing from the English bundles (or is not a string). ` +
      'Check the key against src/i18n/locales and src/features/*/locales.',
  );
};
