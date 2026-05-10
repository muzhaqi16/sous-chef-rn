'use no memo';

import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import { ShoppingListChangeType } from '#/graphql/generated/schemaTypes';
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

jest.mock('#store/useAppStore', () => ({
  useAppStore: jest.fn((selector: any) =>
    selector({ selectedShoppingListId: 'list-1' }),
  ),
}));

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
  mockUseAppStore.mockImplementation((selector: any) =>
    selector({ selectedShoppingListId: 'list-1' }),
  );
});

// Captures the customOnData from the ShoppingListChanges subscription so tests
// can drive it with simulated payloads. We don't go through the real Apollo
// subscription path because the cache-update logic under test is plain JS.
function captureCustomOnData() {
  let customOnData: any;
  mockRegister.mockImplementation((config: any) => {
    if (config.subscriptionName === 'ShoppingListChanges')
      customOnData = config.customOnData;
    return {};
  });
  return () => customOnData;
}

describe('useShoppingListSubscriptions', () => {
  it('registers subscription with correct config', () => {
    renderHookWithApollo(() => useShoppingListSubscriptions('user-1'));

    expect(mockRegister).toHaveBeenCalledWith(
      expect.objectContaining({
        subscriptionName: 'ShoppingListChanges',
        entityType: 'ShoppingListItem',
        enableDeduplication: true,
        userId: 'user-1',
        entityId: 'list-1',
      }),
    );
  });

  it('mounts without error when no selectedShoppingListId', () => {
    const { useAppStore } = require('#store/useAppStore');
    useAppStore.mockImplementation((selector: any) =>
      selector({ selectedShoppingListId: null }),
    );

    // The hook calls `useSubscription` with `skip: true` when
    // selectedShoppingListId is null. We don't directly inspect the
    // subscription options anymore — instead we verify the hook mounts
    // cleanly and registers with no entityId.
    renderHookWithApollo(() => useShoppingListSubscriptions('user-1'));

    expect(mockRegister).toHaveBeenCalledWith(
      expect.objectContaining({
        subscriptionName: 'ShoppingListChanges',
        entityId: undefined,
      }),
    );
  });

  it('handles ITEMS_CHANGED Created mutation in customOnData', () => {
    const {
      addNewItemToShoppingListCache,
    } = require('#/apollo/utils/shoppingListCacheUpdaters');

    const getOnData = captureCustomOnData();
    renderHookWithApollo(() => useShoppingListSubscriptions('user-1'));

    const mockCache: any = {
      batch: jest.fn(({ update }: any) => update(mockCache)),
    };
    const mockClient = { cache: mockCache };

    getOnData()(
      {
        changeType: 'ITEMS_CHANGED',
        mutation: 'CREATED',
        item: { id: 'i1' },
        userId: 'other-user',
      },
      mockClient,
    );

    expect(addNewItemToShoppingListCache).toHaveBeenCalled();
  });

  it('skips self-echo for ITEMS_CHANGED', () => {
    const {
      addNewItemToShoppingListCache,
    } = require('#/apollo/utils/shoppingListCacheUpdaters');

    const getOnData = captureCustomOnData();
    renderHookWithApollo(() => useShoppingListSubscriptions('user-1'));

    const mockClient = { cache: { batch: jest.fn() } };
    getOnData()(
      {
        changeType: 'ITEMS_CHANGED',
        mutation: 'CREATED',
        item: { id: 'i1' },
        userId: 'user-1',
      },
      mockClient,
    );

    expect(addNewItemToShoppingListCache).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('⏭️'),
      expect.anything(),
    );
  });

  it('handles ITEMS_CHANGED Deleted mutation without animation', () => {
    const {
      removeFromShoppingListItemsConnection,
    } = require('#/apollo/utils/shoppingListCacheUpdaters');

    const getOnData = captureCustomOnData();
    renderHookWithApollo(() => useShoppingListSubscriptions('user-1'));

    const mockCache: any = {
      batch: jest.fn(({ update }: any) => update(mockCache)),
    };
    const mockClient = { cache: mockCache };

    getOnData()(
      {
        changeType: 'ITEMS_CHANGED',
        mutation: 'DELETED',
        item: { id: 'i1' },
        userId: 'other-user',
      },
      mockClient,
    );

    expect(removeFromShoppingListItemsConnection).toHaveBeenCalled();
  });

  it('handles ITEMS_BATCH_CLEARED', () => {
    const {
      clearAllPurchasedItemsFromCache,
    } = require('#/apollo/utils/shoppingListCacheUpdaters');

    const getOnData = captureCustomOnData();
    renderHookWithApollo(() => useShoppingListSubscriptions('user-1'));

    const mockClient = { cache: {} };
    getOnData()(
      {
        changeType: 'ITEMS_BATCH_CLEARED',
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

  it('does nothing for null payload', () => {
    const getOnData = captureCustomOnData();
    renderHookWithApollo(() => useShoppingListSubscriptions('user-1'));

    expect(() => getOnData()(null, {})).not.toThrow();
  });

  it('handles LIST_UPDATED for parent deleting', () => {
    // First call is the top-level guard (selectedShoppingListId) — return false
    // Second call is inside LIST_UPDATED case (node.id) — return true
    mockIsParentDeleting.mockReturnValueOnce(false).mockReturnValueOnce(true);

    const getOnData = captureCustomOnData();
    renderHookWithApollo(() => useShoppingListSubscriptions('user-1'));

    const mockCache = {
      identify: jest.fn().mockReturnValue('ShoppingList:list-1'),
      evict: jest.fn(),
      gc: jest.fn(),
    };
    const mockClient = { cache: mockCache };

    getOnData()(
      {
        changeType: ShoppingListChangeType.ListUpdated,
        shoppingList: { id: 'list-1' },
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

    const getOnData = captureCustomOnData();
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
        changeType: 'ITEMS_CHANGED',
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
