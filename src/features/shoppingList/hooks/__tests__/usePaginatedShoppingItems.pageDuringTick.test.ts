import { gql } from '@apollo/client';
import { act } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import { createAnswerOrderingLink } from '#/apollo/links/answerOrderingLink';
import { createLocalWritePrecedenceLink } from '#/apollo/links/localWritePrecedenceLink';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { drainTimers } from '#/test-utils/drainTimers';
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

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

function setup({ holdTick = false } = {}) {
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
    held: holdTick,
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
      return {
        purchased: paged.state.purchased,
        refetch: paged.actions.refetch,
        toggleItem,
      };
    },
    {
      cache,
      // Which answer lands first is what these tests prove, so `held` sets it,
      // never MockLink's default random 20-50 ms.
      operationMocks: [unpurchased, firstPage, nextPage, untick].map(
        ({ mock }) => ({ ...mock, delay: 0 }),
      ),
      links: [createLocalWritePrecedenceLink(), createAnswerOrderingLink()],
    },
  );

  const shownIds = () => result.current.purchased.items.map(item => item.id);
  const inAct = <T>(start: () => Promise<T>) => {
    let started: Promise<T> | undefined;
    act(() => {
      started = start();
    });
    return started as Promise<T>;
  };
  const loadMore = () => inAct(() => result.current.purchased.loadMore());
  const tick = (id: string) => inAct(() => result.current.toggleItem(id));
  // `loadMore` returns without asking when a guard trips.
  const expectPageAsked = async () => {
    await drainTimers();
    expect(nextPage.fired).toHaveLength(1);
  };
  /** Past the drain, a re-ask has been sent and answered too. */
  const expectListSettlesOn = async (ids: string[]) => {
    await drainTimers();
    expect(shownIds()).toEqual(ids);
  };
  return {
    result,
    cache,
    nextPage,
    untick,
    loadMore,
    tick,
    expectPageAsked,
    expectListSettlesOn,
  };
}

const ROW = gql`
  fragment ProbeRow on ShoppingListItem {
    version
    purchaseInfo {
      isPurchased
    }
  }
`;

describe('an answer from before a confirmed tick', () => {
  it('leaves the tick, through the query the list reads', async () => {
    const { result, cache, tick, expectListSettlesOn } = setup();
    await expectListSettlesOn(['p1', 'p2']);
    const ticked = tick('p1');
    await drainTimers();
    await act(() => ticked);

    // The mocks still answer as the server did before the tick.
    const refetched = result.current.refetch();
    await drainTimers();
    await act(() => refetched);

    expect(
      cache.readFragment({
        id: cache.identify({ __typename: 'ShoppingListItem', id: 'p1' }),
        fragment: ROW,
      }),
    ).toMatchObject({ version: 2, purchaseInfo: { isPurchased: false } });
  });
});

describe('a tick while the next page loads', () => {
  it('with no tick, a page of rows the device never held lands', async () => {
    const { nextPage, loadMore, expectPageAsked, expectListSettlesOn } =
      setup();
    await expectListSettlesOn(['p1', 'p2']);

    const paged = loadMore();
    await expectPageAsked();
    nextPage.release();

    await expectListSettlesOn(['p1', 'p2', 'p3', 'p4']);
    await act(() => paged);
    expect(nextPage.fired).toHaveLength(1);
  });

  it('keeps the tick and the page when the tick comes second', async () => {
    const { nextPage, loadMore, tick, expectPageAsked, expectListSettlesOn } =
      setup();
    await expectListSettlesOn(['p1', 'p2']);

    const paged = loadMore();
    await expectPageAsked();
    const ticked = tick('p1');
    await drainTimers();
    await act(() => ticked);
    nextPage.release();

    await expectListSettlesOn(['p2', 'p3', 'p4']);
    await act(() => paged);
  });

  it('keeps the tick and the page when the tick comes first', async () => {
    const { nextPage, loadMore, tick, expectPageAsked, expectListSettlesOn } =
      setup();
    await expectListSettlesOn(['p1', 'p2']);

    const ticked = tick('p1');
    const paged = loadMore();
    await expectPageAsked();
    await act(() => ticked);
    nextPage.release();

    await expectListSettlesOn(['p2', 'p3', 'p4']);
    await act(() => paged);
  });

  it('shows a tick at once while the page is still loading', async () => {
    const { nextPage, loadMore, tick, expectPageAsked, expectListSettlesOn } =
      setup();
    await expectListSettlesOn(['p1', 'p2']);

    const paged = loadMore();
    await expectPageAsked();
    const ticked = tick('p1');

    await expectListSettlesOn(['p2']);

    nextPage.release();
    await expectListSettlesOn(['p2', 'p3', 'p4']);
    await act(() => paged);
    await act(() => ticked);
  });

  it('keeps a tick the server answered until the page lands', async () => {
    const { result, nextPage, loadMore, tick, expectPageAsked } = setup();
    await drainTimers();

    const paged = loadMore();
    await expectPageAsked();
    const ticked = tick('p1');
    // Short of the fence's limit, which a drain runs past and so commits.
    await act(() => jest.advanceTimersByTimeAsync(1000));

    expect(result.current.purchased.items.map(({ id }) => id)).toEqual(['p2']);

    nextPage.release();
    await drainTimers();
    expect(result.current.purchased.items.map(({ id }) => id)).toEqual([
      'p2',
      'p3',
      'p4',
    ]);
    await act(() => paged);
    await act(() => ticked);
  });

  it('keeps the tick and the page when the page lands before the tick is answered', async () => {
    const {
      nextPage,
      untick,
      loadMore,
      tick,
      expectPageAsked,
      expectListSettlesOn,
    } = setup({ holdTick: true });
    await expectListSettlesOn(['p1', 'p2']);

    const ticked = tick('p1');
    const paged = loadMore();
    await expectPageAsked();
    nextPage.release();
    await expectListSettlesOn(['p2', 'p3', 'p4']);
    await act(() => paged);

    untick.release();

    await expectListSettlesOn(['p2', 'p3', 'p4']);
    await act(() => ticked);
  });
});
