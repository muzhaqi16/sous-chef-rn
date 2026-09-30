/**
 * Finds fields a mutation can leave stale in the Apollo cache: a response is a
 * partial write, so a field it does not return keeps its old value.
 *
 * A mutation returns what the app's queries read on each entity it returns
 * (via the generated `<Type>Readers`) and on the collection whose totals it
 * moves (`PARENT_FIELDS`), on the payload wherever the payload offers it. A
 * removal returns only the removed key. Connections and views are owed by no
 * mutation (`isOwnedElsewhere`).
 *
 * It exits non-zero on any gap and on a stale readers file.
 *
 *   node scripts/find-stale-cache-fields.mjs [--src <documents dir>]
 */
import { relative } from 'node:path';
import { REPO_ROOT, requireNonEmptyScan } from './lib/tooling.mjs';
import {
  TypeInfo,
  getNamedType,
  visit,
  visitWithTypeInfo,
  isObjectType,
  isInterfaceType,
} from 'graphql';
import {
  KEY_FIELDS,
  documentsRoot,
  isEntity,
  isOwnedElsewhere,
  loadDocuments,
  loadSchema,
} from './lib/graphqlDocuments.mjs';
import { readersDirOf, staleReadersFiles } from './lib/readersFragments.mjs';

/** Fields whose value is derived from other rows; listed first in the report. */
const DERIVED =
  /count|total|sum|rate|average|avg|stats|summary|last[A-Z]|recent|remaining|completed|previously|has[A-Z]|is[A-Z].*ed$|progress|balance|score/i;

/**
 * A member's fields that lead to the collection whose totals, counts or
 * summaries a change to the member moves. A mutation returning the member owes
 * the collection too — through its payload or through these fields.
 */
const PARENT_FIELDS = {
  ShoppingListItem: ['shoppingList'],
  ShoppingListCollaborator: ['shoppingList'],
  PantryItem: ['pantry', 'storageLocation'],
  RecipeReview: ['recipe'],
  SavedRecipe: ['recipe'],
  MealPlanItem: ['mealPlan'],
  MealTemplateItem: ['template'],
};

/**
 * A removal, by its schema field name. It returns the removed entities' keys
 * (the client evicts them) and the collections they left in full: a returned
 * parent type is owed unless it is the type the noun names (`deleteShoppingList`).
 */
const REMOVAL = /^(?:delete|remove|purge|decline|revoke|leave)([A-Z]\w*)$/;
const srcRoot = documentsRoot();
const schema = loadSchema('find-stale-cache-fields');
const documents = loadDocuments(srcRoot);
const { fragments, operations } = documents;

/** Replaces every fragment spread with its selections, guarding cycles. */
function inlineSpreads(node, seen) {
  if (!node.selectionSet) return node;
  const selections = [];
  for (const sel of node.selectionSet.selections) {
    if (sel.kind === 'FragmentSpread') {
      const name = sel.name.value;
      const frag = fragments.get(name);
      if (!frag || seen.has(name)) continue;
      selections.push({
        kind: 'InlineFragment',
        typeCondition: frag.typeCondition,
        directives: [],
        selectionSet: inlineSpreads(frag, new Set(seen).add(name)).selectionSet,
      });
    } else {
      selections.push(inlineSpreads(sel, seen));
    }
  }
  return { ...node, selectionSet: { ...node.selectionSet, selections } };
}

/** `type -> Set(field)` for every field selected under `definition`. */
function collect(definition, { skipOwnedElsewhere = false } = {}) {
  const into = new Map();
  const typeInfo = new TypeInfo(schema);
  visit(
    inlineSpreads(definition, new Set()),
    visitWithTypeInfo(typeInfo, {
      Field() {
        const parent = getNamedType(typeInfo.getParentType());
        const field = typeInfo.getFieldDef();
        if (!parent || !field) return;
        if (!isObjectType(parent) && !isInterfaceType(parent)) return;
        // The members inside a connection or view still count.
        if (skipOwnedElsewhere && isOwnedElsewhere(parent, field)) return;
        if (!into.has(parent.name)) into.set(parent.name, new Set());
        into.get(parent.name).add(field.name);
      },
    }),
  );
  return into;
}

// What QUERIES read, per type.
const readByType = new Map();
for (const op of operations) {
  if (op.kind !== 'query') continue;
  for (const [type, fields] of collect(op.ast, { skipOwnedElsewhere: true })) {
    if (!readByType.has(type)) readByType.set(type, new Set());
    for (const f of fields) readByType.get(type).add(f);
  }
}

/**
 * The entities a mutation returns: the first entity on each path under its
 * payload, through wrappers such as a batch's `results[]` or a `conflict`, with
 * the selection made on it there. What sits inside an entity is a related
 * record the mutation reports, not one it changed.
 */
function returnedEntities(definition) {
  const found = [];
  const walk = (selectionSet, within) => {
    for (const sel of selectionSet.selections) {
      if (sel.kind === 'InlineFragment') {
        const condition = sel.typeCondition
          ? schema.getType(sel.typeCondition.name.value)
          : within;
        walk(sel.selectionSet, condition);
        continue;
      }
      if (sel.kind !== 'Field' || !sel.selectionSet) continue;
      const type = getNamedType(within.getFields()[sel.name.value].type);
      if (isEntity(type))
        found.push({ type: type.name, selectionSet: sel.selectionSet });
      else walk(sel.selectionSet, type);
    }
  };
  const root = inlineSpreads(definition, new Set()).selectionSet.selections[0];
  const payload = schema.getMutationType().getFields()[root.name.value];
  walk(root.selectionSet, getNamedType(payload.type));
  return found;
}

/**
 * The parent collections a payload offers but the operation leaves unselected:
 * a parent the payload states is read there, resolved after the whole write,
 * not through a member.
 */
