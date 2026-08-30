#!/usr/bin/env node
/**
 * Generate the NEUTRAL BASE for a local-first optimistic entity from the schema.
 *
 * A locally-created row must be written complete for every query that reads it
 * (`returnPartialData: false` — see `src/types/apollo-default-options.d.ts`), so
 * each detail screen needed a hand-written object mirroring its fragment. Those
 * mirrors are pure boilerplate that nothing keeps in step with the SDL: add a
 * field to a detail fragment and the mirror silently falls behind, and the
 * screen blanks offline.
 *
 * Every value in such a mirror is derivable. From the schema:
 *
 *   nullable            -> null
 *   list                -> []            (empty is legal for `[T!]!`)
 *   non-null Boolean    -> false
 *   non-null Int/Float  -> 0
 *   non-null String/ID  -> ''
 *   non-null object     -> recurse into the selection
 *   non-null enum       -> NOT derivable — see ENUM_DEFAULTS
 *
 * Non-null enums are the only genuinely un-guessable values (a handful per
 * type), so they are listed explicitly below. That list is the honest home for
 * the one decision a generator cannot make; anything missing from it fails the
 * run rather than guessing.
 *
 * This is BUILD-time on purpose. The alternative — walking the SDL at runtime —
 * would mean shipping a ~10k-line schema in the bundle.
 *
 * Usage:  node scripts/generate-optimistic-fillers.mjs [--check]
 *   --check  verify the generated files are up to date (CI / pre-push) and
 *            write nothing.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import {
  buildSchema,
  parse,
  isEnumType,
  isListType,
  isNonNullType,
  isObjectType,
  isScalarType,
} from 'graphql';
import { fromRoot } from './lib/tooling.mjs';

const SCHEMA_PATH = fromRoot('src', 'graphql', 'generated', 'schema.graphql');

/**
 * Non-null enum fields, by `Type.field`, with the value a brand-new row has.
 * These are decisions, not defaults: the schema offers no neutral member, so a
 * human has to say which one an entity starts life in. Stating them here means
 * the answer is written once and reviewed.
 */
const ENUM_DEFAULTS = {
  'PantryItem.condition': 'GOOD',
  'PantryItem.acquisitionMethod': 'PURCHASED',
  'PantryItem.storageState': 'NONE',
  'ShoppingList.status': 'ACTIVE',
  // The server-side defaults a recipe created without metadata lands on.
  'Recipe.difficulty': 'EASY',
  'Recipe.category': 'MAIN_COURSE',
  // The unit top-up only ever fills fields the cache is MISSING, and every
  // path that reaches it wrote `type` already (the list fragment selects it),
  // so this value is not observed in practice. COUNT is the resting kind — a
  // bare "each" — and is the safest thing to be wrong with if it ever is.
  'Unit.type': 'COUNT',
};

/** Fragments to generate a neutral base for: [file, fragmentName, outName]. */
const TARGETS = [
  {
    graphql: fromRoot(
      'src',
      'features',
      'pantry',
      'hooks',
      'writePantryItemDetailStub.graphql',
    ),
    out: fromRoot(
      'src',
      'features',
      'pantry',
      'hooks',
      'pantryItemDetailNeutral.generated.ts',
    ),
    // `types` is what makes the output CHECKED rather than merely generated:
    // annotating each constant with its codegen'd fragment type means a wrong
    // ENUM_DEFAULTS entry, or a value the schema would reject, fails `tsc`
    // instead of reaching a device.
    typesFrom: './writePantryItemDetailStub.generated',
    fragments: {
      writePantryItemDetailStub_pantryItem: [
        'NEUTRAL_PANTRY_ITEM_DETAIL',
        'WritePantryItemDetailStub_PantryItemFragment',
      ],
      writePantryItemDetailStub_itemIdentity: [
        'NEUTRAL_ITEM_IDENTITY',
        'WritePantryItemDetailStub_ItemIdentityFragment',
      ],
      writePantryItemDetailStub_itemMedia: [
        'NEUTRAL_ITEM_MEDIA',
        'WritePantryItemDetailStub_ItemMediaFragment',
      ],
      writePantryItemDetailStub_itemPhotos: [
        'NEUTRAL_ITEM_PHOTOS',
        'WritePantryItemDetailStub_ItemPhotosFragment',
      ],
      writePantryItemDetailStub_itemCatalog: [
        'NEUTRAL_ITEM_CATALOG',
        'WritePantryItemDetailStub_ItemCatalogFragment',
      ],
      writePantryItemDetailStub_unit: [
        'NEUTRAL_UNIT',
        'WritePantryItemDetailStub_UnitFragment',
      ],
    },
  },
  {
    graphql: fromRoot(
      'src',
      'apollo',
      'utils',
      'shoppingListCacheUpdaters.graphql',
    ),
    out: fromRoot(
      'src',
      'apollo',
      'utils',
      'shoppingListDetailNeutral.generated.ts',
    ),
    typesFrom: './shoppingListCacheUpdaters.generated',
    fragments: {
      shoppingListCacheUpdaters_listDetail: [
        'NEUTRAL_SHOPPING_LIST_DETAIL',
        'ShoppingListCacheUpdaters_ListDetailFragment',
      ],
    },
  },
  {
    graphql: fromRoot(
      'src',
      'features',
      'recipes',
      'screens',
      'RecipeForm',
      'recipeCacheWriters.graphql',
    ),
    out: fromRoot(
      'src',
      'features',
      'recipes',
      'screens',
      'RecipeForm',
      'recipeFormFieldsNeutral.generated.ts',
    ),
    typesFrom: './recipeCacheWriters.generated',
    fragments: {
      recipeCacheWriters_formFields: [
        'NEUTRAL_RECIPE_FORM_FIELDS',
        'RecipeCacheWriters_FormFieldsFragment',
      ],
    },
  },
  {
    graphql: fromRoot(
      'src',
      'features',
      'mealPlan',
      'hooks',
      'useMealPlanActions.graphql',
    ),
    out: fromRoot(
      'src',
      'features',
      'mealPlan',
      'hooks',
      'mealPlanDetailNeutral.generated.ts',
    ),
    typesFrom: './useMealPlanActions.generated',
    fragments: {
      useMealPlanActions_detailStub: [
        'NEUTRAL_MEAL_PLAN_DETAIL',
        'UseMealPlanActions_DetailStubFragment',
      ],
    },
  },
];

