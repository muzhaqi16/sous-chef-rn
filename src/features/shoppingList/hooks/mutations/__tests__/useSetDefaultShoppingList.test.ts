import { act, waitFor } from '@testing-library/react-native';
import { gql } from '@apollo/client';
import {
  renderHookWithApollo,
  seedCache,
} from '#/test-utils/apolloMockProvider';
import { MarkShoppingListAsDefaultDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { useSetDefaultShoppingList } from '../useSetDefaultShoppingList';

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

const IS_DEFAULT = gql`
  fragment testIsDefault on ShoppingList {
    id
    isDefault
  }
`;

const readDefault = (cache: ReturnType<typeof seedCache>) =>
  cache.readFragment<{ isDefault: boolean }>({
    id: cache.identify({ __typename: 'ShoppingList', id: 'list-1' }),
    fragment: IS_DEFAULT,
  })?.isDefault;

const seedList = () =>
  seedCache([{ __typename: 'ShoppingList', id: 'list-1', isDefault: false }]);

describe('useSetDefaultShoppingList', () => {
  it('flips isDefault optimistically before settle; a queued (null) result keeps it and returns true', async () => {
    const cache = seedList();
    const { result } = renderHookWithApollo(() => useSetDefaultShoppingList(), {
      cache,
      operationMocks: [
        {
          request: {
            query: MarkShoppingListAsDefaultDocument,
            variables: () => true,
          },
          result: { data: { markShoppingListAsDefault: null } },
        },
      ],
    });

    let resolved: boolean | undefined;
    await act(async () => {
      const promise = result.current.setAsDefault('list-1');
      expect(readDefault(cache)).toBe(true);
      resolved = await promise;
    });

    expect(resolved).toBe(true);
    expect(readDefault(cache)).toBe(true);
  });

  it('reverts to the prior flag and returns false on a rejection', async () => {
    const cache = seedList();
    const { result } = renderHookWithApollo(() => useSetDefaultShoppingList(), {
      cache,
      operationMocks: [
        {
          request: {
            query: MarkShoppingListAsDefaultDocument,
            variables: () => true,
          },
          result: {
            data: {
              markShoppingListAsDefault: {
                __typename: 'NotFoundError',
                code: 'NOT_FOUND',
                message: 'gone',
                resource: 'ShoppingList',
                resourceId: 'list-1',
              },
            },
          },
        },
      ],
    });

    let resolved: boolean | undefined;
    await act(async () => {
      resolved = await result.current.setAsDefault('list-1');
    });

    expect(resolved).toBe(false);
    await waitFor(() => {
      expect(readDefault(cache)).toBe(false);
    });
  });
});
