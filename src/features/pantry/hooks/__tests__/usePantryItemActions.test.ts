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
import { errorService } from '#/services/errorService';
import { getVersionConflictMessage } from '#/utils/errors/versionConflict';
import { t } from '#/i18n';
import { changeLanguage } from '#/i18n/config';
import { operationNameOf } from '#/apollo/utils/documentOperation';
import { usePantryItemActions } from '../usePantryItemActions';
import { GetPantryItemBatchesDocument } from '#features/pantry/graphql/pantry.generated';
import {
  UsePantryItemActions_IdFragmentDoc,
  UsePantryItemActions_QuantityFragmentDoc,
  UsePantryItemActions_TrackingUnitFragmentDoc,
} from '../usePantryItemActions.generated';

jest.mock('#/utils/isNetworkError', () => ({
  isNetworkError: jest.fn(() => false),
}));

jest.mock('#/utils/finallyHelpers');

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

jest.mock('#/services/errorService');

const seedPantryItems = (ids: string[] = ['item-1', 'item-2'], quantity = 5) =>
  seedCache(
    // One entry per fragment the hook reads back, so the fixture is held to
    // each of the three selections rather than to its own keys.
    ids.flatMap(id => {
      const data = {
        __typename: 'PantryItem' as const,
        id,
        quantity,
        unit: { __typename: 'Unit' as const, id: 'unit-1', symbol: 'ea' },
      };
      return [
        { fragment: UsePantryItemActions_IdFragmentDoc, data },
        { fragment: UsePantryItemActions_QuantityFragmentDoc, data },
        { fragment: UsePantryItemActions_TrackingUnitFragmentDoc, data },
      ];
    }),
  );

const cachedItem = (cache: ReturnType<typeof seedPantryItems>) =>
  cache.readFragment<{ quantity: number }>({
    id: cache.identify({ __typename: 'PantryItem', id: 'item-1' }),
    fragment: UsePantryItemActions_QuantityFragmentDoc,
  });

const createOptions = () => ({
  removeItem: jest.fn().mockResolvedValue(undefined),
  navigateTo: {
    pantryItem: jest.fn(),
  },
});

