import React, { type ReactNode } from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { MockedProvider } from '@apollo/client/testing/react';
import type { MockedResponse } from '@apollo/client/testing';
import { alertService } from '#/services/alertService';
import { ConvertExpiredToWasteDocument } from '#operations/pantry/pantry.generated';
import { useConvertExpiredToWaste } from '../useConvertExpiredToWaste';

jest.mock('#/services/errorService', () => ({
  useErrorService: () => ({
    handleApolloError: jest.fn(() => ({ message: 'Test error message' })),
  }),
}));

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

function renderWith(
  mocks: MockedResponse[],
  hookOptions: Parameters<typeof useConvertExpiredToWaste>[0] = {},
) {
  const wrapper = ({ children }: { children: ReactNode }) =>
    React.createElement(
      MockedProvider,
      { mocks, showWarnings: false },
      children,
    );
  return renderHook(() => useConvertExpiredToWaste(hookOptions), { wrapper });
}

const successMock = (id: string): MockedResponse => ({
  request: {
    query: ConvertExpiredToWasteDocument,
    variables: { pantryItemId: id },
  },
  result: {
    data: {
      convertExpiredToWaste: {
        __typename: 'PantryItemPayload',
        success: true,
        message: '',
        code: 'SUCCESS',
        pantryItem: {
          __typename: 'PantryItem',
          id,
          quantity: 0,
          condition: 'SPOILED',
        },
      },
    },
  },
});

const errorMock = (id: string): MockedResponse => ({
  request: {
    query: ConvertExpiredToWasteDocument,
    variables: { pantryItemId: id },
  },
  error: new Error('Something went wrong'),
});

const nullPantryItemMock = (id: string): MockedResponse => ({
  request: {
    query: ConvertExpiredToWasteDocument,
    variables: { pantryItemId: id },
  },
  result: {
    data: {
      convertExpiredToWaste: {
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
});

describe('useConvertExpiredToWaste', () => {
  it('returns convertExpiredToWaste function and loading state', () => {
    const { result } = renderWith([successMock('item-1')]);

    expect(typeof result.current.convertExpiredToWaste).toBe('function');
    expect(result.current.loading).toBe(false);
  });

  it('returns true and calls onSuccess on successful mutation', async () => {
    const onSuccess = jest.fn();
    const { result } = renderWith([successMock('item-1')], { onSuccess });

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.convertExpiredToWaste('item-1');
    });

    expect(success).toBe(true);
    expect(onSuccess).toHaveBeenCalled();
  });

  it('returns false and shows alert on error', async () => {
    const { result } = renderWith([errorMock('item-1')]);

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.convertExpiredToWaste('item-1');
    });

    expect(success).toBe(false);
    await waitFor(() =>
      expect(alertService.alert).toHaveBeenCalledWith(
        'Error',
        'Test error message',
      ),
    );
  });

  it('returns false when mutation returns no pantryItem', async () => {
    const { result } = renderWith([nullPantryItemMock('item-1')]);

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.convertExpiredToWaste('item-1');
    });

    expect(success).toBe(false);
  });

  it('does not call onSuccess when mutation fails', async () => {
    const onSuccess = jest.fn();
    const { result } = renderWith([errorMock('item-1')], { onSuccess });

    await act(async () => {
      await result.current.convertExpiredToWaste('item-1');
    });

    expect(onSuccess).not.toHaveBeenCalled();
  });
});
