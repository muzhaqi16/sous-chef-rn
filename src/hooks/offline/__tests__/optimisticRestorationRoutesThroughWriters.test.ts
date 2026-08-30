/**
 * Restoration must apply a persisted patch through the writer that owns the
 * field, not with a blind merge.
 *
 * This path only runs after the app was killed while offline, so no foreground
 * test reaches it — which is how it came to be a third writer of
 * `ShoppingListItem.purchaseInfo` with none of that record's rules. The sibling
 * suite mocks the whole cache and so can only assert that `batch` was called;
 * this one uses the REAL cache, because the rules being skipped live in the
 * writer and the type policy.
 */
import { renderHook } from '@testing-library/react-native';
import { gql, type InMemoryCache } from '@apollo/client';
import { useOptimisticDataRestorationMultiple } from '../useOptimisticDataRestoration';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

const mockGetAllForType = jest.fn<
  Map<string, Record<string, unknown>>,
  [string]
>(() => new Map());

// The factory owns the cache: `jest.mock` is hoisted above every const in this
// file, so a cache built at module scope is still in its temporal dead zone
// when the factory runs.
jest.mock('#/apollo/client', () => {
  const { makeCache } = jest.requireActual('#/apollo/cache');
  return { client: { cache: makeCache() } };
});
jest.mock('#/apollo/offline/OptimisticDataPersistence', () => ({
  optimisticDataPersistence: {
    getAllForType: (entityType: string) => mockGetAllForType(entityType),
  },
}));
jest.mock('#store/useAppStore', () => ({
  useUser: () => ({ id: 'user-1' }),
}));

jest
  .spyOn(require('react'), 'startTransition')
  .mockImplementation((...args: unknown[]) => {
    const fn = args[0];
    if (typeof fn === 'function') fn();
  });

const cache = (
  jest.requireMock('#/apollo/client') as { client: { cache: InMemoryCache } }
).client.cache;

const ROW = gql`
  fragment RestoreProbe on ShoppingListItem {
    __typename
    id
    purchaseInfo {
      __typename
      isPurchased
      movedToPantryAt
      purchasedQuantity
    }
  }
`;

type Row = {
  purchaseInfo: {
    isPurchased: boolean;
    movedToPantryAt: string | null;
    purchasedQuantity: number | null;
  };
};

const seedStockedRow = () => {
  cache.writeFragment({
    id: 'ShoppingListItem:sli-1',
    fragment: ROW,
    data: {
      __typename: 'ShoppingListItem',
      id: 'sli-1',
      purchaseInfo: {
        __typename: 'ShoppingListItemPurchaseInfo',
        isPurchased: true,
        movedToPantryAt: '2026-08-28T10:00:00.000Z',
        purchasedQuantity: 3,
      },
    },
  });
};

const read = () =>
  cache.readFragment<Row>({
    id: 'ShoppingListItem:sli-1',
    fragment: ROW,
  })?.purchaseInfo;

describe('optimistic restoration routes through the owning writer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cache.reset();
  });

  it('applies the record’s clear-on-flip rule to a restored patch', () => {
    seedStockedRow();
    // What `useToggleShoppingItem` persists when the user un-purchases a line
    // and the app is killed before the mutation resolves.
    mockGetAllForType.mockImplementation(type =>
      type === 'ShoppingListItem'
        ? new Map([['sli-1', { purchaseInfo: { isPurchased: false } }]])
        : new Map(),
    );

    renderHook(() =>
      useOptimisticDataRestorationMultiple(['ShoppingListItem']),
    );

    const after = read();
    expect(after?.isPurchased).toBe(false);
    // The blind merge left this standing, so the restored row read as "already
    // in your pantry" and its move-to-pantry action stayed withheld for a line
    // the bulk move would act on.
    expect(after?.movedToPantryAt).toBeNull();
  });

  it('leaves the rest of the purchase record intact', () => {
    seedStockedRow();
    mockGetAllForType.mockImplementation(type =>
      type === 'ShoppingListItem'
        ? new Map([['sli-1', { purchaseInfo: { isPurchased: false } }]])
        : new Map(),
    );

    renderHook(() =>
      useOptimisticDataRestorationMultiple(['ShoppingListItem']),
    );

    expect(read()?.purchasedQuantity).toBe(3);
  });

  it('still merges a field no writer owns', () => {
    cache.writeFragment({
      id: 'ShoppingListItem:sli-1',
      fragment: gql`
        fragment RestoreOther on ShoppingListItem {
          __typename
          id
          notes
        }
      `,
      data: {
        __typename: 'ShoppingListItem',
        id: 'sli-1',
        notes: 'before',
      },
    });
    mockGetAllForType.mockImplementation(type =>
      type === 'ShoppingListItem'
        ? new Map([['sli-1', { notes: 'after' }]])
        : new Map(),
    );

    renderHook(() =>
      useOptimisticDataRestorationMultiple(['ShoppingListItem']),
    );

    expect(
      (
        cache.extract()['ShoppingListItem:sli-1'] as {
          notes?: string;
        }
      ).notes,
    ).toBe('after');
  });
});
