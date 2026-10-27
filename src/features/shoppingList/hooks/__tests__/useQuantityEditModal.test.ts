import { alertService } from '#/services/alertService';
import { act } from '@testing-library/react-native';
import { gql } from '@apollo/client';
import {
  recordMock,
  renderHookWithApollo,
  seedCache,
} from '#/test-utils/apolloMockProvider';
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';
import { getDeviceDecimalSeparator } from '#/utils/deviceLocale';
import { UpdateShoppingListItemDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import type { ShoppingListItemDisplayFragment } from '#features/shoppingList/graphql/shoppingListFragments.generated';
import {
  DisplayFormat,
  EntryImageSource,
  ErrorCode,
  UnitSystem,
  UnitType,
} from '#/graphql/generated/schemaTypes';
import { writeUnitSystemSettings } from '#/test-utils/fixtures/userSettingsFixtures';
import { useQuantityEditModal } from '../useQuantityEditModal';
import { resolveImageUrl } from '#utils/imageUtils';

function updateMock() {
  return recordMock(UpdateShoppingListItemDocument, {
    data: {
      updateShoppingListItem: {
        __typename: 'UpdateShoppingListItemPayload',
        shoppingListItem: { id: 'item-1' },
      },
    },
  });
}

const mockAlert = jest.mocked(alertService.alert);

const QUANTITY = gql`
  fragment QuantityEditProbe on ShoppingListItem {
    id
    quantity
    quantityInput
  }
`;

jest.mock('#utils/imageUtils', () => ({
  resolveImageUrl: jest.fn(() => null),
}));

beforeEach(() => {
  jest.clearAllMocks();
  optimisticDataPersistence.clearAll();
});

const readPersisted = () => {
  optimisticDataPersistence.flush();
  return optimisticDataPersistence.get('ShoppingListItem', 'item-1');
};

function createItem(
  overrides: Partial<ShoppingListItemDisplayFragment> = {},
): ShoppingListItemDisplayFragment {
  return {
    __typename: 'ShoppingListItem',
    id: 'item-1',
    shoppingList: { __typename: 'ShoppingList', id: 'list-1' },
    itemName: 'Milk',
    quantity: 2,
    quantityInput: '2',
    displayFormat: DisplayFormat.Auto,
    version: 3,
    updatedAt: '2025-01-01T00:00:00.000Z',
    category: 'Dairy',
    notes: null,
    unitName: 'gallon',
    sortOrder: 'aaa',
    purchaseInfo: {
      __typename: 'ShoppingListItemPurchaseInfo',
      movedToPantryAt: null,
      isPurchased: false,
    },
    unit: {
      __typename: 'Unit',
      id: 'unit-1',
      name: 'gallon',
      symbol: 'gal',
      type: UnitType.Volume,
    },
    item: null,
    ...overrides,
  };
}

jest.mock('#/utils/deviceLocale', () => ({
  ...jest.requireActual('#/utils/deviceLocale'),
  getDeviceDecimalSeparator: jest.fn(() => '.'),
}));

describe('useQuantityEditModal', () => {
  it('returns initial state with modal closed', () => {
    const { result } = renderHookWithApollo(() =>
      useQuantityEditModal({ items: [createItem()] }),
    );

    expect(result.current.visible).toBe(false);
    expect(result.current.selectedItem).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('opens modal for an item', () => {
    const items = [createItem()];

    const { result } = renderHookWithApollo(() =>
      useQuantityEditModal({ items }),
    );

    act(() => {
      result.current.openForItem('item-1');
    });

    expect(result.current.visible).toBe(true);
    expect(result.current.selectedItem).not.toBeNull();
    expect(result.current.selectedItem!.id).toBe('item-1');
    expect(result.current.selectedItem!.itemName).toBe('Milk');
  });

  it('does not open modal when item not found', () => {
    const items = [createItem()];

    const { result } = renderHookWithApollo(() =>
      useQuantityEditModal({ items }),
    );

    act(() => {
      result.current.openForItem('non-existent');
    });

    expect(result.current.visible).toBe(false);
    expect(result.current.selectedItem).toBeNull();
  });

  it('transforms item to QuantityEditItem format', () => {
    const items = [createItem()];

    const { result } = renderHookWithApollo(() =>
      useQuantityEditModal({ items }),
    );

    act(() => {
      result.current.openForItem('item-1');
    });

    const item = result.current.selectedItem!;
    expect(item.id).toBe('item-1');
    expect(item.itemName).toBe('Milk');
    expect(item.quantity).toBe(2);
    expect(item.unitName).toBe('gal'); // uses unit.symbol
    expect(item.unitId).toBe('unit-1');
    expect(item.category).toBe('Dairy');
    expect(item.version).toBe(3);
  });

  // The household's own photo leads the entry's row, so the sheet shows it too.
  describe('with the real image resolver', () => {
    beforeEach(() => {
      jest
        .mocked(resolveImageUrl)
        .mockImplementation(
          jest.requireActual<typeof import('#utils/imageUtils')>(
            '#utils/imageUtils',
          ).resolveImageUrl,
        );
    });
    afterEach(() => {
      jest.mocked(resolveImageUrl).mockImplementation(() => null);
    });

    it("shows the household's photo rather than the catalog's", () => {
      const cache = seedCache([
        {
          __typename: 'ShoppingListItem',
          id: 'item-1',
          itemName: 'Milk',
          quantity: 2,
          category: 'Dairy',
          unitName: 'gallon',
          version: 3,
          unit: {
            __typename: 'Unit',
            id: 'unit-1',
            name: 'gallon',
            symbol: 'gal',
          },
          amount: null,
          image: {
            __typename: 'EntryImage',
            url: 'https://cdn.example.com/household/milk.jpg',
            source: EntryImageSource.Household,
            catalogImageId: null,
          },
          item: {
            __typename: 'Item',
            id: 'milk',
            imageUrl: 'https://cdn.example.com/catalog/milk.jpg',
            images: [],
          },
        },
      ]);

      const { result } = renderHookWithApollo(
        () => useQuantityEditModal({ items: [createItem()] }),
        { cache },
      );
      act(() => {
        result.current.openForItem('item-1');
      });

      expect(result.current.selectedItem?.imageUrl).toBe(
        'https://cdn.example.com/household/milk.jpg',
      );
    });
  });

  it('includes itemUnits when unit exists', () => {
    const items = [createItem()];

    const { result } = renderHookWithApollo(() =>
      useQuantityEditModal({ items }),
    );

    act(() => {
      result.current.openForItem('item-1');
    });

    expect(result.current.selectedItem!.itemUnits).toHaveLength(1);
    expect(result.current.selectedItem!.itemUnits[0]).toEqual(
      expect.objectContaining({
        id: 'unit-1',
        symbol: 'gal',
        name: 'gallon',
        isDefault: true,
        isPreferred: true,
      }),
    );
  });

  it('returns empty itemUnits when item has no unit', () => {
    const items = [createItem({ unit: null })];

    const { result } = renderHookWithApollo(() =>
      useQuantityEditModal({ items }),
    );

    act(() => {
      result.current.openForItem('item-1');
    });

    expect(result.current.selectedItem!.itemUnits).toEqual([]);
  });

  it('closes the modal', () => {
    const items = [createItem()];

    const { result } = renderHookWithApollo(() =>
      useQuantityEditModal({ items }),
    );

    act(() => {
      result.current.openForItem('item-1');
    });

    expect(result.current.visible).toBe(true);

    act(() => {
      result.current.close();
    });

    expect(result.current.visible).toBe(false);
    expect(result.current.selectedItem).toBeNull();
  });

  it('saves quantity changes via mutation', async () => {
    const m = updateMock();
    const items = [createItem()];

    const { result } = renderHookWithApollo(
      () => useQuantityEditModal({ items }),
      { operationMocks: [m.mock] },
    );

    act(() => {
      result.current.openForItem('item-1');
    });

    await act(async () => {
      await result.current.save('5', 'gal', 'unit-1');
    });

    expect(m.fired).toContainEqual({
      input: {
        id: 'item-1',
        quantity: '5',
        unit: { id: 'unit-1' },
        version: 3,
      },
    });
  });

  // An omitted unit is left as it is; a null one would clear it.
  it('leaves the unit out of the update when none is chosen', async () => {
    const m = updateMock();
    const items = [createItem()];

    const { result } = renderHookWithApollo(
      () => useQuantityEditModal({ items }),
      { operationMocks: [m.mock] },
    );

    act(() => {
      result.current.openForItem('item-1');
    });

    await act(async () => {
      await result.current.save('5', null, null);
    });

    expect(m.fired).toEqual([
      { input: { id: 'item-1', quantity: '5', version: 3 } },
    ]);
  });

  it('sends a comma decimal to the API with the separator normalized', async () => {
    const m = recordMock(UpdateShoppingListItemDocument, {
      data: {
        updateShoppingListItem: {
          __typename: 'UpdateShoppingListItemPayload',
          shoppingListItem: { id: 'item-1' },
        },
      },
    });
    const items = [createItem()];

    const { result } = renderHookWithApollo(
      () => useQuantityEditModal({ items }),
      { operationMocks: [m.mock] },
    );

    act(() => {
      result.current.openForItem('item-1');
    });

    await act(async () => {
      await result.current.save('1,5', 'gal', 'unit-1');
    });

    expect(m.fired[0]).toEqual({
      input: {
        id: 'item-1',
        quantity: '1.5',
        unit: { id: 'unit-1' },
        version: 3,
      },
    });
  });

  // `normalizeNumericTextForApi` is not idempotent on a comma device: it turns
  // `1,125` into `1.125`, and a second pass reads that period as grouping. The
  // parsed value goes to the cache AND to offline persistence, so a wrong one
  // survives a restart.
  it('stores the quantity the person typed, not a thousand-fold of it', async () => {
    (getDeviceDecimalSeparator as jest.Mock).mockReturnValue(',');

    const m = recordMock(UpdateShoppingListItemDocument, {
      data: {
        updateShoppingListItem: {
          __typename: 'UpdateShoppingListItemPayload',
          shoppingListItem: { id: 'item-1' },
        },
      },
    });
    const items = [createItem()];

    const { result } = renderHookWithApollo(
      () => useQuantityEditModal({ items }),
      { operationMocks: [m.mock] },
    );

    act(() => {
      result.current.openForItem('item-1');
    });

    let persisted: Record<string, unknown> = {};
    await act(async () => {
      const pending = result.current.save('1,125', 'gal', 'unit-1');
      persisted = readPersisted();
      await pending;
    });

    expect(persisted.quantity).toBeCloseTo(1.125, 3);
    expect(m.fired[0]).toEqual({
      input: {
        id: 'item-1',
        quantity: '1.125',
        unit: { id: 'unit-1' },
        version: 3,
      },
    });
  });

  it('passes a mixed number through untouched', async () => {
    const m = recordMock(UpdateShoppingListItemDocument, {
      data: {
        updateShoppingListItem: {
          __typename: 'UpdateShoppingListItemPayload',
          shoppingListItem: { id: 'item-1' },
        },
      },
    });
    const items = [createItem()];

    const { result } = renderHookWithApollo(
      () => useQuantityEditModal({ items }),
      { operationMocks: [m.mock] },
    );

    act(() => {
      result.current.openForItem('item-1');
    });

    await act(async () => {
      await result.current.save('2 1/3', 'gal', 'unit-1');
    });

    expect(m.fired[0]).toEqual({
      input: {
        id: 'item-1',
        quantity: '2 1/3',
        unit: { id: 'unit-1' },
        version: 3,
      },
    });
  });

  it('keeps the sheet open and alerts when the server refuses the quantity', async () => {
    const m = recordMock(UpdateShoppingListItemDocument, {
      data: {
        updateShoppingListItem: {
          __typename: 'ValidationError',
          code: ErrorCode.ValidationFailed,
          message: 'Invalid fraction format',
          field: 'quantity',
        },
      },
    });
    const items = [createItem()];

    const { result } = renderHookWithApollo(
      () => useQuantityEditModal({ items }),
      { operationMocks: [m.mock] },
    );

    act(() => {
      result.current.openForItem('item-1');
    });

    await act(async () => {
      await result.current.save('nonsense', null, null);
    });

    expect(result.current.visible).toBe(true);
    expect(result.current.selectedItem).not.toBeNull();
    // A refusal payload resolves with no `error`, so `onError` never fires and
    // this hook is the only alerter — again exactly one.
    expect(mockAlert).toHaveBeenCalledTimes(1);
    // Copy for the field the refusal named, in the app's own words — the
    // server's "Invalid fraction format" is English and is never shown.
    expect(mockAlert).toHaveBeenCalledWith(
      'Error',
      "That quantity isn't valid. Try a number like 2, 0.5 or 1 1/2.",
    );
  });

  // A failure the server gave no verdict on still gets exactly ONE message: the
  // caller's copy, since there is no code to say anything more specific.
  it('alerts a transport failure once and keeps the sheet open', async () => {
    const m = recordMock(UpdateShoppingListItemDocument, {
      error: new Error('network down'),
    });
    const items = [createItem()];

    const { result } = renderHookWithApollo(
      () => useQuantityEditModal({ items }),
      { operationMocks: [m.mock] },
    );

    act(() => {
      result.current.openForItem('item-1');
    });

    await act(async () => {
      await result.current.save('5', null, null);
    });

    expect(mockAlert).toHaveBeenCalledTimes(1);
    expect(mockAlert).toHaveBeenCalledWith(
      'Error',
      'Could not adjust the quantity.',
    );
    // Still a failure: the sheet stays open with the typed value intact.
    expect(result.current.visible).toBe(true);
  });

  // Offline, the mutation resolves with the field null — queueLink's shape for
  // "queued for replay". That is an acceptance, not a failure: the queue
  // replays it later, so the sheet must close silently rather than alert.
  it('closes without alerting when the write is queued offline', async () => {
    const m = recordMock(UpdateShoppingListItemDocument, {
      data: { updateShoppingListItem: null },
    });
    const items = [createItem()];

    const { result } = renderHookWithApollo(
      () => useQuantityEditModal({ items }),
      { operationMocks: [m.mock] },
    );

    act(() => {
      result.current.openForItem('item-1');
    });

    await act(async () => {
      await result.current.save('5', null, null);
    });

    expect(mockAlert).not.toHaveBeenCalled();
    expect(result.current.visible).toBe(false);
    expect(result.current.selectedItem).toBeNull();
  });

  describe('the quantity is written locally before the server answers', () => {
    function setup(member: object | null) {
      const cache = seedCache([
        {
          __typename: 'ShoppingListItem',
          id: 'item-1',
          quantity: 2,
          quantityInput: '2',
          version: 3,
        },
      ]);
      const m = recordMock(UpdateShoppingListItemDocument, {
        data: { updateShoppingListItem: member },
      });
      const rendered = renderHookWithApollo(
        () => useQuantityEditModal({ items: [createItem()] }),
        { cache, operationMocks: [m.mock] },
      );
      const readQuantity = () =>
        cache.readFragment<{ quantity: number; quantityInput: string }>({
          id: cache.identify({ __typename: 'ShoppingListItem', id: 'item-1' }),
          fragment: QUANTITY,
        });
      return { ...rendered, readQuantity };
    }

    // Offline the write is queued: the list must show the new quantity, and
    // keep showing it after a restart, until the replay lands.
    it('shows a queued quantity at once and records it for a restart', async () => {
      const { result, readQuantity } = setup(null);
      act(() => {
        result.current.openForItem('item-1');
      });

      await act(async () => {
        await result.current.save('1 1/2', null, 'unit-1');
      });

      expect(readQuantity()).toMatchObject({
        quantity: 1.5,
        quantityInput: '1 1/2',
      });
      expect(readPersisted()).toEqual({
        quantity: 1.5,
        quantityInput: '1 1/2',
      });
    });

    it('puts the previous quantity back and drops the record when the server refuses', async () => {
      const { result, readQuantity } = setup({
        __typename: 'ValidationError',
        code: ErrorCode.ValidationFailed,
        message: 'refused',
        field: 'quantity',
      });
      act(() => {
        result.current.openForItem('item-1');
      });

      await act(async () => {
        await result.current.save('5', null, 'unit-1');
      });

      expect(readQuantity()).toMatchObject({ quantity: 2, quantityInput: '2' });
      expect(readPersisted()).toEqual({});
    });
  });

  it('closes modal after successful save', async () => {
    const m = updateMock();
    const items = [createItem()];

    const { result } = renderHookWithApollo(
      () => useQuantityEditModal({ items }),
      { operationMocks: [m.mock] },
    );

    act(() => {
      result.current.openForItem('item-1');
    });

    await act(async () => {
      await result.current.save('5', null, null);
    });

    expect(result.current.visible).toBe(false);
    expect(result.current.selectedItem).toBeNull();
  });

  it('does nothing when save called without selected item', async () => {
    const m = updateMock();
    const items = [createItem()];

    const { result } = renderHookWithApollo(
      () => useQuantityEditModal({ items }),
      { operationMocks: [m.mock] },
    );

    await act(async () => {
      await result.current.save('5', null, null);
    });

    expect(m.fired).toEqual([]);
  });

  it('defaults quantity to 0 when item.quantity is null', () => {
    const items = [createItem({ quantity: null })];

    const { result } = renderHookWithApollo(() =>
      useQuantityEditModal({ items }),
    );

    act(() => {
      result.current.openForItem('item-1');
    });

    expect(result.current.selectedItem!.quantity).toBe(0);
  });

  it('defaults itemName to "Item" when missing', () => {
    const items = [createItem({ itemName: '' })];

    const { result } = renderHookWithApollo(() =>
      useQuantityEditModal({ items }),
    );

    act(() => {
      result.current.openForItem('item-1');
    });

    expect(result.current.selectedItem!.itemName).toBe('Item');
  });

  it('uses unitName when unit.symbol is not available', () => {
    const items = [createItem({ unit: null, unitName: 'kilogram' })];

    const { result } = renderHookWithApollo(() =>
      useQuantityEditModal({ items }),
    );

    act(() => {
      result.current.openForItem('item-1');
    });

    expect(result.current.selectedItem!.unitName).toBe('kilogram');
  });
});

// The sheet opens on what the row shows, and saves what is typed in that unit.
describe('useQuantityEditModal — the amount as the row reads it', () => {
  const reading = (value: number, unitId: string, symbol: string) => ({
    __typename: 'MeasureReading',
    value,
    unitId,
    symbol,
    displayAsFraction: false,
    type: UnitType.Weight,
  });

  // A 2 lb line, which a metric reader sees as 0.91 kg.
  const twoPounds = (system: UnitSystem) => {
    const cache = seedCache([
      {
        __typename: 'ShoppingListItem',
        id: 'item-1',
        itemName: 'Beef',
        quantity: 2,
        quantityInput: '2',
        category: 'Meat',
        unitName: 'lb',
        version: 3,
        unit: {
          __typename: 'Unit',
          id: 'unit-lb',
          name: 'pound',
          symbol: 'lb',
        },
        amount: {
          __typename: 'Measure',
          value: 2,
          unitId: 'unit-lb',
          metric: reading(0.91, 'unit-kg', 'kg'),
          imperial: reading(2, 'unit-lb', 'lb'),
        },
        image: null,
        item: null,
      },
    ]);
    writeUnitSystemSettings(cache, system, system);
    const m = updateMock();
    const { result } = renderHookWithApollo(
      () =>
        useQuantityEditModal({
          items: [createItem({ itemName: 'Beef', unitName: 'lb' })],
        }),
      { cache, operationMocks: [m.mock] },
    );
    act(() => {
      result.current.openForItem('item-1');
    });
    const readQuantity = () =>
      cache.readFragment<{ quantity: number }>({
        id: 'ShoppingListItem:item-1',
        fragment: QUANTITY,
      })?.quantity;
    return { result, m, readQuantity };
  };

  it('opens a metric reader on 0.91 kg', () => {
    const { result } = twoPounds(UnitSystem.Metric);
    expect(result.current.selectedItem).toMatchObject({
      quantity: 0.91,
      unitName: 'kg',
      unitId: 'unit-kg',
      itemUnits: [expect.objectContaining({ id: 'unit-kg', symbol: 'kg' })],
    });
  });

  // Written here, 1 would read "1 lb" until the server answers with the line.
  it('saves 1 kg as typed and writes nothing ahead of the server', async () => {
    const { result, m, readQuantity } = twoPounds(UnitSystem.Metric);
    let ahead: number | undefined;
    await act(async () => {
      const pending = result.current.save('1', 'kg', 'unit-kg');
      ahead = readQuantity();
      await pending;
    });
    expect(ahead).toBe(2);
    expect(m.fired[0]).toEqual({
      input: {
        id: 'item-1',
        quantity: '1',
        unit: { id: 'unit-kg' },
        version: 3,
      },
    });
  });

  it('writes a figure in the line’s own unit at once', async () => {
    const { result, readQuantity } = twoPounds(UnitSystem.Imperial);
    expect(result.current.selectedItem?.unitId).toBe('unit-lb');
    let ahead: number | undefined;
    await act(async () => {
      const pending = result.current.save('3', 'lb', 'unit-lb');
      ahead = readQuantity();
      await pending;
    });
    expect(ahead).toBe(3);
  });
});
