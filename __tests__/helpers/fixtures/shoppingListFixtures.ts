/**
 * Shopping lists and their lines as the list reads state them, typed by those
 * reads: a fixture fails to build when a read gains a field it omits.
 */
import {
  CollaboratorRole,
  CollaboratorStatus,
  DisplayFormat,
  MembershipRole,
  type StoreDepartment,
} from '#/graphql/generated/schemaTypes';
import {
  GetShoppingListDetailsDocument,
  GetShoppingListItemsFilteredDocument,
  GetShoppingListsLiteDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { gql, type ApolloCache, type TypedDocumentNode } from '@apollo/client';
import { Kind } from 'graphql';
import { PAGINATION } from '#features/shoppingList/utils/shoppingListConstants';
import {
  ShoppingListItemPurchaseInfoFragmentDoc,
  type ShoppingListItemDisplayFragment,
  type ShoppingListItemPurchaseInfoFragment,
} from '#features/shoppingList/graphql/shoppingListFragments.generated';
import {
  recordMock,
  seedFragment,
  seedQuery,
  type MockDataFor,
} from '../apolloMockProvider';

export type ShoppingListNode = NonNullable<
  MockDataFor<typeof GetShoppingListDetailsDocument>['shoppingList']
>;
type Connection = NonNullable<
  NonNullable<
    MockDataFor<typeof GetShoppingListItemsFilteredDocument>['shoppingList']
  >['itemsConnection']
>;
type ListsEdge = NonNullable<
  NonNullable<
    MockDataFor<typeof GetShoppingListsLiteDocument>['shoppingLists']
  >['edges']
>[number];
export type ListLine = NonNullable<
  NonNullable<NonNullable<Connection['edges']>[number]>['node']
>;

/**
 * A list in a home, stated the same way to every read that selects it: two
 * reads that disagree overwrite each other as completion fills them in.
 */
export const homeShoppingList = (
  id: string,
  name: string,
  {
    role = MembershipRole.Owner,
    homeId = 'h1',
    homeName = 'Family',
  }: { role?: MembershipRole; homeId?: string; homeName?: string } = {},
): ShoppingListNode => ({
  __typename: 'ShoppingList',
  id,
  name,
  homeId,
  home: {
    __typename: 'Home',
    id: homeId,
    name: homeName,
    myMembership: { __typename: 'Membership', id: `m-${homeId}`, role },
  },
  ownerships: [],
});

type Collaborators = NonNullable<ShoppingListNode['collaboratorsConnection']>;
export type ListCollaborator = NonNullable<
  NonNullable<NonNullable<Collaborators['edges']>[number]>['node']
>;
type Ownership = NonNullable<
  NonNullable<ShoppingListNode['ownerships']>[number]
>;

/** Whose list it is, as its reads name its owner. */
export const listOwner = (userId: string, displayName: string): Ownership => ({
  __typename: 'ShoppingListOwnership',
  id: `own-${userId}`,
  userId,
  user: {
    __typename: 'User',
    id: userId,
    email: null,
    displayName,
    profile: null,
  },
});

/** Someone the list is shared with: a viewer holding no flags, unless told. */
export const listCollaborator = (
  userId: string,
  overrides: ListCollaborator = {},
): ListCollaborator => ({
  __typename: 'ShoppingListCollaborator',
  id: `c-${userId}`,
  email: `${userId}@example.com`,
  role: CollaboratorRole.Viewer,
  status: CollaboratorStatus.Active,
  collaboratorId: userId,
  canEdit: false,
  canAddItems: false,
  canEditItems: false,
  canRemoveItems: false,
  canMarkPurchased: false,
  canInviteOthers: false,
  invitedAt: null,
  collaborator: {
    __typename: 'User',
    id: userId,
    email:
      overrides.email === undefined ? `${userId}@example.com` : overrides.email,
    displayName: null,
    profile: null,
  },
  ...overrides,
});

/** A list's collaborators, as its detail read pages them. */
export const collaboratorsOf = (
  ...members: ListCollaborator[]
): Collaborators => ({
  __typename: 'ShoppingListCollaboratorConnection',
  edges: members.map(node => ({
    __typename: 'ShoppingListCollaboratorEdge',
    cursor: node.id ?? '',
    node,
  })),
});

/** A list of the person's own, in no home: nothing on it can go to a pantry. */
export const ownShoppingList = (
  id: string,
  name: string,
): ShoppingListNode => ({
  __typename: 'ShoppingList',
  id,
  name,
  homeId: null,
  home: null,
  ownerships: [],
});

/** A line to buy, or bought; `movedToPantryAt` once it has been put away. */
export const listLine = (
  id: string,
  itemName: string,
  {
    bought = false,
    movedToPantryAt = null,
    quantity,
    storeDepartment,
  }: {
    bought?: boolean;
    movedToPantryAt?: string | null;
    quantity?: number;
    /** The aisle store mode files it under. */
    storeDepartment?: StoreDepartment;
  } = {},
): ListLine => ({
  __typename: 'ShoppingListItem',
  id,
  itemName,
  sortOrder: id,
  ...(quantity !== undefined && { quantity }),
  ...(storeDepartment !== undefined && {
    storeDepartment,
    storeDepartmentOverride: null,
  }),
  purchaseInfo: {
    __typename: 'ShoppingListItemPurchaseInfo',
    isPurchased: bought,
    movedToPantryAt,
  },
});

/** Answers the lists read with `lists`, as often as it is asked. */
export const listsRead = (
  lists: ShoppingListNode[],
  { held = false }: { held?: boolean } = {},
) =>
  recordMock(GetShoppingListsLiteDocument, {
    held,
    data: {
      shoppingLists: {
        __typename: 'ShoppingListConnection',
        edges: lists.map(
          (node): ListsEdge => ({ __typename: 'ShoppingListEdge', node }),
        ),
      },
    },
  });

/** Answers a list's detail read; a list with no home cannot move to a pantry. */
export const listDetailsRead = (
  list: ShoppingListNode,
  { held = false }: { held?: boolean } = {},
) =>
  recordMock(GetShoppingListDetailsDocument, {
    data: { shoppingList: { ...list, canMoveToPantry: !!list.homeId } },
    held,
  });

/**
 * Answers both of a list's line reads, to buy and bought, from `lines`; with
 * `maxUsageCount`, only that many times. With `pageSize`, each answer holds at
 * most that many lines after the cursor asked for, and counts them all.
 */
export const listLinesRead = (
  listId: string,
  lines: ListLine[],
  {
    maxUsageCount,
    pageSize,
    held = false,
  }: { maxUsageCount?: number; pageSize?: number; held?: boolean } = {},
) =>
  recordMock(GetShoppingListItemsFilteredDocument, {
    maxUsageCount,
    held,
    dataFor: ({
      isPurchased,
      first,
      after,
    }): MockDataFor<typeof GetShoppingListItemsFilteredDocument> => {
      const matching = lines.filter(
        line => (line.purchaseInfo?.isPurchased ?? false) === isPurchased,
      );
      const start = after
        ? matching.findIndex(line => line.id === after) + 1
        : 0;
      const asked = typeof first === 'number' ? first : matching.length;
      const page = matching.slice(
        start,
        start + Math.min(asked, pageSize ?? asked),
      );
      const hasNextPage = start + page.length < matching.length;
      return linesPage(listId, page, {
        totalCount: matching.length,
        hasNextPage,
        endCursor: page.at(-1)?.id ?? null,
      });
    },
  });

/** A page of a list's line read: its lines, and what the list holds in all. */
function linesPage(
  listId: string,
  page: ListLine[],
  {
    totalCount = page.length,
    hasNextPage = false,
    endCursor = null,
  }: { totalCount?: number; hasNextPage?: boolean; endCursor?: string | null },
): MockDataFor<typeof GetShoppingListItemsFilteredDocument> {
  return {
    shoppingList: {
      __typename: 'ShoppingList',
      id: listId,
      itemsConnection: {
        __typename: 'ShoppingListItemConnection',
        totalCount,
        edges: page.map(node => ({
          __typename: 'ShoppingListItemEdge',
          cursor: node.id ?? '',
          node,
        })),
        pageInfo: { __typename: 'PageInfo', hasNextPage, endCursor },
      },
    },
  };
}

/**
 * Seeds a list's two first pages, to buy and bought, as the list screen reads
 * them; `totals` states a tab holding more than its page.
 */
export function seedListLines(
  cache: ApolloCache,
  listId: string,
  lines: ListLine[],
  totals: { toBuy?: number; bought?: number } = {},
) {
  for (const isPurchased of [false, true]) {
    const page = lines.filter(
      line => (line.purchaseInfo?.isPurchased ?? false) === isPurchased,
    );
    seedQuery(cache, {
      query: GetShoppingListItemsFilteredDocument,
      variables: { id: listId, first: PAGINATION.ITEMS_PAGE_SIZE, isPurchased },
      data: linesPage(listId, page, {
        totalCount: isPurchased ? totals.bought : totals.toBuy,
      }),
    });
  }
}

/** A line's whole purchase record, as every write that can change it selects. */
const PURCHASE_RECORD: TypedDocumentNode<{
  __typename: 'ShoppingListItem';
  id: string;
  purchaseInfo: ShoppingListItemPurchaseInfoFragment | null;
}> = {
  kind: Kind.DOCUMENT,
  definitions: [
    ...gql`
      fragment FixturePurchaseRecord on ShoppingListItem {
        id
        purchaseInfo {
          ...ShoppingListItemPurchaseInfoFragment
        }
      }
    `.definitions,
    ...ShoppingListItemPurchaseInfoFragmentDoc.definitions,
  ],
};

/** Seeds a line's purchase record: bought, unmoved and unpriced, unless stated. */
export function seedPurchaseRecord(
  cache: ApolloCache,
  id: string,
  record: Partial<ShoppingListItemPurchaseInfoFragment> = {},
) {
  seedFragment(cache, {
    fragment: PURCHASE_RECORD,
    fragmentName: 'FixturePurchaseRecord',
    data: {
      __typename: 'ShoppingListItem',
      id,
      purchaseInfo: {
        __typename: 'ShoppingListItemPurchaseInfo',
        isPurchased: true,
        movedToPantryAt: null,
        purchaseDate: null,
        purchasedPrice: null,
        purchasedQuantity: null,
        purchasedBy: null,
        ...record,
      },
    },
  });
}

/** A line's purchase record as the cache holds it now, pending writes included. */
export const purchaseRecordOf = (cache: ApolloCache, id: string) =>
  cache.readFragment({
    id: cache.identify({ __typename: 'ShoppingListItem', id }),
    fragment: PURCHASE_RECORD,
    fragmentName: 'FixturePurchaseRecord',
    optimistic: true,
  })?.purchaseInfo;

/** A watch of a line's purchase record, for `cacheShows`. */
export const purchaseRecordWatch = (id: string) => ({
  fragment: PURCHASE_RECORD,
  fragmentName: 'FixturePurchaseRecord',
  from: `ShoppingListItem:${id}`,
});

/** Two of milk, open on list-1, as the list hands a line to a sheet. */
export const displayedLine = (
  overrides: Partial<ShoppingListItemDisplayFragment> = {},
): ShoppingListItemDisplayFragment => ({
  __typename: 'ShoppingListItem',
  id: 'line-1',
  shoppingList: { __typename: 'ShoppingList', id: 'list-1' },
  itemName: 'Milk',
  quantity: 2,
  quantityInput: '2',
  displayFormat: DisplayFormat.Auto,
  version: 3,
  updatedAt: '2025-01-01T00:00:00.000Z',
  category: 'Dairy',
  notes: null,
  unitName: null,
  sortOrder: 'aaa',
  purchaseInfo: {
    __typename: 'ShoppingListItemPurchaseInfo',
    movedToPantryAt: null,
    isPurchased: false,
  },
  unit: null,
  item: null,
  ...overrides,
});

/** The ids a list's first page of a tab shows, pending writes included. */
export const listLineIds = (
  cache: ApolloCache,
  listId: string,
  isPurchased: boolean,
  optimistic = true,
) =>
  cache
    .readQuery({
      query: GetShoppingListItemsFilteredDocument,
      variables: { id: listId, first: PAGINATION.ITEMS_PAGE_SIZE, isPurchased },
      optimistic,
    })
    ?.shoppingList?.itemsConnection.edges.map(edge => edge.node.id) ?? [];
