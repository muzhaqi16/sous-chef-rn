import {
  BaseDimension,
  ItemType,
  StorageState,
} from '#/graphql/generated/schemaTypes';
// These enum namespaces are split across the two features that own the
// entities: `itemType` is the catalog's, `storageState` / `baseDimension` are
// the pantry's. Imported and spread rather than read from the merged tree so a
// missing namespace is a compile error here, not a runtime one.
// Suffixed because a bare `it` import shadows Jest's `it()`.
import catalogEn from '#features/catalog/locales/en.json';
import catalogEs from '#features/catalog/locales/es.json';
import catalogIt from '#features/catalog/locales/it.json';
import catalogSq from '#features/catalog/locales/sq.json';
import pantryEn from '#features/pantry/locales/en.json';
import pantryEs from '#features/pantry/locales/es.json';
import pantryIt from '#features/pantry/locales/it.json';
import pantrySq from '#features/pantry/locales/sq.json';

const enLocale = { ...catalogEn, ...pantryEn };
const esLocale = { ...catalogEs, ...pantryEs };
const itLocale = { ...catalogIt, ...pantryIt };
const sqLocale = { ...catalogSq, ...pantrySq };

/**
 * Every schema enum the UI renders as a label must have one in every locale.
 *
 * `AddItemForm` builds its pickers with `Object.values(SomeEnum).map(v =>
 * t(namespace + '.' + v))`, so a value with no key renders as the raw key text
 * ("itemType.PET") — worse than the bare enum it replaced, and invisible to
 * typecheck and lint because the key is assembled at runtime.
 *
 * The values are read from the generated enum rather than listed here on
 * purpose: a hand-written list can only confirm the keys someone already wrote.
 * That is exactly how PET / PRODUCT / SUPPLEMENT were missed — the enum was
 * read from a stale `schemaTypes.ts` that predated them, so both the labels and
 * the check that "verified" them shared one blind spot. Deriving from the enum
 * means the next value the API adds fails this test until it is labelled.
 */
const LOCALES: Record<string, unknown> = {
  en: enLocale,
  es: esLocale,
  it: itLocale,
  sq: sqLocale,
};

const NAMESPACES = [
  { namespace: 'itemType', values: Object.values(ItemType) },
  { namespace: 'storageState', values: Object.values(StorageState) },
  { namespace: 'baseDimension', values: Object.values(BaseDimension) },
];

/** Narrows through the bundle without asserting a shape the JSON may not have. */
const readLabel = (
  bundle: unknown,
  namespace: string,
  value: string,
): unknown => {
  if (typeof bundle !== 'object' || bundle === null) return undefined;
  const group = (bundle as Record<string, unknown>)[namespace];
  if (typeof group !== 'object' || group === null) return undefined;
  return (group as Record<string, unknown>)[value];
};

describe('schema enum labels', () => {
  for (const { namespace, values } of NAMESPACES) {
    for (const lang of Object.keys(LOCALES)) {
      it(`${lang} labels every ${namespace} value`, () => {
        const missing = values.filter(
          value =>
            typeof readLabel(LOCALES[lang], namespace, value) !== 'string',
        );
        expect(missing).toEqual([]);
      });
    }
  }

  // A label left equal to its own key is the failure this guards against
  // rendering, so catch it here rather than on screen.
  it('never uses the key itself as a label', () => {
    for (const { namespace, values } of NAMESPACES) {
      for (const lang of Object.keys(LOCALES)) {
        for (const value of values) {
          const label = readLabel(LOCALES[lang], namespace, value);
          expect(label).not.toBe(`${namespace}.${value}`);
          expect(String(label).trim()).not.toBe('');
        }
      }
    }
  });
});
