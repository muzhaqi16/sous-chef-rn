import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  buildSchema,
  Kind,
  isInputObjectType,
  isListType,
  isNonNullType,
  type GraphQLInputType,
  type GraphQLSchema,
  type OperationDefinitionNode,
} from 'graphql';
import { syncMappedOperations } from '#/apollo/offlineQueue/convertToSyncMutation';
import { PARENT_REFERENCE_KEYS } from '#/apollo/offlineQueue/queueManager';
import {
  SRC,
  authoredMutations,
  localFirstOperationNames,
} from '#/test-utils/queueableOperations';

/**
 * The drain holds a queued write behind an undelivered one when they share a
 * SUBJECT id or a PARENT reference. Both lists are hand-written in
 * `queueManager`, so an input that gains a new `*Id` field — a parent minted
 * offline that the drain does not know to wait for — would replay ahead of its
 * create and be refused as missing. Every `*Id` an enqueueable input declares
 * must be classified here; an unclassified one fails.
 */

/** Mirrors `QueueManager.getAllEntityIds` — the keys read as the write's own rows. */
const SUBJECT_KEYS = [
  'id',
  'itemId',
  'pantryItemId',
  'recipeId',
  'mealPlanId',
  'batchId',
  'clientId',
  'newRecipeId',
];

/** References to rows no queued write creates, so nothing waits on them. */
const NEVER_QUEUED_REFERENCE: Record<string, string> = {
  unitId: 'unit vocabulary is server-owned',
  usageUnitId: 'unit vocabulary is server-owned',
  actualUnitId: 'unit vocabulary is server-owned',
  displayUnitId: 'unit vocabulary is server-owned',
  netWeightUnitId: 'unit vocabulary is server-owned',
  portionUnitId: 'unit vocabulary is server-owned',
  brandId: 'catalog rows are created online only',
  storeId: 'catalog rows are created online only',
  targetStoreId: 'catalog rows are created online only',
  preferredStoreId: 'catalog rows are created online only',
  dietaryProfileId: 'one per user, minted by the server at sign-up',
  notificationId: 'minted by the server, never by a queued write',
  externalSourceId: 'an external catalogue id',
  spoonacularIngredientId: 'an external catalogue id',
};

function unwrap(type: GraphQLInputType): GraphQLInputType {
  let inner = type;
  while (isNonNullType(inner) || isListType(inner)) inner = inner.ofType;
  return inner;
}

/** `*Id` fields of an input, top-level and one level into a row array. */
function idFieldsOf(type: GraphQLInputType, depth = 0): string[] {
  const inner = unwrap(type);
  if (!isInputObjectType(inner)) return [];
  const out: string[] = [];
  for (const field of Object.values(inner.getFields())) {
    if (/Id$/.test(field.name)) out.push(field.name);
    if (depth === 0) out.push(...idFieldsOf(field.type, 1));
  }
  return out;
}

function inputIdFields(
  schema: GraphQLSchema,
  operation: OperationDefinitionNode,
): string[] {
  const mutationType = schema.getMutationType();
  if (!mutationType) return [];
  const names = new Set<string>();
  for (const selection of operation.selectionSet.selections) {
    if (selection.kind !== Kind.FIELD) continue;
    const field = mutationType.getFields()[selection.name.value];
    if (!field) continue;
    for (const arg of field.args) {
      if (/Id$/.test(arg.name)) names.add(arg.name);
      for (const name of idFieldsOf(arg.type)) names.add(name);
    }
  }
  return [...names].sort();
}

describe('every id an enqueueable input declares is classified for the drain', () => {
  const schema = buildSchema(
    fs.readFileSync(
      path.join(SRC, 'graphql', 'generated', 'schema.graphql'),
      'utf8',
    ),
  );
  const mutations = authoredMutations();
  const queueable = new Set([
    ...syncMappedOperations(),
    ...localFirstOperationNames(),
  ]);
  const candidates = [...queueable].filter(name => mutations.has(name)).sort();

  it('finds the enqueueable operations at all', () => {
    expect(candidates.length).toBeGreaterThan(3);
  });

  it('never lists a subject or parent key as never-queued', () => {
    // A key may be both subject and parent (`mealPlanId`: the plan being
    // edited, or the plan a meal is added to); it cannot also be never-queued.
    const waited = new Set<string>([...SUBJECT_KEYS, ...PARENT_REFERENCE_KEYS]);
    expect(
      Object.keys(NEVER_QUEUED_REFERENCE).filter(key => waited.has(key)),
    ).toEqual([]);
  });

  it.each(candidates.map(name => [name]))(
    '%s declares only classified ids',
    name => {
      const unclassified = inputIdFields(schema, mutations.get(name)!).filter(
        field =>
          !SUBJECT_KEYS.includes(field) &&
          !PARENT_REFERENCE_KEYS.includes(field) &&
          !(field in NEVER_QUEUED_REFERENCE),
      );
      expect(
        unclassified.length === 0
          ? true
          : `${name} declares ${unclassified.join(', ')}: add each to SUBJECT_KEYS (the write's own row), PARENT_REFERENCE_KEYS in queueManager (a row an earlier queued write may have minted, so the drain waits for it) or NEVER_QUEUED_REFERENCE with the reason.`,
      ).toBe(true);
    },
  );
});
