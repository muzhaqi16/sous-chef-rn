import { renderHook, act, waitFor } from '@testing-library/react-native';
import type { MockedResponse } from '@apollo/client/testing';
import { alertService } from '#/services/alertService';
import { AdjustPantryItemQuantityDocument } from '#operations/pantry/pantry.generated';
import { createApolloWrapper } from '../../../../../__tests__/helpers/apolloMockProvider';
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

const successMock = (variables: {
  id: string;
  input: any;
}): MockedResponse => ({
  request: { query: AdjustPantryItemQuantityDocument, variables },
  result: {
    data: {
      adjustPantryItemQuantity: {
        __typename: 'PantryItemPayload',
        success: true,
        message: '',
        code: 'SUCCESS',
        pantryItem: {
          __typename: 'PantryItem',
          id: variables.id,
          quantity: variables.input.newQuantity,
        },
      },
    },
  },
});

const errorMock = (variables: { id: string; input: any }): MockedResponse => ({
  request: { query: AdjustPantryItemQuantityDocument, variables },
  error: new Error('Network error'),
});

const nullPantryItemMock = (variables: {
  id: string;
  input: any;
}): MockedResponse => ({
  request: { query: AdjustPantryItemQuantityDocument, variables },
  result: {
    data: {
      adjustPantryItemQuantity: {
        __typename: 'PantryItemPayload',
        success: true,
        message: '',
        code: 'SUCCESS',
        pantryItem: null,
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
      wrapper: createApolloWrapper([]),
    });

    expect(typeof result.current.adjustQuantity).toBe('function');
    expect(result.current.loading).toBe(false);
  });

  it('returns true and calls onSuccess on successful adjustment', async () => {
    const onSuccess = jest.fn();
    const variables = {
      id: 'item-1',
      input: { newQuantity: 5, reason: 'Physical count' },
    };
    const { result } = renderHook(
      () => useAdjustPantryItemQuantity({ onSuccess }),
      { wrapper: createApolloWrapper([successMock(variables)]) },
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
      id: 'item-1',
      input: { newQuantity: 3, reason: 'Counted', version: 7 },
    };
    const { result } = renderHook(() => useAdjustPantryItemQuantity(), {
      wrapper: createApolloWrapper([successMock(variables)]),
    });

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.adjustQuantity('item-1', 3, 'Counted', 7);
    });

    expect(success).toBe(true);
  });

  it('includes remainingNetWeight when provided', async () => {
    const variables = {
      id: 'item-1',
      input: {
        newQuantity: 2,
        reason: 'Weighed',
        version: 5,
        remainingNetWeight: 250,
      },
    };
    const { result } = renderHook(() => useAdjustPantryItemQuantity(), {
      wrapper: createApolloWrapper([successMock(variables)]),
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
      id: 'item-1',
      input: { newQuantity: 1, reason: 'Adjusted' },
    };
    const { result } = renderHook(() => useAdjustPantryItemQuantity(), {
      wrapper: createApolloWrapper([successMock(variables)]),
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
      id: 'item-1',
      input: { newQuantity: 5, reason: 'Count' },
    };
    const { result } = renderHook(() => useAdjustPantryItemQuantity(), {
      wrapper: createApolloWrapper([errorMock(variables)]),
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
      id: 'item-1',
      input: { newQuantity: 5, reason: 'Count' },
    };
    const { result } = renderHook(() => useAdjustPantryItemQuantity(), {
      wrapper: createApolloWrapper([errorMock(variables)]),
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

  it('returns false when no pantryItem returned', async () => {
    const variables = {
      id: 'item-1',
      input: { newQuantity: 5, reason: 'Count' },
    };
    const { result } = renderHook(() => useAdjustPantryItemQuantity(), {
      wrapper: createApolloWrapper([nullPantryItemMock(variables)]),
    });

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.adjustQuantity('item-1', 5, 'Count');
    });

    expect(success).toBe(false);
  });
});
