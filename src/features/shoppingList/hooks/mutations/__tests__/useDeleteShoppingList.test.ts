import { gql } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import type { MockFor } from '#/test-utils/apolloMockProvider';
import {
  renderHookWithApollo,
  seedFragment,
} from '#/test-utils/apolloMockProvider';
import { drained } from '#/test-utils/drainTimers';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import { DeleteShoppingListDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { List_EmptyItemsVariantFragmentDoc } from '#features/shoppingList/cache/list.generated';
import { useDeleteShoppingList } from '../useDeleteShoppingList';
import { toastService } from '#/services/toastService';

const LIST_ID = 'list-1';

const LIST = gql`
  fragment _DeletedListProbe on ShoppingList {
    id
    homeId
    totalItems
  }
`;

const UNPURCHASED = gql`
  fragment _DeletedListItemsProbe on ShoppingList {
    id
    itemsConnection(filters: { isPurchased: false }) {
      totalCount
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        cursor
        node {
          id
        }
      }
    }
  }
`;

const edge = (id: string) => ({
  __typename: 'ShoppingListItemEdge',
  cursor: id,
  node: { __typename: 'ShoppingListItem', id },
});

function cacheWithList() {
  const cache = makeCache();
  const id = cache.identify({ __typename: 'ShoppingList', id: LIST_ID });
  seedFragment(cache, {
    id,
    fragment: LIST,
    data: {
      __typename: 'ShoppingList',
      id: LIST_ID,
      homeId: 'home-1',
      totalItems: 12,
    },
  });
  seedFragment(cache, {
    id,
    fragment: UNPURCHASED,
    data: {
      __typename: 'ShoppingList',
      id: LIST_ID,
      itemsConnection: {
        __typename: 'ShoppingListItemConnection',
        totalCount: 2,
        pageInfo: { __typename: 'PageInfo', hasNextPage: true, endCursor: 'b' },
        edges: [edge('a'), edge('b')],
      },
    },
  });
  return cache;
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useDeleteShoppingList', () => {
  beforeEach(() => jest.clearAllMocks());

  it('toasts localized copy, not the server’s English', async () => {
    // The server's message is unlocalizable by construction: the client sends
    // no `Accept-Language` and the token carries no locale, so an es / it / sq
    // user gets a translated title over an English body.
    const failure: MockFor<typeof DeleteShoppingListDocument> = {
      request: { query: DeleteShoppingListDocument, variables: () => true },
      error: new Error('An unexpected database error occurred'),
      maxUsageCount: Number.POSITIVE_INFINITY,
    };

    const { result } = renderHookWithApollo(() => useDeleteShoppingList(), {
      operationMocks: [failure],
    });

    await drained(() => result.current.deleteShoppingList('list-1'));
    expect(toastService.error).toHaveBeenCalled();
    expect(toastService.error).not.toHaveBeenCalledWith(
      'An unexpected database error occurred',
    );
  });

  it('brings a refused delete back with its items', async () => {
    const cache = cacheWithList();
    const refusal: MockFor<typeof DeleteShoppingListDocument> = {
      request: { query: DeleteShoppingListDocument, variables: () => true },
      result: {
        data: {
          deleteShoppingList: {
            __typename: 'ForbiddenError',
            code: ErrorCode.Forbidden,
          },
        },
      },
    };
    const { result } = renderHookWithApollo(() => useDeleteShoppingList(), {
      cache,
      operationMocks: [refusal],
    });

    let kept: boolean | undefined;
    kept = await drained(() => result.current.deleteShoppingList(LIST_ID));

    const id = cache.identify({ __typename: 'ShoppingList', id: LIST_ID });
    expect(kept).toBe(false);
    expect(
      cache.readFragment<{ totalItems: number }>({
        id,
        fragment: LIST,
        optimistic: true,
      })?.totalItems,
    ).toBe(12);
    expect(
      cache.readFragment({
        id,
        fragment: List_EmptyItemsVariantFragmentDoc,
        variables: { isPurchased: false },
        optimistic: true,
      }),
    ).not.toBeNull();
  });
});
