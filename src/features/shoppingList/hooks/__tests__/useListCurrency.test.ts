import { waitFor } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
  seedCache,
  seedFragment,
} from '#/test-utils/apolloMockProvider';
import { useStore } from '#store';
import { useListCurrency } from '../useListCurrency';
import {
  ListCurrencyDocument,
  UseListCurrency_ListFragmentDoc,
} from '../useListCurrency.generated';

const listAnswer = (currency: string | null) =>
  recordMock(ListCurrencyDocument, {
    data: { shoppingList: { id: 'list-1', currency } },
  });

function renderFor(listCurrency: string | null) {
  const cache = seedCache([]);
  seedFragment(cache, {
    fragment: UseListCurrency_ListFragmentDoc,
    data: {
      __typename: 'ShoppingList',
      version: 1,
      id: 'list-1',
      currency: listCurrency,
    },
  });
  const asked = listAnswer('USD');
  const rendered = renderHookWithApollo(() => useListCurrency('list-1'), {
    cache,
    operationMocks: [asked.mock],
  });
  return { ...rendered, asked };
}

describe('useListCurrency', () => {
  beforeEach(() => {
    useStore.setState({ preferredCurrency: 'ALL' });
  });

  it("reads the list's own currency first, and asks nothing", () => {
    const { result, asked } = renderFor('EUR');

    expect(result.current).toBe('EUR');
    expect(asked.fired).toEqual([]);
  });

  // The API records a cost on a list with no currency in the account's.
  it("falls back to the account's currency for a list with none", () => {
    expect(renderFor(null).result.current).toBe('ALL');
  });

  // The account's would name the wrong one: the server records the price in
  // the list's, which the device has not read yet (a scan at launch).
  it('names none until the list is read, and asks for it', async () => {
    const asked = listAnswer('USD');
    const { result } = renderHookWithApollo(() => useListCurrency('list-1'), {
      cache: seedCache([]),
      operationMocks: [asked.mock],
    });

    expect(result.current).toBeNull();
    await waitFor(() => expect(result.current).toBe('USD'));
    expect(asked.fired).toEqual([{ id: 'list-1' }]);
  });

  it('names none and asks nothing without a list', () => {
    const asked = listAnswer('USD');
    const { result } = renderHookWithApollo(() => useListCurrency(null), {
      operationMocks: [asked.mock],
    });

    expect(result.current).toBeNull();
    expect(asked.fired).toEqual([]);
  });
});
