import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  buildSchema,
  parse,
  Kind,
  isInputObjectType,
  type GraphQLSchema,
  type OperationDefinitionNode,
} from 'graphql';
import { syncMappedOperations } from '#/apollo/offlineQueue/convertToSyncMutation';

/**
 * Every local-first write can converge on replay.
 *
 * `queueLink` enqueues an operation when it is sync-mapped OR when its caller
 * opted in with `context: { localFirst: true }`. The first half is safe by
 * construction — a `Sync*` upsert keyed by a client-minted cuid lands the same
 * state twice. The second half is safe only if the ORIGINAL mutation is itself
 * at-most-once, which means the input carries something the server can
 * deduplicate on: a client-minted `id`/`clientId`, or an `idempotencyKey`.
 *
 * Nothing checked that. `MoveShoppingItemToPantry` shipped local-first with the
 * shopping-row removal living in a mutation `update` callback — which runs
 * neither for the queued call nor for its replay — so the server deleted the
 * line while the client kept rendering it. This is the gate for the class: a
 * fifth path added later has to answer the same question.
 */

const ROOT = path.join(__dirname, '..', '..');
const SRC = path.join(ROOT, 'src');

/** Ids a server can deduplicate a re-sent mutation on. */
const IDEMPOTENCY_KEYS = ['id', 'clientId', 'idempotencyKey'];

/**
 * Operations that are local-first without a dedupe key in their input.
 *
 * This is a WORKLIST, not an approval — a shrink-only baseline, the same shape
 * the repo's other ratchets use. Two kinds are on it:
 *
 * - `absolute-update`: an absolute field write keyed by an EXISTING entity id.
 * Re-sending lands the same state twice, so replay converges even though the
 *   input carries no dedupe key of its own. These are safe today; they are
 *   listed because the property is argued, not enforced.
 * - `bulk-create`: an operation that mints rows the client did not name. A
 *   replay CAN duplicate these, and whether it does is a server-side question
 *   this repo cannot answer (`sous-chef-api` is read-only from here). Each one
 *   needs either a `Sync*` twin or a client-minted key before it can be trusted
 *   offline.
 *
 * Nothing may be ADDED here without the same argument being written down. A new
 * local-first operation that is neither sync-mapped nor idempotent fails.
 */
const REPLAY_SAFETY_BASELINE: Record<string, 'absolute-update' | 'bulk-create'> =
  {
    AddDietaryRestriction: 'absolute-update',
    AddItemsToShoppingListFromRecipe: 'bulk-create',
    CreateFromTemplate: 'bulk-create',
    CreateMealPlanFromTemplate: 'bulk-create',
    CreateShoppingListItemsFromRecipe: 'bulk-create',
    CreateTemplateFromMealPlan: 'bulk-create',
    DeleteMultipleNotifications: 'absolute-update',
    DeleteRecipeFolder: 'absolute-update',
    MarkAllNotificationsAsRead: 'absolute-update',
    MarkExpirationAction: 'absolute-update',
    MarkExpirationNotificationAsRead: 'absolute-update',
    MovePurchasedItemsToPantry: 'bulk-create',
    RemoveItemsFromShoppingList: 'absolute-update',
    RemoveRecipeFromFavorites: 'absolute-update',
    SendTestNotification: 'absolute-update',
    UpdateDietaryProfile: 'absolute-update',
    UpdateFavoriteRecipe: 'absolute-update',
    UpdateNotificationPreferences: 'absolute-update',
    UpdateRecipeIngredients: 'absolute-update',
    UpdateUserPreferences: 'absolute-update',
    UpdateUserProfile: 'absolute-update',
  };

