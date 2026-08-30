import { renderHook, act, waitFor } from '@testing-library/react-native';
import type { MockedResponse } from '#/test-utils/apolloMockProvider';
import { alertService } from '#/services/alertService';
import { toastService } from '#/services/toastService';
import { useStore } from '#store';
import type { AdjustPantryItemWeightInput } from '#/graphql/generated/schemaTypes';
import { AdjustPantryItemWeightDocument } from '#features/pantry/graphql/pantry.generated';
import { createApolloTestWrapper } from '#/test-utils/apolloMockProvider';
import { useCorrectPantryItemWeight } from '../useCorrectPantryItemWeight';

jest.mock('#/services/errorService');

let mockHandleVersionConflict = false;
jest.mock('#/utils/errors/versionConflict', () => ({
  handleVersionConflict: jest.fn(() => mockHandleVersionConflict),
  getVersionConflictMessage: jest.fn(() => 'Version conflict message'),
}));

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

const successMock = (variables: {
  input: AdjustPantryItemWeightInput;
}): MockedResponse => ({
  // variables: () => true — the input carries a generated idempotencyKey, so
  // match on the operation and assert the payload separately.
  request: { query: AdjustPantryItemWeightDocument, variables: () => true },
  result: {
    data: {
      adjustPantryItemWeight: {
        __typename: 'AdjustPantryItemWeightPayload',
        pantryItem: {
          __typename: 'PantryItem',
          id: variables.input.id,
          version: (variables.input.version ?? 0) + 1,
          updatedAt: '2026-01-01T00:00:00.000Z',
          netWeight: variables.input.netWeight,
          remainingNetWeight: variables.input.netWeight,
          lastUsedAt: null,
          netWeightUnit: variables.input.netWeightUnitId
            ? {
                __typename: 'Unit',
                id: variables.input.netWeightUnitId,
                name: 'gram',
                symbol: 'g',
              }
            : null,
        },
      },
    },
  },
});

// These two no longer read their argument — the generated idempotencyKey means
// the mock matches on the operation, not the exact variables.
const errorMock = (): MockedResponse => ({
  request: { query: AdjustPantryItemWeightDocument, variables: () => true },
  error: new Error('Network error'),
});

const validationErrorMock = (): MockedResponse => ({
  // variables: () => true — the input carries a generated idempotencyKey, so
  // match on the operation and assert the payload separately.
  request: { query: AdjustPantryItemWeightDocument, variables: () => true },
  result: {
    data: {
      adjustPantryItemWeight: {
        __typename: 'ValidationError',
        code: 'VALIDATION_ERROR',
        message: 'Invalid weight',
        field: 'netWeight',
      },
    },
  },
});

beforeEach(() => {
  jest.clearAllMocks();
  mockHandleVersionConflict = false;
});

