import {
  renderHookWithApollo,
  seedCache,
} from '#/test-utils/apolloMockProvider';
import { useBudgetAndPricesEnabled } from '#hooks/settings/useBudgetAndPricesEnabled';
import { useListAsksPrice, useListTracksPrices } from '../useListAsksPrice';

jest.mock('#hooks/settings/useBudgetAndPricesEnabled', () => ({
  useBudgetAndPricesEnabled: jest.fn(() => true),
}));

const list = (priceTracking: boolean) => ({
  __typename: 'ShoppingList',
  id: 'list-1',
  version: 1,
  priceTracking,
});

const asks = (listId: string | undefined, cached = [list(true)]) =>
  renderHookWithApollo(() => useListAsksPrice(listId), {
    cache: seedCache(cached),
    operationMocks: [],
  }).result.current;

describe('useListAsksPrice', () => {
  beforeEach(() => {
    jest.mocked(useBudgetAndPricesEnabled).mockReturnValue(true);
  });

  it('asks for a list that tracks prices', () => {
    expect(asks('list-1')).toBe(true);
  });

  it('asks nobody on a list that does not track prices', () => {
    expect(asks('list-1', [list(false)])).toBe(false);
  });

  it('asks nothing with prices turned off, whatever the list', () => {
    jest.mocked(useBudgetAndPricesEnabled).mockReturnValue(false);
    expect(asks('list-1')).toBe(false);
  });

  // Tracking is on by default, so a list the device hasn't read yet asks.
  it('asks for a list it has not read yet, or no list', () => {
    expect(asks('list-2')).toBe(true);
    expect(asks(undefined)).toBe(true);
  });
});

describe('useListTracksPrices', () => {
  const tracks = (listId: string | undefined, cached = [list(true)]) =>
    renderHookWithApollo(() => useListTracksPrices(listId), {
      cache: seedCache(cached),
      operationMocks: [],
    }).result.current;

  // The long-press sheet gathers prices before Budget & prices is on.
  it('follows the list alone, with prices turned off', () => {
    jest.mocked(useBudgetAndPricesEnabled).mockReturnValue(false);

    expect(tracks('list-1')).toBe(true);
    expect(tracks('list-1', [list(false)])).toBe(false);
  });

  it('tracks on a list it has not read yet, or no list', () => {
    expect(tracks('list-2')).toBe(true);
    expect(tracks(undefined)).toBe(true);
  });
});
