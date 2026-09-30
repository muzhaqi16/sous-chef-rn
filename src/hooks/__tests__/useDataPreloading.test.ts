import { waitFor } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { GetCommonUnitsDocument } from '#operations/item/unit.generated';
import {
  GetCategoriesDocument,
  GetBrandsDocument,
} from '#operations/item/item.generated';
import { GetStoresDocument } from '#operations/store/store.generated';
import { CategoryType, UnitType } from '#/graphql/generated/schemaTypes';
import { makeCache } from '#/apollo/cache';
import { useDataPreloading } from '../useDataPreloading';

jest.mock('../../apollo/links/tokenScheduler');
jest.mock('../../apollo/links/refreshToken');

// Run idle-deferred work synchronously so the warming fires within the test.
const originalRequestIdleCallback = globalThis.requestIdleCallback;
beforeAll(() => {
  globalThis.requestIdleCallback = (cb: IdleRequestCallback) => {
    cb({ didTimeout: false, timeRemaining: () => 50 });
    return 1;
  };
});
afterAll(() => {
  globalThis.requestIdleCallback = originalRequestIdleCallback;
});

let mockIsOnline = true;
const mockState = {
  hasInitializedHomeData: true,
  isPantryQueryComplete: false,
  lastUnitsFetchedAt: null as number | null,
  lastCategoriesFetchedAt: null as number | null,
  lastBrandsFetchedAt: null as number | null,
  lastStoresFetchedAt: null as number | null,
};
const mockSetters = {
  setCachedUnits: jest.fn(),
  setLastUnitsFetchedAt: jest.fn(),
  setCachedCategories: jest.fn(),
  setLastCategoriesFetchedAt: jest.fn(),
  setCachedBrands: jest.fn(),
  setLastBrandsFetchedAt: jest.fn(),
  setCachedStores: jest.fn(),
  setLastStoresFetchedAt: jest.fn(),
};

jest.mock('#store/useAppStore', () => ({
  useAppStore: (selector: (state: typeof mockState) => unknown) =>
    selector(mockState),
  useIsOnline: () => mockIsOnline,
  useIsPantryQueryComplete: () => mockState.isPantryQueryComplete,
}));

const mockNetwork = {
  isOnline: true,
  apiReachable: true as boolean | null,
  offlineModeEnabled: false,
};

jest.mock('#store', () => ({
  useStore: { getState: () => ({ ...mockSetters, ...mockNetwork }) },
}));

function referenceMocks() {
  return [
    recordMock(GetCommonUnitsDocument, {
      data: {
        units: [
          {
            __typename: 'Unit',
            id: 'u1',
            name: 'Gram',
            symbol: 'g',
            type: UnitType.Weight,
            isMetric: true,
            isCommon: true,
            sortOrder: 0,
            displayAsFraction: false,
            minPrecision: 0,
          },
        ],
      },
    }).mock,
    recordMock(GetCategoriesDocument, {
      data: {
        categories: {
          __typename: 'CategoryConnection',
          edges: [
            {
              __typename: 'CategoryEdge',
              node: {
                __typename: 'Category',
                id: 'c1',
                name: 'Dairy',
                type: CategoryType.General,
                icon: null,
                color: null,
                slug: 'dairy',
              },
            },
          ],
        },
      },
    }).mock,
    recordMock(GetBrandsDocument, {
      data: {
        brands: {
          __typename: 'BrandConnection',
          edges: [
            {
              __typename: 'BrandEdge',
              node: { __typename: 'Brand', id: 'b1', name: 'Heinz' },
            },
          ],
        },
      },
    }).mock,
    recordMock(GetStoresDocument, {
      data: {
        stores: {
          __typename: 'StoreConnection',
          edges: [
            {
              __typename: 'StoreEdge',
              node: {
                __typename: 'Store',
                id: 's1',
                name: 'Local Market',
                address: '1 Main St',
              },
            },
          ],
        },
      },
    }).mock,
  ];
}

