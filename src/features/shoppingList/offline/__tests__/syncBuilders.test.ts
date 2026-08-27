/**
 * The shopping-list half of the offline queue's replay mapping: what each
 * queued shopping mutation becomes when it is replayed through its `Sync*`
 * upsert.
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

describe('shopping-list sync builders', () => {
  it('converts AddItemToShoppingList (batch-of-1 input) → SyncShoppingListItem ({ clientId, item })', () => {
    // The single-add op now sends the batch AddItemsToShoppingListInput shape;
    // the sync builder flattens items[0] (+ shoppingListId) back to one item.
    const mutation = makeMutation({
      operationName: 'AddItemToShoppingList',
      variables: {
        input: {
          shoppingListId: 'list-1',
          items: [
            {
              id: 'sl-1',
              // The @oneOf catalog ref rides nested on the queued item,
              // exactly as useAddShoppingItem enqueues it.
              item: { itemName: 'Bread' },
              quantity: 2,
            },
          ],
        },
      },
    });
    const { syncVariables } = convertToSyncMutation(mutation);
    const input = wrapper(syncVariables);
    expect(input.clientId).toBe('sl-1');
    const item = input.item as Record<string, unknown>;
    expect(item.shoppingListId).toBe('list-1');
    expect(item.item).toEqual({ itemName: 'Bread' });
    // FlexibleQuantity scalar — passed through, no unitId needed.
    expect(item.quantity).toBe(2);
  });

  it('converts UpdateShoppingListItemQuantity with cache read', () => {
    // One combined mock serves both cache reads (list id + item ref).
    mockClient.cache.readFragment.mockReturnValue({
      id: 'sl-item-1',
      shoppingList: { id: 'list-99' },
      itemName: 'Bread',
      item: null,
    });
    const mutation = makeMutation({
      operationName: 'UpdateShoppingListItemQuantity',
      variables: {
        input: { itemId: 'sl-item-1', quantity: '5', version: 3 },
      },
    });
    const { syncVariables } = convertToSyncMutation(mutation);
    const input = wrapper(syncVariables);
    expect(input.clientId).toBe('sl-item-1');
    const item = input.item as Record<string, unknown>;
    expect(item.shoppingListId).toBe('list-99');
    // The qty input's `itemId` is the ROW id — the @oneOf catalog ref must be
    // backfilled from the cached row, never from that field.
    expect(item.item).toEqual({ itemName: 'Bread' });
    expect(item.quantity).toBe('5');
    expect(item.version).toBe(3);
  });

  // UpdateShoppingListItemQuantity sends a flat `unitId`, but
  // SyncShoppingListItemInput.unit is a UnitSpecInput object — the converter
  // normalizes the flat scalar into `unit` so an offline unit change isn't lost.
  it('normalizes a flat unitId into unit:{unitId} for a quantity sync', () => {
    mockClient.cache.readFragment.mockReturnValue({
      id: 'sl-item-1',
      shoppingList: { id: 'list-99' },
      itemName: 'Bread',
      item: null,
    });
    const mutation = makeMutation({
      operationName: 'UpdateShoppingListItemQuantity',
      variables: {
        input: { itemId: 'sl-item-1', quantity: '5', unitId: 'unit-7' },
      },
    });
    const { syncVariables } = convertToSyncMutation(mutation);
    const item = wrapper(syncVariables).item as Record<string, unknown>;
    expect(item.unit).toEqual({ unitId: 'unit-7' });
  });

  it('converts ToggleShoppingListItemPurchased with cache read', () => {
    // Toggle input carries no catalog ref — the cached row's linked item id
    // wins over its free-text name for the @oneOf backfill.
    mockClient.cache.readFragment.mockReturnValue({
      id: 'sl-item-2',
      shoppingList: { id: 'list-88' },
      itemName: 'Milk',
      item: { id: 'cat-7' },
    });
    const mutation = makeMutation({
      operationName: 'ToggleShoppingListItemPurchased',
      variables: { input: { id: 'sl-item-2', purchased: true } },
    });
    const { syncVariables } = convertToSyncMutation(mutation);
    const input = wrapper(syncVariables);
    expect(input.clientId).toBe('sl-item-2');
    const item = input.item as Record<string, unknown>;
    expect(item.shoppingListId).toBe('list-88');
    expect(item.item).toEqual({ itemId: 'cat-7' });
    expect(item.purchaseTracking).toEqual({ isPurchased: true });
  });

  it('carries a flat itemName rename into the @oneOf ref for UpdateShoppingListItem', () => {
    mockClient.cache.readFragment.mockReturnValue({
      id: 'sl-item-3',
      shoppingList: { id: 'list-77' },
      itemName: 'Old name',
      item: { id: 'cat-9' },
    });
    const mutation = makeMutation({
      operationName: 'UpdateShoppingListItem',
      variables: {
        input: { id: 'sl-item-3', itemName: 'New name', version: 4 },
      },
    });
    const item = wrapper(convertToSyncMutation(mutation).syncVariables)
      .item as Record<string, unknown>;
    // The rename must win over the cached ref, or the replay undoes it.
    expect(item.item).toEqual({ itemName: 'New name' });
  });

  it('throws when no @oneOf item ref is resolvable for a toggle', () => {
    // Row cached without a linked item or name — the required ref cannot be
    // built, so the replay surfaces a permanent failure instead of sending
    // an empty ref the server rejects.
    mockClient.cache.readFragment.mockReturnValue({
      id: 'sl-item-4',
      shoppingList: { id: 'list-66' },
      itemName: null,
      item: null,
    });
    const mutation = makeMutation({
      operationName: 'ToggleShoppingListItemPurchased',
      variables: { input: { id: 'sl-item-4', purchased: true } },
    });
    expect(() => convertToSyncMutation(mutation)).toThrow('item ref not found');
  });

  it('throws when cache has no shoppingList data for quantity update', () => {
    mockClient.cache.readFragment.mockReturnValue(null);
    const mutation = makeMutation({
      operationName: 'UpdateShoppingListItemQuantity',
      variables: { input: { itemId: 'missing-item', quantity: '2' } },
    });
    expect(() => convertToSyncMutation(mutation)).toThrow(
      'Cannot sync UpdateShoppingListItemQuantity',
    );
  });

  it('converts RemoveItemFromShoppingList → SyncDeleteShoppingListItem', () => {
    const mutation = makeMutation({
      operationName: 'RemoveItemFromShoppingList',
      variables: { input: { id: 'del-item', version: 5 } },
    });
    const { syncVariables } = convertToSyncMutation(mutation);
    const input = wrapper(syncVariables);
    expect(input.clientId).toBe('del-item');
    expect(input.version).toBe(5);
  });

  it('converts MoveShoppingListItem → SyncMoveShoppingListItem (afterItemId → afterId)', () => {
    const mutation = makeMutation({
      operationName: 'MoveShoppingListItem',
      variables: {
        input: {
          itemId: 'mv-1',
          afterItemId: 'a',
          beforeItemId: 'b',
          version: 2,
        },
      },
    });
    const { syncVariables } = convertToSyncMutation(mutation);
    const input = wrapper(syncVariables);
    expect(input.clientId).toBe('mv-1');
    expect(input.afterId).toBe('a');
    expect(input.beforeId).toBe('b');
    expect(input.version).toBe(2);
  });

  it('converts BarcodeAddItemToShoppingList → SyncShoppingListItem (keeps brand + netWeight)', () => {
    const mutation = makeMutation({
      operationName: 'BarcodeAddItemToShoppingList',
      variables: {
        input: {
          shoppingListId: 'list-1',
          items: [
            {
              id: 'sl-9',
              item: { itemId: 'cat-1' },
              quantity: 1,
              brand: { brandId: 'b1' },
              netWeight: { netWeight: 500 },
            },
          ],
        },
      },
    });
    const input = wrapper(convertToSyncMutation(mutation).syncVariables);
    expect(input.clientId).toBe('sl-9');
    const item = input.item as Record<string, unknown>;
    expect(item.shoppingListId).toBe('list-1');
    expect(item.item).toEqual({ itemId: 'cat-1' });
    // Not dropped on sync replay (would be lost if it fell back to replay-original).
    expect(item.brand).toEqual({ brandId: 'b1' });
    expect(item.netWeight).toEqual({ netWeight: 500 });
  });

  it('converts AddItemToShoppingListFromFilteredPantry → SyncShoppingListItem', () => {
    const mutation = makeMutation({
      operationName: 'AddItemToShoppingListFromFilteredPantry',
      variables: {
        input: {
          shoppingListId: 'list-1',
          items: [{ id: 'sl-10', item: { itemId: 'cat-2' } }],
        },
      },
    });
    const input = wrapper(convertToSyncMutation(mutation).syncVariables);
    expect(input.clientId).toBe('sl-10');
    const item = input.item as Record<string, unknown>;
    expect(item.shoppingListId).toBe('list-1');
    expect(item.item).toEqual({ itemId: 'cat-2' });
  });

  it('converts AddItemToShoppingListFromPantryItem → SyncShoppingListItem', () => {
    const mutation = makeMutation({
      operationName: 'AddItemToShoppingListFromPantryItem',
      variables: {
        input: {
          shoppingListId: 'list-1',
          items: [{ id: 'sl-11', item: { itemName: 'Rice' }, quantity: 3 }],
        },
      },
    });
    const input = wrapper(convertToSyncMutation(mutation).syncVariables);
    expect(input.clientId).toBe('sl-11');
    const item = input.item as Record<string, unknown>;
    expect(item.item).toEqual({ itemName: 'Rice' });
    expect(item.quantity).toBe(3);
  });
});
