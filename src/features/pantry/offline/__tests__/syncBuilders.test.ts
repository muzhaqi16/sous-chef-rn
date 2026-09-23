/**
 * The pantry half of the offline queue's replay mapping: what each queued
 * pantry mutation becomes when it is replayed through its `Sync*` upsert.
 *
 * Driven through the kernel's `convertToSyncMutation` rather than the builder
 * table directly, so the op-name → builder wiring is under test too — a builder
 * that is correct but unregistered replays as the original mutation and
 * silently loses the idempotency the table exists to provide.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  buildSchema,
  isInputObjectType,
  isNonNullType,
  type DocumentNode,
} from 'graphql';
import {
  makeQueuedMutation as makeMutation,
  makeSyncCacheStub,
  queuedMutationFor,
} from '#/test-utils/queuedMutation';
import {
  CreatePantryItemDocument,
  DeletePantryItemDocument,
  UpdatePantryItemDocument,
  UpdatePantryItemQuantityDocument,
} from '#features/pantry/graphql/pantry.generated';
import { BarcodeCreatePantryItemDocument } from '#features/barcode/hooks/useAddScannedItem.generated';
import type { QueuedMutation } from '#/apollo/offlineQueue/types';
import {
  captureReplayInputs,
  convertToSyncMutation as convertToSyncMutationFn,
} from '#/apollo/offlineQueue/convertToSyncMutation';
import { getDeviceDecimalSeparator } from '#/utils/deviceLocale';

jest.mock('#/utils/deviceLocale', () => ({
  getDeviceDecimalSeparator: jest.fn(() => '.'),
}));

const mockClient = { cache: makeSyncCacheStub() };

let convertToSyncMutation: (mutation: QueuedMutation) => {
  syncMutation: DocumentNode;
  syncVariables: Record<string, unknown>;
  requiresVersion?: boolean;
};

beforeEach(() => {
  jest.clearAllMocks();
  (getDeviceDecimalSeparator as jest.Mock).mockReturnValue('.');
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
      ...queuedMutationFor(CreatePantryItemDocument),
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

  // UpdatePantryItemInput has no pantryId, but SyncPantryItemInput requires it:
  // the converter backfills it from the cached PantryItem.
  it('converts UpdatePantryItem → SyncPantryItem (backfills pantryId)', () => {
    mockClient.cache.readFragment.mockReturnValue({
      id: 'item-2',
      pantryId: 'pan-2',
    });
    const mutation = makeMutation({
      ...queuedMutationFor(UpdatePantryItemDocument),
      variables: {
        input: {
          id: 'item-2',
          storage: { storageState: 'OPENED' },
          version: 4,
        },
      },
    });
    const { syncVariables } = convertToSyncMutation(mutation);
    const input = wrapper(syncVariables);
    expect(input.clientId).toBe('item-2');
    expect(input.version).toBe(4);
    expect(input.pantryId).toBe('pan-2');
    expect(input.storage).toEqual({ storageState: 'OPENED' });
  });

  // The sync upsert's update branch ignores `item`, so a rename sent through it
  // is dropped and the old name written back. The original document applies it.
  it('replays a queued rename as its original UpdatePantryItem', () => {
    const mutation = makeMutation({
      ...queuedMutationFor(UpdatePantryItemDocument),
      variables: { input: { id: 'item-2', itemName: 'Oat milk', version: 4 } },
    });

    const conversion = convertToSyncMutation(mutation);

    expect(conversion.syncMutation).toBe(UpdatePantryItemDocument);
    expect(conversion.syncVariables).toEqual(mutation.variables);
    expect(conversion.requiresVersion).toBe(true);
  });

  it('pins the rename passthrough to the SDL: its input requires version', () => {
    const schema = buildSchema(
      readFileSync(
        join(process.cwd(), 'src/graphql/generated/schema.graphql'),
        'utf8',
      ),
    );
    const input = schema.getType('UpdatePantryItemInput');
    expect(
      isInputObjectType(input) &&
        isNonNullType(input.getFields().version?.type),
    ).toBe(true);
  });

  describe('values captured when queued', () => {
    it('builds an edit whose row has left the cache from what it captured', () => {
      mockClient.cache.readFragment.mockReturnValue(null);
      const mutation = makeMutation({
        ...queuedMutationFor(UpdatePantryItemDocument),
        variables: { input: { id: 'gone-item', notes: 'x', version: 2 } },
        replayInputs: { pantryId: 'pan-7' },
      });

      expect(wrapper(convertToSyncMutation(mutation).syncVariables)).toEqual(
        expect.objectContaining({ clientId: 'gone-item', pantryId: 'pan-7' }),
      );
    });

    it('builds a quantity edit whose row has left the cache from what it captured', () => {
      mockClient.cache.readFragment.mockReturnValue(null);
      const mutation = makeMutation({
        ...queuedMutationFor(UpdatePantryItemQuantityDocument),
        variables: {
          input: { pantryItemId: 'gone-item', quantity: '1.5', unitId: 'u-kg' },
        },
        replayInputs: { pantryId: 'pan-7', unitSymbol: 'kg' },
      });

      expect(wrapper(convertToSyncMutation(mutation).syncVariables)).toEqual({
        clientId: 'gone-item',
        pantryId: 'pan-7',
        quantity: 1.5,
        unit: { unitId: 'u-kg', unitSymbol: 'kg' },
      });
    });

    it('prefers the pantry it captured over a later cache read', () => {
      mockClient.cache.readFragment.mockReturnValue({
        id: 'item-2',
        pantryId: 'pan-later',
      });
      const mutation = makeMutation({
        ...queuedMutationFor(UpdatePantryItemDocument),
        variables: { input: { id: 'item-2', notes: 'x', version: 2 } },
        replayInputs: { pantryId: 'pan-queued' },
      });

      expect(
        wrapper(convertToSyncMutation(mutation).syncVariables).pantryId,
      ).toBe('pan-queued');
    });

    it('captures the pantry an edit reads, while the row is cached', () => {
      mockClient.cache.readFragment.mockReturnValue({
        id: 'item-2',
        pantryId: 'pan-2',
      });
      const mutation = makeMutation({
        ...queuedMutationFor(UpdatePantryItemQuantityDocument),
        variables: { input: { pantryItemId: 'item-2', quantity: '3' } },
      });

      expect(captureReplayInputs(mutation, mockClient.cache)).toEqual({
        pantryId: 'pan-2',
      });
    });
  });

  it('throws when pantryId cannot be resolved for a pantry-item sync', () => {
    mockClient.cache.readFragment.mockReturnValue(null);
    const mutation = makeMutation({
      ...queuedMutationFor(UpdatePantryItemDocument),
      variables: { input: { id: 'orphan-item', notes: 'Ghost' } },
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
      ...queuedMutationFor(UpdatePantryItemQuantityDocument),
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

  // The queued text is what the API was sent: already `.`-decimal, never
  // device text, so a comma device must not read `1.250` as grouped thousands.
  it('reads the queued quantity as API text on a comma-decimal device', () => {
    (getDeviceDecimalSeparator as jest.Mock).mockReturnValue(',');
    mockClient.cache.readFragment.mockReturnValue({
      id: 'item-c',
      pantryId: 'pan-c',
    });
    const mutation = makeMutation({
      ...queuedMutationFor(UpdatePantryItemQuantityDocument),
      variables: { input: { pantryItemId: 'item-c', quantity: '1.250' } },
    });

    const input = wrapper(convertToSyncMutation(mutation).syncVariables);

    expect(input.quantity).toBe(1.25);
  });

  it('omits quantity/unit from the quantity sync when absent or unparsable', () => {
    mockClient.cache.readFragment.mockReturnValue({
      id: 'item-q2',
      pantryId: 'pan-q2',
    });
    const mutation = makeMutation({
      ...queuedMutationFor(UpdatePantryItemQuantityDocument),
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

  // A pantry holds one stack per item and unit. A stack another member added
  // while this create sat queued would refuse it as a duplicate; `forceAdd`
  // joins it instead, and the replay lookup keeps a re-send idempotent.
  it.each([CreatePantryItemDocument, BarcodeCreatePantryItemDocument])(
    'replays a queued create with forceAdd (%#)',
    document => {
      const mutation = makeMutation({
        ...queuedMutationFor(document),
        variables: { input: { id: 'p-9', pantryId: 'pan-1', quantity: 12 } },
      });

      const input = wrapper(convertToSyncMutation(mutation).syncVariables);

      expect(input.forceAdd).toBe(true);
    },
  );

  // `today` is the day the user acted, which the replay may be days after;
  // the server derives a shelf-life expiry from it.
  it('forwards the queued today to the sync upsert', () => {
    const mutation = makeMutation({
      ...queuedMutationFor(CreatePantryItemDocument),
      variables: {
        input: { id: 'p-9', pantryId: 'pan-1', today: '2026-09-22' },
      },
    });

    const input = wrapper(convertToSyncMutation(mutation).syncVariables);

    expect(input.today).toBe('2026-09-22');
  });

  it('sends no forceAdd on an update', () => {
    mockClient.cache.readFragment.mockReturnValue({
      id: 'item-u',
      pantryId: 'pan-u',
    });
    const mutation = makeMutation({
      ...queuedMutationFor(UpdatePantryItemDocument),
      variables: { input: { id: 'item-u', notes: 'x', version: 2 } },
    });

    const input = wrapper(convertToSyncMutation(mutation).syncVariables);

    expect(input.forceAdd).toBeUndefined();
  });

  it('converts DeletePantryItem → SyncDeletePantryItem', () => {
    const mutation = makeMutation({
      ...queuedMutationFor(DeletePantryItemDocument),
      variables: { input: { id: 'item-3' } },
    });
    const { syncVariables } = convertToSyncMutation(mutation);
    const input = wrapper(syncVariables);
    expect(input.clientId).toBe('item-3');
  });

  // `itemId` on a create is the CATALOG item. A row with no minted id must reach
  // the server without one and be refused, not upsert a row keyed by the catalog.
  it('names no client id for a create queued without its row id', () => {
    const mutation = makeMutation({
      ...queuedMutationFor(BarcodeCreatePantryItemDocument),
      variables: { input: { pantryId: 'pan-1', itemId: 'cat-1' } },
    });
    const input = wrapper(convertToSyncMutation(mutation).syncVariables);
    expect(input.clientId).toBeUndefined();
  });

  // Specialized single-item creates map onto the same sync mutations as their
  // canonical counterparts (they create the same entity from the same fields).
  it('converts BarcodeCreatePantryItem → SyncPantryItem', () => {
    const mutation = makeMutation({
      ...queuedMutationFor(BarcodeCreatePantryItemDocument),
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
