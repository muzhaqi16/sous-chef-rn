import {
  recordMock,
  renderHookWithApollo,
  type MockDataFor,
} from '#/test-utils/apolloMockProvider';
import { drainTimers } from '#/test-utils/drainTimers';
import {
  StoreDepartment,
  StoreRouteSource,
} from '#/graphql/generated/schemaTypes';
import { useFeatureFlag } from '#hooks/settings/useFeatureFlag';
import { shoppingListRowItem } from '#/test-utils/fixtures/shoppingListRowItem';
import { AisleViewRouteDocument } from '../useAisleView.generated';
import { useAisleView } from '../useAisleView';

jest.mock('#hooks/settings/useFeatureFlag', () => ({
  useFeatureFlag: jest.fn(() => true),
}));

const ROWS = [
  shoppingListRowItem('milk', { storeDepartment: StoreDepartment.DairyEggs }),
  shoppingListRowItem('apples', { storeDepartment: StoreDepartment.Produce }),
];

const routeAnswer = (
  source: StoreRouteSource,
): MockDataFor<typeof AisleViewRouteDocument> => ({
  shoppingList: {
    id: 'list-1',
    storeRoute: {
      departments: [StoreDepartment.DairyEggs, StoreDepartment.Produce],
      source,
      store:
        source === StoreRouteSource.Default
          ? null
          : { id: 'store-1', name: 'Costco' },
    },
  },
});

function renderAisles(source = StoreRouteSource.Household) {
  const route = recordMock(AisleViewRouteDocument, {
    data: routeAnswer(source),
  });
  const hook = renderHookWithApollo(
    () => useAisleView('list-1', 'store-1', ROWS),
    { operationMocks: [route.mock] },
  );
  return { ...hook, route };
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useAisleView', () => {
  it("groups the lines in the walking order of the list's store", async () => {
    const { result, route } = renderAisles();

    await drainTimers();
    expect(result.current.aisleEntries.map(entry => entry.id)).toEqual([
      'aisle:DAIRY_EGGS',
      'milk',
      'aisle:PRODUCE',
      'apples',
    ]);
    expect(route.fired).toEqual([{ id: 'list-1', storeId: 'store-1' }]);
  });

  it('says whose trips taught the order', async () => {
    const { result } = renderAisles();

    await drainTimers();
    expect(result.current.routeNote).toEqual({
      ownTrips: true,
      storeName: 'Costco',
    });
  });

  it('says nothing of the default walk', async () => {
    const { result } = renderAisles(StoreRouteSource.Default);

    await drainTimers();
    expect(result.current.aisleEntries[0]?.id).toBe('aisle:DAIRY_EGGS');
    expect(result.current.routeNote).toBeNull();
  });

  // Without the flag the API still answers, with the default order.
  it('says nothing while learned routes are off for this user', async () => {
    jest.mocked(useFeatureFlag).mockReturnValue(false);
    const { result } = renderAisles(StoreRouteSource.Store);

    await drainTimers();
    expect(result.current.aisleEntries[0]?.id).toBe('aisle:DAIRY_EGGS');
    expect(result.current.routeNote).toBeNull();
  });
});
