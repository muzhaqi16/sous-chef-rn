import { gql } from '@apollo/client';
import { act } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import { alertService } from '#/services/alertService';
import {
  recordMock,
  renderHookWithApollo,
  seedCache,
  seedFragment,
} from '#/test-utils/apolloMockProvider';
import { PantryItem_ListedFragmentDoc } from '#features/pantry/cache/pantryItemListed.generated';
import { drained, drainTimers } from '#/test-utils/drainTimers';
import {
  StorageState,
  StorageType,
  UnitType,
} from '#/graphql/generated/schemaTypes';
import { UpdatePantryItemDocument } from '#features/pantry/graphql/pantry.generated';
import { UseUpdatePantryItem_PantryItemFragmentDoc } from '../useUpdatePantryItem.generated';
import type { DirtyFieldFlags, FormDataInput } from '../types';
import { useUpdatePantryItem } from '../useUpdatePantryItem';
import { asAbbreviation } from '#/test-utils/fixtures/unitLabels';

jest.mock('#/services/errorService');

jest.mock('../utils', () => ({
  buildDirtyUpdateInput: jest.fn(
    (data: FormDataInput, dirtyFields: DirtyFieldFlags) => {
      const input: Record<string, unknown> = {};
      if (dirtyFields.itemName) input.itemName = data.itemName;
      if (dirtyFields.notes) input.storageNotes = data.notes;
      if (dirtyFields.brand) input.brand = { name: data.brand };
      if (dirtyFields.location) input.storage = { location: null };
      if (dirtyFields.consumeUnitId) {
        input.consumeUnit = { id: data.consumeUnitId };
      }
      if (dirtyFields.netWeight) {
        input.netWeight = {
          netWeight: Number(data.netWeight),
          netWeightUnitId: data.netWeightUnitId,
        };
      }
      return input;
    },
  ),
  stateToCountKey: jest.fn(() => 'ambient'),
}));

// Hook reads currentItem from the cache via cache.readFragment, so tests
// must seed the cache with a matching entity. The optimistic response is
// then computed from the cached values plus the dirty-field updates.
const buildPantryItem = (overrides: Record<string, unknown> = {}) => ({
  __typename: 'PantryItem',
  id: 'item-1',
  pantryId: 'pantry-1',
  itemId: null,
  itemName: 'Milk',
  quantity: 5,
  heldQuantity: 5,
  displayAmount: {
    __typename: 'DisplayAmount',
    quantity: 5,
    localizedSymbol: 'g',
    fraction: null,
    unit: asAbbreviation({ __typename: 'Unit', id: 'unit-1', symbol: 'g' }),
  },
  version: 1,
  updatedAt: '2025-01-01',
  storageState: 'PANTRY',
  condition: 'GOOD',
  expiresOn: null,
  lowStockAlert: false,
  isLowStock: false,
  minQuantity: null,
  lastUsedAt: null,
  netWeight: null,
  remainingNetWeight: null,
  activeBatchCount: 0,
  earliestBatchExpiresOn: null,
  restockQuantity: null,
  storageNotes: null,
  tags: [],
  item: null,
  unit: asAbbreviation({
    __typename: 'Unit',
    id: 'unit-1',
    name: 'Gram',
    symbol: 'g',
    type: UnitType.Weight,
    displayAsFraction: false,
  }),
  netWeightUnit: null,
  storageLocation: null,
  packageBreakdown: null,
  quantityBreakdown: null,
  brand: null,
  ...overrides,
});

const seedItem = () => seedCache([buildPantryItem()]);

