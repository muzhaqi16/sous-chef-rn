/**
 * The dispatch itself, independent of any one feature's builders: an operation
 * with no `Sync*` mapping replays as the original mutation, and the shared
 * client-id helper never fabricates an id.
 */
import { Kind, type DocumentNode } from 'graphql';
import {
  makeQueuedMutation as makeMutation,
  makeSyncCacheStub,
} from '#/test-utils/queuedMutation';
import type { QueuedMutation } from '#/apollo/offlineQueue/types';
import { convertToSyncMutation as convertToSyncMutationFn } from '#/apollo/offlineQueue/convertToSyncMutation';

const mockClient = { cache: makeSyncCacheStub() };

let convertToSyncMutation: (mutation: QueuedMutation) => {
  syncMutation: DocumentNode;
  syncVariables: Record<string, unknown>;
};

beforeEach(() => {
  jest.clearAllMocks();
  // The builders read the cache themselves — the backfill fragments live with
  // the feature that owns the entity — so the stubbed cache is what the
  // `readFragment` stubs in each case drive.
  convertToSyncMutation = mutation =>
    convertToSyncMutationFn(mutation, mockClient.cache);
});

describe('convertToSyncMutation dispatch', () => {
  // Granular deltas (adjust/restock/consume/open/waste/convert-expired) no
  // longer convert to a sync* twin — they replay as the original canonical
  // mutation, made at-most-once by the client-minted `input.idempotencyKey`
  // the server dedups on (returning ConflictError(IDEMPOTENT_REPLAY)).
  it('replays a granular delta as the original canonical mutation (no sync conversion)', () => {
    const mutation = makeMutation({
      operationName: 'AdjustPantryItemQuantity',
      variables: {
        input: {
          id: 'item-1',
          newQuantity: 3,
          reason: 'recount',
          idempotencyKey: 'op-cuid-1',
        },
      },
      context: { localFirst: true },
    });
    const { syncMutation, syncVariables } = convertToSyncMutation(mutation);
    // Falls through to the default: same document + variables, key intact.
    expect(syncMutation).toBe(mutation.mutation);
    expect(syncVariables).toEqual(mutation.variables);
  });

  it('falls back to original mutation for unknown operation', () => {
    const originalMutation: DocumentNode = {
      kind: Kind.DOCUMENT,
      definitions: [],
    };
    const mutation = makeMutation({
      operationName: 'UnknownOperation',
      mutation: originalMutation,
      variables: { foo: 'bar' },
    });
    const { syncMutation, syncVariables } = convertToSyncMutation(mutation);
    expect(syncMutation).toBe(originalMutation);
    expect(syncVariables.foo).toBe('bar');
  });

  it('leaves clientId undefined when the input has no id (no temp- fallback)', () => {
    // temp- ids are rejected by the server now (client mints permanent cuids);
    // a missing id surfaces as undefined rather than a fabricated temp- id.
    const mutation = makeMutation({
      operationName: 'CreatePantryItem',
      variables: {
        input: { pantryId: 'pan-1', item: { name: 'No ID item' } },
      },
    });
    const { syncVariables } = convertToSyncMutation(mutation);
    const input = syncVariables.input as Record<string, unknown>;
    expect(input.clientId).toBeUndefined();
  });
});
