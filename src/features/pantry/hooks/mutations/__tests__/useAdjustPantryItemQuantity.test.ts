import { renderHook, act, waitFor } from '@testing-library/react-native';
import type { MockFor } from '#/test-utils/apolloMockProvider';
import { alertService } from '#/services/alertService';
import { ErrorCode, TopLevelErrorCode } from '#/graphql/generated/schemaTypes';
import { getVersionConflictMessage } from '#/utils/errors/versionConflict';
import { t } from '#/i18n';
import { AdjustPantryItemQuantityDocument } from '#features/pantry/graphql/pantry.generated';
import type { AdjustPantryItemQuantityInput } from '#/graphql/generated/schemaTypes';
import {
  createApolloTestWrapper,
  recordMock,
  seedCache,
  seedFragment,
} from '#/test-utils/apolloMockProvider';
import { UseAdjustPantryItemQuantity_PantryItemFragmentDoc } from '../useAdjustPantryItemQuantity.generated';
import { useAdjustPantryItemQuantity } from '../useAdjustPantryItemQuantity';
import { asAbbreviation } from '#/test-utils/fixtures/unitLabels';

jest.mock('#/services/errorService');

const successMock = (variables: {
  input: AdjustPantryItemQuantityInput;
}): MockFor<typeof AdjustPantryItemQuantityDocument> => ({
  // variables: () => true — the input carries a generated idempotencyKey, so
  // match on the operation, not an exact deep-equal (MockLink can't match the
  // generated value).
  request: { query: AdjustPantryItemQuantityDocument, variables: () => true },
  result: {
    data: {
      adjustPantryItemQuantity: {
        __typename: 'AdjustPantryItemQuantityPayload',
        pantryItem: {
          __typename: 'PantryItem',
          id: variables.input.id,
          version: 1,
          quantity: variables.input.newQuantity,
          remainingNetWeight: variables.input.remainingNetWeight ?? null,
        },
      },
    },
  },
});

// variables: () => true — the input carries a generated idempotencyKey, so match
// on the operation, not an exact deep-equal (MockLink can't match the generated
// value). These two builders ignore the input entirely (error / static payload).
const errorMock = (): MockFor<typeof AdjustPantryItemQuantityDocument> => ({
  request: { query: AdjustPantryItemQuantityDocument, variables: () => true },
  error: new Error('Network error'),
});

const validationErrorMock = (): MockFor<
  typeof AdjustPantryItemQuantityDocument
> => ({
  request: { query: AdjustPantryItemQuantityDocument, variables: () => true },
  result: {
    data: {
      adjustPantryItemQuantity: {
        __typename: 'ValidationError',
        code: ErrorCode.ValidationFailed,
        message: 'Invalid quantity',
        field: 'newQuantity',
      },
    },
  },
});

