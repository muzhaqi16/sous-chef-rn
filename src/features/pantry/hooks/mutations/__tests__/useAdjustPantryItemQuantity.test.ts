import { renderHook, act, waitFor } from '@testing-library/react-native';
import type { MockedResponse } from '#/test-utils/apolloMockProvider';
import { alertService } from '#/services/alertService';
import { AdjustPantryItemQuantityDocument } from '#features/pantry/graphql/pantry.generated';
import { createApolloTestWrapper } from '#/test-utils/apolloMockProvider';
import { useAdjustPantryItemQuantity } from '../useAdjustPantryItemQuantity';

jest.mock('#/services/errorService', () => ({
  useErrorService: () => ({
    handleApolloError: jest.fn(() => ({ message: 'Adjust error' })),
  }),
}));

let mockHandleVersionConflict = false;
jest.mock('#/utils/errors/versionConflict', () => ({
  handleVersionConflict: jest.fn(() => mockHandleVersionConflict),
  getVersionConflictMessage: jest.fn(() => 'Version conflict message'),
}));

let mockIsInvalidUnit = false;
jest.mock('#/utils/errors/invalidUnit', () => ({
  isInvalidUnitError: jest.fn(() => mockIsInvalidUnit),
  getInvalidUnitMessage: jest.fn(() => 'Invalid unit message'),
}));

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

const successMock = (variables: { input: any }): MockedResponse => ({
  request: { query: AdjustPantryItemQuantityDocument, variables },
  result: {
    data: {
      adjustPantryItemQuantity: {
        __typename: 'AdjustPantryItemQuantityPayload',
        pantryItem: {
          __typename: 'PantryItem',
          id: variables.input.id,
          version: 1,
          updatedAt: '2026-01-01T00:00:00.000Z',
          quantity: String(variables.input.newQuantity),
          remainingNetWeight: variables.input.remainingNetWeight ?? null,
          lastUsedAt: null,
          activeBatchCount: 0,
        },
      },
    },
  },
});

const errorMock = (variables: { input: any }): MockedResponse => ({
  request: { query: AdjustPantryItemQuantityDocument, variables },
  error: new Error('Network error'),
});

const validationErrorMock = (variables: { input: any }): MockedResponse => ({
  request: { query: AdjustPantryItemQuantityDocument, variables },
  result: {
    data: {
      adjustPantryItemQuantity: {
        __typename: 'ValidationError',
        code: 'VALIDATION_ERROR',
        message: 'Invalid quantity',
        field: 'newQuantity',
      },
    },
  },
});

beforeEach(() => {
  jest.clearAllMocks();
  mockHandleVersionConflict = false;
  mockIsInvalidUnit = false;
});

describe('useAdjustPantryItemQuantity', () => {
  it('returns adjustQuantity function and loading state', () => {
    const { result } = renderHook(() => useAdjustPantryItemQuantity(), {
      wrapper: createApolloTestWrapper({ operationMocks: [] }),
    });

    expect(typeof result.current.adjustQuantity).toBe('function');
    expect(result.current.loading).toBe(false);
  });

  it('returns true and calls onSuccess on successful adjustment', async () => {
    const onSuccess = jest.fn();
    const variables = {
      input: { id: 'item-1', newQuantity: 5, reason: 'Physical count' },
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

  it('omits version and remainingNetWeight when undefined', async () => {
    const variables = {
      input: { id: 'item-1', newQuantity: 1, reason: 'Adjusted' },
    };
    const { result } = renderHook(() => useAdjustPantryItemQuantity(), {
      wrapper: createApolloTestWrapper({
        operationMocks: [successMock(variables)],
      }),
    });

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.adjustQuantity('item-1', 1, 'Adjusted');
    });

    expect(success).toBe(true);
  });

  it('shows version conflict alert on version error', async () => {
    mockHandleVersionConflict = true;
    const variables = {
      input: { id: 'item-1', newQuantity: 5, reason: 'Count' },
    };
    const { result } = renderHook(() => useAdjustPantryItemQuantity(), {
      wrapper: createApolloTestWrapper({
        operationMocks: [errorMock(variables)],
      }),
    });

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.adjustQuantity('item-1', 5, 'Count');
    });

    expect(success).toBe(false);
    await waitFor(() =>
      expect(alertService.alert).toHaveBeenCalledWith(
        'Item Updated',
        'Version conflict message',
      ),
    );
  });

  it('shows generic error alert on non-conflict error', async () => {
    const variables = {
      input: { id: 'item-1', newQuantity: 5, reason: 'Count' },
    };
    const { result } = renderHook(() => useAdjustPantryItemQuantity(), {
      wrapper: createApolloTestWrapper({
        operationMocks: [errorMock(variables)],
      }),
    });

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.adjustQuantity('item-1', 5, 'Count');
    });

    expect(success).toBe(false);
    await waitFor(() =>
      expect(alertService.alert).toHaveBeenCalledWith('Error', 'Adjust error'),
    );
  });

  it('returns false when response is a ValidationError', async () => {
    const variables = {
      input: { id: 'item-1', newQuantity: 5, reason: 'Count' },
    };
    const { result } = renderHook(() => useAdjustPantryItemQuantity(), {
      wrapper: createApolloTestWrapper({
        operationMocks: [validationErrorMock(variables)],
      }),
    });

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.adjustQuantity('item-1', 5, 'Count');
    });

    expect(success).toBe(false);
  });
});
