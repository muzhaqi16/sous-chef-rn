'use no memo';

import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import { useShoppingListSubscriptions } from '../useShoppingListSubscriptions';

jest.mock('../../../apollo/links/tokenScheduler');
jest.mock('../../../apollo/links/refreshToken');

const mockRegister = jest.fn().mockReturnValue({});
const mockIsParentDeleting = jest.fn().mockReturnValue(false);
jest.mock('#/services/subscriptions/SubscriptionService', () => ({
  subscriptionService: {
    register: (...args: any[]) => mockRegister(...args),
    isParentDeleting: (...args: any[]) => mockIsParentDeleting(...args),
  },
}));

jest.mock('#/services/subscriptions/types', () => ({
  CacheStrategy: { NONE: 'NONE' },
}));

jest.mock('#store/useAppStore', () => {
  const getState = () => ({ selectedShoppingListId: 'list-1' });
  return {
    useAppStore: jest.fn((selector: any) => selector(getState())),
    useSelectedShoppingListId: jest.fn(() => getState().selectedShoppingListId),
  };
});

jest.mock('#/apollo/utils/shoppingListCacheUpdaters', () => ({
  removeFromShoppingListItemsConnection: jest.fn(),
  moveShoppingListItemToPurchased: jest.fn(),
  moveShoppingListItemToUnpurchased: jest.fn(),
  clearAllPurchasedItemsFromCache: jest.fn(),
  addNewItemToShoppingListCache: jest.fn(),
}));

jest.mock('#/apollo/utils/cacheUpdaters', () => ({
  createAddToQueryConnectionUpdater: jest.fn(() => jest.fn()),
  createRemoveFromQueryConnectionUpdater: jest.fn(() => jest.fn()),
  createAddToParentConnectionUpdater: jest.fn(() => jest.fn()),
  createRemoveFromParentConnectionUpdater: jest.fn(() => jest.fn()),
  safeEvict: jest.fn(),
  safeEvictMany: jest.fn(),
  gcResetResultCache: jest.fn(),
}));

jest.mock('#/utils/compilerSafeWrappers');

const mockUseAppStore = require('#store/useAppStore').useAppStore;

beforeEach(() => {
  jest.clearAllMocks();
  mockRegister.mockReturnValue({});
  mockIsParentDeleting.mockReturnValue(false);
  mockUseAppStore.mockImplementation((selector: any) =>
    selector({ selectedShoppingListId: 'list-1' }),
  );
});

// Captures the customOnData for a specific subscription so tests can drive it
// directly with simulated payloads. The hook now registers multiple separate
// subscriptions (ShoppingListItemChanged, ShoppingListUpdated,
// ShoppingListItemsBatchCleared, etc.); pass the desired subscriptionName.
function captureCustomOnData(subscriptionName: string) {
  let customOnData: any;
  mockRegister.mockImplementation((config: any) => {
    if (config.subscriptionName === subscriptionName)
      customOnData = config.customOnData;
    return {};
  });
  return () => customOnData;
}

