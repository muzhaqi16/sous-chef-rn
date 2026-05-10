import { renderHook, act, waitFor } from '@testing-library/react-native';
import type { MockedResponse } from '#/test-utils/apolloMockProvider';
import { alertService } from '#/services/alertService';
import { CorrectPantryItemWeightDocument } from '#features/pantry/graphql/pantry.generated';
import { createApolloWrapper } from '#/test-utils/apolloMockProvider';
import { useCorrectPantryItemWeight } from '../useCorrectPantryItemWeight';

jest.mock('#/services/errorService', () => ({
  useErrorService: () => ({
    handleApolloError: jest.fn(() => ({ message: 'Test error' })),
  }),
}));

let mockHandleVersionConflict = false;
jest.mock('#/utils/errors/versionConflict', () => ({
  handleVersionConflict: jest.fn(() => mockHandleVersionConflict),
  getVersionConflictMessage: jest.fn(() => 'Version conflict message'),
}));

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

const successMock = (
  variables: { id: string; input: any },
  data: { id: string; netWeight?: any } = { id: variables.id },
): MockedResponse => ({
  request: { query: CorrectPantryItemWeightDocument, variables },
  result: {
    data: {
      correctPantryItemWeight: {
        __typename: 'PantryItemPayload',
        success: true,
        message: '',
        code: 'SUCCESS',
        pantryItem: {
          __typename: 'PantryItem',
          ...data,
        },
      },
    },
  },
});

const errorMock = (variables: { id: string; input: any }): MockedResponse => ({
  request: { query: CorrectPantryItemWeightDocument, variables },
  error: new Error('Network error'),
});

const nullPantryItemMock = (variables: {
  id: string;
  input: any;
}): MockedResponse => ({
  request: { query: CorrectPantryItemWeightDocument, variables },
  result: {
    data: {
      correctPantryItemWeight: {
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
});

describe('useCorrectPantryItemWeight', () => {
  it('returns correctWeight function and loading state', () => {
    const { result } = renderHook(() => useCorrectPantryItemWeight(), {
      wrapper: createApolloWrapper([]),
    });

    expect(typeof result.current.correctWeight).toBe('function');
    expect(result.current.loading).toBe(false);
  });

  it('returns true and calls onSuccess on successful mutation', async () => {
    const onSuccess = jest.fn();
    const variables = {
      id: 'item-1',
      input: { netWeight: 500, reason: 'Measured with scale', version: 2 },
    };
    const { result } = renderHook(
      () => useCorrectPantryItemWeight({ onSuccess }),
      { wrapper: createApolloWrapper([successMock(variables)]) },
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
      id: 'item-1',
      input: {
        netWeight: 500,
        reason: 'Reason',
        version: 3,
        netWeightUnitId: 'unit-g',
      },
    };
    const { result } = renderHook(() => useCorrectPantryItemWeight(), {
      wrapper: createApolloWrapper([successMock(variables)]),
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
    const variables = {
      id: 'item-1',
      input: { netWeight: 500, reason: 'Reason', version: 1 },
    };
    const { result } = renderHook(() => useCorrectPantryItemWeight(), {
      wrapper: createApolloWrapper([errorMock(variables)]),
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
      ),
    );
  });

  it('returns false and shows generic error on non-conflict error', async () => {
    const variables = {
      id: 'item-1',
      input: { netWeight: 500, reason: 'Reason', version: 1 },
    };
    const { result } = renderHook(() => useCorrectPantryItemWeight(), {
      wrapper: createApolloWrapper([errorMock(variables)]),
    });

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.correctWeight('item-1', 500, 'Reason', 1);
    });

    expect(success).toBe(false);
    await waitFor(() =>
      expect(alertService.alert).toHaveBeenCalledWith('Error', 'Test error'),
    );
  });

  it('returns false when mutation returns no pantryItem', async () => {
    const variables = {
      id: 'item-1',
      input: { netWeight: 500, reason: 'Reason', version: 1 },
    };
    const { result } = renderHook(() => useCorrectPantryItemWeight(), {
      wrapper: createApolloWrapper([nullPantryItemMock(variables)]),
    });

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.correctWeight('item-1', 500, 'Reason', 1);
    });

    expect(success).toBe(false);
  });
});