const refusalMock = (
  member: Record<string, unknown>,
): MockFor<typeof AdjustPantryItemQuantityDocument> => ({
  request: { query: AdjustPantryItemQuantityDocument, variables: () => true },
  result: { data: { adjustPantryItemQuantity: member } },
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useAdjustPantryItemQuantity', () => {
  it('returns true and calls onSuccess on successful adjustment', async () => {
    const onSuccess = jest.fn();
    const variables = {
      input: {
        id: 'item-1',
        newQuantity: 5,
        reason: 'Physical count',
        version: 1,
      },
    };
    const { result } = renderHook(
      () => useAdjustPantryItemQuantity({ onSuccess }),
      {
        wrapper: createApolloTestWrapper({
          operationMocks: [successMock(variables)],
        }),
      },
    );

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.adjustQuantity(
        'item-1',
        5,
        'Physical count',
        1,
      );
    });

    expect(success).toBe(true);
    expect(onSuccess).toHaveBeenCalled();
  });

  it('includes version when provided', async () => {
    const variables = {
      input: { id: 'item-1', newQuantity: 3, reason: 'Counted', version: 7 },
    };
    const { result } = renderHook(() => useAdjustPantryItemQuantity(), {
      wrapper: createApolloTestWrapper({
        operationMocks: [successMock(variables)],
      }),
    });

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.adjustQuantity('item-1', 3, 'Counted', 7);
    });

    expect(success).toBe(true);
  });

  it('includes remainingNetWeight when provided', async () => {
    const variables = {
      input: {
        id: 'item-1',
        newQuantity: 2,
        reason: 'Weighed',
        version: 5,
        remainingNetWeight: 250,
      },
    };
    const { result } = renderHook(() => useAdjustPantryItemQuantity(), {
      wrapper: createApolloTestWrapper({
        operationMocks: [successMock(variables)],
      }),
    });

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.adjustQuantity(
        'item-1',
        2,
        'Weighed',
        5,
        250,
      );
    });

    expect(success).toBe(true);
  });

  it('omits remainingNetWeight when undefined', async () => {
    const variables = {
      input: { id: 'item-1', newQuantity: 1, reason: 'Adjusted', version: 2 },
    };
    const { result } = renderHook(() => useAdjustPantryItemQuantity(), {
      wrapper: createApolloTestWrapper({
        operationMocks: [successMock(variables)],
      }),
    });

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.adjustQuantity('item-1', 1, 'Adjusted', 2);
    });

    expect(success).toBe(true);
  });

  it('shows version conflict alert on version error', async () => {
    const { result } = renderHook(() => useAdjustPantryItemQuantity(), {
      wrapper: createApolloTestWrapper({
        operationMocks: [
          refusalMock({
            __typename: 'ConflictError',
            code: ErrorCode.VersionConflict,
            message: 'Stale write',
          }),
        ],
      }),
    });

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.adjustQuantity('item-1', 5, 'Count', 1);
    });

    expect(success).toBe(false);
    expect(alertService.alert).toHaveBeenCalledWith(
      t('errors.changedElsewhereTitle'),
      getVersionConflictMessage(),
    );
  });

  it('shows generic error alert on non-conflict error', async () => {
    const { result } = renderHook(() => useAdjustPantryItemQuantity(), {
      wrapper: createApolloTestWrapper({
        operationMocks: [errorMock()],
      }),
    });

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.adjustQuantity('item-1', 5, 'Count', 1);
    });

    expect(success).toBe(false);
    await waitFor(() =>
      // Localized copy, not the error's own text. The raw message is
      // unlocalizable English and belongs in the report, not the alert.
      expect(alertService.alert).toHaveBeenCalledWith(
        'Error',
        'Could not adjust the quantity.',
      ),
    );
  });

  it('returns false when response is a ValidationError', async () => {
    const { result } = renderHook(() => useAdjustPantryItemQuantity(), {
      wrapper: createApolloTestWrapper({
        operationMocks: [validationErrorMock()],
      }),
    });

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.adjustQuantity('item-1', 5, 'Count', 1);
    });

    expect(success).toBe(false);
    // A union-error payload carries no transport error, so onError never fires —
    // the hook must surface its own alert rather than reverting silently. The
    // refusal names `newQuantity`, so the alert is this app's localized copy
    // for that field, not the server's English "Invalid quantity".
    expect(alertService.alert).toHaveBeenCalledWith(
      'Error',
      "That quantity isn't valid. Try a number like 2, 0.5 or 1 1/2.",
    );
  });
  it("explains a refused unit in the app's own copy", async () => {
    const { result } = renderHook(() => useAdjustPantryItemQuantity(), {
      wrapper: createApolloTestWrapper({
        operationMocks: [
          refusalMock({
            __typename: 'ValidationError',
            code: TopLevelErrorCode.UnitInvalid,
            message: 'raw server words',
          }),
        ],
      }),
    });

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.adjustQuantity('item-1', 5, 'Count', 1);
    });

    expect(success).toBe(false);
    expect(alertService.alert).toHaveBeenCalledWith(
      t('errors.invalidUnitTitle'),
      t('errors.codes.unitInvalid'),
    );
  });

  // USM-8: only the server converts a count stated in another unit, so the
  // cache keeps what it holds until the answer lands.
  describe('a recount stated in another unit', () => {
    const ITEM = {
      __typename: 'PantryItem',
      id: 'item-1',
      version: 1,
      quantity: 1360.78,
      displayAmount: {
        __typename: 'DisplayAmount',
        quantity: 1360.78,
        unit: asAbbreviation({ __typename: 'Unit', id: 'u-g', symbol: 'g' }),
      },
      remainingNetWeight: null,
    } as const;

    const refusedWhileHeld = () =>
      recordMock(AdjustPantryItemQuantityDocument, {
        held: true,
        data: {
          adjustPantryItemQuantity: {
            __typename: 'ConflictError',
            code: ErrorCode.VersionConflict,
            message: 'Stale write',
          },
        },
      });
    const readStack = (cache: ReturnType<typeof seedCache>) =>
      cache.readFragment({
        id: 'PantryItem:item-1',
        fragment: UseAdjustPantryItemQuantity_PantryItemFragmentDoc,
        fragmentName: 'useAdjustPantryItemQuantity_pantryItem',
      });
    const recount = (
      cache: ReturnType<typeof seedCache>,
      refused: ReturnType<typeof refusedWhileHeld>,
      quantity: number,
      units: { newQuantityUnitId?: string } = {},
    ) => {
      const { result } = renderHook(() => useAdjustPantryItemQuantity(), {
        wrapper: createApolloTestWrapper({
          cache,
          operationMocks: [refused.mock],
        }),
      });
      let pending: Promise<boolean> | undefined;
      act(() => {
        pending = result.current.adjustQuantity(
          'item-1',
          quantity,
          'Recount',
          1,
          undefined,
          units,
        );
      });
      return () => pending;
    };
    const seeded = () =>
      seedCache([
        {
          fragment: UseAdjustPantryItemQuantity_PantryItemFragmentDoc,
          fragmentName: 'useAdjustPantryItemQuantity_pantryItem',
          data: ITEM,
        },
      ]);

    it('keeps what arrived for the stack while a refused recount was in flight', async () => {
      const cache = seeded();
      const refused = refusedWhileHeld();
      const pending = recount(cache, refused, 2.5, {
        newQuantityUnitId: 'u-lb',
      });
      await waitFor(() => expect(refused.fired).toHaveLength(1));

      // Another member's use, read back over the socket.
      seedFragment(cache, {
        fragment: UseAdjustPantryItemQuantity_PantryItemFragmentDoc,
        fragmentName: 'useAdjustPantryItemQuantity_pantryItem',
        data: {
          ...ITEM,
          version: 2,
          quantity: 1000,
        },
      });
      await act(async () => {
        refused.release();
        await pending();
      });

      expect(readStack(cache)).toMatchObject({ quantity: 1000, version: 2 });
    });

    it('puts back the amount a refused recount in its own unit wrote', async () => {
      const cache = seeded();
      const refused = refusedWhileHeld();
      const pending = recount(cache, refused, 900);
      await waitFor(() => expect(refused.fired).toHaveLength(1));
      expect(readStack(cache)?.quantity).toBe(900);

      await act(async () => {
        refused.release();
        await pending();
      });

      expect(readStack(cache)).toMatchObject({ quantity: 1360.78, version: 1 });
    });

    it('sends the pound and writes nothing ahead of the server', async () => {
      const held = recordMock(AdjustPantryItemQuantityDocument, {
        held: true,
        data: {
          adjustPantryItemQuantity: {
            __typename: 'AdjustPantryItemQuantityPayload',
            pantryItem: { ...ITEM, quantity: 1133.98 },
          },
        },
      });
      const cache = seedCache([
        {
          fragment: UseAdjustPantryItemQuantity_PantryItemFragmentDoc,
          fragmentName: 'useAdjustPantryItemQuantity_pantryItem',
          data: ITEM,
        },
      ]);
      const { result } = renderHook(() => useAdjustPantryItemQuantity(), {
        wrapper: createApolloTestWrapper({
          cache,
          operationMocks: [held.mock],
        }),
      });

      let pending: Promise<boolean> | undefined;
      act(() => {
        pending = result.current.adjustQuantity(
          'item-1',
          2.5,
          'Recount',
          1,
          undefined,
          { newQuantityUnitId: 'u-lb' },
        );
      });

      await waitFor(() => expect(held.fired).toHaveLength(1));
      expect(held.fired[0]).toEqual(
        expect.objectContaining({
          input: expect.objectContaining({
            newQuantity: 2.5,
            newQuantityUnitId: 'u-lb',
          }),
        }),
      );
      expect(
        cache.readFragment({
          id: 'PantryItem:item-1',
          fragment: UseAdjustPantryItemQuantity_PantryItemFragmentDoc,
          fragmentName: 'useAdjustPantryItemQuantity_pantryItem',
        })?.quantity,
      ).toBe(1360.78);

      await act(async () => {
        held.release();
        await pending;
      });
      expect(
        cache.readFragment({
          id: 'PantryItem:item-1',
          fragment: UseAdjustPantryItemQuantity_PantryItemFragmentDoc,
          fragmentName: 'useAdjustPantryItemQuantity_pantryItem',
        })?.quantity,
      ).toBe(1133.98);
    });
  });
});
