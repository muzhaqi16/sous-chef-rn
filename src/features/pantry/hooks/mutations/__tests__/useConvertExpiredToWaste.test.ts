import React, { type ReactNode } from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { MockedProvider } from '@apollo/client/testing/react';
import type { MockedResponse } from '#/test-utils/apolloMockProvider';
import { ConvertExpiredToWasteDocument } from '#features/pantry/graphql/pantry.generated';
import { useConvertExpiredToWaste } from '../useConvertExpiredToWaste';
import { GraphQLDomainError } from '#/utils/errors/graphqlErrors';

function renderWith(mocks: MockedResponse[]) {
  const wrapper = ({ children }: { children: ReactNode }) =>
    React.createElement(
      MockedProvider,
      { mocks, showWarnings: false },
      children,
    );
  return renderHook(() => useConvertExpiredToWaste(), { wrapper });
}

const successMock = (id: string): MockedResponse => ({
  request: {
    query: ConvertExpiredToWasteDocument,
    variables: { input: { pantryItemId: id } },
  },
  result: {
    data: {
      convertExpiredToWaste: {
        __typename: 'ConvertExpiredToWastePayload',
        pantryItem: {
          __typename: 'PantryItem',
          id,
          version: 2,
          quantity: '0',
          condition: 'SPOILED',
          wasteReason: 'EXPIRED',
          storageState: 'WASTE',
        },
      },
    },
  },
});

const notFoundErrorMock = (id: string): MockedResponse => ({
  request: {
    query: ConvertExpiredToWasteDocument,
    variables: { input: { pantryItemId: id } },
  },
  result: {
    data: {
      convertExpiredToWaste: {
        __typename: 'NotFoundError',
        code: 'NOT_FOUND',
        message: 'Pantry item not found',
        resource: 'PantryItem',
        resourceId: id,
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

  it('returns the payload on successful mutation', async () => {
    const { result } = renderWith([successMock('item-1')]);

    let payload: unknown;
    await act(async () => {
      payload = await result.current.convertExpiredToWaste('item-1');
    });

    expect(payload).toMatchObject({
      __typename: 'ConvertExpiredToWastePayload',
    });
  });

  it('throws GraphQLDomainError when mutation returns a NotFoundError', async () => {
    const { result } = renderWith([notFoundErrorMock('item-1')]);

    await act(async () => {
      await expect(
        result.current.convertExpiredToWaste('item-1'),
      ).rejects.toThrow(GraphQLDomainError);
    });
  });
});
