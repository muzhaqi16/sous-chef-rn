'use no memo';

import { act } from '@testing-library/react-native';
import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import { useShoppingListSubscriptions } from '#features/shoppingList/hooks/useShoppingListSubscriptions';
import { InMemoryCache } from '@apollo/client';
import { MyShoppingListsEventsDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import {
  MutationType,
  ShoppingListSubtype,
} from '#/graphql/generated/schemaTypes';
import type { SubscriptionConfig } from '#/services/subscriptions/types';
import type { RootState } from '#store/index';

type CapturedOnData = (data: unknown, client: unknown) => void;

type MockBatchCache = {
  batch: jest.Mock;
};

jest.mock('../../../apollo/links/tokenScheduler');
jest.mock('../../../apollo/links/refreshToken');

const mockRegister = jest.fn().mockReturnValue({});
const mockIsParentDeleting = jest.fn().mockReturnValue(false);
jest.mock('#/services/subscriptions/SubscriptionService', () => ({
  subscriptionService: {
    register: (config: SubscriptionConfig) => mockRegister(config),
    isParentDeleting: (entityId: string) => mockIsParentDeleting(entityId),
  },
}));

jest.mock('#/services/subscriptions/types', () => ({
  CacheStrategy: { NONE: 'NONE' },
}));

jest.mock('#store/useAppStore', () => {
  const getState = () =>
    ({ selectedShoppingListId: 'list-1' } as Partial<RootState> as RootState);
  return {
    useAppStore: jest.fn(
      <T>(selector: (state: RootState) => T): T => selector(getState()),
    ),
    useSelectedShoppingListId: jest.fn(() => getState().selectedShoppingListId),
    // Transport recovery reads connectivity; a partial factory here would
    // otherwise make every subscription in this suite throw on mount.
    useIsOnline: jest.fn(() => true),
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

jest.mock('#/utils/finallyHelpers');

const mockUseAppStore = require('#store/useAppStore').useAppStore;

beforeEach(() => {
  jest.clearAllMocks();
  mockRegister.mockReturnValue({});
  mockIsParentDeleting.mockReturnValue(false);
  mockUseAppStore.mockImplementation(
    <T>(selector: (state: RootState) => T): T =>
      selector({
        selectedShoppingListId: 'list-1',
      } as Partial<RootState> as RootState),
  );
});

// Captures the customOnData for a specific subscription so tests can drive it
// directly with simulated payloads. The hook registers two subscriptions
// (MyShoppingListsEvents, CollaborationChanges); pass the desired
// subscriptionName.
function captureCustomOnData(subscriptionName: string) {
  let customOnData: CapturedOnData | undefined;
  mockRegister.mockImplementation((config: SubscriptionConfig) => {
    if (config.subscriptionName === subscriptionName)
      customOnData = config.customOnData as CapturedOnData | undefined;
    return {};
  });
  return (): CapturedOnData => {
    if (!customOnData) throw new Error('customOnData was not captured');
    return customOnData;
  };
}

describe('useShoppingListSubscriptions', () => {
  it('registers MyShoppingListsEvents subscription with correct config', () => {
    renderHookWithApollo(() => useShoppingListSubscriptions('user-1'));

    expect(mockRegister).toHaveBeenCalledWith(
      expect.objectContaining({
        subscriptionName: 'MyShoppingListsEvents',
        entityType: 'ShoppingList',
        enableDeduplication: true,
        userId: 'user-1',
      }),
    );
  });

  it('mounts without error when no selectedShoppingListId', () => {
    const {
      useAppStore,
      useSelectedShoppingListId,
    } = require('#store/useAppStore');
    useAppStore.mockImplementationOnce(
      <T>(selector: (state: RootState) => T): T =>
        selector({
          selectedShoppingListId: null,
        } as Partial<RootState> as RootState),
    );
    useSelectedShoppingListId.mockReturnValueOnce(null);

    renderHookWithApollo(() => useShoppingListSubscriptions('user-1'));

    expect(mockRegister).toHaveBeenCalledWith(
      expect.objectContaining({
        subscriptionName: 'MyShoppingListsEvents',
      }),
    );
  });

  it('reads a created item back before adding it', async () => {
    const {
      addNewItemToShoppingListCache,
    } = require('#/apollo/utils/shoppingListCacheUpdaters');

    const getOnData = captureCustomOnData('MyShoppingListsEvents');
    renderHookWithApollo(() => useShoppingListSubscriptions('user-1'));

    const mockCache: MockBatchCache = {
      batch: jest.fn(
        ({ update }: { update: (cache: MockBatchCache) => void }) =>
          update(mockCache),
      ),
    };
    // The event carries only the id; the values come from the read-back.
    const mockClient = {
      cache: mockCache,
      query: jest.fn().mockResolvedValue({
        data: {
          shoppingListItem: { __typename: 'ShoppingListItem', id: 'i1' },
        },
      }),
    };

    await act(async () => {
      getOnData()(
        {
          subtype: 'ITEMS_CHANGED',
          mutation: 'CREATED',
          node: { __typename: 'ShoppingListItem', id: 'i1' },
          listId: 'list-1',
          actorUserId: 'other-user',
          updatedFields: [],
        },
        mockClient,
      );
    });

    expect(mockClient.query).toHaveBeenCalledWith(
      expect.objectContaining({ variables: { id: 'i1' } }),
    );
    expect(addNewItemToShoppingListCache).toHaveBeenCalled();
  });

  it('skips self-echo for MyShoppingListsEvents item changes', () => {
    const {
      addNewItemToShoppingListCache,
    } = require('#/apollo/utils/shoppingListCacheUpdaters');

    const getOnData = captureCustomOnData('MyShoppingListsEvents');
    renderHookWithApollo(() => useShoppingListSubscriptions('user-1'));

    const mockClient = { cache: { batch: jest.fn() } };
    getOnData()(
      {
        subtype: 'ITEMS_CHANGED',
        mutation: 'CREATED',
        node: { __typename: 'ShoppingListItem', id: 'i1' },
        listId: 'list-1',
        actorUserId: 'user-1',
      },
      mockClient,
    );

    expect(addNewItemToShoppingListCache).not.toHaveBeenCalled();
  });

  it('ignores item events for lists other than the selected one', () => {
    const {
      addNewItemToShoppingListCache,
    } = require('#/apollo/utils/shoppingListCacheUpdaters');

    const getOnData = captureCustomOnData('MyShoppingListsEvents');
    renderHookWithApollo(() => useShoppingListSubscriptions('user-1'));

    const mockClient = { cache: { batch: jest.fn() } };
    getOnData()(
      {
        subtype: 'ITEMS_CHANGED',
        mutation: 'CREATED',
        node: { __typename: 'ShoppingListItem', id: 'i1' },
        listId: 'list-other',
        actorUserId: 'other-user',
      },
      mockClient,
    );

    expect(addNewItemToShoppingListCache).not.toHaveBeenCalled();
  });

  it('handles Deleted mutation without animation', () => {
    const {
      removeFromShoppingListItemsConnection,
    } = require('#/apollo/utils/shoppingListCacheUpdaters');

    const getOnData = captureCustomOnData('MyShoppingListsEvents');
    renderHookWithApollo(() => useShoppingListSubscriptions('user-1'));

    const mockCache: MockBatchCache = {
      batch: jest.fn(
        ({ update }: { update: (cache: MockBatchCache) => void }) =>
          update(mockCache),
      ),
    };
    const mockClient = { cache: mockCache };

    getOnData()(
      {
        subtype: 'ITEMS_CHANGED',
        mutation: 'DELETED',
        node: { __typename: 'ShoppingListItem', id: 'i1' },
        listId: 'list-1',
        actorUserId: 'other-user',
      },
      mockClient,
    );

    expect(removeFromShoppingListItemsConnection).toHaveBeenCalled();
  });

  it('handles ITEMS_BATCH_CLEARED payload', () => {
    const {
      clearAllPurchasedItemsFromCache,
    } = require('#/apollo/utils/shoppingListCacheUpdaters');

    const getOnData = captureCustomOnData('MyShoppingListsEvents');
    renderHookWithApollo(() => useShoppingListSubscriptions('user-1'));

    const mockClient = { cache: {} };
    getOnData()(
      {
        subtype: 'ITEMS_BATCH_CLEARED',
        clearedItemIds: ['i1', 'i2'],
        listId: 'list-1',
        actorUserId: 'other-user',
      },
      mockClient,
    );

    expect(clearAllPurchasedItemsFromCache).toHaveBeenCalledWith(
      mockClient.cache,
      'list-1',
      ['i1', 'i2'],
    );
  });

  it('ignores ITEMS_BATCH_CLEARED for lists other than the selected one', () => {
    const {
      clearAllPurchasedItemsFromCache,
    } = require('#/apollo/utils/shoppingListCacheUpdaters');

    const getOnData = captureCustomOnData('MyShoppingListsEvents');
    renderHookWithApollo(() => useShoppingListSubscriptions('user-1'));

    const mockClient = { cache: {} };
    getOnData()(
      {
        subtype: 'ITEMS_BATCH_CLEARED',
        clearedItemIds: ['i1', 'i2'],
        listId: 'list-other',
        actorUserId: 'other-user',
      },
      mockClient,
    );

    expect(clearAllPurchasedItemsFromCache).not.toHaveBeenCalled();
  });

  it('does nothing for null payload (MyShoppingListsEvents)', () => {
    const getOnData = captureCustomOnData('MyShoppingListsEvents');
    renderHookWithApollo(() => useShoppingListSubscriptions('user-1'));

    expect(() => getOnData()(null, {})).not.toThrow();
  });

  it('evicts list entity when parent is deleting (LIST_UPDATED)', () => {
    // The LIST_UPDATED branch calls isParentDeleting(node.id) which returns
    // true → safeEvict is invoked.
    mockIsParentDeleting.mockReturnValue(true);

    const getOnData = captureCustomOnData('MyShoppingListsEvents');
    renderHookWithApollo(() => useShoppingListSubscriptions('user-1'));

    const mockCache = {
      identify: jest.fn().mockReturnValue('ShoppingList:list-1'),
      evict: jest.fn(),
      gc: jest.fn(),
    };
    const mockClient = { cache: mockCache };

    getOnData()(
      {
        subtype: 'LIST_UPDATED',
        node: { __typename: 'ShoppingList', id: 'list-1' },
        listId: 'list-1',
        actorUserId: 'user-1',
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

    const getOnData = captureCustomOnData('MyShoppingListsEvents');
    const scheduleAnimation = jest.fn((id, dir, onComplete) => onComplete());
    renderHookWithApollo(() =>
      useShoppingListSubscriptions('user-1', scheduleAnimation),
    );

    const mockCache: MockBatchCache = {
      batch: jest.fn(
        ({ update }: { update: (cache: MockBatchCache) => void }) =>
          update(mockCache),
      ),
    };
    const mockClient = { cache: mockCache };

    getOnData()(
      {
        subtype: 'ITEMS_CHANGED',
        mutation: 'DELETED',
        node: { __typename: 'ShoppingListItem', id: 'i1' },
        listId: 'list-1',
        actorUserId: 'other-user',
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

describe('useShoppingListSubscriptions: event envelope and the cache', () => {
  it('keeps the envelope out of the cache, so an event for a just-deleted row cannot re-create it', async () => {
    // The server echoes our own delete before the mutation resolves, while the
    // row is already evicted. A cacheable subscription would normalise
    // `node { id }` into a bare ShoppingListItem and leave the list query
    // incomplete — see `__tests__/apollo/subscriptionEnvelopeWrite.test.ts`.
    const cache = new InMemoryCache();
    renderHookWithApollo(() => useShoppingListSubscriptions('user-1'), {
      cache,
      operationMocks: [
        {
          request: { query: MyShoppingListsEventsDocument },
          result: {
            data: {
              __typename: 'Subscription',
              myShoppingListsEvents: {
                __typename: 'ShoppingListEvent',
                subtype: ShoppingListSubtype.ItemsChanged,
                mutation: MutationType.ItemRemoved,
                listId: 'list-1',
                originatorClientId: 'device_other',
                actorUserId: 'user-2',
                timestamp: '2026-01-01T00:00:00.000Z',
                updatedFields: [],
                clearedItemIds: [],
                node: { __typename: 'ShoppingListItem', id: 'item-1' },
              },
            },
          },
        },
      ],
    });

    // MockLink delivers the subscription result on a (real) timer.
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 20));
    });

    expect(cache.extract()['ShoppingListItem:item-1']).toBeUndefined();
    expect(cache.extract().ROOT_SUBSCRIPTION).toBeUndefined();
  });
});
