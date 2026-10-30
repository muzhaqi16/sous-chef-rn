import { makeCache } from '#/apollo/cache';
import { createOfflineModeLink } from '#/apollo/links/offlineModeLink';
import { pendingWritesOf } from '#/apollo/pendingWrites/pendingWrites';
import { drainTimers } from '#/test-utils/drainTimers';
import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import { CreateShoppingListDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { usePaginatedShoppingItems } from '#features/shoppingList/hooks/usePaginatedShoppingItems';
import type { CreateListInputs } from '#features/shoppingList/offline/localWrites';
import { useStore } from '#store';

jest.mock('#hooks/auth/useIsLoggedOut', () => ({
  useIsLoggedOut: () => false,
}));

const NOW = '2026-10-30T10:00:00.000Z';

describe('a list made offline, opened offline', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    useStore.setState({ apiReachable: false, isOnline: false });
  });

  afterEach(() => {
    jest.useRealTimers();
    useStore.setState({ apiReachable: true, isOnline: true });
  });

  it('reads through its layer, with no error shown', async () => {
    const cache = makeCache();
    const inputs: CreateListInputs = {
      list: { id: 'minted-list', name: 'Dinner' },
      owner: { id: 'user-1' },
      rows: [{ id: 'line-1', shoppingListId: 'minted-list', itemName: 'Milk' }],
      now: NOW,
    };
    pendingWritesOf(cache).begin(
      CreateShoppingListDocument,
      { input: { id: 'minted-list', name: 'Dinner' } },
      inputs,
    );

    const { result } = renderHookWithApollo(
      () => usePaginatedShoppingItems({ listId: 'minted-list' }),
      { cache, operationMocks: [], links: [createOfflineModeLink()] },
    );
    await drainTimers();

    const { state } = result.current;
    expect(state.unpurchased.items.map(item => item.id)).toEqual(['line-1']);
    expect(state.error).toBeFalsy();
    expect(state.loading).toBe(false);
    // What only a pending write shows never reaches the server's data.
    expect(cache.extract()).toEqual({});
  });
});
