import {
  renderHookWithApollo,
  seedCache,
} from '#/test-utils/apolloMockProvider';
import { useStore } from '#store';
import { useListCurrency } from '../useListCurrency';
import { UseListCurrency_ListFragmentDoc } from '../useListCurrency.generated';

function renderFor(listCurrency: string | null) {
  const cache = seedCache([]);
  cache.writeFragment({
    fragment: UseListCurrency_ListFragmentDoc,
    data: { __typename: 'ShoppingList', id: 'list-1', currency: listCurrency },
  });
  return renderHookWithApollo(() => useListCurrency('list-1'), {
    cache,
    operationMocks: [],
  });
}

describe('useListCurrency', () => {
  beforeEach(() => {
    useStore.setState({ preferredCurrency: 'ALL' });
  });

  it("reads the list's own currency first", () => {
    expect(renderFor('EUR').result.current).toBe('EUR');
  });

  it("falls back to the account's currency for a list with none", () => {
    expect(renderFor(null).result.current).toBe('ALL');
  });

  it("falls back to the account's currency before the list is read", () => {
    const { result } = renderHookWithApollo(() => useListCurrency('list-1'), {
      cache: seedCache([]),
      operationMocks: [],
    });

    expect(result.current).toBe('ALL');
  });
});
