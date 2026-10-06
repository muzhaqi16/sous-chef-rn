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
  getNamedType,
  parse,
  isEnumType,
  isListType,
  isNonNullType,
  isObjectType,
  isScalarType,
} from 'graphql';
import { fromRoot } from './lib/tooling.mjs';
import { loadDocuments } from './lib/graphqlDocuments.mjs';

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
  // A local membership is only ever the creator's own, of the home it made.
  'Membership.role': 'OWNER',
  'Membership.status': 'ACTIVE',
  // Every location create states its type; this stands in for none.
  'StorageLocation.type': 'CUSTOM',
  'StorageLocationCount.type': 'CUSTOM',
  'ShoppingListItem.displayFormat': 'AUTO',
  // "USER_CREATED when it came from no external source" — every local create.
  'Recipe.primarySource': 'USER_CREATED',
  'Recipe.status': 'DRAFT',
  // Every meal-plan and template create states these; they stand in for none.
  'MealPlan.planType': 'CUSTOM',
  'MealPlanItem.mealType': 'DINNER',
  'MealTemplate.category': 'CUSTOM',
  'MealTemplateItem.mealType': 'DINNER',
};

/**
 * Fragments to generate a neutral base for. A fragment may spread others (a
 * `<Type>Readers`); `unmasked: true` then types the constant `Unmasked<…>`, the
 * shape `writeFragment` takes for it.
 */
