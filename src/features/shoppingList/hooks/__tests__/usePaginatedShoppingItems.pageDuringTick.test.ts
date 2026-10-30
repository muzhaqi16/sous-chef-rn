import { act, waitFor } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import { createAnswerOrderingLink } from '#/apollo/links/answerOrderingLink';
import { createLocalWritePrecedenceLink } from '#/apollo/links/localWritePrecedenceLink';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import {
  GetShoppingListItemsFilteredDocument,
  UpdateShoppingListItemDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { useToggleShoppingItem } from '#features/shoppingList/hooks/mutations/useToggleShoppingItem';
import { usePaginatedShoppingItems } from '#features/shoppingList/hooks/usePaginatedShoppingItems';

jest.mock('#hooks/auth/useIsLoggedOut', () => ({
  useIsLoggedOut: () => false,
}));
jest.mock('#features/shoppingList/utils/shoppingListConstants', () => ({
  ...jest.requireActual('#features/shoppingList/utils/shoppingListConstants'),
  PAGINATION: { ITEMS_PAGE_SIZE: 2 },
}));

const list = { __typename: 'ShoppingList', id: 'list-1', version: 1 };

const answer = (ids: string[], isPurchased: boolean, hasNextPage: boolean) => ({
  shoppingList: {
    ...list,
    itemsConnection: {
      __typename: 'ShoppingListItemConnection',
      totalCount: isPurchased ? 4 : 1,
      edges: ids.map(id => ({
        cursor: `c-${id}`,
        node: {
          __typename: 'ShoppingListItem',
          id,
          version: 1,
          itemName: `Item ${id}`,
          sortOrder: id,
          purchaseInfo: {
            __typename: 'ShoppingListItemPurchaseInfo',
            isPurchased,
          },
          shoppingList: list,
        },
      })),
      pageInfo: {
        __typename: 'PageInfo',
        hasNextPage,
        endCursor: `c-${ids.at(-1)}`,
      },
    },
  },
});

const settle = () => new Promise(resolve => setTimeout(resolve, 30));

function setup() {
  const cache = makeCache();
  const unpurchased = recordMock(GetShoppingListItemsFilteredDocument, {
    data: answer(['u1'], false, false) as never,
    match: variables => variables.isPurchased === false,
  });
  const firstPage = recordMock(GetShoppingListItemsFilteredDocument, {
    data: answer(['p1', 'p2'], true, true) as never,
    match: variables => variables.isPurchased === true && !variables.after,
  });
  const nextPage = recordMock(GetShoppingListItemsFilteredDocument, {
    data: answer(['p3', 'p4'], true, false) as never,
    match: variables =>
      variables.isPurchased === true && variables.after === 'c-p2',
    held: true,
    maxUsageCount: 1,
  });
  const untick = recordMock(UpdateShoppingListItemDocument, {
    data: {
      updateShoppingListItem: {
        __typename: 'UpdateShoppingListItemPayload',
        shoppingListItem: {
          __typename: 'ShoppingListItem',
          id: 'p1',
          version: 2,
          purchaseInfo: {
            __typename: 'ShoppingListItemPurchaseInfo',
            isPurchased: false,
          },
        },
      },
    } as never,
  });

  const { result } = renderHookWithApollo(
    () => {
      const paged = usePaginatedShoppingItems({ listId: 'list-1' });
      const { toggleItem } = useToggleShoppingItem({
        listId: 'list-1',
        refetch: paged.actions.refetch,
      });
      return { purchased: paged.state.purchased, toggleItem };
    },
    {
      cache,
      operationMocks: [
        unpurchased.mock,
        firstPage.mock,
        nextPage.mock,
        untick.mock,
      ],
      links: [createLocalWritePrecedenceLink(), createAnswerOrderingLink()],
    },
  );

  const shownIds = () => result.current.purchased.items.map(item => item.id);
  return { result, nextPage, shownIds };
}

describe('a tick while the next page loads', () => {
  beforeEach(() => {
    jest.spyOn(globalThis, 'requestIdleCallback').mockImplementation(run => {
      run({ didTimeout: false, timeRemaining: () => 0 });
      return 1;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('with no tick, a page of rows the device never held lands', async () => {
    const { result, nextPage, shownIds } = setup();
    await waitFor(() => expect(shownIds()).toEqual(['p1', 'p2']));

    await act(async () => {
      void result.current.purchased.loadMore();
      await settle();
    });
    await waitFor(() => expect(nextPage.fired).toHaveLength(1));
    await act(async () => {
      nextPage.release();
      await settle();
    });

    expect(shownIds()).toEqual(['p1', 'p2', 'p3', 'p4']);
    expect(nextPage.fired).toHaveLength(1);
  });

  it('keeps the tick and the page when the tick comes second', async () => {
    const { result, nextPage, shownIds } = setup();
    await waitFor(() => expect(shownIds()).toEqual(['p1', 'p2']));

    await act(async () => {
      void result.current.purchased.loadMore();
      await settle();
    });
    await waitFor(() => expect(nextPage.fired).toHaveLength(1));
    await act(async () => {
      await result.current.toggleItem('p1');
      await settle();
    });
    await act(async () => {
      nextPage.release();
      await settle();
    });

    expect(shownIds()).toEqual(['p2', 'p3', 'p4']);
  });

  it('keeps the tick and the page when the tick comes first', async () => {
    const { result, nextPage, shownIds } = setup();
    await waitFor(() => expect(shownIds()).toEqual(['p1', 'p2']));

    await act(async () => {
      void result.current.toggleItem('p1');
      void result.current.purchased.loadMore();
      await settle();
    });
    await act(async () => {
      nextPage.release();
      await settle();
    });

    expect(shownIds()).toEqual(['p2', 'p3', 'p4']);
  });
});