function walk(dir: string, test: (name: string) => boolean): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      out.push(...walk(full, test));
    } else if (test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** Every authored mutation, by operation name. */
function authoredMutations(): Map<string, OperationDefinitionNode> {
  const found = new Map<string, OperationDefinitionNode>();
  for (const file of walk(SRC, name => name.endsWith('.graphql'))) {
    if (file.includes(path.join('generated', 'schema.graphql'))) continue;
    let doc;
    try {
      doc = parse(fs.readFileSync(file, 'utf8'));
    } catch {
      continue;
    }
    for (const def of doc.definitions) {
      if (
        def.kind === Kind.OPERATION_DEFINITION &&
        def.operation === 'mutation' &&
        def.name
      ) {
        found.set(def.name.value, def);
      }
    }
  }
  return found;
}

/**
 * The operation names reachable from a file that opts into `localFirst`.
 * Over-collects (a file's queries come along too) and is then narrowed to the
 * authored mutations — a false positive here would only make the gate stricter.
 */
function localFirstOperationNames(): Set<string> {
  const names = new Set<string>();
  for (const file of walk(
    SRC,
    name => name.endsWith('.ts') || name.endsWith('.tsx'),
  )) {
    const source = fs.readFileSync(file, 'utf8');
    if (!/localFirst:\s*true/.test(source)) continue;
    for (const match of source.matchAll(/\b([A-Z][A-Za-z0-9_]*)Document\b/g)) {
      names.add(match[1]);
    }
    // `useXMutation()` codegen hooks name the operation the same way.
    for (const match of source.matchAll(/\buse([A-Z][A-Za-z0-9_]*)Mutation\b/g)) {
      names.add(match[1]);
    }
  }
  return names;
}

/** Whether the mutation's input declares a field the server can dedupe on. */
function hasIdempotentInput(
  schema: GraphQLSchema,
  operationName: string,
  operation: OperationDefinitionNode,
): boolean {
  const mutationType = schema.getMutationType();
  if (!mutationType) return false;

  const selections = operation.selectionSet.selections;
  for (const selection of selections) {
    if (selection.kind !== Kind.FIELD) continue;
    const field = mutationType.getFields()[selection.name.value];
    if (!field) continue;
    for (const arg of field.args) {
      let type = arg.type;
      while ('ofType' in type && type.ofType) type = type.ofType as typeof type;
      if (!isInputObjectType(type)) continue;
      const fields = Object.keys(type.getFields());
      if (IDEMPOTENCY_KEYS.some(key => fields.includes(key))) return true;
    }
  }
  void operationName;
  return false;
}

describe('local-first writes are replay-safe', () => {
  const schema = buildSchema(
    fs.readFileSync(
      path.join(SRC, 'graphql', 'generated', 'schema.graphql'),
      'utf8',
    ),
  );
  const mutations = authoredMutations();
  const syncMapped = new Set(syncMappedOperations());
  const candidates = [...localFirstOperationNames()]
    .filter(name => mutations.has(name))
    .sort();

  it('finds the local-first call sites at all', () => {
    // A guard on the guard: a refactor that renames the context key or the
    // generated document suffix would otherwise silently empty this suite.
    expect(candidates.length).toBeGreaterThan(3);
  });

  it.each(candidates.map(name => [name]))(
    '%s replays without duplicating',
    name => {
      const operation = mutations.get(name)!;
      const replaySafe =
        syncMapped.has(name) ||
        hasIdempotentInput(schema, name, operation) ||
        name in REPLAY_SAFETY_BASELINE;

      expect(
        replaySafe
          ? true
          : `${name} is fired with context.localFirst but is neither sync-mapped nor idempotent: re-sending it on reconnect would duplicate the write. Add a Sync* builder, or a client-minted id / idempotencyKey to its input.`,
      ).toBe(true);
    },
  );

  it('the baseline only shrinks', () => {
    // An entry that no longer applies — the operation gained a dedupe key, a
    // `Sync*` twin, or stopped being local-first — has to leave the list, or it
    // silently exempts a future operation that happens to reuse the name.
    const stale = Object.keys(REPLAY_SAFETY_BASELINE).filter(name => {
      const operation = mutations.get(name);
      if (!operation || !candidates.includes(name)) return true;
      return syncMapped.has(name) || hasIdempotentInput(schema, name, operation);
    });

    expect(stale).toEqual([]);
  });
});