const TARGETS = [
  {
    graphql: fromRoot(
      'src',
      'features',
      'shoppingList',
      'cache',
      'items.graphql',
    ),
    out: fromRoot(
      'src',
      'features',
      'shoppingList',
      'cache',
      'shoppingListItemRowNeutral.generated.ts',
    ),
    typesFrom: './items.generated',
    unmasked: true,
    fragments: {
      items_row: ['NEUTRAL_LOCAL_SHOPPING_LIST_ITEM', 'Items_RowFragment'],
    },
  },
  {
    graphql: fromRoot(
      'src',
      'features',
      'catalog',
      'hooks',
      'useCreateStorageLocation.graphql',
    ),
    out: fromRoot(
      'src',
      'features',
      'catalog',
      'hooks',
      'useCreateStorageLocationNeutral.generated.ts',
    ),
    typesFrom: './useCreateStorageLocation.generated',
    unmasked: true,
    fragments: {
      useCreateStorageLocation_row: [
        'NEUTRAL_LOCAL_STORAGE_LOCATION',
        'UseCreateStorageLocation_RowFragment',
      ],
    },
  },
  {
    graphql: fromRoot(
      'src',
      'features',
      'catalog',
      'hooks',
      'useCreateStore.graphql',
    ),
    out: fromRoot(
      'src',
      'features',
      'catalog',
      'hooks',
      'useCreateStoreNeutral.generated.ts',
    ),
    typesFrom: './useCreateStore.generated',
    unmasked: true,
    fragments: {
      useCreateStore_row: ['NEUTRAL_LOCAL_STORE', 'UseCreateStore_RowFragment'],
    },
  },
  {
    graphql: fromRoot('src', 'features', 'pantry', 'cache', 'pantry.graphql'),
    out: fromRoot(
      'src',
      'features',
      'pantry',
      'cache',
      'pantryRowNeutral.generated.ts',
    ),
    typesFrom: './pantry.generated',
    unmasked: true,
    fragments: {
      pantry_row: ['NEUTRAL_LOCAL_PANTRY', 'Pantry_RowFragment'],
    },
  },
  {
    graphql: fromRoot(
      'src',
      'features',
      'pantry',
      'cache',
      'writeLocalPantryItem.graphql',
    ),
    out: fromRoot(
      'src',
      'features',
      'pantry',
      'cache',
      'writeLocalPantryItemNeutral.generated.ts',
    ),
    typesFrom: './writeLocalPantryItem.generated',
    unmasked: true,
    fragments: {
      writeLocalPantryItem_row: [
        'NEUTRAL_LOCAL_PANTRY_ITEM',
        'WriteLocalPantryItem_RowFragment',
      ],
    },
  },
  {
    graphql: fromRoot('src', 'features', 'home', 'cache', 'home.graphql'),
    out: fromRoot(
      'src',
      'features',
      'home',
      'cache',
      'homeRowNeutral.generated.ts',
    ),
    typesFrom: './home.generated',
    unmasked: true,
    fragments: {
      home_row: ['NEUTRAL_LOCAL_HOME', 'Home_RowFragment'],
      home_membershipRow: [
        'NEUTRAL_LOCAL_MEMBERSHIP',
        'Home_MembershipRowFragment',
      ],
    },
  },
  {
    graphql: fromRoot(
      'src',
      'features',
      'shoppingList',
      'cache',
      'list.graphql',
    ),
    out: fromRoot(
      'src',
      'features',
      'shoppingList',
      'cache',
      'shoppingListRowNeutral.generated.ts',
    ),
    typesFrom: './list.generated',
    unmasked: true,
    fragments: {
      list_row: ['NEUTRAL_LOCAL_SHOPPING_LIST', 'List_RowFragment'],
    },
  },
  {
    graphql: fromRoot(
      'src',
      'features',
      'recipes',
      'utils',
      'recipeCacheWriters.graphql',
    ),
    out: fromRoot(
      'src',
      'features',
      'recipes',
      'utils',
      'recipeRowNeutral.generated.ts',
    ),
    typesFrom: './recipeCacheWriters.generated',
    unmasked: true,
    fragments: {
      recipeCacheWriters_row: [
        'NEUTRAL_LOCAL_RECIPE',
        'RecipeCacheWriters_RowFragment',
      ],
    },
  },
  {
    graphql: fromRoot(
      'src',
      'features',
      'mealPlan',
      'cache',
      'mealPlan.graphql',
    ),
    out: fromRoot(
      'src',
      'features',
      'mealPlan',
      'cache',
      'mealPlanRowNeutral.generated.ts',
    ),
    typesFrom: './mealPlan.generated',
    unmasked: true,
    fragments: {
      mealPlan_row: ['NEUTRAL_LOCAL_MEAL_PLAN', 'MealPlan_RowFragment'],
    },
  },
  {
    graphql: fromRoot(
      'src',
      'features',
      'mealPlan',
      'cache',
      'mealPlanItem.graphql',
    ),
    out: fromRoot(
      'src',
      'features',
      'mealPlan',
      'cache',
      'mealPlanItemRowNeutral.generated.ts',
    ),
    typesFrom: './mealPlanItem.generated',
    unmasked: true,
    fragments: {
      mealPlanItem_row: [
        'NEUTRAL_LOCAL_MEAL_PLAN_ITEM',
        'MealPlanItem_RowFragment',
      ],
    },
  },
  {
    graphql: fromRoot(
      'src',
      'features',
      'mealPlan',
      'cache',
      'mealTemplate.graphql',
    ),
    out: fromRoot(
      'src',
      'features',
      'mealPlan',
      'cache',
      'mealTemplateRowNeutral.generated.ts',
    ),
    typesFrom: './mealTemplate.generated',
    unmasked: true,
    fragments: {
      mealTemplate_row: [
        'NEUTRAL_LOCAL_MEAL_TEMPLATE',
        'MealTemplate_RowFragment',
      ],
    },
  },
  {
    graphql: fromRoot(
      'src',
      'features',
      'mealPlan',
      'cache',
      'mealTemplateItem.graphql',
    ),
    out: fromRoot(
      'src',
      'features',
      'mealPlan',
      'cache',
      'mealTemplateItemRowNeutral.generated.ts',
    ),
    typesFrom: './mealTemplateItem.generated',
    unmasked: true,
    fragments: {
      mealTemplateItem_row: [
        'NEUTRAL_LOCAL_MEAL_TEMPLATE_ITEM',
        'MealTemplateItem_RowFragment',
      ],
    },
  },
  {
    graphql: fromRoot(
      'src',
      'features',
      'recipes',
      'cache',
      'favorites.graphql',
    ),
    out: fromRoot(
      'src',
      'features',
      'recipes',
      'cache',
      'savedRecipeRowNeutral.generated.ts',
    ),
    typesFrom: './favorites.generated',
    unmasked: true,
    fragments: {
      favorites_row: ['NEUTRAL_LOCAL_SAVED_RECIPE', 'Favorites_RowFragment'],
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

  // A record behind a nullable field or in a list still gets a shape, for a
  // create that names one to be completed from.
  const named = getNamedType(type);
  const shapeOnly = !isNonNullType(type) || isListType(type.ofType);
  if (shapeOnly && selectionSet && isObjectType(named)) {
    shapeOnlyDepth += 1;
    neutralForSelection(schema, named, selectionSet, path);
    shapeOnlyDepth -= 1;
  }

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
    // A shape no create names needs no decided member; one that is named and
    // lacks it fails the test guard on the missing field.
    if (value === undefined && shapeOnlyDepth > 0) return undefined;
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

// A spread is followed into its fields: the base is the UNMASKED shape.
function neutralForSelection(schema, parentType, selectionSet, path) {
  const out = { __typename: parentType.name };
  for (const selection of selectionSet.selections) {
    if (selection.kind !== 'Field') {
      const inner =
        selection.kind === 'FragmentSpread'
          ? fragmentIndex.get(selection.name.value)
          : selection;
      const condition = inner?.typeCondition?.name.value ?? parentType.name;
      if (!inner || condition !== parentType.name) {
        throw new Error(
          `${path}: a spread must name a fragment on ${parentType.name}`,
        );
      }
      Object.assign(
        out,
        neutralForSelection(schema, parentType, inner.selectionSet, path),
      );
      continue;
    }
    const name = selection.name.value;
    if (name === '__typename') continue;
    const key = selection.alias?.value ?? name;
    const value = neutralForField(
      schema,
      parentType,
      name,
      selection.selectionSet,
      `${path}.${key}`,
    );
    if (value !== undefined) out[key] = value;
  }
  shapes?.set(parentType.name, { ...out, ...shapes.get(parentType.name) });
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

let fragmentIndex = new Map();
/** Per target: every object type the fragment reaches, with its neutral fields. */
let shapes = null;
let shapeOnlyDepth = 0;

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
    shapes = target.unmasked ? new Map() : null;
    const neutral = neutralForSelection(
      schema,
      parentType,
      fragment.selectionSet,
      fragmentName,
    );
    collectEnumTypes(neutral, enumTypes);
    const declared = target.unmasked ? `Unmasked<${typeName}>` : typeName;
    parts.push(
      `/** Neutral base for \`${fragmentName}\`, derived from the schema. */\n` +
        `export const ${constName}: ${declared} =\n  ${serialize(
          neutral,
          '  ',
        )};`,
    );
    if (shapes) {
      const byType = Object.fromEntries(
        [...shapes].sort(([a], [b]) => a.localeCompare(b)),
      );
      collectEnumTypes(byType, enumTypes);
      parts.push(
        `/** Every record \`${fragmentName}\` reaches, by type, for a create that names one. */\n` +
          `export const ${constName}_BY_TYPE: NeutralByType =\n  ${serialize(
            byType,
            '  ',
          )};`,
      );
    }
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
    (target.unmasked
      ? "import type { Unmasked } from '@apollo/client/masking';\n" +
        "import type { NeutralByType } from '#/apollo/utils/writeLocalEntity';\n"
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
  fragmentIndex = loadDocuments().fragments;
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