function neutralForField(schema, parentType, fieldName, selectionSet, path) {
  const field = parentType.getFields()[fieldName];
  if (!field) {
    throw new Error(`${path}: no field '${fieldName}' on ${parentType.name}`);
  }
  return neutralForType(
    schema,
    field.type,
    selectionSet,
    path,
    parentType.name,
    fieldName,
  );
}

function neutralForType(
  schema,
  type,
  selectionSet,
  path,
  parentTypeName,
  fieldName,
) {
  // A connection's `totalCount` is 0 on a brand-new row, not "unknown". It is
  // nullable on 39 of the schema's 41 connections, so the nullable rule below
  // would derive `null` — but the neutral base has already asserted `edges: []`,
  // which `null` contradicts. Narrow on purpose: only the field literally named
  // `totalCount`, and only on a type implementing the `Connection` interface.
  const parentType = parentTypeName ? schema.getType(parentTypeName) : null;
  const isConnection =
    parentType &&
    'getInterfaces' in parentType &&
    parentType.getInterfaces().some(i => i.name === 'Connection');
  if (fieldName === 'totalCount' && isConnection) return 0;

  // Nullable is the easiest honest answer, and the commonest.
  if (!isNonNullType(type)) return null;
  const inner = type.ofType;

  // `[T!]!` — an empty list is legal and true of a fresh row.
  if (isListType(inner)) return [];

  if (isScalarType(inner)) {
    switch (inner.name) {
      case 'Boolean':
        return false;
      case 'Int':
      case 'Float':
        return 0;
      default:
        // String / ID / DateTime / JSON — an empty string is the only
        // non-null scalar value that carries no claim.
        return '';
    }
  }

  if (isEnumType(inner)) {
    const key = `${parentTypeName}.${fieldName}`;
    const value = ENUM_DEFAULTS[key];
    if (value === undefined) {
      throw new Error(
        `${path}: non-null enum ${inner.name} has no neutral member.\n` +
          `  Add "${key}": "<VALUE>" to ENUM_DEFAULTS in this script.\n` +
          `  Options: ${inner
            .getValues()
            .map(v => v.name)
            .join(', ')}`,
      );
    }
    return { __enum: { type: inner.name, value } };
  }

  if (isObjectType(inner)) {
    if (!selectionSet) {
      throw new Error(
        `${path}: non-null object ${inner.name} has no selection`,
      );
    }
    return neutralForSelection(schema, inner, selectionSet, path);
  }

  throw new Error(`${path}: unsupported non-null type ${inner.toString()}`);
}

function neutralForSelection(schema, parentType, selectionSet, path) {
  const out = { __typename: parentType.name };
  for (const selection of selectionSet.selections) {
    if (selection.kind !== 'Field') {
      throw new Error(
        `${path}: only plain fields are supported — a spread here would be ` +
          `written as a masked ref and read back incomplete`,
      );
    }
    const name = selection.name.value;
    if (name === '__typename') continue;
    out[name] = neutralForField(
      schema,
      parentType,
      name,
      selection.selectionSet,
      `${path}.${name}`,
    );
  }
  return out;
}

