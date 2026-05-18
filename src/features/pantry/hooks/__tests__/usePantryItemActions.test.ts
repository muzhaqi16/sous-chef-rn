'use no memo';

import { act } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
  seedCache,
} from '#/test-utils/apolloMockProvider';
import {
  CreatePantryItemUsageDocument,
  RestockPantryItemDocument,
} from '#features/pantry/graphql/pantry.generated';
import { alertService } from '#/services/alertService';
import { usePantryItemActions } from '../usePantryItemActions';

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

const seedPantryItems = (ids: string[] = ['item-1', 'item-2'], quantity = 5) =>
  seedCache(
    ids.map(id => ({
      __typename: 'PantryItem',
      id,
      quantity,
      unit: { __typename: 'Unit', id: 'unit-1', symbol: 'ea' },
    })),
  );

const createOptions = () => ({
  removeItem: jest.fn().mockResolvedValue(undefined),
  navigateTo: {
    pantryItem: jest.fn(),
  },
});

function consumeMock(payload?: Record<string, unknown>) {
  return recordMock(CreatePantryItemUsageDocument, {
    data: {
      createPantryItemUsage: {
        __typename: 'PantryItemUsagePayload',
        success: true,
        message: '',
        code: 'SUCCESS',
        validUnits: null,
        pantryItemUsage: null,
        ...(payload ?? {}),
      },
    },
  });
}

