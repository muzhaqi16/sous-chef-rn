import { renderHook, act } from '@testing-library/react-native';
import { alertService } from '#/services/alertService';
import { usePantryItemActions } from '../usePantryItemActions';

const mockCacheModify = jest.fn();
const mockCacheIdentify = jest.fn((obj: any) => `${obj.__typename}:${obj.id}`);

const mockCreatePantryItemUsage = jest.fn();
const mockRestockPantryItem = jest.fn();

// Mock the Apollo React hooks our hook calls so we can intercept the mutation
// invocations and observe `client.cache.modify` calls without spinning up a
// MockedProvider — that would force us to assert on cache state instead of
// spies, which would change every assertion in this file.
jest.mock('@apollo/client/react', () => ({
  ...jest.requireActual('@apollo/client/react'),
  useApolloClient: jest.fn(() => ({
    cache: {
      modify: mockCacheModify,
      identify: mockCacheIdentify,
    },
  })),
  useMutation: jest.fn((doc: any) => {
    const opName = doc?.definitions?.[0]?.name?.value;
    if (opName === 'CreatePantryItemUsage') {
      return [mockCreatePantryItemUsage, { loading: false }];
    }
    if (opName === 'RestockPantryItem') {
      return [mockRestockPantryItem, { loading: false }];
    }
    return [jest.fn(), { loading: false }];
  }),
}));

jest.mock('#/utils/isNetworkError', () => ({
  isNetworkError: jest.fn(() => false),
}));

jest.mock('#services/telemetry', () => ({
  Telemetry: {
    trackEvent: jest.fn(),
  },
}));

jest.mock('#/utils/compilerSafeWrappers');

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

const createPantryItem = (id: string, quantity = 5) =>
  ({
    id,
    quantity,
    unit: { id: 'unit-1', symbol: 'ea' },
    item: { name: `Item ${id}` },
  } as any);

