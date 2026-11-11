/**
 * Shopping lists and their lines as the list reads state them, typed by those
 * reads: a fixture fails to build when a read gains a field it omits.
 */
import {
  CollaboratorRole,
  CollaboratorStatus,
  MembershipRole,
  type StoreDepartment,
} from '#/graphql/generated/schemaTypes';
import {
  GetShoppingListDetailsDocument,
  GetShoppingListItemsFilteredDocument,
  GetShoppingListsLiteDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { recordMock, type MockDataFor } from '../apolloMockProvider';

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
 * `maxUsageCount`, only that many times.
 */
export const listLinesRead = (
  listId: string,
  lines: ListLine[],
  { maxUsageCount }: { maxUsageCount?: number } = {},
) =>
  recordMock(GetShoppingListItemsFilteredDocument, {
    maxUsageCount,
    dataFor: ({
      isPurchased,
    }): MockDataFor<typeof GetShoppingListItemsFilteredDocument> => {
      const page = lines.filter(
        line => (line.purchaseInfo?.isPurchased ?? false) === isPurchased,
      );
      return {
        shoppingList: {
          __typename: 'ShoppingList',
          id: listId,
          itemsConnection: {
            __typename: 'ShoppingListItemConnection',
            totalCount: page.length,
            edges: page.map(node => ({
              __typename: 'ShoppingListItemEdge',
              cursor: node.id ?? '',
              node,
            })),
            pageInfo: {
              __typename: 'PageInfo',
              hasNextPage: false,
              endCursor: null,
            },
          },
        },
      };
    },
  });