const pascalCase = value =>
  value
    .split('_')
    .map(part => part.charAt(0) + part.slice(1).toLowerCase())
    .join('');

/** Serialize, routing enum values through the generated TS enum objects. */
function serialize(value, indent = '') {
  if (value === null) return 'null';
  if (Array.isArray(value)) return '[]';
  if (typeof value === 'object') {
    if ('__enum' in value) {
      // Codegen emits real TS enums (`enumsAsTypes: false`), so the member —
      // not the wire string — is what type-checks. Codegen's naming is
      // PascalCase of the SDL value: GOOD -> Good, BARCODE_SCAN -> BarcodeScan.
      const { type, value: member } = value.__enum;
      return `${type}.${pascalCase(member)}`;
    }
    const inner = Object.entries(value)
      .map(([k, v]) => `${indent}  ${k}: ${serialize(v, indent + '  ')},`)
      .join('\n');
    return `{\n${inner}\n${indent}}`;
  }
  return JSON.stringify(value);
}

function collectEnumTypes(value, out) {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    return;
  if ('__enum' in value) {
    out.add(value.__enum.type);
    return;
  }
  for (const nested of Object.values(value)) collectEnumTypes(nested, out);
}

function generate(schema, target) {
  const doc = parse(readFileSync(target.graphql, 'utf8'));
  const byName = new Map(
    doc.definitions
      .filter(d => d.kind === 'FragmentDefinition')
      .map(d => [d.name.value, d]),
  );

  const parts = [];
  const typeNames = [];
  const enumTypes = new Set();
  for (const [fragmentName, [constName, typeName]] of Object.entries(
    target.fragments,
  )) {
    typeNames.push(typeName);
    const fragment = byName.get(fragmentName);
    if (!fragment) {
      throw new Error(`${target.graphql}: no fragment '${fragmentName}'`);
    }
    const parentType = schema.getType(fragment.typeCondition.name.value);
    const neutral = neutralForSelection(
      schema,
      parentType,
      fragment.selectionSet,
      fragmentName,
    );
    collectEnumTypes(neutral, enumTypes);
    parts.push(
      `/** Neutral base for \`${fragmentName}\`, derived from the schema. */\n` +
        `export const ${constName}: ${typeName} =\n  ${serialize(
          neutral,
          '  ',
        )};`,
    );
  }

  return (
    '// AUTO-GENERATED by scripts/generate-optimistic-fillers.mjs — DO NOT EDIT.\n' +
    `// Source: ${target.graphql.split('/').slice(-1)[0]}\n` +
    '//\n' +
    '// Neutral values for a locally-created row, derived from the SDL so they\n' +
    "// cannot fall behind it. Every value is either the schema's own resting\n" +
    '// value (null / [] / 0 / false / "") or a non-null enum listed explicitly\n' +
    '// in ENUM_DEFAULTS in that script. Callers spread these and overlay what\n' +
    '// the user actually supplied.\n\n' +
    (enumTypes.size
      ? `import {\n${[...enumTypes]
          .sort()
          .map(t => `  ${t},`)
          .join('\n')}\n} from '#/graphql/generated/schemaTypes';\n`
      : '') +
    `import type {\n${typeNames.map(t => `  ${t},`).join('\n')}\n} from '${
      target.typesFrom
    }';\n\n` +
    parts.join('\n\n') +
    '\n'
  );
}

function main() {
  if (!existsSync(SCHEMA_PATH)) {
    console.error(
      `✗ No schema at ${SCHEMA_PATH}. Run \`npm run codegen\` first.`,
    );
    process.exit(2);
  }
  const schema = buildSchema(readFileSync(SCHEMA_PATH, 'utf8'));
  const check = process.argv.includes('--check');
  let stale = 0;

  for (const target of TARGETS) {
    const next = generate(schema, target);
    const current = existsSync(target.out)
      ? readFileSync(target.out, 'utf8')
      : null;
    if (current === next) continue;
    if (check) {
      stale += 1;
      console.error(`✗ stale: ${target.out}`);
    } else {
      writeFileSync(target.out, next);
      console.log(`✓ wrote ${target.out}`);
    }
  }

  if (check && stale > 0) {
    console.error(
      `\n${stale} generated filler(s) are out of date — run\n` +
        '  node scripts/generate-optimistic-fillers.mjs',
    );
    process.exit(1);
  }
  if (check) console.log('✓ optimistic fillers are up to date');
}

main();
