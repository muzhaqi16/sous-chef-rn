import { useApolloClient } from '@apollo/client/react';
import { announceHouseholdLeft } from '#/apollo/refetchEvents';
import {
  GetHomesDocument,
  type GetHomesQuery,
} from '#operations/home/home.generated';
import {
  recordMock,
  renderHookWithApollo,
  type MockPart,
} from '#/test-utils/apolloMockProvider';
import { isHeld } from '#/apollo/utils/writeLocalEntity';
import { useStore } from '#store/index';
import { forgetHome } from '../forgetHome';

jest.mock('#/apollo/refetchEvents', () => ({
  announceHouseholdLeft: jest.fn(),
}));

const homeEdge = (
  id: string,
): MockPart<GetHomesQuery['homes']['edges'][number]> => ({
  __typename: 'HomeEdge',
  cursor: id,
  node: { __typename: 'Home', id, name: id },
});

/** A client whose cache holds the two homes the caller belongs to. */
async function clientWithHomes() {
  const homes = recordMock(GetHomesDocument, {
    data: {
      homes: {
        __typename: 'HomeConnection',
        totalCount: 2,
        edges: [homeEdge('h1'), homeEdge('h2')],
        pageInfo: {
          __typename: 'PageInfo',
          hasNextPage: false,
          endCursor: null,
        },
      },
    },
  });
  const { result } = renderHookWithApollo(() => useApolloClient(), {
    operationMocks: [homes.mock],
  });
  await result.current.query({ query: GetHomesDocument });
  return result.current;
}

const holds = (client: { cache: Parameters<typeof isHeld>[0] }, id: string) =>
  isHeld(client.cache, { __typename: 'Home', id });

beforeEach(() => {
  jest.mocked(announceHouseholdLeft).mockClear();
  useStore.setState({
    selectedHomeId: 'h1',
    selectedPantryId: 'p1',
    selectedShoppingListId: 'sl1',
    selectedMealPlanId: 'mp1',
  });
});

describe('forgetHome', () => {
  it('moves every pick off the home it forgets, onto the next home', async () => {
    const client = await clientWithHomes();

    expect(forgetHome(client.cache, 'h1')).toBe('h2');

    expect(holds(client, 'h1')).toBe(false);
    expect(useStore.getState()).toMatchObject({
      selectedHomeId: 'h2',
      selectedPantryId: null,
      selectedShoppingListId: null,
      selectedMealPlanId: null,
    });
  });

  it('leaves the picks alone when another home is selected', async () => {
    const client = await clientWithHomes();

    expect(forgetHome(client.cache, 'h2')).toBeNull();

    expect(holds(client, 'h2')).toBe(false);
    expect(useStore.getState()).toMatchObject({
      selectedHomeId: 'h1',
      selectedShoppingListId: 'sl1',
      selectedMealPlanId: 'mp1',
    });
  });

  // What the household holds stays with it, the caller's own lists and plans
  // included, so every screen showing it is asked again.
  it('resyncs what the app shows', async () => {
    const client = await clientWithHomes();

    forgetHome(client.cache, 'h2');

    expect(announceHouseholdLeft).toHaveBeenCalledTimes(1);
  });
});
