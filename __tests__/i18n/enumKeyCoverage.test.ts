import fs from 'fs';
import path from 'path';
import {
  BaseDimension,
  Cuisine,
  Diet,
  Difficulty,
  HealthGoal,
  ImagePerspective,
  Intolerance,
  ItemType,
  RecipeStatus,
  StorageState,
} from '#/graphql/generated/schemaTypes';

/**
 * Every member of an enum that backs an i18n namespace has a key in that
 * namespace in en.json.
 *
 * These keys are composed at runtime — `t(`itemType.${type}`)` — so
 * `keysExist.test.ts` cannot see them: it matches single-quoted literals, and a
 * backtick means the key only exists once the enum value is substituted in. The
 * enum side comes from codegen. When the API adds a member, `npm run codegen`
 * grows `schemaTypes.ts`, the option lists built with `Object.values(...)` grow
 * with it, and en.json does not — so the new option renders in a picker as its
 * own raw dot-path, "itemType.FROZEN".
 *
 * Several composition sites pass a fallback, `t(key, formatEnum(value))`, which
 * turns VERY_EASY into "Very Easy". A fallback does not make a missing key
 * acceptable and those namespaces are asserted the same as the rest: the string
 * is English regardless of locale, and it is a mechanical re-casing of an API
 * identifier rather than copy anyone wrote.
 *
 * The check runs one direction only — every enum member needs a key, but a
 * namespace may carry keys that are not enum members. `baseDimension.none` is
 * the "unset" option the picker offers alongside the three real dimensions.
 */
const EN = path.join(
  __dirname,
  '..',
  '..',
  'src',
  'i18n',
  'locales',
  'en.json',
);

/** The enum value as it appears in the composed key. */
type KeyFragment = (value: string) => string;

/** The key is the enum value verbatim: `ItemType.FOOD` -> `itemType.FOOD`. */
const verbatim: KeyFragment = value => value;

/**
 * The key is the lower-cased enum value: `ImagePerspective.NUTRITION_LABEL` ->
 * `itemPhotos.perspective.nutrition_label`. `ItemPhoto.perspective` is a String
 * in the schema, carrying the lower-cased vocabulary that `PERSPECTIVE_TO_ENUM`
 * maps back onto `ImagePerspective`, so the enum is still what bounds the set.
 */
const lowerCased: KeyFragment = value => value.toLowerCase();

interface EnumNamespace {
  /** Named in the failure output, so the enum to widen is unambiguous. */
  enumName: string;
  members: Record<string, string>;
  namespace: string;
  keyFragment: KeyFragment;
}

const CASES: EnumNamespace[] = [
  // src/components/organisms/AddItemForm/fields.tsx — options come from
  // `Object.values(ItemType)` / `Object.values(StorageState)`.
  {
    enumName: 'ItemType',
    members: ItemType,
    namespace: 'itemType',
    keyFragment: verbatim,
  },
  {
    enumName: 'StorageState',
    members: StorageState,
    namespace: 'storageState',
    keyFragment: verbatim,
  },
  // src/components/organisms/AddItemForm/fields.tsx — one option per member,
  // listed explicitly, plus the `none` sentinel.
  {
    enumName: 'BaseDimension',
    members: BaseDimension,
    namespace: 'baseDimension',
    keyFragment: verbatim,
  },
  // src/constants/cuisines.ts — `cuisineLabelKey`, over `Object.values(Cuisine)`.
  {
    enumName: 'Cuisine',
    members: Cuisine,
    namespace: 'cuisines',
    keyFragment: verbatim,
  },
  // src/features/recipes/screens/RecipeForm/components/RecipeCategoryFields.tsx
  {
    enumName: 'Difficulty',
    members: Difficulty,
    namespace: 'recipes.difficultyLabel',
    keyFragment: verbatim,
  },
  {
    enumName: 'RecipeStatus',
    members: RecipeStatus,
    namespace: 'recipes.recipeStatus',
    keyFragment: verbatim,
  },
  // src/features/recipes/screens/RecipeForm/components/RecipeTagsSection.tsx —
  // options come from `Object.values(...)` of each enum.
  {
    enumName: 'Diet',
    members: Diet,
    namespace: 'recipes.diet',
    keyFragment: verbatim,
  },
  {
    enumName: 'HealthGoal',
    members: HealthGoal,
    namespace: 'recipes.healthGoal',
    keyFragment: verbatim,
  },
  {
    enumName: 'Intolerance',
    members: Intolerance,
    namespace: 'recipes.intolerance',
    keyFragment: verbatim,
  },
  // src/utils/imageUtils.ts — `getPerspectiveLabel`.
  {
    enumName: 'ImagePerspective',
    members: ImagePerspective,
    namespace: 'itemPhotos.perspective',
    keyFragment: lowerCased,
  },
];

function flatten(node: unknown, prefix = ''): Set<string> {
  const keys = new Set<string>();
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      const full = prefix ? `${prefix}.${k}` : k;
      if (typeof v === 'string') {
        keys.add(full);
      } else {
        for (const nested of flatten(v, full)) keys.add(nested);
      }
    }
  }
  return keys;
}

const available = flatten(JSON.parse(fs.readFileSync(EN, 'utf8')));

const cases = CASES.map(({ enumName, members, namespace, keyFragment }) => ({
  enumName,
  namespace,
  missing: Object.values(members)
    .map(member => ({
      member,
      key: `${namespace}.${keyFragment(member)}`,
    }))
    .filter(({ key }) => !available.has(key))
    .map(({ member, key }) => `${enumName}.${member} -> ${key}`),
}));

describe('enum-backed i18n namespaces', () => {
  it.each(cases)(
    '$enumName has an en.json key under $namespace for every member',
    ({ missing }) => {
      expect(missing).toEqual([]);
    },
  );
});
