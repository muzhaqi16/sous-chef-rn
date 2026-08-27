/**
 * The pantry half of the offline queue's replay mapping: what each queued
 * pantry mutation becomes when it is replayed through its `Sync*` upsert.
 *
 * Driven through the kernel's `convertToSyncMutation` rather than the builder
 * table directly, so the op-name → builder wiring is under test too — a builder
 * that is correct but unregistered replays as the original mutation and
 * silently loses the idempotency the table exists to provide.
 */
import type { DocumentNode } from 'graphql';
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

// Variables ride inside `input`, and the output is `{ input: { clientId, ... } }`
// (clientId INSIDE input).
const wrapper = (syncVariables: Record<string, unknown>) =>
  syncVariables.input as Record<string, unknown>;

describe('pantry sync builders', () => {
  it('converts CreatePantryItem → SyncPantryItem (id → clientId inside input)', () => {
    const mutation = makeMutation({
      operationName: 'CreatePantryItem',
      // Real CreatePantryItemInput carries pantryId + item:{name}.
      variables: {
        input: { id: 'item-1', pantryId: 'pan-1', item: { name: 'Milk' } },
      },
    });
    const { syncVariables } = convertToSyncMutation(mutation);
    const input = wrapper(syncVariables);
    expect(input.clientId).toBe('item-1');
    expect(input.pantryId).toBe('pan-1');
    expect(input.item).toEqual({ name: 'Milk' });
    expect(input.id).toBeUndefined();
  });

  // UpdatePantryItemInput has no pantryId and sends a flat itemName, but
  // SyncPantryItemInput requires pantryId and takes item:{name}. The converter
  // backfills pantryId from the cached PantryItem and folds itemName into item.
  it('converts UpdatePantryItem → SyncPantryItem (backfills pantryId, folds itemName→item)', () => {
    mockClient.cache.readFragment.mockReturnValue({
      id: 'item-2',
      pantryId: 'pan-2',
    });
    const mutation = makeMutation({
      operationName: 'UpdatePantryItem',
      variables: {
        input: {
          id: 'item-2',
          itemName: 'Eggs',
          storage: { storageState: 'OPENED' },
          version: 4,
        },
      },
    });
    const { syncVariables } = convertToSyncMutation(mutation);
    const input = wrapper(syncVariables);
    expect(input.clientId).toBe('item-2');
    expect(input.version).toBe(4);
    // pantryId backfilled from cache (required by SyncPantryItemInput).
    expect(input.pantryId).toBe('pan-2');
    // itemName folded into item:{name}; no flat itemName forwarded.
    expect(input.item).toEqual({ name: 'Eggs' });
    expect(input.itemName).toBeUndefined();
    expect(input.storage).toEqual({ storageState: 'OPENED' });
  });

  it('throws when pantryId cannot be resolved for a pantry-item sync', () => {
    mockClient.cache.readFragment.mockReturnValue(null);
    const mutation = makeMutation({
      operationName: 'UpdatePantryItem',
      variables: { input: { id: 'orphan-item', itemName: 'Ghost' } },
    });
    expect(() => convertToSyncMutation(mutation)).toThrow(
      'Cannot sync UpdatePantryItem: pantryId not found',
    );
  });

  // UpdatePantryItemQuantityInput carries the item id as `pantryItemId`, the
  // quantity as a raw string, and the unit as a flat `unitId` — none of which
  // align with SyncPantryItemInput. The dedicated builder maps each field.
  it('converts UpdatePantryItemQuantity → SyncPantryItem (pantryItemId → clientId, string → Float, unitId → unit)', () => {
    mockClient.cache.readFragment.mockReturnValue({
      id: 'item-q',
      pantryId: 'pan-q',
    });
    const mutation = makeMutation({
      operationName: 'UpdatePantryItemQuantity',
      variables: {
        input: {
          pantryItemId: 'item-q',
          quantity: '2.5',
          unitId: 'unit-7',
          version: 3,
        },
      },
    });
    const { syncVariables } = convertToSyncMutation(mutation);
    const input = wrapper(syncVariables);
    expect(input.clientId).toBe('item-q');
    expect(input.pantryId).toBe('pan-q');
    expect(input.quantity).toBe(2.5);
    expect(input.unit).toEqual({ unitId: 'unit-7' });
    expect(input.version).toBe(3);
    expect(input.pantryItemId).toBeUndefined();
  });

  it('omits quantity/unit from the quantity sync when absent or unparsable', () => {
    mockClient.cache.readFragment.mockReturnValue({
      id: 'item-q2',
      pantryId: 'pan-q2',
    });
    const mutation = makeMutation({
      operationName: 'UpdatePantryItemQuantity',
      variables: {
        input: { pantryItemId: 'item-q2', quantity: '', unitId: null },
      },
    });
    const { syncVariables } = convertToSyncMutation(mutation);
    const input = wrapper(syncVariables);
    expect(input.clientId).toBe('item-q2');
    expect(input.quantity).toBeUndefined();
    expect(input.unit).toBeUndefined();
  });

  it('converts DeletePantryItem → SyncDeletePantryItem', () => {
    const mutation = makeMutation({
      operationName: 'DeletePantryItem',
      variables: { input: { id: 'item-3', version: 2 } },
    });
    const { syncVariables } = convertToSyncMutation(mutation);
    const input = wrapper(syncVariables);
    expect(input.clientId).toBe('item-3');
    expect(input.version).toBe(2);
  });

  // Specialized single-item creates map onto the same sync mutations as their
  // canonical counterparts (they create the same entity from the same fields).
  it('converts BarcodeCreatePantryItem → SyncPantryItem', () => {
    const mutation = makeMutation({
      operationName: 'BarcodeCreatePantryItem',
      variables: {
        input: { id: 'p-1', pantryId: 'pan-1', itemId: 'cat-1', quantity: 2 },
      },
    });
    const input = wrapper(convertToSyncMutation(mutation).syncVariables);
    expect(input.clientId).toBe('p-1');
    expect(input.pantryId).toBe('pan-1');
    expect(input.itemId).toBe('cat-1');
    expect(input.id).toBeUndefined();
  });
});