describe('useShoppingListSubscriptions', () => {
  it('registers ShoppingListItemChanged subscription with correct config', () => {
    renderHookWithApollo(() => useShoppingListSubscriptions('user-1'));

    expect(mockRegister).toHaveBeenCalledWith(
      expect.objectContaining({
        subscriptionName: 'ShoppingListItemChanged',
        entityType: 'ShoppingListItem',
        enableDeduplication: true,
        userId: 'user-1',
        entityId: 'list-1',
      }),
    );
  });

  it('mounts without error when no selectedShoppingListId', () => {
    const {
      useAppStore,
      useSelectedShoppingListId,
    } = require('#store/useAppStore');
    useAppStore.mockImplementationOnce((selector: any) =>
      selector({ selectedShoppingListId: null }),
    );
    useSelectedShoppingListId.mockReturnValueOnce(null);

    renderHookWithApollo(() => useShoppingListSubscriptions('user-1'));

    expect(mockRegister).toHaveBeenCalledWith(
      expect.objectContaining({
        subscriptionName: 'ShoppingListItemChanged',
        entityId: undefined,
      }),
    );
  });

  it('handles Created mutation in customOnData', () => {
    const {
      addNewItemToShoppingListCache,
    } = require('#/apollo/utils/shoppingListCacheUpdaters');

    const getOnData = captureCustomOnData('ShoppingListItemChanged');
    renderHookWithApollo(() => useShoppingListSubscriptions('user-1'));

    const mockCache: any = {
      batch: jest.fn(({ update }: any) => update(mockCache)),
    };
    const mockClient = { cache: mockCache };

    getOnData()(
      {
        mutation: 'CREATED',
        item: { id: 'i1' },
        userId: 'other-user',
      },
      mockClient,
    );

    expect(addNewItemToShoppingListCache).toHaveBeenCalled();
  });

  it('skips self-echo for ShoppingListItemChanged', () => {
    const {
      addNewItemToShoppingListCache,
    } = require('#/apollo/utils/shoppingListCacheUpdaters');

    const getOnData = captureCustomOnData('ShoppingListItemChanged');
    renderHookWithApollo(() => useShoppingListSubscriptions('user-1'));

    const mockClient = { cache: { batch: jest.fn() } };
    getOnData()(
      {
        mutation: 'CREATED',
        item: { id: 'i1' },
        userId: 'user-1',
      },
      mockClient,
    );

    expect(addNewItemToShoppingListCache).not.toHaveBeenCalled();
  });

  it('handles Deleted mutation without animation', () => {
    const {
      removeFromShoppingListItemsConnection,
    } = require('#/apollo/utils/shoppingListCacheUpdaters');

    const getOnData = captureCustomOnData('ShoppingListItemChanged');
    renderHookWithApollo(() => useShoppingListSubscriptions('user-1'));

    const mockCache: any = {
      batch: jest.fn(({ update }: any) => update(mockCache)),
    };
    const mockClient = { cache: mockCache };

    getOnData()(
      {
        mutation: 'DELETED',
        item: { id: 'i1' },
        userId: 'other-user',
      },
      mockClient,
    );

    expect(removeFromShoppingListItemsConnection).toHaveBeenCalled();
  });

  it('handles ShoppingListItemsBatchCleared payload', () => {
    const {
      clearAllPurchasedItemsFromCache,
    } = require('#/apollo/utils/shoppingListCacheUpdaters');

    const getOnData = captureCustomOnData('ShoppingListItemsBatchCleared');
    renderHookWithApollo(() => useShoppingListSubscriptions('user-1'));

    const mockClient = { cache: {} };
    getOnData()(
      {
        clearedItemIds: ['i1', 'i2'],
        userId: 'other-user',
      },
      mockClient,
    );

    expect(clearAllPurchasedItemsFromCache).toHaveBeenCalledWith(
      mockClient.cache,
      'list-1',
      ['i1', 'i2'],
    );
  });

  it('does nothing for null payload (ShoppingListItemChanged)', () => {
    const getOnData = captureCustomOnData('ShoppingListItemChanged');
    renderHookWithApollo(() => useShoppingListSubscriptions('user-1'));

    expect(() => getOnData()(null, {})).not.toThrow();
  });

  it('evicts list entity when parent is deleting (ShoppingListUpdated)', () => {
    // First call is the top-level guard inside ShoppingListItemChanged's
    // customOnData (selectedShoppingListId). The handler under test
    // (ShoppingListUpdated.customOnData) calls isParentDeleting(node.id) which
    // returns true → safeEvict is invoked.
    mockIsParentDeleting.mockReturnValue(true);

    const getOnData = captureCustomOnData('ShoppingListUpdated');
    renderHookWithApollo(() => useShoppingListSubscriptions('user-1'));

    const mockCache = {
      identify: jest.fn().mockReturnValue('ShoppingList:list-1'),
      evict: jest.fn(),
      gc: jest.fn(),
    };
    const mockClient = { cache: mockCache };

    getOnData()(
      {
        node: { id: 'list-1' },
      },
      mockClient,
    );

    const { safeEvict } = require('#/apollo/utils/cacheUpdaters');
    expect(safeEvict).toHaveBeenCalledWith(mockCache, 'ShoppingList', 'list-1');
  });

  it('passes scheduleAnimation callback for Deleted items', () => {
    const {
      removeFromShoppingListItemsConnection,
    } = require('#/apollo/utils/shoppingListCacheUpdaters');

    const getOnData = captureCustomOnData('ShoppingListItemChanged');
    const scheduleAnimation = jest.fn((id, dir, onComplete) => onComplete());
    renderHookWithApollo(() =>
      useShoppingListSubscriptions('user-1', scheduleAnimation),
    );

    const mockCache: any = {
      batch: jest.fn(({ update }: any) => update(mockCache)),
    };
    const mockClient = { cache: mockCache };

    getOnData()(
      {
        mutation: 'DELETED',
        item: { id: 'i1' },
        userId: 'other-user',
      },
      mockClient,
    );

    expect(scheduleAnimation).toHaveBeenCalledWith(
      'i1',
      -1,
      expect.any(Function),
    );
    expect(removeFromShoppingListItemsConnection).toHaveBeenCalled();
  });
});
