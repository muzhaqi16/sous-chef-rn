/**
 * Shopping lists and their lines as the list reads state them, typed by those
 * reads: a fixture fails to build when a read gains a field it omits.
 */
import { MembershipRole } from '#/graphql/generated/schemaTypes';
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
  }: { role?: MembershipRole; homeId?: string } = {},
): ShoppingListNode => ({
  __typename: 'ShoppingList',
  id,
  name,
  homeId,
  home: {
    __typename: 'Home',
    id: homeId,
    myMembership: { __typename: 'Membership', id: `m-${homeId}`, role },
  },
  ownerships: [],
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
  }: {
    bought?: boolean;
    movedToPantryAt?: string | null;
    quantity?: number;
  } = {},
): ListLine => ({
  __typename: 'ShoppingListItem',
  id,
  itemName,
  sortOrder: id,
  ...(quantity !== undefined && { quantity }),
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

/** Answers both of a list's line reads, to buy and bought, from `lines`. */
export const listLinesRead = (listId: string, lines: ListLine[]) =>
  recordMock(GetShoppingListItemsFilteredDocument, {
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