beforeEach(() => {
  jest.clearAllMocks();
  mockIsOnline = true;
  mockNetwork.apiReachable = true;
  mockState.hasInitializedHomeData = true;
  mockState.isPantryQueryComplete = false;
  mockState.lastUnitsFetchedAt = null;
  mockState.lastCategoriesFetchedAt = null;
  mockState.lastBrandsFetchedAt = null;
  mockState.lastStoresFetchedAt = null;
});

describe('useDataPreloading', () => {
  it('warms reference data when core data is loaded and online', async () => {
    renderHookWithApollo(() => useDataPreloading(), {
      operationMocks: referenceMocks(),
    });

    await waitFor(() => {
      expect(mockSetters.setCachedCategories).toHaveBeenCalled();
    });
    expect(mockSetters.setCachedBrands).toHaveBeenCalled();
    expect(mockSetters.setCachedStores).toHaveBeenCalled();
    expect(mockSetters.setCachedUnits).toHaveBeenCalled();

    // Cached the mapped suggestion shape.
    expect(mockSetters.setCachedCategories).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'c1', name: 'Dairy', type: 'GENERAL' }),
    ]);
  });

  it('does not warm when offline', async () => {
    mockIsOnline = false;
    renderHookWithApollo(() => useDataPreloading(), {
      operationMocks: referenceMocks(),
    });

    // Give any (incorrectly-scheduled) idle work a chance to run.
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(mockSetters.setCachedCategories).not.toHaveBeenCalled();
    expect(mockSetters.setCachedUnits).not.toHaveBeenCalled();
  });

  it('does not warm before core data is loaded', async () => {
    mockState.hasInitializedHomeData = false;
    mockState.isPantryQueryComplete = false;
    renderHookWithApollo(() => useDataPreloading(), {
      operationMocks: referenceMocks(),
    });

    await new Promise(resolve => setTimeout(resolve, 0));
    expect(mockSetters.setCachedCategories).not.toHaveBeenCalled();
  });

  it('refreshes an expired time-to-live from the server, not the cache', async () => {
    const cache = makeCache();
    cache.writeQuery({
      query: GetCommonUnitsDocument,
      data: {
        __typename: 'Query',
        units: [
          {
            __typename: 'Unit',
            id: 'u-cached',
            name: 'Cached',
            symbol: 'c',
            type: UnitType.Weight,
            isMetric: true,
            isCommon: true,
            sortOrder: 0,
            displayAsFraction: false,
            minPrecision: 0,
          },
        ],
      },
    });
    const now = Date.now();
    const expired = now - 25 * 60 * 60 * 1000;
    mockState.lastUnitsFetchedAt = expired;
    mockState.lastCategoriesFetchedAt = now;
    mockState.lastBrandsFetchedAt = now;
    mockState.lastStoresFetchedAt = now;
    const units = recordMock(GetCommonUnitsDocument, {
      data: { units: [{ __typename: 'Unit', id: 'u-fresh', name: 'Fresh' }] },
    });

    renderHookWithApollo(() => useDataPreloading(), {
      operationMocks: [units.mock],
      cache,
    });

    await waitFor(() =>
      expect(mockSetters.setLastUnitsFetchedAt).toHaveBeenCalled(),
    );
    expect(units.fired).toHaveLength(1);
    expect(mockSetters.setCachedUnits).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'u-fresh' }),
    ]);
  });

  it('does not stamp a refresh the network was withheld from', async () => {
    mockNetwork.apiReachable = false;
    const units = recordMock(GetCommonUnitsDocument, {
      data: { units: [{ __typename: 'Unit', id: 'u-fresh' }] },
    });

    renderHookWithApollo(() => useDataPreloading(), {
      operationMocks: [units.mock],
    });

    await new Promise(resolve => setTimeout(resolve, 0));
    expect(units.fired).toHaveLength(0);
    expect(mockSetters.setLastUnitsFetchedAt).not.toHaveBeenCalled();
  });
});