function unselectedPayloadParents(definition, parents) {
  const root = inlineSpreads(definition, new Set()).selectionSet.selections[0];
  const payloadField = schema.getMutationType().getFields()[root.name.value];
  const unselected = [];
  for (const sel of root.selectionSet.selections) {
    if (sel.kind !== 'InlineFragment' || !sel.typeCondition) continue;
    const payload = schema.getType(sel.typeCondition.name.value);
    if (!isObjectType(payload) || !payload.name.endsWith('Payload')) continue;
    const selected = new Set(
      sel.selectionSet.selections
        .filter(s => s.kind === 'Field')
        .map(s => s.name.value),
    );
    for (const field of Object.values(payload.getFields())) {
      const type = getNamedType(field.type).name;
      if (parents.has(type) && !selected.has(field.name)) {
        unselected.push({ type, field: `${payload.name}.${field.name}` });
      }
    }
  }
  return payloadField ? unselected : [];
}

/** The fields selected directly in an inlined selection set. */
const fieldNames = selectionSet =>
  selectionSet.selections.flatMap(sel =>
    sel.kind === 'Field' ? [sel.name.value] : fieldNames(sel.selectionSet),
  );

/** The collection type a member's parent field leads to; a typo fails loudly. */
function parentType(member, fieldName) {
  const field = schema.getType(member)?.getFields()[fieldName];
  if (!field) {
    console.error(
      `✗ PARENT_FIELDS names ${member}.${fieldName}, which the schema lacks.`,
    );
    process.exit(2);
  }
  return getNamedType(field.type).name;
}

/**
 * Aggregates a payload states that no member reaches: the caller's badge, which
 * every notification write returns, removals included.
 */
const PAYLOAD_PARENTS = ['NotificationSummary'];

const parentTypes = new Set([
  ...Object.entries(PARENT_FIELDS).flatMap(([member, fields]) =>
    fields.map(field => parentType(member, field)),
  ),
  ...PAYLOAD_PARENTS,
]);

const findings = [];
for (const op of operations) {
  if (op.kind !== 'mutation') continue;
  const written = collect(op.ast);
  const entities = returnedEntities(op.ast);
  const returned = new Set(entities.map(e => e.type));
  const file = relative(srcRoot, op.file);

  const noun = REMOVAL.exec(op.ast.selectionSet.selections[0].name.value)?.[1];
  const removed = new Set(
    noun
      ? [...returned].filter(type => type === noun || !parentTypes.has(type))
      : [],
  );
  for (const { type, selectionSet } of entities) {
    if (!removed.has(type)) continue;
    const extra = fieldNames(selectionSet).filter(f => !KEY_FIELDS.has(f));
    if (extra.length) {
      findings.push({
        mutation: op.name,
        type,
        removal: true,
        missing: extra,
        file,
      });
    }
  }

  for (const { type, field } of unselectedPayloadParents(op.ast, parentTypes)) {
    if (removed.has(type)) continue;
    findings.push({
      mutation: op.name,
      type,
      payloadField: field,
      missing: [field],
      file,
    });
  }

  const owed = new Map(); // type -> the member it is owed as the parent of, or null
  for (const type of returned) if (!removed.has(type)) owed.set(type, null);
  for (const type of returned) {
    for (const fieldName of PARENT_FIELDS[type] ?? []) {
      const parent = parentType(type, fieldName);
      if (!owed.has(parent)) owed.set(parent, type);
    }
  }
  for (const [type, parentOf] of owed) {
    const read = readByType.get(type);
    if (!read) continue;
    const fields = written.get(type) ?? new Set();
    const missing = [...read].filter(f => !fields.has(f));
    if (!missing.length) continue;
    findings.push({
      mutation: op.name,
      type,
      parentOf,
      notReturned: !written.has(type),
      missing: [
        ...missing.filter(f => DERIVED.test(f)),
        ...missing.filter(f => !DERIVED.test(f)),
      ],
      file,
    });
  }
}
findings.sort(
  (a, b) =>
    a.type.localeCompare(b.type) || a.mutation.localeCompare(b.mutation),
);

// A run that examined nothing must not read as clean.
requireNonEmptyScan({
  count: operations.length,
  what: 'GraphQL operations',
  check: 'find-stale-cache-fields',
  hint: '`src/` moved, or the operations are no longer `.graphql` files.',
});

const describe = f =>
  `${f.mutation} → ${f.type}${
    f.removal
      ? ' (removal; returns more than the key)'
      : f.payloadField
      ? ' (on the payload, not selected)'
      : f.parentOf
      ? ` (parent of ${f.parentOf}${f.notReturned ? ', not returned' : ''})`
      : ''
  }`;
const gaps = findings;
const { stale } = staleReadersFiles(schema, documents, readersDirOf(srcRoot));

const print = (log, list) => {
  let family = null;
  for (const f of list) {
    if (f.type !== family) {
      family = f.type;
      log(`── ${family} (${list.filter(x => x.type === family).length})`);
    }
    log(`  ${describe(f)}`);
    log(`     ${f.missing.join(', ')}`);
  }
};

console.log(`Examined ${operations.length} operations · ${gaps.length} gap(s)`);
if (stale.length) {
  console.error(
    '\n✗ Readers fragments are out of date (`npm run codegen:readers`):',
  );
  for (const path of stale) console.error(`  ${relative(REPO_ROOT, path)}`);
}
if (gaps.length) {
  console.error(
    '\n✗ Mutations that leave a field the queries read unreturned, or return more than a removed key:',
  );
  print(console.error, gaps);
}
if (stale.length || gaps.length) process.exit(1);
console.log('✓ Every mutation returns what the queries read.');