function consumeMock(payload?: Record<string, unknown>) {
  const defaultPayload = {
    __typename: 'CreatePantryItemUsagePayload' as const,
    pantryItemUsage: {
      __typename: 'PantryItemUsage' as const,
      id: 'usage-1',
      quantityUsed: 1,
      usageUnitId: null,
      usageUnit: null,
      usedAt: '2026-01-01T00:00:00.000Z',
      purpose: UsagePurpose.Cooking,
      notes: null,
      wasteReason: null,
      isComposted: null,
      isRecycled: null,
      pantryItem: {
        __typename: 'PantryItem' as const,
        id: 'item-1',
        quantity: 4,
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
    __typename: 'RestockPantryItemPayload' as const,
    pantryItemUsage: {
      __typename: 'PantryItemUsage' as const,
      id: 'usage-1',
      quantityUsed: 1,
      purpose: UsagePurpose.Restock,
      costPerUnit: null,
      totalCost: null,
      pantryItem: {
        __typename: 'PantryItem' as const,
        id: 'item-1',
        version: 2,
        updatedAt: '2026-01-01T00:00:00.000Z',
        quantity: 6,
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
          UsagePurpose.Cooking,
          'For dinner',
        );
      });

      expect(m.fired).toContainEqual({
        input: {
          pantryItemId: 'item-1',
          quantityUsed: 2,
          purpose: UsagePurpose.Cooking,
          notes: 'For dinner',
          usageUnitId: undefined,
          idempotencyKey: expect.any(String),
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
          UsagePurpose.Cooking,
          '',
        );
      });

      expect(m.fired).toEqual([]);
    });

    // `errorPolicy: 'all'` resolves a transport failure with `error` set rather
    // than rejecting, so this drives the outcome the app actually gets.
    it('reverts quantity and shows error on failure', async () => {
      const failing = recordMock(CreatePantryItemUsageDocument, {
        error: new Error('network down'),
      });

      const cache = seedPantryItems();
      const { result } = renderHookWithApollo(
        () => usePantryItemActions(createOptions()),
        { cache, operationMocks: [failing.mock] },
      );

      act(() => {
        result.current.handleConsumeItem('item-1');
      });

      await act(async () => {
        await result.current.handleConfirmConsume(
          2,
          '2',
          UsagePurpose.Cooking,
          '',
        );
      });

      expect(cachedItem(cache)).toMatchObject({ quantity: 5 });
      expect(result.current.consumeModal.visible).toBe(true);
      expect(alertService.alert).toHaveBeenCalledWith(
        'Error',
        expect.any(String),
      );
      expect(errorService.reportError).toHaveBeenCalledWith(expect.any(Error), {
        operation: operationNameOf(CreatePantryItemUsageDocument),
      });
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
          purpose: UsagePurpose.Waste,
          notes: 'Past date',
          usageUnitId: undefined,
          wasteReason: 'EXPIRED',
          isComposted: true,
          isRecycled: false,
          idempotencyKey: expect.any(String),
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
          idempotencyKey: expect.any(String),
        },
      });

      expect(result.current.restockModal.visible).toBe(false);
    });

    it('keeps the cached batches when the restock is queued offline', async () => {
      // This mutation runs `localFirst`, so offline `queueLink` resolves it with
      // a NULL result. Evicting there drops a field only a server response can
      // refill — and offline there is no response, so the batch section stays
      // empty for the rest of the session and the emptied field persists.
      const cache = seedPantryItems();
      cache.writeQuery({
        query: GetPantryItemBatchesDocument,
        variables: { pantryItemId: 'item-1' },
        data: {
          __typename: 'Query',
          pantryItemBatchesConnection: {
            __typename: 'PantryItemBatchConnection',
            totalCount: 1,
            pageInfo: {
              __typename: 'PageInfo',
              hasNextPage: false,
              endCursor: null,
            },
            edges: [],
          },
        },
      });
      const before = cache.readQuery({
        query: GetPantryItemBatchesDocument,
        variables: { pantryItemId: 'item-1' },
      });
      expect(before).not.toBeNull();

      // A queued local-first write: `queueLink` resolves with a null payload.
      const queued = recordMock(RestockPantryItemDocument, {
        data: { restockPantryItem: null },
      });
      const { result } = renderHookWithApollo(
        () => usePantryItemActions(createOptions()),
        { operationMocks: [queued.mock], cache },
      );

      act(() => {
        result.current.handleRestockItem('item-1');
      });
      await act(async () => {
        await result.current.handleConfirmRestock(3, '3', '');
      });

      expect(
        cache.readQuery({
          query: GetPantryItemBatchesDocument,
          variables: { pantryItemId: 'item-1' },
        }),
      ).toEqual(before);
      expect(cachedItem(cache)).toMatchObject({ quantity: 8 });
      expect(result.current.restockModal.visible).toBe(false);
      expect(alertService.alert).not.toHaveBeenCalled();
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

      const input = m.fired[0]!.input as Record<string, unknown>;
      expect(input.unitId).toBe('unit-kg');
      expect(input.costPerUnit).toBe(2.5);
      expect(input.totalCost).toBe(12.5);
      expect(input.expiresAt).toBe('2026-12-31T00:00:00.000Z');
    });
  });

  describe('payload error handling', () => {
    it('shows invalid unit alert on consume payload UNIT_INVALID', async () => {
      const m = consumeMock({
        __typename: 'ValidationError' as const,
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
          UsagePurpose.Cooking,
          '',
        );
      });

      // The refusal's own message is unlocalizable English, so the copy is
      // ours — the server's sentence never reaches the screen.
      expect(alertService.alert).toHaveBeenCalledWith(
        'Invalid Unit',
        'That unit cannot be used here.',
      );
      // Modal should not close on payload error
      expect(result.current.consumeModal.visible).toBe(true);
    });

    it('shows invalid unit alert on waste payload UNIT_INVALID', async () => {
      const m = consumeMock({
        __typename: 'ValidationError' as const,
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
        'That unit cannot be used here.',
      );
      expect(result.current.wasteModal.visible).toBe(true);
    });

    it('describes a consume payload CONFLICT by its code, not as a stale version', async () => {
      const m = consumeMock({
        __typename: 'ConflictError' as const,
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
          UsagePurpose.Cooking,
          '',
        );
      });

      // One alert in the app's words; the payload's `message` is server English.
      expect(alertService.alert).toHaveBeenCalledTimes(1);
      expect(alertService.alert).not.toHaveBeenCalledWith(
        expect.anything(),
        getVersionConflictMessage(),
      );
      expect(alertService.alert).not.toHaveBeenCalledWith(
        expect.anything(),
        'Version conflict: expected 3, found 4',
      );
    });

    it('shows version conflict alert on consume payload VERSION_CONFLICT (optimistic-lock code)', async () => {
      // The API emits VERSION_CONFLICT (not CONFLICT) for optimistic-lock
      // failures; matching only CONFLICT drops it into the generic Error alert.
      const m = consumeMock({
        __typename: 'ConflictError' as const,
        code: 'VERSION_CONFLICT',
        message: 'Item was updated by another device',
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
          UsagePurpose.Cooking,
          '',
        );
      });

      expect(alertService.alert).toHaveBeenCalledWith(
        'Item Updated',
        getVersionConflictMessage(),
      );
    });

    it('shows invalid unit alert on restock payload UNIT_INVALID', async () => {
      const m = restockMock({
        __typename: 'ValidationError' as const,
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
        'That unit cannot be used here.',
      );
      expect(result.current.restockModal.visible).toBe(true);
    });

    it('shows alert on restock payload error', async () => {
      const m = restockMock({
        __typename: 'ValidationError' as const,
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
        'That unit cannot be used here.',
      );
    });

    it('shows generic error for unknown payload failure codes', async () => {
      const m = consumeMock({
        __typename: 'ValidationError' as const,
        code: 'VALIDATION_FAILED',
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
          UsagePurpose.Cooking,
          '',
        );
      });

      // `quantityUsed` has no field copy, so the action's shows — never the
      // refusal's `message`.
      expect(alertService.alert).toHaveBeenCalledWith(
        'Error',
        t('errors.recordUsageFailedRetry'),
      );
    });
  });

  describe('a write that is queued, or fails', () => {
    it('keeps a queued consume, closes the modal and says nothing', async () => {
      // The offline queue resolves with the payload field null and no error;
      // that is an accepted write, not a failure to revert.
      const queued = recordMock(CreatePantryItemUsageDocument, {
        data: { createPantryItemUsage: null },
      });
      const cache = seedPantryItems();
      const { result } = renderHookWithApollo(
        () => usePantryItemActions(createOptions()),
        { cache, operationMocks: [queued.mock] },
      );

      act(() => {
        result.current.handleConsumeItem('item-1');
      });
      await act(async () => {
        await result.current.handleConfirmConsume(
          2,
          '2',
          UsagePurpose.Cooking,
          '',
        );
      });

      expect(cachedItem(cache)).toMatchObject({ quantity: 3 });
      expect(alertService.alert).not.toHaveBeenCalled();
      expect(result.current.consumeModal.visible).toBe(false);
    });

    it('keeps a queued waste, closes the modal and says nothing', async () => {
      const queued = recordMock(CreatePantryItemUsageDocument, {
        data: { createPantryItemUsage: null },
      });
      const cache = seedPantryItems();
      const { result } = renderHookWithApollo(
        () => usePantryItemActions(createOptions()),
        { cache, operationMocks: [queued.mock] },
      );

      act(() => {
        result.current.handleWasteItem('item-1');
      });
      await act(async () => {
        await result.current.handleConfirmWaste(
          1,
          WasteReason.Expired,
          false,
          false,
          '',
        );
      });

      expect(queued.fired).toHaveLength(1);
      expect(cachedItem(cache)).toMatchObject({ quantity: 4 });
      expect(alertService.alert).not.toHaveBeenCalled();
      expect(result.current.wasteModal.visible).toBe(false);
    });

    it('keeps the waste modal open and says so when the write fails', async () => {
      const failing = recordMock(CreatePantryItemUsageDocument, {
        error: new Error('Server error'),
      });
      const cache = seedPantryItems();
      const { result } = renderHookWithApollo(
        () => usePantryItemActions(createOptions()),
        { cache, operationMocks: [failing.mock] },
      );

      act(() => {
        result.current.handleWasteItem('item-1');
      });
      await act(async () => {
        await result.current.handleConfirmWaste(
          1,
          WasteReason.Expired,
          false,
          false,
          '',
        );
      });

      expect(cachedItem(cache)).toMatchObject({ quantity: 5 });
      expect(alertService.alert).toHaveBeenCalledTimes(1);
      expect(result.current.wasteModal.visible).toBe(true);
    });

    it('keeps the restock modal open and says so when the write fails', async () => {
      const failing = recordMock(RestockPantryItemDocument, {
        error: new Error('Server error'),
      });
      const cache = seedPantryItems();
      const { result } = renderHookWithApollo(
        () => usePantryItemActions(createOptions()),
        { cache, operationMocks: [failing.mock] },
      );

      act(() => {
        result.current.handleRestockItem('item-1');
      });
      await act(async () => {
        await result.current.handleConfirmRestock(2, '2', '');
      });

      expect(cachedItem(cache)).toMatchObject({ quantity: 5 });
      expect(alertService.alert).toHaveBeenCalledTimes(1);
      expect(result.current.restockModal.visible).toBe(true);
    });
  });

  describe('in a language other than English', () => {
    const englishConflictCopy = getVersionConflictMessage();
    const englishFallback = t('errors.recordUsageFailedRetry');

    beforeEach(async () => {
      await changeLanguage('es');
    });
    afterEach(async () => {
      await changeLanguage('en');
    });

    const consumeOne = async (mock: ReturnType<typeof recordMock>) => {
      const { result } = renderHookWithApollo(
        () => usePantryItemActions(createOptions()),
        { operationMocks: [mock.mock], cache: seedPantryItems() },
      );
      act(() => {
        result.current.handleConsumeItem('item-1');
      });
      await act(async () => {
        await result.current.handleConfirmConsume(
          1,
          '1',
          UsagePurpose.Cooking,
          '',
        );
      });
    };

    const shownCopy = () => {
      expect(alertService.alert).toHaveBeenCalledTimes(1);
      const [title, message] = (alertService.alert as jest.Mock).mock.calls[0];
      return `${title} ${message}`;
    };

    it('shows the app copy for a version conflict, never the server text', async () => {
      await consumeOne(
        consumeMock({
          __typename: 'ConflictError' as const,
          code: 'VERSION_CONFLICT',
          message: 'Item was updated by another device',
        }),
      );

      const copy = shownCopy();
      expect(getVersionConflictMessage()).not.toBe(englishConflictCopy);
      expect(copy).toContain(getVersionConflictMessage());
      expect(copy).not.toContain('updated by another device');
    });

    it('shows the action copy for an unmapped thrown error, never the server text', async () => {
      await consumeOne(
        recordMock(CreatePantryItemUsageDocument, {
          error: new Error('pantry_usage_item_fk violated'),
        }),
      );

      const copy = shownCopy();
      expect(t('errors.recordUsageFailedRetry')).not.toBe(englishFallback);
      expect(copy).toContain(t('errors.recordUsageFailedRetry'));
      expect(copy).not.toContain('pantry_usage_item_fk');
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