const createFormData = (
  overrides: Partial<FormDataInput> = {},
): FormDataInput => ({
  itemName: 'Milk',
  storageState: StorageState.Ambient,
  location: '',
  notes: 'Fresh milk',
  unit: 'kg',
  ...overrides,
});

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useUpdatePantryItem', () => {
  it('returns updatePantryItemFields function', () => {
    const { result } = renderHookWithApollo(() => useUpdatePantryItem({}), {
      cache: seedItem(),
    });

    expect(typeof result.current.updatePantryItemFields).toBe('function');
  });

  it('resolves true once the write is queued', async () => {
    const { result } = renderHookWithApollo(() => useUpdatePantryItem({}), {
      cache: seedItem(),
      operationMocks: [
        {
          request: { query: UpdatePantryItemDocument, variables: () => true },
          result: { data: { updatePantryItem: null } },
        },
      ],
    });

    const stands = await drained(() =>
      result.current.updatePantryItemFields({
        itemId: 'item-1',
        input: createFormData(),
        dirtyFields: { itemName: true },
        selectedLocationId: null,
        selectedBrandId: null,
      }),
    );

    expect(stands).toBe(true);
  });

  it("edits a stack known only from its list row, at that row's version", async () => {
    const cache = makeCache();
    seedFragment(cache, {
      fragment: PantryItem_ListedFragmentDoc,
      fragmentName: 'pantryItem_listed',
      data: { __typename: 'PantryItem', id: 'item-1', version: 7 },
    });
    const update = recordMock(UpdatePantryItemDocument, {
      data: { updatePantryItem: null },
    });
    const { result } = renderHookWithApollo(() => useUpdatePantryItem({}), {
      cache,
      operationMocks: [update.mock],
    });

    const stands = await drained(() =>
      result.current.updatePantryItemFields({
        itemId: 'item-1',
        input: createFormData(),
        dirtyFields: { itemName: true },
        selectedLocationId: null,
        selectedBrandId: null,
      }),
    );

    expect(stands).toBe(true);
    expect(update.fired[0]).toMatchObject({
      input: { id: 'item-1', version: 7 },
    });
  });

  it('says so when the device holds no such stack, rather than saving nothing', async () => {
    const alert = jest
      .spyOn(alertService, 'alert')
      .mockImplementation(() => {});
    const { result } = renderHookWithApollo(() => useUpdatePantryItem({}), {
      cache: makeCache(),
    });

    const stands = await drained(() =>
      result.current.updatePantryItemFields({
        itemId: 'not-held',
        input: createFormData(),
        dirtyFields: { itemName: true },
        selectedLocationId: null,
        selectedBrandId: null,
      }),
    );

    expect(stands).toBe(false);
    expect(alert).toHaveBeenCalledTimes(1);
    alert.mockRestore();
  });

  it('resolves false when the server refuses the write', async () => {
    const { result } = renderHookWithApollo(() => useUpdatePantryItem({}), {
      cache: seedItem(),
      operationMocks: [
        {
          request: { query: UpdatePantryItemDocument, variables: () => true },
          result: {
            data: {
              updatePantryItem: {
                __typename: 'ValidationError',
                code: 'VALIDATION_FAILED',
                message: 'Name is invalid',
                field: 'itemName',
              },
            },
          },
        },
      ],
    });

    const stands = await drained(() =>
      result.current.updatePantryItemFields({
        itemId: 'item-1',
        input: createFormData(),
        dirtyFields: { itemName: true },
        selectedLocationId: null,
        selectedBrandId: null,
      }),
    );

    expect(stands).toBe(false);
  });

  it('resolves true without a mutation when no fields are dirty', async () => {
    const { result } = renderHookWithApollo(() => useUpdatePantryItem({}), {
      cache: seedItem(),
    });

    const stands = await drained(() =>
      result.current.updatePantryItemFields({
        itemId: 'item-1',
        input: createFormData(),
        dirtyFields: {},
        selectedLocationId: null,
        selectedBrandId: null,
      }),
    );

    expect(stands).toBe(true);
    // Early return — buildDirtyUpdateInput returns {} so the mutation never fires.
    const { buildDirtyUpdateInput } = jest.requireMock('../utils');
    expect(buildDirtyUpdateInput.mock.results[0]?.value).toEqual({});
  });
});