describe('useCorrectPantryItemWeight', () => {
  it('returns correctWeight function and loading state', () => {
    const { result } = renderHook(() => useCorrectPantryItemWeight(), {
      wrapper: createApolloTestWrapper({ operationMocks: [] }),
    });

    expect(typeof result.current.correctWeight).toBe('function');
    expect(result.current.loading).toBe(false);
  });

  it('returns true and calls onSuccess on successful mutation', async () => {
    const onSuccess = jest.fn();
    const variables = {
      input: {
        id: 'item-1',
        netWeight: 500,
        reason: 'Measured with scale',
        version: 2,
      },
    };
    const { result } = renderHook(
      () => useCorrectPantryItemWeight({ onSuccess }),
      {
        wrapper: createApolloTestWrapper({
          operationMocks: [successMock(variables)],
        }),
      },
    );

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.correctWeight(
        'item-1',
        500,
        'Measured with scale',
        2,
      );
    });

    expect(success).toBe(true);
    expect(onSuccess).toHaveBeenCalled();
  });

  it('includes netWeightUnitId when provided', async () => {
    const variables = {
      input: {
        id: 'item-1',
        netWeight: 500,
        reason: 'Reason',
        version: 3,
        netWeightUnitId: 'unit-g',
      },
    };
    const { result } = renderHook(() => useCorrectPantryItemWeight(), {
      wrapper: createApolloTestWrapper({
        operationMocks: [successMock(variables)],
      }),
    });

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.correctWeight(
        'item-1',
        500,
        'Reason',
        3,
        'unit-g',
      );
    });

    // Mock with matching variables was consumed → variables were correct
    expect(success).toBe(true);
  });

  it('returns false and shows version conflict alert', async () => {
    mockHandleVersionConflict = true;
    const { result } = renderHook(() => useCorrectPantryItemWeight(), {
      wrapper: createApolloTestWrapper({
        operationMocks: [errorMock()],
      }),
    });

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.correctWeight('item-1', 500, 'Reason', 1);
    });

    expect(success).toBe(false);
    await waitFor(() =>
      expect(alertService.alert).toHaveBeenCalledWith(
        'Item Updated',
        'Version conflict message',
        [
          { text: 'Refresh', onPress: expect.any(Function) },
          { text: 'Cancel', style: 'cancel' },
        ],
      ),
    );
  });

  it('returns false and shows generic error on non-conflict error', async () => {
    const { result } = renderHook(() => useCorrectPantryItemWeight(), {
      wrapper: createApolloTestWrapper({
        operationMocks: [errorMock()],
      }),
    });

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.correctWeight('item-1', 500, 'Reason', 1);
    });

    expect(success).toBe(false);
    await waitFor(() =>
      // Localized copy, not the error's own text.
      expect(alertService.alert).toHaveBeenCalledWith(
        'Error',
        'Something went wrong.',
      ),
    );
  });

  it('returns false when mutation returns a ValidationError', async () => {
    const { result } = renderHook(() => useCorrectPantryItemWeight(), {
      wrapper: createApolloTestWrapper({
        operationMocks: [validationErrorMock()],
      }),
    });

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.correctWeight('item-1', 500, 'Reason', 1);
    });

    expect(success).toBe(false);
  });

  describe('when the API is unavailable', () => {
    afterEach(() => {
      useStore.setState({ apiReachable: true, isOnline: true });
    });

    /**
     * The correction used to refuse offline with a toast. It is local-first
     * now: `AdjustPantryItemWeightInput.idempotencyKey` makes the replay
     * at-most-once, so the write goes to the cache and the queue, and the
     * screen no longer disables the control.
     */
    it('still fires the mutation, so the queue can replay it', async () => {
      useStore.setState({ apiReachable: false });
      const errorSpy = jest.spyOn(toastService, 'error');
      const { result } = renderHook(() => useCorrectPantryItemWeight(), {
        wrapper: createApolloTestWrapper({
          operationMocks: [
            successMock({
              input: {
                id: 'item-1',
                netWeight: 500,
                reason: 'Reason',
                version: 1,
              },
            }),
          ],
        }),
      });

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.correctWeight(
          'item-1',
          500,
          'Reason',
          1,
        );
      });

      expect(success).toBe(true);
      expect(errorSpy).not.toHaveBeenCalledWith('Not available offline');
    });

    it('sends an idempotencyKey and opts into the offline queue', async () => {
      const seen: Record<string, unknown>[] = [];
      const { result } = renderHook(() => useCorrectPantryItemWeight(), {
        wrapper: createApolloTestWrapper({
          operationMocks: [
            {
              request: {
                query: AdjustPantryItemWeightDocument,
                variables: (v: Record<string, unknown>) => {
                  seen.push(v);
                  return true;
                },
              },
              result: successMock({
                input: {
                  id: 'item-1',
                  netWeight: 500,
                  reason: 'Reason',
                  version: 2,
                },
              }).result,
            },
          ],
        }),
      });

      await act(async () => {
        await result.current.correctWeight('item-1', 500, 'Reason', 2);
      });

      const input = seen[0]?.input as { idempotencyKey?: string };
      // Without the key a replay would write the WEIGHT_CORRECTED audit twice.
      expect(input.idempotencyKey).toEqual(expect.any(String));
    });
  });
});
