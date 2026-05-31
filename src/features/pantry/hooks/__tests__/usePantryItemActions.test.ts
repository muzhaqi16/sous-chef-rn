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
import { UsagePurpose, WasteReason } from '#/graphql/generated/schemaTypes';
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
  const defaultPayload = {
    __typename: 'CreatePantryItemUsagePayload',
    pantryItemUsage: {
      __typename: 'PantryItemUsage',
      id: 'usage-1',
      quantityUsed: 1,
      usageUnitId: null,
      usageUnit: null,
      usedAt: '2026-01-01T00:00:00.000Z',
      purpose: 'COOK',
      notes: null,
      wasteReason: null,
      isComposted: null,
      isRecycled: null,
      pantryItem: {
        __typename: 'PantryItem',
        id: 'item-1',
        quantity: '4',
        version: 2,
        lastUsedAt: '2026-01-01T00:00:00.000Z',
        remainingNetWeight: null,
        activeBatchCount: 0,
        earliestBatchExpiration: null,
      },
      usedBy: null,
    },
  };
  return recordMock(CreatePantryItemUsageDocument, {
    data: {
      createPantryItemUsage: payload ?? defaultPayload,
    },
  });
}

function restockMock(payload?: Record<string, unknown>) {
  const defaultPayload = {
    __typename: 'RestockPantryItemPayload',
    pantryItemUsage: {
      __typename: 'PantryItemUsage',
      id: 'usage-1',
      quantityUsed: 1,
      purpose: 'RESTOCK',
      costPerUnit: null,
      totalCost: null,
      pantryItem: {
        __typename: 'PantryItem',
        id: 'item-1',
        version: 2,
        updatedAt: '2026-01-01T00:00:00.000Z',
        quantity: '6',
        netWeight: null,
        remainingNetWeight: null,
        expiresAt: null,
        activeBatchCount: 1,
        earliestBatchExpiration: null,
        netWeightUnit: null,
        packageBreakdown: null,
        quantityBreakdown: null,
      },
    },
  };
  return recordMock(RestockPantryItemDocument, {
    data: {
      restockPantryItem: payload ?? defaultPayload,
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
          'COOK' as UsagePurpose,
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
        await result.current.handleConfirmConsume(
          1,
          '1',
          'COOK' as UsagePurpose,
          '',
        );
      });

      expect(m.fired).toEqual([]);
    });

    it('reverts quantity and shows error on failure', async () => {
      const { executeMutation } = require('#/utils/compilerSafeWrappers');
      executeMutation.mockImplementationOnce(
        async (_fn: () => Promise<unknown>, onError: (e: unknown) => void) => {
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
        await result.current.handleConfirmConsume(
          2,
          '2',
          'COOK' as UsagePurpose,
          '',
        );
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
          'EXPIRED' as WasteReason,
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
        input: {
          id: 'item-1',
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

      const input = m.fired[0].input as Record<string, unknown>;
      expect(input.unitId).toBe('unit-kg');
      expect(input.costPerUnit).toBe(2.5);
      expect(input.totalCost).toBe(12.5);
      expect(input.expiresAt).toBe('2026-12-31T00:00:00.000Z');
    });
  });

  describe('payload error handling', () => {
    it('shows invalid unit alert on consume payload UNIT_INVALID', async () => {
      const m = consumeMock({
        __typename: 'ValidationError',
        code: 'UNIT_INVALID',
        message: "Cannot consume in 'jar'",
        field: 'usageUnitId',
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
          2,
          '2',
          'COOK' as UsagePurpose,
          '',
        );
      });

      expect(alertService.alert).toHaveBeenCalledWith(
        'Invalid Unit',
        "Cannot consume in 'jar'",
      );
      // Modal should not close on payload error
      expect(result.current.consumeModal.visible).toBe(true);
    });

    it('shows invalid unit alert on waste payload UNIT_INVALID', async () => {
      const m = consumeMock({
        __typename: 'ValidationError',
        code: 'UNIT_INVALID',
        message: "Cannot waste in 'jar'",
        field: 'usageUnitId',
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
          'EXPIRED' as WasteReason,
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
        __typename: 'ConflictError',
        code: 'CONFLICT',
        message: 'Version conflict: expected 3, found 4',
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
          1,
          '1',
          'COOK' as UsagePurpose,
          '',
        );
      });

      expect(alertService.alert).toHaveBeenCalledWith(
        'Item Updated',
        expect.stringContaining('Version conflict'),
      );
    });

    it('shows invalid unit alert on restock payload UNIT_INVALID', async () => {
      const m = restockMock({
        __typename: 'ValidationError',
        code: 'UNIT_INVALID',
        message: "Cannot restock in 'slice'",
        field: 'unitId',
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
        "Cannot restock in 'slice'",
      );
      expect(result.current.restockModal.visible).toBe(true);
    });

    it('shows alert on restock payload error', async () => {
      const m = restockMock({
        __typename: 'ValidationError',
        code: 'UNIT_INVALID',
        message: 'Invalid unit',
        field: 'unitId',
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
        __typename: 'ValidationError',
        code: 'VALIDATION_ERROR',
        message: 'Cannot use more than available quantity',
        field: 'quantityUsed',
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
          'COOK' as UsagePurpose,
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