describe('useUpdatePantryItem — a package size typed in another unit', () => {
  const queued = {
    request: { query: UpdatePantryItemDocument, variables: () => true },
    result: { data: { updatePantryItem: null } },
  };
  const readNetWeight = (cache: ReturnType<typeof seedCache>) =>
    cache.readFragment<{ netWeight: number | null }>({
      optimistic: true,
      id: cache.identify({ __typename: 'PantryItem', id: 'item-1' }),
      fragment: UseUpdatePantryItem_PantryItemFragmentDoc,
      fragmentName: 'useUpdatePantryItem_pantryItem',
    })?.netWeight;

  const saveSize = async (netWeight: string, netWeightUnitId: string) => {
    const cache = seedCache([
      buildPantryItem({
        netWeight: 1360.78,
        netWeightUnit: asAbbreviation({
          __typename: 'Unit',
          id: 'unit-g',
          name: 'gram',
          symbol: 'g',
        }),
      }),
    ]);
    const { result } = renderHookWithApollo(() => useUpdatePantryItem({}), {
      cache,
      operationMocks: [queued],
    });
    await drained(() =>
      result.current.updatePantryItemFields({
        itemId: 'item-1',
        input: createFormData({ netWeight, netWeightUnitId }),
        dirtyFields: { netWeight: true },
        selectedLocationId: null,
        selectedBrandId: null,
      }),
    );
    return readNetWeight(cache);
  };

  // 2.5 written against the stack's grams would read "2.5 g" until the server
  // re-expresses the batches in pounds.
  it('writes nothing ahead of the server for a size in pounds on a gram stack', async () => {
    expect(await saveSize('2.5', 'unit-lb')).toBe(1360.78);
  });

  it('writes a size in the stack’s own unit at once', async () => {
    expect(await saveSize('1000', 'unit-g')).toBe(1000);
  });
});

describe('useUpdatePantryItem — what shows at once', () => {
  const SHOWN = gql`
    fragment ShownProbe on PantryItem {
      id
      brand {
        version
        id
        name
      }
      consumeUnit {
        id
        symbol
      }
      storageLocation {
        id
        name
        type
      }
    }
  `;

  async function shownWhilePending(
    input: Partial<FormDataInput>,
    dirtyFields: DirtyFieldFlags,
    picks: { selectedBrandId?: string } = {},
  ) {
    const cache = seedItem();
    const { result } = renderHookWithApollo(() => useUpdatePantryItem({}), {
      cache,
      operationMocks: [
        {
          request: { query: UpdatePantryItemDocument, variables: () => true },
          result: { data: { updatePantryItem: null } },
        },
      ],
    });
    let shown: unknown = null;
    await act(async () => {
      void result.current.updatePantryItemFields({
        itemId: 'item-1',
        input: createFormData(input),
        dirtyFields,
        selectedLocationId: null,
        selectedBrandId: picks.selectedBrandId ?? null,
      });
      shown = cache.readFragment({
        id: cache.identify({ __typename: 'PantryItem', id: 'item-1' }),
        fragment: SHOWN,
        optimistic: true,
        returnPartialData: true,
      });
    });
    return shown;
  }

  it('shows a picked brand', async () => {
    const shown = await shownWhilePending(
      { brand: 'Sunrise' },
      { brand: true },
      { selectedBrandId: 'brand-1' },
    );

    expect(shown).toMatchObject({
      brand: { id: 'brand-1', name: 'Sunrise', version: 0 },
    });
  });

  it('shows a typed brand and clears an emptied one', async () => {
    expect(
      await shownWhilePending({ brand: 'Sunrise' }, { brand: true }),
    ).toMatchObject({ brand: { name: 'Sunrise' } });
    expect(
      await shownWhilePending({ brand: ' ' }, { brand: true }),
    ).toMatchObject({ brand: null });
  });

  it('shows the unit a stack is used in', async () => {
    const shown = await shownWhilePending(
      { consumeUnit: 'cup', consumeUnitId: 'unit-cup' },
      { consumeUnitId: true },
    );

    expect(shown).toMatchObject({
      consumeUnit: { id: 'unit-cup', symbol: 'cup' },
    });
  });

  it('shows a typed location and clears an emptied one', async () => {
    expect(
      await shownWhilePending({ location: 'Garage' }, { location: true }),
    ).toMatchObject({
      storageLocation: { name: 'Garage', type: StorageType.Custom },
    });
    expect(
      await shownWhilePending({ location: '' }, { location: true }),
    ).toMatchObject({ storageLocation: null });
  });
});