function restockMock(payload?: Record<string, unknown>) {
  return recordMock(RestockPantryItemDocument, {
    data: {
      restockPantryItem: {
        __typename: 'PantryItemUsagePayload',
        success: true,
        message: '',
        code: 'SUCCESS',
        validUnits: null,
        pantryItemUsage: null,
        ...(payload ?? {}),
      },
    },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('usePantryItemActions', () => {
  it('returns all modal states and handlers', () => {
    const { result } = renderHookWithApollo(
      () => usePantryItemActions(createOptions()),
      { cache: seedPantryItems() },
    );

    // Modal states
    expect(result.current.consumeModal.visible).toBe(false);
    expect(result.current.consumeModal.itemId).toBeNull();
    expect(result.current.wasteModal.visible).toBe(false);
    expect(result.current.wasteModal.itemId).toBeNull();
    expect(result.current.restockModal.visible).toBe(false);
    expect(result.current.restockModal.itemId).toBeNull();

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
      const { result } = renderHookWithApollo(
        () => usePantryItemActions(createOptions()),
        { cache: seedPantryItems() },
      );

      act(() => {
        result.current.handleConsumeItem('item-1');
      });

      expect(result.current.consumeModal.visible).toBe(true);
      expect(result.current.consumeModal.itemId).toBe('item-1');
      expect(result.current.wasteModal.visible).toBe(false);
      expect(result.current.restockModal.visible).toBe(false);
    });

    it('does nothing for unknown item', () => {
      const { result } = renderHookWithApollo(
        () => usePantryItemActions(createOptions()),
        { cache: seedPantryItems() },
      );

      act(() => {
        result.current.handleConsumeItem('unknown');
      });

      expect(result.current.consumeModal.visible).toBe(false);
    });
  });

  describe('handleWasteItem', () => {
    it('opens waste modal', () => {
      const { result } = renderHookWithApollo(
        () => usePantryItemActions(createOptions()),
        { cache: seedPantryItems() },
      );

      act(() => {
        result.current.handleWasteItem('item-2');
      });

      expect(result.current.wasteModal.visible).toBe(true);
      expect(result.current.wasteModal.itemId).toBe('item-2');
    });
  });

  describe('handleRestockItem', () => {
    it('opens restock modal', () => {
      const { result } = renderHookWithApollo(
        () => usePantryItemActions(createOptions()),
        { cache: seedPantryItems() },
      );

      act(() => {
        result.current.handleRestockItem('item-1');
      });

      expect(result.current.restockModal.visible).toBe(true);
      expect(result.current.restockModal.itemId).toBe('item-1');
    });
  });

  describe('handleEditItem', () => {
    it('navigates to pantry item screen', () => {
      const options = createOptions();
      const { result } = renderHookWithApollo(
        () => usePantryItemActions(options),
        { cache: seedPantryItems() },
      );

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
      const { result } = renderHookWithApollo(
        () => usePantryItemActions(options),
        { cache: seedPantryItems() },
      );

      await act(async () => {
        await result.current.handleDeleteItem('item-1');
      });

      expect(options.removeItem).toHaveBeenCalledWith('item-1');
    });
  });

  describe('handleConfirmConsume', () => {
    it('calls createPantryItemUsage mutation and closes modal', async () => {
      const m = consumeMock();
      const { result } = renderHookWithApollo(
        () => usePantryItemActions(createOptions()),
        { operationMocks: [m.mock], cache: seedPantryItems() },
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

      expect(m.fired).toContainEqual({
        input: {
          pantryItemId: 'item-1',
          quantityUsed: 2,
          purpose: 'COOK',
          notes: 'For dinner',
          usageUnitId: undefined,
        },
      });

      expect(result.current.consumeModal.visible).toBe(false);
    });

    it('does nothing when no modal is open', async () => {
      const m = consumeMock();
      const { result } = renderHookWithApollo(
        () => usePantryItemActions(createOptions()),
        { operationMocks: [m.mock], cache: seedPantryItems() },
      );

      await act(async () => {
        await result.current.handleConfirmConsume(1, '1', 'COOK' as any, '');
      });

      expect(m.fired).toEqual([]);
    });

    it('reverts quantity and shows error on failure', async () => {
      const { executeMutation } = require('#/utils/compilerSafeWrappers');
      executeMutation.mockImplementationOnce(
        async (_fn: any, onError: (e: unknown) => void) => {
          onError(new Error('Failed'));
          return false;
        },
      );

      const { result } = renderHookWithApollo(
        () => usePantryItemActions(createOptions()),
        { cache: seedPantryItems() },
      );

      act(() => {
        result.current.handleConsumeItem('item-1');
      });

      await act(async () => {
        await result.current.handleConfirmConsume(2, '2', 'COOK' as any, '');
      });

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
      const m = consumeMock();
      const { result } = renderHookWithApollo(
        () => usePantryItemActions(createOptions()),
        { operationMocks: [m.mock], cache: seedPantryItems() },
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

      expect(m.fired).toContainEqual({
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
      });

      expect(result.current.wasteModal.visible).toBe(false);
    });
  });

  describe('handleConfirmRestock', () => {
    it('calls restock mutation and closes modal', async () => {
      const m = restockMock();
      const { result } = renderHookWithApollo(
        () => usePantryItemActions(createOptions()),
        { operationMocks: [m.mock], cache: seedPantryItems() },
      );

      act(() => {
        result.current.handleRestockItem('item-1');
      });

      await act(async () => {
        await result.current.handleConfirmRestock(3, '3', 'Bought more');
      });

      expect(m.fired).toContainEqual({
        id: 'item-1',
        input: {
          quantity: 3,
          unitId: undefined,
          notes: 'Bought more',
          costPerUnit: undefined,
          totalCost: undefined,
          expiresAt: null,
        },
      });

      expect(result.current.restockModal.visible).toBe(false);
    });

    it('includes optional restock fields', async () => {
      const m = restockMock();
      const { result } = renderHookWithApollo(
        () => usePantryItemActions(createOptions()),
        { operationMocks: [m.mock], cache: seedPantryItems() },
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

      const input = (m.fired[0] as any).input;
      expect(input.unitId).toBe('unit-kg');
      expect(input.costPerUnit).toBe(2.5);
      expect(input.totalCost).toBe(12.5);
      expect(input.expiresAt).toBe('2026-12-31T00:00:00.000Z');
    });
  });

  describe('payload error handling', () => {
    it('shows invalid unit alert on consume payload UNIT_INVALID', async () => {
      const m = consumeMock({
        success: false,
        code: 'UNIT_INVALID',
        message: "Cannot consume in 'jar'",
        validUnits: ['oz', 'cup', 'tbsp'],
      });
      const { result } = renderHookWithApollo(
        () => usePantryItemActions(createOptions()),
        { operationMocks: [m.mock], cache: seedPantryItems() },
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
      const m = consumeMock({
        success: false,
        code: 'UNIT_INVALID',
        message: "Cannot waste in 'jar'",
        validUnits: null,
      });
      const { result } = renderHookWithApollo(
        () => usePantryItemActions(createOptions()),
        { operationMocks: [m.mock], cache: seedPantryItems() },
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
      const m = consumeMock({
        success: false,
        code: 'CONFLICT',
        message: 'Version conflict: expected 3, found 4',
        validUnits: null,
      });
      const { result } = renderHookWithApollo(
        () => usePantryItemActions(createOptions()),
        { operationMocks: [m.mock], cache: seedPantryItems() },
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
      const m = restockMock({
        success: false,
        code: 'UNIT_INVALID',
        message: "Cannot restock in 'slice'",
        validUnits: ['bottle', 'mL'],
      });
      const { result } = renderHookWithApollo(
        () => usePantryItemActions(createOptions()),
        { operationMocks: [m.mock], cache: seedPantryItems() },
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

    it('shows alert on restock payload error', async () => {
      const m = restockMock({
        success: false,
        code: 'UNIT_INVALID',
        message: 'Invalid unit',
        validUnits: null,
      });
      const { result } = renderHookWithApollo(
        () => usePantryItemActions(createOptions()),
        { operationMocks: [m.mock], cache: seedPantryItems() },
      );

      act(() => {
        result.current.handleRestockItem('item-1');
      });

      await act(async () => {
        await result.current.handleConfirmRestock(3, '3', '');
      });

      expect(alertService.alert).toHaveBeenCalledWith(
        'Invalid Unit',
        'Invalid unit',
      );
    });

    it('shows generic error for unknown payload failure codes', async () => {
      const m = consumeMock({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Cannot use more than available quantity',
        validUnits: null,
      });
      const { result } = renderHookWithApollo(
        () => usePantryItemActions(createOptions()),
        { operationMocks: [m.mock], cache: seedPantryItems() },
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
      const { result } = renderHookWithApollo(
        () => usePantryItemActions(createOptions()),
        { cache: seedPantryItems() },
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
      const { result } = renderHookWithApollo(
        () => usePantryItemActions(createOptions()),
        { cache: seedPantryItems() },
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