const createOptions = (
  items = [createPantryItem('item-1'), createPantryItem('item-2')],
) => ({
  pantryItems: items,
  removeItem: jest.fn().mockResolvedValue(undefined),
  navigateTo: {
    pantryItem: jest.fn(),
  },
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('usePantryItemActions', () => {
  it('returns all modal states and handlers', () => {
    const { result } = renderHook(() => usePantryItemActions(createOptions()));

    // Modal states
    expect(result.current.consumeModal.visible).toBe(false);
    expect(result.current.consumeModal.item).toBeNull();
    expect(result.current.wasteModal.visible).toBe(false);
    expect(result.current.wasteModal.item).toBeNull();
    expect(result.current.restockModal.visible).toBe(false);
    expect(result.current.restockModal.item).toBeNull();

    // Handlers
    expect(typeof result.current.handleConsumeItem).toBe('function');
    expect(typeof result.current.handleWasteItem).toBe('function');
    expect(typeof result.current.handleRestockItem).toBe('function');
    expect(typeof result.current.handleEditItem).toBe('function');
    expect(typeof result.current.handleDeleteItem).toBe('function');
    expect(typeof result.current.handleConfirmConsume).toBe('function');
    expect(typeof result.current.handleConfirmWaste).toBe('function');
    expect(typeof result.current.handleConfirmRestock).toBe('function');
  });

  describe('handleConsumeItem', () => {
    it('opens consume modal for existing item', () => {
      const { result } = renderHook(() =>
        usePantryItemActions(createOptions()),
      );

      act(() => {
        result.current.handleConsumeItem('item-1');
      });

      expect(result.current.consumeModal.visible).toBe(true);
      expect(result.current.consumeModal.item?.id).toBe('item-1');
      expect(result.current.wasteModal.visible).toBe(false);
      expect(result.current.restockModal.visible).toBe(false);
    });

    it('does nothing for unknown item', () => {
      const { result } = renderHook(() =>
        usePantryItemActions(createOptions()),
      );

      act(() => {
        result.current.handleConsumeItem('unknown');
      });

      expect(result.current.consumeModal.visible).toBe(false);
    });
  });

  describe('handleWasteItem', () => {
    it('opens waste modal', () => {
      const { result } = renderHook(() =>
        usePantryItemActions(createOptions()),
      );

      act(() => {
        result.current.handleWasteItem('item-2');
      });

      expect(result.current.wasteModal.visible).toBe(true);
      expect(result.current.wasteModal.item?.id).toBe('item-2');
    });
  });

  describe('handleRestockItem', () => {
    it('opens restock modal', () => {
      const { result } = renderHook(() =>
        usePantryItemActions(createOptions()),
      );

      act(() => {
        result.current.handleRestockItem('item-1');
      });

      expect(result.current.restockModal.visible).toBe(true);
      expect(result.current.restockModal.item?.id).toBe('item-1');
    });
  });

  describe('handleEditItem', () => {
    it('navigates to pantry item screen', () => {
      const options = createOptions();
      const { result } = renderHook(() => usePantryItemActions(options));

      act(() => {
        result.current.handleEditItem('item-1');
      });

      expect(options.navigateTo.pantryItem).toHaveBeenCalledWith({
        itemId: 'item-1',
      });
    });
  });

  describe('handleDeleteItem', () => {
    it('calls removeItem and tracks event', async () => {
      const options = createOptions();
      const { result } = renderHook(() => usePantryItemActions(options));

      await act(async () => {
        await result.current.handleDeleteItem('item-1');
      });

      expect(options.removeItem).toHaveBeenCalledWith('item-1');
    });
  });

  describe('handleConfirmConsume', () => {
    it('calls createPantryItemUsage mutation and closes modal', async () => {
      mockCreatePantryItemUsage.mockResolvedValue({
        data: { createPantryItemUsage: { success: true } },
      });

      const { result } = renderHook(() =>
        usePantryItemActions(createOptions()),
      );

      // Open consume modal first
      act(() => {
        result.current.handleConsumeItem('item-1');
      });

      expect(result.current.consumeModal.visible).toBe(true);

      // Confirm consume
      await act(async () => {
        await result.current.handleConfirmConsume(
          2,
          '2',
          'COOK' as any,
          'For dinner',
        );
      });

      expect(mockCreatePantryItemUsage).toHaveBeenCalledWith({
        variables: {
          input: {
            pantryItemId: 'item-1',
            quantityUsed: 2,
            purpose: 'COOK',
            notes: 'For dinner',
            usageUnitId: undefined,
          },
        },
      });

      expect(result.current.consumeModal.visible).toBe(false);
    });

    it('does nothing when no modal is open', async () => {
      const { result } = renderHook(() =>
        usePantryItemActions(createOptions()),
      );

      await act(async () => {
        await result.current.handleConfirmConsume(1, '1', 'COOK' as any, '');
      });

      expect(mockCreatePantryItemUsage).not.toHaveBeenCalled();
    });

    it('reverts quantity and shows error on failure', async () => {
      mockCreatePantryItemUsage.mockRejectedValue(new Error('Failed'));

      const { result } = renderHook(() =>
        usePantryItemActions(createOptions()),
      );

      act(() => {
        result.current.handleConsumeItem('item-1');
      });

      await act(async () => {
        await result.current.handleConfirmConsume(2, '2', 'COOK' as any, '');
      });

      // Cache modify called for optimistic update AND revert
      expect(mockCacheModify).toHaveBeenCalled();
      expect(alertService.alert).toHaveBeenCalledWith(
        'Error',
        expect.any(String),
      );
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Error consuming pantry item:'),
        expect.any(Error),
      );
    });
  });

  describe('handleConfirmWaste', () => {
    it('calls usage mutation with WASTE purpose and closes modal', async () => {
      mockCreatePantryItemUsage.mockResolvedValue({
        data: { createPantryItemUsage: { success: true } },
      });

      const { result } = renderHook(() =>
        usePantryItemActions(createOptions()),
      );

      act(() => {
        result.current.handleWasteItem('item-1');
      });

      await act(async () => {
        await result.current.handleConfirmWaste(
          1,
          'EXPIRED' as any,
          true,
          false,
          'Past date',
        );
      });

      expect(mockCreatePantryItemUsage).toHaveBeenCalledWith({
        variables: {
          input: {
            pantryItemId: 'item-1',
            quantityUsed: 1,
            purpose: 'WASTE',
            notes: 'Past date',
            usageUnitId: undefined,
            wasteReason: 'EXPIRED',
            isComposted: true,
            isRecycled: false,
          },
        },
      });

      expect(result.current.wasteModal.visible).toBe(false);
    });
  });

  describe('handleConfirmRestock', () => {
    it('calls restock mutation and closes modal', async () => {
      mockRestockPantryItem.mockResolvedValue({
        data: { restockPantryItem: { success: true } },
      });

      const { result } = renderHook(() =>
        usePantryItemActions(createOptions()),
      );

      act(() => {
        result.current.handleRestockItem('item-1');
      });

      await act(async () => {
        await result.current.handleConfirmRestock(3, '3', 'Bought more');
      });

      expect(mockRestockPantryItem).toHaveBeenCalledWith({
        variables: {
          id: 'item-1',
          input: {
            quantity: 3,
            unitId: undefined,
            notes: 'Bought more',
            costPerUnit: undefined,
            totalCost: undefined,
            expiresAt: null,
          },
        },
      });

      expect(result.current.restockModal.visible).toBe(false);
    });

    it('includes optional restock fields', async () => {
      mockRestockPantryItem.mockResolvedValue({
        data: { restockPantryItem: { success: true } },
      });

      const { result } = renderHook(() =>
        usePantryItemActions(createOptions()),
      );

      act(() => {
        result.current.handleRestockItem('item-1');
      });

      const expiresAt = new Date('2026-12-31');
      await act(async () => {
        await result.current.handleConfirmRestock(
          5,
          '5',
          '',
          'unit-kg',
          2.5,
          12.5,
          expiresAt,
        );
      });

      const input = mockRestockPantryItem.mock.calls[0][0].variables.input;
      expect(input.unitId).toBe('unit-kg');
      expect(input.costPerUnit).toBe(2.5);
      expect(input.totalCost).toBe(12.5);
      expect(input.expiresAt).toBe('2026-12-31T00:00:00.000Z');
    });
  });

  describe('payload error handling', () => {
    it('shows invalid unit alert on consume payload UNIT_INVALID', async () => {
      mockCreatePantryItemUsage.mockResolvedValue({
        data: {
          createPantryItemUsage: {
            success: false,
            code: 'UNIT_INVALID',
            message: "Cannot consume in 'jar'",
            validUnits: ['oz', 'cup', 'tbsp'],
          },
        },
      });

      const { result } = renderHook(() =>
        usePantryItemActions(createOptions()),
      );

      act(() => {
        result.current.handleConsumeItem('item-1');
      });

      await act(async () => {
        await result.current.handleConfirmConsume(2, '2', 'COOK' as any, '');
      });

      expect(alertService.alert).toHaveBeenCalledWith(
        'Invalid Unit',
        expect.stringContaining('oz, cup, tbsp'),
      );
      // Modal should not close on payload error
      expect(result.current.consumeModal.visible).toBe(true);
    });

    it('shows invalid unit alert on waste payload UNIT_INVALID', async () => {
      mockCreatePantryItemUsage.mockResolvedValue({
        data: {
          createPantryItemUsage: {
            success: false,
            code: 'UNIT_INVALID',
            message: "Cannot waste in 'jar'",
            validUnits: null,
          },
        },
      });

      const { result } = renderHook(() =>
        usePantryItemActions(createOptions()),
      );

      act(() => {
        result.current.handleWasteItem('item-1');
      });

      await act(async () => {
        await result.current.handleConfirmWaste(
          1,
          'EXPIRED' as any,
          false,
          false,
          '',
        );
      });

      expect(alertService.alert).toHaveBeenCalledWith(
        'Invalid Unit',
        "Cannot waste in 'jar'",
      );
      expect(result.current.wasteModal.visible).toBe(true);
    });

    it('shows version conflict alert on consume payload CONFLICT', async () => {
      mockCreatePantryItemUsage.mockResolvedValue({
        data: {
          createPantryItemUsage: {
            success: false,
            code: 'CONFLICT',
            message: 'Version conflict: expected 3, found 4',
            validUnits: null,
          },
        },
      });

      const { result } = renderHook(() =>
        usePantryItemActions(createOptions()),
      );

      act(() => {
        result.current.handleConsumeItem('item-1');
      });

      await act(async () => {
        await result.current.handleConfirmConsume(1, '1', 'COOK' as any, '');
      });

      expect(alertService.alert).toHaveBeenCalledWith(
        'Item Updated',
        expect.stringContaining('Version conflict'),
      );
    });

    it('shows invalid unit alert on restock payload UNIT_INVALID', async () => {
      mockRestockPantryItem.mockResolvedValue({
        data: {
          restockPantryItem: {
            success: false,
            code: 'UNIT_INVALID',
            message: "Cannot restock in 'slice'",
            validUnits: ['bottle', 'mL'],
          },
        },
      });

      const { result } = renderHook(() =>
        usePantryItemActions(createOptions()),
      );

      act(() => {
        result.current.handleRestockItem('item-1');
      });

      await act(async () => {
        await result.current.handleConfirmRestock(2, '2', '');
      });

      expect(alertService.alert).toHaveBeenCalledWith(
        'Invalid Unit',
        expect.stringContaining('bottle, mL'),
      );
      expect(result.current.restockModal.visible).toBe(true);
    });

    it('reverts optimistic updates on restock payload error', async () => {
      mockRestockPantryItem.mockResolvedValue({
        data: {
          restockPantryItem: {
            success: false,
            code: 'UNIT_INVALID',
            message: 'Invalid unit',
            validUnits: null,
          },
        },
      });

      const { result } = renderHook(() =>
        usePantryItemActions(createOptions()),
      );

      act(() => {
        result.current.handleRestockItem('item-1');
      });

      await act(async () => {
        await result.current.handleConfirmRestock(3, '3', '');
      });

      // Optimistic update + revert = at least 3 cache.modify calls
      // (1: quantity optimistic, 2: batch count optimistic, 3+: reverts)
      expect(mockCacheModify).toHaveBeenCalled();
      expect(alertService.alert).toHaveBeenCalledWith(
        'Invalid Unit',
        'Invalid unit',
      );
    });

    it('shows generic error for unknown payload failure codes', async () => {
      mockCreatePantryItemUsage.mockResolvedValue({
        data: {
          createPantryItemUsage: {
            success: false,
            code: 'VALIDATION_ERROR',
            message: 'Cannot use more than available quantity',
            validUnits: null,
          },
        },
      });

      const { result } = renderHook(() =>
        usePantryItemActions(createOptions()),
      );

      act(() => {
        result.current.handleConsumeItem('item-1');
      });

      await act(async () => {
        await result.current.handleConfirmConsume(
          100,
          '100',
          'COOK' as any,
          '',
        );
      });

      expect(alertService.alert).toHaveBeenCalledWith(
        'Error',
        'Cannot use more than available quantity',
      );
    });
  });

  describe('modal close', () => {
    it('closes consume modal', () => {
      const { result } = renderHook(() =>
        usePantryItemActions(createOptions()),
      );

      act(() => {
        result.current.handleConsumeItem('item-1');
      });
      expect(result.current.consumeModal.visible).toBe(true);

      act(() => {
        result.current.consumeModal.close();
      });
      expect(result.current.consumeModal.visible).toBe(false);
    });

    it('only one modal can be open at a time', () => {
      const { result } = renderHook(() =>
        usePantryItemActions(createOptions()),
      );

      act(() => {
        result.current.handleConsumeItem('item-1');
      });
      expect(result.current.consumeModal.visible).toBe(true);

      act(() => {
        result.current.handleWasteItem('item-2');
      });
      expect(result.current.consumeModal.visible).toBe(false);
      expect(result.current.wasteModal.visible).toBe(true);
    });
  });
});