describe('useUpdatePantryItem — local-first cache behavior', () => {
  const readItemName = (cache: ReturnType<typeof seedCache>) =>
    cache.readFragment<{ itemName: string }>({
      optimistic: true,
      id: cache.identify({ __typename: 'PantryItem', id: 'item-1' }),
      fragment: UseUpdatePantryItem_PantryItemFragmentDoc,
      fragmentName: 'useUpdatePantryItem_pantryItem',
    })?.itemName;

  const fireRename = (
    result: { current: ReturnType<typeof useUpdatePantryItem> },
    itemName: string,
  ) => {
    void result.current.updatePantryItemFields({
      itemId: 'item-1',
      input: createFormData({ itemName }),
      dirtyFields: { itemName: true },
      selectedLocationId: null,
      selectedBrandId: null,
    });
  };

  it('writes the update to the cache PERMANENTLY before the mutation settles, and a queued (null) result keeps it', async () => {
    const cache = seedItem();
    const { result } = renderHookWithApollo(() => useUpdatePantryItem({}), {
      cache,
      operationMocks: [
        {
          request: {
            query: UpdatePantryItemDocument,
            variables: () => true,
          },
          // The offline queue completes an intercepted mutation with each
          // top-level field null — the classifier reads that as 'queued'.
          result: { data: { updatePantryItem: null } },
        },
      ],
    });

    await act(async () => {
      fireRename(result, 'Oat Milk');
      // Synchronous permanent write — visible before the mutation settles.
      expect(readItemName(cache)).toBe('Oat Milk');
    });

    // Queued result keeps the write (no rollback).
    expect(readItemName(cache)).toBe('Oat Milk');
  });

  it('restores the pre-edit snapshot when the server rejects the update', async () => {
    const cache = seedItem();
    const { result } = renderHookWithApollo(() => useUpdatePantryItem({}), {
      cache,
      operationMocks: [
        {
          request: {
            query: UpdatePantryItemDocument,
            variables: () => true,
          },
          result: {
            data: {
              updatePantryItem: {
                __typename: 'ValidationError',
                code: 'VALIDATION_FAILED',
                message: 'Name is invalid',
                field: 'itemName',
              },
            },
          },
        },
      ],
    });

    await act(async () => {
      fireRename(result, 'Bad Name');
      expect(readItemName(cache)).toBe('Bad Name');
    });

    await drainTimers();
    expect(readItemName(cache)).toBe('Milk');
    // A refused union payload resolves as data, so the mutation's onError
    // never fires — the hook has to tell the user itself. The refusal names a
    // field, so its own sentence is what gets shown.
    // The app's copy for `field: 'itemName'`, not the server's "Name is
    // invalid" — the server has no locale to render that in.
    expect(alertService.alert).toHaveBeenCalledWith(
      'Error',
      'Enter a name for this item.',
    );
  });

  it('falls back to the generic copy for an unattributed refusal', async () => {
    const cache = seedItem();
    const { result } = renderHookWithApollo(() => useUpdatePantryItem({}), {
      cache,
      operationMocks: [
        {
          request: {
            query: UpdatePantryItemDocument,
            variables: () => true,
          },
          result: {
            data: {
              updatePantryItem: {
                __typename: 'ValidationError',
                code: 'VALIDATION_FAILED',
                message: 'Something was invalid',
                field: null,
              },
            },
          },
        },
      ],
    });

    await act(async () => {
      fireRename(result, 'Bad Name');
    });

    await drainTimers();
    expect(readItemName(cache)).toBe('Milk');
    expect(alertService.alert).toHaveBeenCalledWith(
      'Error',
      'Failed to update item',
    );
  });

  it('tells the user which input the server refused (the unit)', async () => {
    // `unit` only relabels the unit in use; a different one is refused on
    // `field: "unit"`. The edit must snap back AND say which input was refused —
    // in the app's own words, because `message` is English only.
    const cache = seedItem();
    const { result } = renderHookWithApollo(() => useUpdatePantryItem({}), {
      cache,
      operationMocks: [
        {
          request: {
            query: UpdatePantryItemDocument,
            variables: () => true,
          },
          result: {
            data: {
              updatePantryItem: {
                __typename: 'ValidationError',
                code: 'VALIDATION_FAILED',
                message:
                  "A pantry item's unit changes through changePantryItemUnit.",
                field: 'unit',
              },
            },
          },
        },
      ],
    });

    await act(async () => {
      fireRename(result, 'Milk (cans)');
    });

    await drainTimers();
    expect(readItemName(cache)).toBe('Milk');
    expect(alertService.alert).toHaveBeenCalledWith(
      'Error',
      "This item's unit changes through the Unit field, which shows what happens to its stock before saving.",
    );
  });
});
