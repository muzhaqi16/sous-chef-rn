// This file is auto-generated. Do not edit manually.
/* eslint-disable */
// @ts-nocheck
import type * as Types from '../../../graphql/generated/baseTypes';

import type {
  ShoppingListOwnershipFragment,
  ShoppingListCollaboratorFragment,
  ShoppingListItemDisplayFragment,
  ShoppingListItemFragment,
  PantryItemDisplayFragment,
} from '../../../graphql/operations/fragments.generated';
import type { DocumentNode } from 'graphql';
import type * as ApolloReactCommon from '@apollo/client';
import * as ApolloReactHooks from '@apollo/client/react';
const defaultOptions = {} as const;
export type GetShoppingListDetailsQueryVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
}>;

export type GetShoppingListDetailsQuery = {
  __typename: 'Query';
  shoppingList: {
    __typename: 'ShoppingList';
    id: string;
    name: string;
    isDefault: boolean;
    totalItems: number;
    completedItems: number;
    homeId: string | null;
    shareCode: string | null;
    isPublic: boolean;
    home: {
      __typename: 'Home';
      id: string;
      name: string;
      myMembership: {
        __typename: 'Membership';
        id: string;
        role: Types.MembershipRole;
        canAddItems: boolean;
        canRemoveItems: boolean;
        canEditPantry: boolean;
      } | null;
    } | null;
    ownerships: Array<
      { __typename: 'ShoppingListOwnership' } & ShoppingListOwnershipFragment
    >;
    collaboratorsConnection: {
      __typename: 'ShoppingListCollaboratorConnection';
      totalCount: number | null;
      edges: Array<{
        __typename: 'ShoppingListCollaboratorEdge';
        cursor: string;
        node: {
          __typename: 'ShoppingListCollaborator';
          invitedAt: string;
        } & ShoppingListCollaboratorFragment;
      }>;
      pageInfo: {
        __typename: 'PageInfo';
        hasNextPage: boolean;
        endCursor: string | null;
      };
    };
  } | null;
};

export type GetShoppingListsLiteQueryVariables = Types.Exact<{
  homeId?: Types.InputMaybe<Types.Scalars['ID']['input']>;
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>;
  after?: Types.InputMaybe<Types.Scalars['String']['input']>;
}>;

export type GetShoppingListsLiteQuery = {
  __typename: 'Query';
  shoppingLists: {
    __typename: 'ShoppingListConnection';
    totalCount: number | null;
    edges: Array<{
      __typename: 'ShoppingListEdge';
      cursor: string;
      node: {
        __typename: 'ShoppingList';
        id: string;
        name: string;
        isDefault: boolean;
        totalItems: number;
        completedItems: number;
        homeId: string | null;
        home: { __typename: 'Home'; id: string; name: string } | null;
        ownerships: Array<{
          __typename: 'ShoppingListOwnership';
          id: string;
          userId: string;
          user: {
            __typename: 'User';
            id: string;
            email: string;
            profile: {
              __typename: 'UserProfile';
              id: string;
              displayName: string | null;
              avatar: string | null;
            } | null;
          };
        }>;
      };
    }>;
    pageInfo: {
      __typename: 'PageInfo';
      hasNextPage: boolean;
      endCursor: string | null;
    };
  };
};

export type GetShoppingListItemsFilteredQueryVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
  first: Types.Scalars['Int']['input'];
  after?: Types.InputMaybe<Types.Scalars['String']['input']>;
  isPurchased: Types.Scalars['Boolean']['input'];
}>;

export type GetShoppingListItemsFilteredQuery = {
  __typename: 'Query';
  shoppingList: {
    __typename: 'ShoppingList';
    id: string;
    itemsConnection: {
      __typename: 'ShoppingListItemConnection';
      totalCount: number | null;
      edges: Array<{
        __typename: 'ShoppingListItemEdge';
        cursor: string;
        node: {
          __typename: 'ShoppingListItem';
        } & ShoppingListItemDisplayFragment;
      }>;
      pageInfo: {
        __typename: 'PageInfo';
        hasNextPage: boolean;
        endCursor: string | null;
      };
    };
  } | null;
};

export type GetShoppingListItemQueryVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
}>;

export type GetShoppingListItemQuery = {
  __typename: 'Query';
  shoppingListItem:
    | ({ __typename: 'ShoppingListItem' } & ShoppingListItemFragment)
    | null;
};

export type GetShoppingListSuggestionsQueryVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
  limit?: Types.InputMaybe<Types.Scalars['Int']['input']>;
}>;

export type GetShoppingListSuggestionsQuery = {
  __typename: 'Query';
  shoppingList: {
    __typename: 'ShoppingList';
    id: string;
    suggestions: Array<{
      __typename: 'ShoppingListSuggestion';
      id: string;
      itemId: string;
      name: string;
      source: Types.SuggestionSource;
      imageUrl: string | null;
      category: string | null;
      defaultUnitId: string | null;
      lastQuantity: number | null;
      lastUnitId: string | null;
      frequencyCount: number | null;
      popularityRank: number | null;
      shoppingListItemId: string | null;
      defaultUnit: {
        __typename: 'SuggestionUnit';
        id: string;
        name: string;
        symbol: string;
      } | null;
      item: {
        __typename: 'SuggestionItem';
        id: string;
        name: string;
        imageUrl: string | null;
      };
    }>;
  } | null;
};

export type CreateShoppingListMutationVariables = Types.Exact<{
  input: Types.CreateShoppingListInput;
}>;

export type CreateShoppingListMutation = {
  __typename: 'Mutation';
  createShoppingList: {
    __typename: 'ShoppingListPayload';
    success: boolean;
    message: string;
    code: string;
    shoppingList: {
      __typename: 'ShoppingList';
      id: string;
      name: string;
      isDefault: boolean;
      totalItems: number;
      completedItems: number;
      createdAt: string;
      updatedAt: string;
      homeId: string | null;
      home: { __typename: 'Home'; id: string; name: string } | null;
      ownerships: Array<
        { __typename: 'ShoppingListOwnership' } & ShoppingListOwnershipFragment
      >;
    } | null;
  };
};

export type UpdateShoppingListMutationVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
  input: Types.UpdateShoppingListInput;
}>;

export type UpdateShoppingListMutation = {
  __typename: 'Mutation';
  updateShoppingList: {
    __typename: 'ShoppingListPayload';
    success: boolean;
    message: string;
    code: string;
    shoppingList: {
      __typename: 'ShoppingList';
      id: string;
      name: string;
      isDefault: boolean;
      totalItems: number;
      completedItems: number;
      createdAt: string;
      updatedAt: string;
      ownerships: Array<
        { __typename: 'ShoppingListOwnership' } & ShoppingListOwnershipFragment
      >;
    } | null;
  };
};

export type DeleteShoppingListMutationVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
}>;

export type DeleteShoppingListMutation = {
  __typename: 'Mutation';
  deleteShoppingList: {
    __typename: 'ShoppingListPayload';
    success: boolean;
    message: string;
    code: string;
    shoppingList: {
      __typename: 'ShoppingList';
      id: string;
      name: string;
    } | null;
  };
};

export type AddCollaboratorMutationVariables = Types.Exact<{
  input: Types.InviteToShoppingListInput;
}>;

export type AddCollaboratorMutation = {
  __typename: 'Mutation';
  inviteToShoppingList: {
    __typename: 'ShoppingListCollaboratorPayload';
    success: boolean;
    message: string;
    code: string;
    collaborator:
      | ({
          __typename: 'ShoppingListCollaborator';
          canEdit: boolean;
          invitedAt: string;
          lastViewedAt: string | null;
        } & ShoppingListCollaboratorFragment)
      | null;
  };
};

export type RemoveCollaboratorMutationVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
}>;

export type RemoveCollaboratorMutation = {
  __typename: 'Mutation';
  removeShoppingListCollaborator: {
    __typename: 'ShoppingListCollaboratorPayload';
    success: boolean;
    message: string;
    code: string;
  };
};

export type AddItemToShoppingListMutationVariables = Types.Exact<{
  input: Types.CreateShoppingListItemInput;
}>;

export type AddItemToShoppingListMutation = {
  __typename: 'Mutation';
  addItemToShoppingList: {
    __typename: 'ShoppingListItemPayload';
    success: boolean;
    message: string;
    code: string;
    shoppingListItem:
      | ({ __typename: 'ShoppingListItem' } & ShoppingListItemDisplayFragment)
      | null;
  };
};

export type UpdateShoppingListItemMutationVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
  input: Types.UpdateShoppingListItemInput;
}>;

export type UpdateShoppingListItemMutation = {
  __typename: 'Mutation';
  updateShoppingListItem: {
    __typename: 'ShoppingListItemPayload';
    success: boolean;
    message: string;
    code: string;
    shoppingListItem:
      | ({ __typename: 'ShoppingListItem' } & ShoppingListItemDisplayFragment)
      | null;
  };
};

export type RemoveItemFromShoppingListMutationVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
}>;

export type RemoveItemFromShoppingListMutation = {
  __typename: 'Mutation';
  removeItemFromShoppingList: {
    __typename: 'ShoppingListItemPayload';
    success: boolean;
    message: string;
    code: string;
    shoppingListItem: { __typename: 'ShoppingListItem'; id: string } | null;
  };
};

export type MoveShoppingListItemMutationVariables = Types.Exact<{
  input: Types.MoveShoppingListItemInput;
}>;

export type MoveShoppingListItemMutation = {
  __typename: 'Mutation';
  moveShoppingListItem: {
    __typename: 'ShoppingListItemPayload';
    success: boolean;
    message: string;
    code: string;
    shoppingListItem:
      | ({ __typename: 'ShoppingListItem' } & ShoppingListItemDisplayFragment)
      | null;
  };
};

export type ToggleShoppingListItemPurchasedMutationVariables = Types.Exact<{
  input: Types.ToggleShoppingListItemPurchasedInput;
}>;

export type ToggleShoppingListItemPurchasedMutation = {
  __typename: 'Mutation';
  toggleShoppingListItemPurchased: {
    __typename: 'ShoppingListItemPayload';
    success: boolean;
    message: string;
    code: string;
    shoppingListItem:
      | ({ __typename: 'ShoppingListItem' } & ShoppingListItemDisplayFragment)
      | null;
  };
};

export type UpdateShoppingListItemQuantityMutationVariables = Types.Exact<{
  itemId: Types.Scalars['ID']['input'];
  quantity: Types.Scalars['String']['input'];
  unitId?: Types.InputMaybe<Types.Scalars['ID']['input']>;
  version?: Types.InputMaybe<Types.Scalars['Int']['input']>;
}>;

export type UpdateShoppingListItemQuantityMutation = {
  __typename: 'Mutation';
  updateShoppingListItemQuantity: {
    __typename: 'ShoppingListItemPayload';
    success: boolean;
    message: string;
    code: string;
    shoppingListItem:
      | ({ __typename: 'ShoppingListItem' } & ShoppingListItemDisplayFragment)
      | null;
  };
};

export type UpdateCollaboratorRoleMutationVariables = Types.Exact<{
  input: Types.UpdateCollaboratorRoleInput;
}>;

export type UpdateCollaboratorRoleMutation = {
  __typename: 'Mutation';
  updateCollaboratorRole: {
    __typename: 'ShoppingListCollaboratorPayload';
    success: boolean;
    message: string;
    code: string;
  };
};

export type MoveShoppingItemToPantryMutationVariables = Types.Exact<{
  input: Types.MoveShoppingItemToPantryInput;
}>;

export type MoveShoppingItemToPantryMutation = {
  __typename: 'Mutation';
  moveShoppingItemToPantry: {
    __typename: 'PantryItemPayload';
    success: boolean;
    message: string;
    code: string;
    pantryItem:
      | ({ __typename: 'PantryItem' } & PantryItemDisplayFragment)
      | null;
  };
};

export type ClearShoppingListItemsMutationVariables = Types.Exact<{
  shoppingListId: Types.Scalars['ID']['input'];
  purchased: Types.Scalars['Boolean']['input'];
}>;

export type ClearShoppingListItemsMutation = {
  __typename: 'Mutation';
  clearShoppingListItems: {
    __typename: 'ClearItemsResponse';
    clearedItemIds: Array<string>;
    summary: {
      __typename: 'BulkOperationSummary';
      total: number;
      successful: number;
      failed: number;
      skipped: number;
      executionTime: number;
    };
  };
};

export type AddItemsToShoppingListMutationVariables = Types.Exact<{
  shoppingListId: Types.Scalars['ID']['input'];
  items:
    | Array<Types.BatchAddShoppingListItemInput>
    | Types.BatchAddShoppingListItemInput;
}>;

export type AddItemsToShoppingListMutation = {
  __typename: 'Mutation';
  addItemsToShoppingList: {
    __typename: 'BatchAddShoppingListItemsResponse';
    successCount: number;
    failedCount: number;
    incrementedCount: number;
    results: Array<{
      __typename: 'BatchAddShoppingListItemResult';
      index: number;
      clientId: string | null;
      success: boolean;
      quantityIncremented: boolean | null;
      error: string | null;
      item:
        | ({ __typename: 'ShoppingListItem' } & ShoppingListItemDisplayFragment)
        | null;
    }>;
  };
};

export type ShareShoppingListMutationVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
  input: Types.ShareShoppingListInput;
}>;

export type ShareShoppingListMutation = {
  __typename: 'Mutation';
  shareShoppingList: {
    __typename: 'ShoppingListPayload';
    success: boolean;
    message: string;
    code: string;
    shoppingList: {
      __typename: 'ShoppingList';
      id: string;
      shareCode: string | null;
      isPublic: boolean;
    } | null;
  };
};

export type JoinShoppingListByShareCodeMutationVariables = Types.Exact<{
  shareCode: Types.Scalars['String']['input'];
}>;

export type JoinShoppingListByShareCodeMutation = {
  __typename: 'Mutation';
  joinShoppingListByShareCode: {
    __typename: 'ShoppingListPayload';
    success: boolean;
    message: string;
    code: string;
    shoppingList: {
      __typename: 'ShoppingList';
      id: string;
      name: string;
    } | null;
  };
};

export type SyncShoppingListItemMutationVariables = Types.Exact<{
  clientId: Types.Scalars['ID']['input'];
  input: Types.SyncShoppingListItemInput;
}>;

export type SyncShoppingListItemMutation = {
  __typename: 'Mutation';
  syncShoppingListItem: {
    __typename: 'SyncShoppingListItemResult';
    clientId: string;
    serverId: string | null;
    operation: Types.SyncOperation;
    wasCreated: boolean;
    item:
      | ({ __typename: 'ShoppingListItem' } & ShoppingListItemDisplayFragment)
      | null;
    conflict: {
      __typename: 'SyncConflictInfo';
      clientVersion: number;
      serverVersion: number;
      message: string;
      serverItem: {
        __typename: 'ShoppingListItem';
        id: string;
        version: number;
        sortOrder: string;
      };
    } | null;
  };
};

export type SyncDeleteShoppingListItemMutationVariables = Types.Exact<{
  clientId: Types.Scalars['ID']['input'];
  version?: Types.InputMaybe<Types.Scalars['Int']['input']>;
}>;

export type SyncDeleteShoppingListItemMutation = {
  __typename: 'Mutation';
  syncDeleteShoppingListItem: {
    __typename: 'SyncShoppingListItemResult';
    clientId: string;
    serverId: string | null;
    operation: Types.SyncOperation;
    wasCreated: boolean;
    item: {
      __typename: 'ShoppingListItem';
      id: string;
      itemName: string | null;
    } | null;
    conflict: {
      __typename: 'SyncConflictInfo';
      clientVersion: number;
      serverVersion: number;
      message: string;
    } | null;
  };
};

export type SyncMoveShoppingListItemMutationVariables = Types.Exact<{
  clientId: Types.Scalars['ID']['input'];
  afterId?: Types.InputMaybe<Types.Scalars['ID']['input']>;
  beforeId?: Types.InputMaybe<Types.Scalars['ID']['input']>;
  version?: Types.InputMaybe<Types.Scalars['Int']['input']>;
}>;

export type SyncMoveShoppingListItemMutation = {
  __typename: 'Mutation';
  syncMoveShoppingListItem: {
    __typename: 'SyncShoppingListItemResult';
    clientId: string;
    serverId: string | null;
    operation: Types.SyncOperation;
    wasCreated: boolean;
    item:
      | ({ __typename: 'ShoppingListItem' } & ShoppingListItemDisplayFragment)
      | null;
    conflict: {
      __typename: 'SyncConflictInfo';
      clientVersion: number;
      serverVersion: number;
      message: string;
      serverItem: {
        __typename: 'ShoppingListItem';
        id: string;
        version: number;
        sortOrder: string;
      };
    } | null;
  };
};

export type ShoppingListChangesSubscriptionVariables = Types.Exact<{
  listId: Types.Scalars['ID']['input'];
}>;

export type ShoppingListChangesSubscription = {
  __typename: 'Subscription';
  shoppingListChanged: {
    __typename: 'ShoppingListChangeEvent';
    changeType: Types.ShoppingListChangeType;
    clearedItemIds: Array<string> | null;
    clearedCount: number | null;
    mutation: Types.MutationType | null;
    updatedFields: Array<string> | null;
    listId: string;
    timestamp: string;
    userId: string;
    item:
      | ({ __typename: 'ShoppingListItem' } & ShoppingListItemDisplayFragment)
      | null;
    shoppingList: {
      __typename: 'ShoppingList';
      id: string;
      name: string;
      totalItems: number;
      completedItems: number;
    } | null;
  };
};

export type MyShoppingListsChangesSubscriptionVariables = Types.Exact<{
  [key: string]: never;
}>;

export type MyShoppingListsChangesSubscription = {
  __typename: 'Subscription';
  myShoppingListsChanged: {
    __typename: 'ShoppingListChangeEvent';
    changeType: Types.ShoppingListChangeType;
    mutation: Types.MutationType | null;
    updatedFields: Array<string> | null;
    listId: string;
    timestamp: string;
    userId: string;
    shoppingList: {
      __typename: 'ShoppingList';
      id: string;
      name: string;
      totalItems: number;
      completedItems: number;
    } | null;
  };
};

export const GetShoppingListDetailsDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'GetShoppingListDetails' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'shoppingList' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'id' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'id' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'isDefault' } },
                { kind: 'Field', name: { kind: 'Name', value: 'totalItems' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'completedItems' },
                },
                { kind: 'Field', name: { kind: 'Name', value: 'homeId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'shareCode' } },
                { kind: 'Field', name: { kind: 'Name', value: 'isPublic' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'home' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'myMembership' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'id' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'role' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'canAddItems' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'canRemoveItems' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'canEditPantry' },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'ownerships' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: {
                          kind: 'Name',
                          value: 'ShoppingListOwnershipFragment',
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'collaboratorsConnection' },
                  arguments: [
                    {
                      kind: 'Argument',
                      name: { kind: 'Name', value: 'first' },
                      value: { kind: 'IntValue', value: '20' },
                    },
                  ],
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'edges' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'cursor' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'node' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  {
                                    kind: 'FragmentSpread',
                                    name: {
                                      kind: 'Name',
                                      value: 'ShoppingListCollaboratorFragment',
                                    },
                                  },
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'invitedAt' },
                                  },
                                ],
                              },
                            },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'pageInfo' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'hasNextPage' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'endCursor' },
                            },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'totalCount' },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'ShoppingListOwnershipFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'ShoppingListOwnership' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'userId' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'user' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'email' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'profile' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'displayName' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'avatar' },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'ShoppingListCollaboratorFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'ShoppingListCollaborator' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'email' } },
          { kind: 'Field', name: { kind: 'Name', value: 'role' } },
          { kind: 'Field', name: { kind: 'Name', value: 'status' } },
          { kind: 'Field', name: { kind: 'Name', value: 'collaboratorId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'canAddItems' } },
          { kind: 'Field', name: { kind: 'Name', value: 'canRemoveItems' } },
          { kind: 'Field', name: { kind: 'Name', value: 'canEditItems' } },
          { kind: 'Field', name: { kind: 'Name', value: 'canMarkPurchased' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'collaborator' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'email' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'profile' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'displayName' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'avatar' },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useGetShoppingListDetailsQuery__
 *
 * To run a query within a React component, call `useGetShoppingListDetailsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetShoppingListDetailsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetShoppingListDetailsQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useGetShoppingListDetailsQuery(
  baseOptions: ApolloReactHooks.QueryHookOptions<
    GetShoppingListDetailsQuery,
    GetShoppingListDetailsQueryVariables
  > &
    (
      | { variables: GetShoppingListDetailsQueryVariables; skip?: boolean }
      | { skip: boolean }
    ),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useQuery<
    GetShoppingListDetailsQuery,
    GetShoppingListDetailsQueryVariables
  >(GetShoppingListDetailsDocument, options);
}
export function useGetShoppingListDetailsLazyQuery(
  baseOptions?: ApolloReactHooks.LazyQueryHookOptions<
    GetShoppingListDetailsQuery,
    GetShoppingListDetailsQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useLazyQuery<
    GetShoppingListDetailsQuery,
    GetShoppingListDetailsQueryVariables
  >(GetShoppingListDetailsDocument, options);
}
// @ts-ignore
export function useGetShoppingListDetailsSuspenseQuery(
  baseOptions?: ApolloReactHooks.SuspenseQueryHookOptions<
    GetShoppingListDetailsQuery,
    GetShoppingListDetailsQueryVariables
  >,
): ApolloReactHooks.UseSuspenseQueryResult<
  GetShoppingListDetailsQuery,
  GetShoppingListDetailsQueryVariables
>;
export function useGetShoppingListDetailsSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<
        GetShoppingListDetailsQuery,
        GetShoppingListDetailsQueryVariables
      >,
): ApolloReactHooks.UseSuspenseQueryResult<
  GetShoppingListDetailsQuery | undefined,
  GetShoppingListDetailsQueryVariables
>;
export function useGetShoppingListDetailsSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<
        GetShoppingListDetailsQuery,
        GetShoppingListDetailsQueryVariables
      >,
) {
  const options =
    baseOptions === ApolloReactHooks.skipToken
      ? baseOptions
      : { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useSuspenseQuery<
    GetShoppingListDetailsQuery,
    GetShoppingListDetailsQueryVariables
  >(GetShoppingListDetailsDocument, options);
}
export type GetShoppingListDetailsQueryHookResult = ReturnType<
  typeof useGetShoppingListDetailsQuery
>;
export type GetShoppingListDetailsLazyQueryHookResult = ReturnType<
  typeof useGetShoppingListDetailsLazyQuery
>;
export type GetShoppingListDetailsSuspenseQueryHookResult = ReturnType<
  typeof useGetShoppingListDetailsSuspenseQuery
>;
export type GetShoppingListDetailsQueryResult = ApolloReactCommon.QueryResult<
  GetShoppingListDetailsQuery,
  GetShoppingListDetailsQueryVariables
>;
export const GetShoppingListsLiteDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'GetShoppingListsLite' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'homeId' },
          },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
        },
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'first' },
          },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'Int' } },
        },
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'after' },
          },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'shoppingLists' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'filters' },
                value: {
                  kind: 'ObjectValue',
                  fields: [
                    {
                      kind: 'ObjectField',
                      name: { kind: 'Name', value: 'homeId' },
                      value: {
                        kind: 'Variable',
                        name: { kind: 'Name', value: 'homeId' },
                      },
                    },
                  ],
                },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'first' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'first' },
                },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'after' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'after' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'edges' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'cursor' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'node' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'id' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'name' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'isDefault' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'totalItems' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'completedItems' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'homeId' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'home' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'id' },
                                  },
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'name' },
                                  },
                                ],
                              },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'ownerships' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'id' },
                                  },
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'userId' },
                                  },
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'user' },
                                    selectionSet: {
                                      kind: 'SelectionSet',
                                      selections: [
                                        {
                                          kind: 'Field',
                                          name: { kind: 'Name', value: 'id' },
                                        },
                                        {
                                          kind: 'Field',
                                          name: {
                                            kind: 'Name',
                                            value: 'email',
                                          },
                                        },
                                        {
                                          kind: 'Field',
                                          name: {
                                            kind: 'Name',
                                            value: 'profile',
                                          },
                                          selectionSet: {
                                            kind: 'SelectionSet',
                                            selections: [
                                              {
                                                kind: 'Field',
                                                name: {
                                                  kind: 'Name',
                                                  value: 'id',
                                                },
                                              },
                                              {
                                                kind: 'Field',
                                                name: {
                                                  kind: 'Name',
                                                  value: 'displayName',
                                                },
                                              },
                                              {
                                                kind: 'Field',
                                                name: {
                                                  kind: 'Name',
                                                  value: 'avatar',
                                                },
                                              },
                                            ],
                                          },
                                        },
                                      ],
                                    },
                                  },
                                ],
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'pageInfo' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'hasNextPage' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'endCursor' },
                      },
                    ],
                  },
                },
                { kind: 'Field', name: { kind: 'Name', value: 'totalCount' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useGetShoppingListsLiteQuery__
 *
 * To run a query within a React component, call `useGetShoppingListsLiteQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetShoppingListsLiteQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetShoppingListsLiteQuery({
 *   variables: {
 *      homeId: // value for 'homeId'
 *      first: // value for 'first'
 *      after: // value for 'after'
 *   },
 * });
 */
export function useGetShoppingListsLiteQuery(
  baseOptions?: ApolloReactHooks.QueryHookOptions<
    GetShoppingListsLiteQuery,
    GetShoppingListsLiteQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useQuery<
    GetShoppingListsLiteQuery,
    GetShoppingListsLiteQueryVariables
  >(GetShoppingListsLiteDocument, options);
}
export function useGetShoppingListsLiteLazyQuery(
  baseOptions?: ApolloReactHooks.LazyQueryHookOptions<
    GetShoppingListsLiteQuery,
    GetShoppingListsLiteQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useLazyQuery<
    GetShoppingListsLiteQuery,
    GetShoppingListsLiteQueryVariables
  >(GetShoppingListsLiteDocument, options);
}
// @ts-ignore
export function useGetShoppingListsLiteSuspenseQuery(
  baseOptions?: ApolloReactHooks.SuspenseQueryHookOptions<
    GetShoppingListsLiteQuery,
    GetShoppingListsLiteQueryVariables
  >,
): ApolloReactHooks.UseSuspenseQueryResult<
  GetShoppingListsLiteQuery,
  GetShoppingListsLiteQueryVariables
>;
export function useGetShoppingListsLiteSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<
        GetShoppingListsLiteQuery,
        GetShoppingListsLiteQueryVariables
      >,
): ApolloReactHooks.UseSuspenseQueryResult<
  GetShoppingListsLiteQuery | undefined,
  GetShoppingListsLiteQueryVariables
>;
export function useGetShoppingListsLiteSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<
        GetShoppingListsLiteQuery,
        GetShoppingListsLiteQueryVariables
      >,
) {
  const options =
    baseOptions === ApolloReactHooks.skipToken
      ? baseOptions
      : { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useSuspenseQuery<
    GetShoppingListsLiteQuery,
    GetShoppingListsLiteQueryVariables
  >(GetShoppingListsLiteDocument, options);
}
export type GetShoppingListsLiteQueryHookResult = ReturnType<
  typeof useGetShoppingListsLiteQuery
>;
export type GetShoppingListsLiteLazyQueryHookResult = ReturnType<
  typeof useGetShoppingListsLiteLazyQuery
>;
export type GetShoppingListsLiteSuspenseQueryHookResult = ReturnType<
  typeof useGetShoppingListsLiteSuspenseQuery
>;
export type GetShoppingListsLiteQueryResult = ApolloReactCommon.QueryResult<
  GetShoppingListsLiteQuery,
  GetShoppingListsLiteQueryVariables
>;
export const GetShoppingListItemsFilteredDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'GetShoppingListItemsFiltered' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'first' },
          },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'Int' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'after' },
          },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
        },
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'isPurchased' },
          },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'NamedType',
              name: { kind: 'Name', value: 'Boolean' },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'shoppingList' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'id' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'id' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'itemsConnection' },
                  arguments: [
                    {
                      kind: 'Argument',
                      name: { kind: 'Name', value: 'first' },
                      value: {
                        kind: 'Variable',
                        name: { kind: 'Name', value: 'first' },
                      },
                    },
                    {
                      kind: 'Argument',
                      name: { kind: 'Name', value: 'after' },
                      value: {
                        kind: 'Variable',
                        name: { kind: 'Name', value: 'after' },
                      },
                    },
                    {
                      kind: 'Argument',
                      name: { kind: 'Name', value: 'filters' },
                      value: {
                        kind: 'ObjectValue',
                        fields: [
                          {
                            kind: 'ObjectField',
                            name: { kind: 'Name', value: 'isPurchased' },
                            value: {
                              kind: 'Variable',
                              name: { kind: 'Name', value: 'isPurchased' },
                            },
                          },
                        ],
                      },
                    },
                    {
                      kind: 'Argument',
                      name: { kind: 'Name', value: 'orderBy' },
                      value: {
                        kind: 'ObjectValue',
                        fields: [
                          {
                            kind: 'ObjectField',
                            name: { kind: 'Name', value: 'sortOrder' },
                            value: { kind: 'EnumValue', value: 'ASC' },
                          },
                        ],
                      },
                    },
                  ],
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'totalCount' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'edges' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'cursor' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'node' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  {
                                    kind: 'FragmentSpread',
                                    name: {
                                      kind: 'Name',
                                      value: 'ShoppingListItemDisplayFragment',
                                    },
                                  },
                                ],
                              },
                            },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'pageInfo' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'hasNextPage' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'endCursor' },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'ShoppingListItemDisplayFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'ShoppingListItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'FragmentSpread',
            name: { kind: 'Name', value: 'ShoppingListItemCore' },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'sortOrder' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'item' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'imageUrl' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'images' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'url' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'kind' } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'ShoppingListItemCore' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'ShoppingListItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'itemName' } },
          { kind: 'Field', name: { kind: 'Name', value: 'quantity' } },
          { kind: 'Field', name: { kind: 'Name', value: 'quantityInput' } },
          { kind: 'Field', name: { kind: 'Name', value: 'displayFormat' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'purchaseInfo' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'isPurchased' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'version' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'category' } },
          { kind: 'Field', name: { kind: 'Name', value: 'notes' } },
          { kind: 'Field', name: { kind: 'Name', value: 'unitName' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'unit' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'symbol' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useGetShoppingListItemsFilteredQuery__
 *
 * To run a query within a React component, call `useGetShoppingListItemsFilteredQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetShoppingListItemsFilteredQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetShoppingListItemsFilteredQuery({
 *   variables: {
 *      id: // value for 'id'
 *      first: // value for 'first'
 *      after: // value for 'after'
 *      isPurchased: // value for 'isPurchased'
 *   },
 * });
 */
export function useGetShoppingListItemsFilteredQuery(
  baseOptions: ApolloReactHooks.QueryHookOptions<
    GetShoppingListItemsFilteredQuery,
    GetShoppingListItemsFilteredQueryVariables
  > &
    (
      | {
          variables: GetShoppingListItemsFilteredQueryVariables;
          skip?: boolean;
        }
      | { skip: boolean }
    ),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useQuery<
    GetShoppingListItemsFilteredQuery,
    GetShoppingListItemsFilteredQueryVariables
  >(GetShoppingListItemsFilteredDocument, options);
}
export function useGetShoppingListItemsFilteredLazyQuery(
  baseOptions?: ApolloReactHooks.LazyQueryHookOptions<
    GetShoppingListItemsFilteredQuery,
    GetShoppingListItemsFilteredQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useLazyQuery<
    GetShoppingListItemsFilteredQuery,
    GetShoppingListItemsFilteredQueryVariables
  >(GetShoppingListItemsFilteredDocument, options);
}
// @ts-ignore
export function useGetShoppingListItemsFilteredSuspenseQuery(
  baseOptions?: ApolloReactHooks.SuspenseQueryHookOptions<
    GetShoppingListItemsFilteredQuery,
    GetShoppingListItemsFilteredQueryVariables
  >,
): ApolloReactHooks.UseSuspenseQueryResult<
  GetShoppingListItemsFilteredQuery,
  GetShoppingListItemsFilteredQueryVariables
>;
export function useGetShoppingListItemsFilteredSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<
        GetShoppingListItemsFilteredQuery,
        GetShoppingListItemsFilteredQueryVariables
      >,
): ApolloReactHooks.UseSuspenseQueryResult<
  GetShoppingListItemsFilteredQuery | undefined,
  GetShoppingListItemsFilteredQueryVariables
>;
export function useGetShoppingListItemsFilteredSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<
        GetShoppingListItemsFilteredQuery,
        GetShoppingListItemsFilteredQueryVariables
      >,
) {
  const options =
    baseOptions === ApolloReactHooks.skipToken
      ? baseOptions
      : { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useSuspenseQuery<
    GetShoppingListItemsFilteredQuery,
    GetShoppingListItemsFilteredQueryVariables
  >(GetShoppingListItemsFilteredDocument, options);
}
export type GetShoppingListItemsFilteredQueryHookResult = ReturnType<
  typeof useGetShoppingListItemsFilteredQuery
>;
export type GetShoppingListItemsFilteredLazyQueryHookResult = ReturnType<
  typeof useGetShoppingListItemsFilteredLazyQuery
>;
export type GetShoppingListItemsFilteredSuspenseQueryHookResult = ReturnType<
  typeof useGetShoppingListItemsFilteredSuspenseQuery
>;
export type GetShoppingListItemsFilteredQueryResult =
  ApolloReactCommon.QueryResult<
    GetShoppingListItemsFilteredQuery,
    GetShoppingListItemsFilteredQueryVariables
  >;
export const GetShoppingListItemDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'GetShoppingListItem' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'shoppingListItem' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'id' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'id' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'ShoppingListItemFragment' },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'ShoppingListItemDisplayFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'ShoppingListItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'FragmentSpread',
            name: { kind: 'Name', value: 'ShoppingListItemCore' },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'sortOrder' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'item' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'imageUrl' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'images' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'url' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'kind' } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'ShoppingListItemCore' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'ShoppingListItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'itemName' } },
          { kind: 'Field', name: { kind: 'Name', value: 'quantity' } },
          { kind: 'Field', name: { kind: 'Name', value: 'quantityInput' } },
          { kind: 'Field', name: { kind: 'Name', value: 'displayFormat' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'purchaseInfo' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'isPurchased' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'version' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'category' } },
          { kind: 'Field', name: { kind: 'Name', value: 'notes' } },
          { kind: 'Field', name: { kind: 'Name', value: 'unitName' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'unit' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'symbol' } },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'ShoppingListItemFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'ShoppingListItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'FragmentSpread',
            name: { kind: 'Name', value: 'ShoppingListItemDisplayFragment' },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'item' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'description' } },
                { kind: 'Field', name: { kind: 'Name', value: 'imageUrl' } },
                { kind: 'Field', name: { kind: 'Name', value: 'netWeight' } },
                { kind: 'Field', name: { kind: 'Name', value: 'nutritions' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'displayUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'categories' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'isPrimary' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'confidence' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'source' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'assignedAt' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'category' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'id' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'name' },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'priceEstimate' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'estimated' } },
                { kind: 'Field', name: { kind: 'Name', value: 'lastKnown' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'source' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'isAutoAdded' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'autoAddReason' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'isFromMealPlan' },
                },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'priority' } },
          { kind: 'Field', name: { kind: 'Name', value: 'sortOrder' } },
          { kind: 'Field', name: { kind: 'Name', value: 'createdAt' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'addedBy' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'UserSummary' },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'purchasesConnection' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'first' },
                value: { kind: 'IntValue', value: '10' },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'edges' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'node' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'FragmentSpread',
                              name: { kind: 'Name', value: 'PurchaseFragment' },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
                { kind: 'Field', name: { kind: 'Name', value: 'totalCount' } },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'UserSummary' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'User' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'email' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'profile' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'displayName' } },
                { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PurchaseFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'Purchase' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'purchaseDate' } },
          { kind: 'Field', name: { kind: 'Name', value: 'quantity' } },
          { kind: 'Field', name: { kind: 'Name', value: 'unitPrice' } },
          { kind: 'Field', name: { kind: 'Name', value: 'unitSymbol' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useGetShoppingListItemQuery__
 *
 * To run a query within a React component, call `useGetShoppingListItemQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetShoppingListItemQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetShoppingListItemQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useGetShoppingListItemQuery(
  baseOptions: ApolloReactHooks.QueryHookOptions<
    GetShoppingListItemQuery,
    GetShoppingListItemQueryVariables
  > &
    (
      | { variables: GetShoppingListItemQueryVariables; skip?: boolean }
      | { skip: boolean }
    ),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useQuery<
    GetShoppingListItemQuery,
    GetShoppingListItemQueryVariables
  >(GetShoppingListItemDocument, options);
}
export function useGetShoppingListItemLazyQuery(
  baseOptions?: ApolloReactHooks.LazyQueryHookOptions<
    GetShoppingListItemQuery,
    GetShoppingListItemQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useLazyQuery<
    GetShoppingListItemQuery,
    GetShoppingListItemQueryVariables
  >(GetShoppingListItemDocument, options);
}
// @ts-ignore
export function useGetShoppingListItemSuspenseQuery(
  baseOptions?: ApolloReactHooks.SuspenseQueryHookOptions<
    GetShoppingListItemQuery,
    GetShoppingListItemQueryVariables
  >,
): ApolloReactHooks.UseSuspenseQueryResult<
  GetShoppingListItemQuery,
  GetShoppingListItemQueryVariables
>;
export function useGetShoppingListItemSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<
        GetShoppingListItemQuery,
        GetShoppingListItemQueryVariables
      >,
): ApolloReactHooks.UseSuspenseQueryResult<
  GetShoppingListItemQuery | undefined,
  GetShoppingListItemQueryVariables
>;
export function useGetShoppingListItemSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<
        GetShoppingListItemQuery,
        GetShoppingListItemQueryVariables
      >,
) {
  const options =
    baseOptions === ApolloReactHooks.skipToken
      ? baseOptions
      : { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useSuspenseQuery<
    GetShoppingListItemQuery,
    GetShoppingListItemQueryVariables
  >(GetShoppingListItemDocument, options);
}
export type GetShoppingListItemQueryHookResult = ReturnType<
  typeof useGetShoppingListItemQuery
>;
export type GetShoppingListItemLazyQueryHookResult = ReturnType<
  typeof useGetShoppingListItemLazyQuery
>;
export type GetShoppingListItemSuspenseQueryHookResult = ReturnType<
  typeof useGetShoppingListItemSuspenseQuery
>;
export type GetShoppingListItemQueryResult = ApolloReactCommon.QueryResult<
  GetShoppingListItemQuery,
  GetShoppingListItemQueryVariables
>;
export const GetShoppingListSuggestionsDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'GetShoppingListSuggestions' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'limit' },
          },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'Int' } },
          defaultValue: { kind: 'IntValue', value: '15' },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'shoppingList' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'id' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'id' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'suggestions' },
                  arguments: [
                    {
                      kind: 'Argument',
                      name: { kind: 'Name', value: 'limit' },
                      value: {
                        kind: 'Variable',
                        name: { kind: 'Name', value: 'limit' },
                      },
                    },
                  ],
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'itemId' },
                      },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'source' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'imageUrl' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'category' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'defaultUnitId' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'defaultUnit' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'id' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'name' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'symbol' },
                            },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'item' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'id' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'name' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'imageUrl' },
                            },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'lastQuantity' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'lastUnitId' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'frequencyCount' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'popularityRank' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'shoppingListItemId' },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useGetShoppingListSuggestionsQuery__
 *
 * To run a query within a React component, call `useGetShoppingListSuggestionsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetShoppingListSuggestionsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetShoppingListSuggestionsQuery({
 *   variables: {
 *      id: // value for 'id'
 *      limit: // value for 'limit'
 *   },
 * });
 */
export function useGetShoppingListSuggestionsQuery(
  baseOptions: ApolloReactHooks.QueryHookOptions<
    GetShoppingListSuggestionsQuery,
    GetShoppingListSuggestionsQueryVariables
  > &
    (
      | { variables: GetShoppingListSuggestionsQueryVariables; skip?: boolean }
      | { skip: boolean }
    ),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useQuery<
    GetShoppingListSuggestionsQuery,
    GetShoppingListSuggestionsQueryVariables
  >(GetShoppingListSuggestionsDocument, options);
}
export function useGetShoppingListSuggestionsLazyQuery(
  baseOptions?: ApolloReactHooks.LazyQueryHookOptions<
    GetShoppingListSuggestionsQuery,
    GetShoppingListSuggestionsQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useLazyQuery<
    GetShoppingListSuggestionsQuery,
    GetShoppingListSuggestionsQueryVariables
  >(GetShoppingListSuggestionsDocument, options);
}
// @ts-ignore
export function useGetShoppingListSuggestionsSuspenseQuery(
  baseOptions?: ApolloReactHooks.SuspenseQueryHookOptions<
    GetShoppingListSuggestionsQuery,
    GetShoppingListSuggestionsQueryVariables
  >,
): ApolloReactHooks.UseSuspenseQueryResult<
  GetShoppingListSuggestionsQuery,
  GetShoppingListSuggestionsQueryVariables
>;
export function useGetShoppingListSuggestionsSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<
        GetShoppingListSuggestionsQuery,
        GetShoppingListSuggestionsQueryVariables
      >,
): ApolloReactHooks.UseSuspenseQueryResult<
  GetShoppingListSuggestionsQuery | undefined,
  GetShoppingListSuggestionsQueryVariables
>;
export function useGetShoppingListSuggestionsSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<
        GetShoppingListSuggestionsQuery,
        GetShoppingListSuggestionsQueryVariables
      >,
) {
  const options =
    baseOptions === ApolloReactHooks.skipToken
      ? baseOptions
      : { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useSuspenseQuery<
    GetShoppingListSuggestionsQuery,
    GetShoppingListSuggestionsQueryVariables
  >(GetShoppingListSuggestionsDocument, options);
}
export type GetShoppingListSuggestionsQueryHookResult = ReturnType<
  typeof useGetShoppingListSuggestionsQuery
>;
export type GetShoppingListSuggestionsLazyQueryHookResult = ReturnType<
  typeof useGetShoppingListSuggestionsLazyQuery
>;
export type GetShoppingListSuggestionsSuspenseQueryHookResult = ReturnType<
  typeof useGetShoppingListSuggestionsSuspenseQuery
>;
export type GetShoppingListSuggestionsQueryResult =
  ApolloReactCommon.QueryResult<
    GetShoppingListSuggestionsQuery,
    GetShoppingListSuggestionsQueryVariables
  >;
export const CreateShoppingListDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'CreateShoppingList' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'input' },
          },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'NamedType',
              name: { kind: 'Name', value: 'CreateShoppingListInput' },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'createShoppingList' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'input' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'input' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'success' } },
                { kind: 'Field', name: { kind: 'Name', value: 'message' } },
                { kind: 'Field', name: { kind: 'Name', value: 'code' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'shoppingList' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'isDefault' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'totalItems' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'completedItems' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'createdAt' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'updatedAt' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'homeId' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'home' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'id' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'name' },
                            },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'ownerships' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'FragmentSpread',
                              name: {
                                kind: 'Name',
                                value: 'ShoppingListOwnershipFragment',
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'ShoppingListOwnershipFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'ShoppingListOwnership' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'userId' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'user' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'email' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'profile' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'displayName' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'avatar' },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useCreateShoppingListMutation__
 *
 * To run a mutation, you first call `useCreateShoppingListMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useCreateShoppingListMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [createShoppingListMutation, { data, loading, error }] = useCreateShoppingListMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useCreateShoppingListMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    CreateShoppingListMutation,
    CreateShoppingListMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<
    CreateShoppingListMutation,
    CreateShoppingListMutationVariables
  >(CreateShoppingListDocument, options);
}
export type CreateShoppingListMutationHookResult = ReturnType<
  typeof useCreateShoppingListMutation
>;
export type CreateShoppingListMutationResult =
  ApolloReactCommon.MutationResult<CreateShoppingListMutation>;
export type CreateShoppingListMutationOptions =
  ApolloReactCommon.BaseMutationOptions<
    CreateShoppingListMutation,
    CreateShoppingListMutationVariables
  >;
export const UpdateShoppingListDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'UpdateShoppingList' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'input' },
          },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'NamedType',
              name: { kind: 'Name', value: 'UpdateShoppingListInput' },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'updateShoppingList' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'id' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'id' },
                },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'input' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'input' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'success' } },
                { kind: 'Field', name: { kind: 'Name', value: 'message' } },
                { kind: 'Field', name: { kind: 'Name', value: 'code' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'shoppingList' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'isDefault' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'totalItems' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'completedItems' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'createdAt' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'updatedAt' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'ownerships' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'FragmentSpread',
                              name: {
                                kind: 'Name',
                                value: 'ShoppingListOwnershipFragment',
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'ShoppingListOwnershipFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'ShoppingListOwnership' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'userId' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'user' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'email' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'profile' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'displayName' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'avatar' },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useUpdateShoppingListMutation__
 *
 * To run a mutation, you first call `useUpdateShoppingListMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdateShoppingListMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updateShoppingListMutation, { data, loading, error }] = useUpdateShoppingListMutation({
 *   variables: {
 *      id: // value for 'id'
 *      input: // value for 'input'
 *   },
 * });
 */
export function useUpdateShoppingListMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    UpdateShoppingListMutation,
    UpdateShoppingListMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<
    UpdateShoppingListMutation,
    UpdateShoppingListMutationVariables
  >(UpdateShoppingListDocument, options);
}
export type UpdateShoppingListMutationHookResult = ReturnType<
  typeof useUpdateShoppingListMutation
>;
export type UpdateShoppingListMutationResult =
  ApolloReactCommon.MutationResult<UpdateShoppingListMutation>;
export type UpdateShoppingListMutationOptions =
  ApolloReactCommon.BaseMutationOptions<
    UpdateShoppingListMutation,
    UpdateShoppingListMutationVariables
  >;
export const DeleteShoppingListDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'DeleteShoppingList' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'deleteShoppingList' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'id' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'id' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'success' } },
                { kind: 'Field', name: { kind: 'Name', value: 'message' } },
                { kind: 'Field', name: { kind: 'Name', value: 'code' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'shoppingList' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useDeleteShoppingListMutation__
 *
 * To run a mutation, you first call `useDeleteShoppingListMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useDeleteShoppingListMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [deleteShoppingListMutation, { data, loading, error }] = useDeleteShoppingListMutation({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useDeleteShoppingListMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    DeleteShoppingListMutation,
    DeleteShoppingListMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<
    DeleteShoppingListMutation,
    DeleteShoppingListMutationVariables
  >(DeleteShoppingListDocument, options);
}
export type DeleteShoppingListMutationHookResult = ReturnType<
  typeof useDeleteShoppingListMutation
>;
export type DeleteShoppingListMutationResult =
  ApolloReactCommon.MutationResult<DeleteShoppingListMutation>;
export type DeleteShoppingListMutationOptions =
  ApolloReactCommon.BaseMutationOptions<
    DeleteShoppingListMutation,
    DeleteShoppingListMutationVariables
  >;
export const AddCollaboratorDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'AddCollaborator' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'input' },
          },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'NamedType',
              name: { kind: 'Name', value: 'InviteToShoppingListInput' },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'inviteToShoppingList' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'input' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'input' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'success' } },
                { kind: 'Field', name: { kind: 'Name', value: 'message' } },
                { kind: 'Field', name: { kind: 'Name', value: 'code' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'collaborator' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: {
                          kind: 'Name',
                          value: 'ShoppingListCollaboratorFragment',
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'canEdit' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'invitedAt' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'lastViewedAt' },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'ShoppingListCollaboratorFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'ShoppingListCollaborator' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'email' } },
          { kind: 'Field', name: { kind: 'Name', value: 'role' } },
          { kind: 'Field', name: { kind: 'Name', value: 'status' } },
          { kind: 'Field', name: { kind: 'Name', value: 'collaboratorId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'canAddItems' } },
          { kind: 'Field', name: { kind: 'Name', value: 'canRemoveItems' } },
          { kind: 'Field', name: { kind: 'Name', value: 'canEditItems' } },
          { kind: 'Field', name: { kind: 'Name', value: 'canMarkPurchased' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'collaborator' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'email' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'profile' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'displayName' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'avatar' },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useAddCollaboratorMutation__
 *
 * To run a mutation, you first call `useAddCollaboratorMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useAddCollaboratorMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [addCollaboratorMutation, { data, loading, error }] = useAddCollaboratorMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useAddCollaboratorMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    AddCollaboratorMutation,
    AddCollaboratorMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<
    AddCollaboratorMutation,
    AddCollaboratorMutationVariables
  >(AddCollaboratorDocument, options);
}
export type AddCollaboratorMutationHookResult = ReturnType<
  typeof useAddCollaboratorMutation
>;
export type AddCollaboratorMutationResult =
  ApolloReactCommon.MutationResult<AddCollaboratorMutation>;
export type AddCollaboratorMutationOptions =
  ApolloReactCommon.BaseMutationOptions<
    AddCollaboratorMutation,
    AddCollaboratorMutationVariables
  >;
export const RemoveCollaboratorDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'RemoveCollaborator' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'removeShoppingListCollaborator' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'id' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'id' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'success' } },
                { kind: 'Field', name: { kind: 'Name', value: 'message' } },
                { kind: 'Field', name: { kind: 'Name', value: 'code' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useRemoveCollaboratorMutation__
 *
 * To run a mutation, you first call `useRemoveCollaboratorMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useRemoveCollaboratorMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [removeCollaboratorMutation, { data, loading, error }] = useRemoveCollaboratorMutation({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useRemoveCollaboratorMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    RemoveCollaboratorMutation,
    RemoveCollaboratorMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<
    RemoveCollaboratorMutation,
    RemoveCollaboratorMutationVariables
  >(RemoveCollaboratorDocument, options);
}
export type RemoveCollaboratorMutationHookResult = ReturnType<
  typeof useRemoveCollaboratorMutation
>;
export type RemoveCollaboratorMutationResult =
  ApolloReactCommon.MutationResult<RemoveCollaboratorMutation>;
export type RemoveCollaboratorMutationOptions =
  ApolloReactCommon.BaseMutationOptions<
    RemoveCollaboratorMutation,
    RemoveCollaboratorMutationVariables
  >;
export const AddItemToShoppingListDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'AddItemToShoppingList' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'input' },
          },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'NamedType',
              name: { kind: 'Name', value: 'CreateShoppingListItemInput' },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'addItemToShoppingList' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'input' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'input' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'success' } },
                { kind: 'Field', name: { kind: 'Name', value: 'message' } },
                { kind: 'Field', name: { kind: 'Name', value: 'code' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'shoppingListItem' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: {
                          kind: 'Name',
                          value: 'ShoppingListItemDisplayFragment',
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'ShoppingListItemDisplayFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'ShoppingListItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'FragmentSpread',
            name: { kind: 'Name', value: 'ShoppingListItemCore' },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'sortOrder' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'item' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'imageUrl' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'images' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'url' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'kind' } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'ShoppingListItemCore' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'ShoppingListItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'itemName' } },
          { kind: 'Field', name: { kind: 'Name', value: 'quantity' } },
          { kind: 'Field', name: { kind: 'Name', value: 'quantityInput' } },
          { kind: 'Field', name: { kind: 'Name', value: 'displayFormat' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'purchaseInfo' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'isPurchased' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'version' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'category' } },
          { kind: 'Field', name: { kind: 'Name', value: 'notes' } },
          { kind: 'Field', name: { kind: 'Name', value: 'unitName' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'unit' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'symbol' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useAddItemToShoppingListMutation__
 *
 * To run a mutation, you first call `useAddItemToShoppingListMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useAddItemToShoppingListMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [addItemToShoppingListMutation, { data, loading, error }] = useAddItemToShoppingListMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useAddItemToShoppingListMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    AddItemToShoppingListMutation,
    AddItemToShoppingListMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<
    AddItemToShoppingListMutation,
    AddItemToShoppingListMutationVariables
  >(AddItemToShoppingListDocument, options);
}
export type AddItemToShoppingListMutationHookResult = ReturnType<
  typeof useAddItemToShoppingListMutation
>;
export type AddItemToShoppingListMutationResult =
  ApolloReactCommon.MutationResult<AddItemToShoppingListMutation>;
export type AddItemToShoppingListMutationOptions =
  ApolloReactCommon.BaseMutationOptions<
    AddItemToShoppingListMutation,
    AddItemToShoppingListMutationVariables
  >;
export const UpdateShoppingListItemDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'UpdateShoppingListItem' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'input' },
          },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'NamedType',
              name: { kind: 'Name', value: 'UpdateShoppingListItemInput' },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'updateShoppingListItem' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'id' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'id' },
                },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'input' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'input' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'success' } },
                { kind: 'Field', name: { kind: 'Name', value: 'message' } },
                { kind: 'Field', name: { kind: 'Name', value: 'code' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'shoppingListItem' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: {
                          kind: 'Name',
                          value: 'ShoppingListItemDisplayFragment',
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'ShoppingListItemDisplayFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'ShoppingListItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'FragmentSpread',
            name: { kind: 'Name', value: 'ShoppingListItemCore' },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'sortOrder' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'item' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'imageUrl' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'images' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'url' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'kind' } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'ShoppingListItemCore' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'ShoppingListItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'itemName' } },
          { kind: 'Field', name: { kind: 'Name', value: 'quantity' } },
          { kind: 'Field', name: { kind: 'Name', value: 'quantityInput' } },
          { kind: 'Field', name: { kind: 'Name', value: 'displayFormat' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'purchaseInfo' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'isPurchased' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'version' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'category' } },
          { kind: 'Field', name: { kind: 'Name', value: 'notes' } },
          { kind: 'Field', name: { kind: 'Name', value: 'unitName' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'unit' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'symbol' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useUpdateShoppingListItemMutation__
 *
 * To run a mutation, you first call `useUpdateShoppingListItemMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdateShoppingListItemMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updateShoppingListItemMutation, { data, loading, error }] = useUpdateShoppingListItemMutation({
 *   variables: {
 *      id: // value for 'id'
 *      input: // value for 'input'
 *   },
 * });
 */
export function useUpdateShoppingListItemMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    UpdateShoppingListItemMutation,
    UpdateShoppingListItemMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<
    UpdateShoppingListItemMutation,
    UpdateShoppingListItemMutationVariables
  >(UpdateShoppingListItemDocument, options);
}
export type UpdateShoppingListItemMutationHookResult = ReturnType<
  typeof useUpdateShoppingListItemMutation
>;
export type UpdateShoppingListItemMutationResult =
  ApolloReactCommon.MutationResult<UpdateShoppingListItemMutation>;
export type UpdateShoppingListItemMutationOptions =
  ApolloReactCommon.BaseMutationOptions<
    UpdateShoppingListItemMutation,
    UpdateShoppingListItemMutationVariables
  >;
export const RemoveItemFromShoppingListDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'RemoveItemFromShoppingList' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'removeItemFromShoppingList' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'id' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'id' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'success' } },
                { kind: 'Field', name: { kind: 'Name', value: 'message' } },
                { kind: 'Field', name: { kind: 'Name', value: 'code' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'shoppingListItem' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useRemoveItemFromShoppingListMutation__
 *
 * To run a mutation, you first call `useRemoveItemFromShoppingListMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useRemoveItemFromShoppingListMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [removeItemFromShoppingListMutation, { data, loading, error }] = useRemoveItemFromShoppingListMutation({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useRemoveItemFromShoppingListMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    RemoveItemFromShoppingListMutation,
    RemoveItemFromShoppingListMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<
    RemoveItemFromShoppingListMutation,
    RemoveItemFromShoppingListMutationVariables
  >(RemoveItemFromShoppingListDocument, options);
}
export type RemoveItemFromShoppingListMutationHookResult = ReturnType<
  typeof useRemoveItemFromShoppingListMutation
>;
export type RemoveItemFromShoppingListMutationResult =
  ApolloReactCommon.MutationResult<RemoveItemFromShoppingListMutation>;
export type RemoveItemFromShoppingListMutationOptions =
  ApolloReactCommon.BaseMutationOptions<
    RemoveItemFromShoppingListMutation,
    RemoveItemFromShoppingListMutationVariables
  >;
export const MoveShoppingListItemDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'MoveShoppingListItem' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'input' },
          },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'NamedType',
              name: { kind: 'Name', value: 'MoveShoppingListItemInput' },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'moveShoppingListItem' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'input' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'input' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'success' } },
                { kind: 'Field', name: { kind: 'Name', value: 'message' } },
                { kind: 'Field', name: { kind: 'Name', value: 'code' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'shoppingListItem' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: {
                          kind: 'Name',
                          value: 'ShoppingListItemDisplayFragment',
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'ShoppingListItemDisplayFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'ShoppingListItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'FragmentSpread',
            name: { kind: 'Name', value: 'ShoppingListItemCore' },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'sortOrder' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'item' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'imageUrl' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'images' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'url' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'kind' } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'ShoppingListItemCore' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'ShoppingListItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'itemName' } },
          { kind: 'Field', name: { kind: 'Name', value: 'quantity' } },
          { kind: 'Field', name: { kind: 'Name', value: 'quantityInput' } },
          { kind: 'Field', name: { kind: 'Name', value: 'displayFormat' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'purchaseInfo' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'isPurchased' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'version' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'category' } },
          { kind: 'Field', name: { kind: 'Name', value: 'notes' } },
          { kind: 'Field', name: { kind: 'Name', value: 'unitName' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'unit' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'symbol' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useMoveShoppingListItemMutation__
 *
 * To run a mutation, you first call `useMoveShoppingListItemMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useMoveShoppingListItemMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [moveShoppingListItemMutation, { data, loading, error }] = useMoveShoppingListItemMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useMoveShoppingListItemMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    MoveShoppingListItemMutation,
    MoveShoppingListItemMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<
    MoveShoppingListItemMutation,
    MoveShoppingListItemMutationVariables
  >(MoveShoppingListItemDocument, options);
}
export type MoveShoppingListItemMutationHookResult = ReturnType<
  typeof useMoveShoppingListItemMutation
>;
export type MoveShoppingListItemMutationResult =
  ApolloReactCommon.MutationResult<MoveShoppingListItemMutation>;
export type MoveShoppingListItemMutationOptions =
  ApolloReactCommon.BaseMutationOptions<
    MoveShoppingListItemMutation,
    MoveShoppingListItemMutationVariables
  >;
export const ToggleShoppingListItemPurchasedDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'ToggleShoppingListItemPurchased' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'input' },
          },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'NamedType',
              name: {
                kind: 'Name',
                value: 'ToggleShoppingListItemPurchasedInput',
              },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'toggleShoppingListItemPurchased' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'input' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'input' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'success' } },
                { kind: 'Field', name: { kind: 'Name', value: 'message' } },
                { kind: 'Field', name: { kind: 'Name', value: 'code' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'shoppingListItem' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: {
                          kind: 'Name',
                          value: 'ShoppingListItemDisplayFragment',
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'ShoppingListItemDisplayFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'ShoppingListItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'FragmentSpread',
            name: { kind: 'Name', value: 'ShoppingListItemCore' },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'sortOrder' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'item' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'imageUrl' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'images' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'url' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'kind' } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'ShoppingListItemCore' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'ShoppingListItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'itemName' } },
          { kind: 'Field', name: { kind: 'Name', value: 'quantity' } },
          { kind: 'Field', name: { kind: 'Name', value: 'quantityInput' } },
          { kind: 'Field', name: { kind: 'Name', value: 'displayFormat' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'purchaseInfo' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'isPurchased' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'version' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'category' } },
          { kind: 'Field', name: { kind: 'Name', value: 'notes' } },
          { kind: 'Field', name: { kind: 'Name', value: 'unitName' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'unit' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'symbol' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useToggleShoppingListItemPurchasedMutation__
 *
 * To run a mutation, you first call `useToggleShoppingListItemPurchasedMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useToggleShoppingListItemPurchasedMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [toggleShoppingListItemPurchasedMutation, { data, loading, error }] = useToggleShoppingListItemPurchasedMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useToggleShoppingListItemPurchasedMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    ToggleShoppingListItemPurchasedMutation,
    ToggleShoppingListItemPurchasedMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<
    ToggleShoppingListItemPurchasedMutation,
    ToggleShoppingListItemPurchasedMutationVariables
  >(ToggleShoppingListItemPurchasedDocument, options);
}
export type ToggleShoppingListItemPurchasedMutationHookResult = ReturnType<
  typeof useToggleShoppingListItemPurchasedMutation
>;
export type ToggleShoppingListItemPurchasedMutationResult =
  ApolloReactCommon.MutationResult<ToggleShoppingListItemPurchasedMutation>;
export type ToggleShoppingListItemPurchasedMutationOptions =
  ApolloReactCommon.BaseMutationOptions<
    ToggleShoppingListItemPurchasedMutation,
    ToggleShoppingListItemPurchasedMutationVariables
  >;
export const UpdateShoppingListItemQuantityDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'UpdateShoppingListItemQuantity' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'itemId' },
          },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'quantity' },
          },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'NamedType',
              name: { kind: 'Name', value: 'String' },
            },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'unitId' },
          },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
        },
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'version' },
          },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'Int' } },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'updateShoppingListItemQuantity' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'itemId' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'itemId' },
                },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'quantity' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'quantity' },
                },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'unitId' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'unitId' },
                },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'version' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'version' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'success' } },
                { kind: 'Field', name: { kind: 'Name', value: 'message' } },
                { kind: 'Field', name: { kind: 'Name', value: 'code' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'shoppingListItem' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: {
                          kind: 'Name',
                          value: 'ShoppingListItemDisplayFragment',
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'ShoppingListItemDisplayFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'ShoppingListItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'FragmentSpread',
            name: { kind: 'Name', value: 'ShoppingListItemCore' },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'sortOrder' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'item' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'imageUrl' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'images' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'url' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'kind' } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'ShoppingListItemCore' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'ShoppingListItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'itemName' } },
          { kind: 'Field', name: { kind: 'Name', value: 'quantity' } },
          { kind: 'Field', name: { kind: 'Name', value: 'quantityInput' } },
          { kind: 'Field', name: { kind: 'Name', value: 'displayFormat' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'purchaseInfo' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'isPurchased' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'version' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'category' } },
          { kind: 'Field', name: { kind: 'Name', value: 'notes' } },
          { kind: 'Field', name: { kind: 'Name', value: 'unitName' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'unit' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'symbol' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useUpdateShoppingListItemQuantityMutation__
 *
 * To run a mutation, you first call `useUpdateShoppingListItemQuantityMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdateShoppingListItemQuantityMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updateShoppingListItemQuantityMutation, { data, loading, error }] = useUpdateShoppingListItemQuantityMutation({
 *   variables: {
 *      itemId: // value for 'itemId'
 *      quantity: // value for 'quantity'
 *      unitId: // value for 'unitId'
 *      version: // value for 'version'
 *   },
 * });
 */
export function useUpdateShoppingListItemQuantityMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    UpdateShoppingListItemQuantityMutation,
    UpdateShoppingListItemQuantityMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<
    UpdateShoppingListItemQuantityMutation,
    UpdateShoppingListItemQuantityMutationVariables
  >(UpdateShoppingListItemQuantityDocument, options);
}
export type UpdateShoppingListItemQuantityMutationHookResult = ReturnType<
  typeof useUpdateShoppingListItemQuantityMutation
>;
export type UpdateShoppingListItemQuantityMutationResult =
  ApolloReactCommon.MutationResult<UpdateShoppingListItemQuantityMutation>;
export type UpdateShoppingListItemQuantityMutationOptions =
  ApolloReactCommon.BaseMutationOptions<
    UpdateShoppingListItemQuantityMutation,
    UpdateShoppingListItemQuantityMutationVariables
  >;
export const UpdateCollaboratorRoleDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'UpdateCollaboratorRole' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'input' },
          },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'NamedType',
              name: { kind: 'Name', value: 'UpdateCollaboratorRoleInput' },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'updateCollaboratorRole' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'input' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'input' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'success' } },
                { kind: 'Field', name: { kind: 'Name', value: 'message' } },
                { kind: 'Field', name: { kind: 'Name', value: 'code' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useUpdateCollaboratorRoleMutation__
 *
 * To run a mutation, you first call `useUpdateCollaboratorRoleMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdateCollaboratorRoleMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updateCollaboratorRoleMutation, { data, loading, error }] = useUpdateCollaboratorRoleMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useUpdateCollaboratorRoleMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    UpdateCollaboratorRoleMutation,
    UpdateCollaboratorRoleMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<
    UpdateCollaboratorRoleMutation,
    UpdateCollaboratorRoleMutationVariables
  >(UpdateCollaboratorRoleDocument, options);
}
export type UpdateCollaboratorRoleMutationHookResult = ReturnType<
  typeof useUpdateCollaboratorRoleMutation
>;
export type UpdateCollaboratorRoleMutationResult =
  ApolloReactCommon.MutationResult<UpdateCollaboratorRoleMutation>;
export type UpdateCollaboratorRoleMutationOptions =
  ApolloReactCommon.BaseMutationOptions<
    UpdateCollaboratorRoleMutation,
    UpdateCollaboratorRoleMutationVariables
  >;
export const MoveShoppingItemToPantryDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'MoveShoppingItemToPantry' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'input' },
          },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'NamedType',
              name: { kind: 'Name', value: 'MoveShoppingItemToPantryInput' },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'moveShoppingItemToPantry' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'input' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'input' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'success' } },
                { kind: 'Field', name: { kind: 'Name', value: 'message' } },
                { kind: 'Field', name: { kind: 'Name', value: 'code' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'pantryItem' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: { kind: 'Name', value: 'PantryItemDisplay' },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PantryItemDisplay' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'PantryItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'FragmentSpread',
            name: { kind: 'Name', value: 'PantryItemCore' },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'item' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'imageUrl' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'images' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'url' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'kind' } },
                    ],
                  },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'unit' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'symbol' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'netWeightUnit' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'symbol' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'storageLocation' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'type' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'packageBreakdown' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'count' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'contentUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'perUnitNetWeight' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'perUnitNetWeightUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'totalNetWeight' },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'quantityBreakdown' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'fullPackages' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'looseContentUnits' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'contentUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'totalContentUnits' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'remainingWeight' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'remainingWeightUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PantryItemCore' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'PantryItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pantryId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'itemId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'itemName' } },
          { kind: 'Field', name: { kind: 'Name', value: 'quantity' } },
          { kind: 'Field', name: { kind: 'Name', value: 'version' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'storageState' } },
          { kind: 'Field', name: { kind: 'Name', value: 'expiresAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'lowStockAlert' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isLowStock' } },
          { kind: 'Field', name: { kind: 'Name', value: 'minQuantity' } },
          { kind: 'Field', name: { kind: 'Name', value: 'lastUsedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'netWeight' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'remainingNetWeight' },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'activeBatchCount' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'earliestBatchExpiration' },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useMoveShoppingItemToPantryMutation__
 *
 * To run a mutation, you first call `useMoveShoppingItemToPantryMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useMoveShoppingItemToPantryMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [moveShoppingItemToPantryMutation, { data, loading, error }] = useMoveShoppingItemToPantryMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useMoveShoppingItemToPantryMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    MoveShoppingItemToPantryMutation,
    MoveShoppingItemToPantryMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<
    MoveShoppingItemToPantryMutation,
    MoveShoppingItemToPantryMutationVariables
  >(MoveShoppingItemToPantryDocument, options);
}
export type MoveShoppingItemToPantryMutationHookResult = ReturnType<
  typeof useMoveShoppingItemToPantryMutation
>;
export type MoveShoppingItemToPantryMutationResult =
  ApolloReactCommon.MutationResult<MoveShoppingItemToPantryMutation>;
export type MoveShoppingItemToPantryMutationOptions =
  ApolloReactCommon.BaseMutationOptions<
    MoveShoppingItemToPantryMutation,
    MoveShoppingItemToPantryMutationVariables
  >;
export const ClearShoppingListItemsDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'ClearShoppingListItems' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'shoppingListId' },
          },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'purchased' },
          },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'NamedType',
              name: { kind: 'Name', value: 'Boolean' },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'clearShoppingListItems' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'shoppingListId' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'shoppingListId' },
                },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'purchased' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'purchased' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'summary' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'total' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'successful' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'failed' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'skipped' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'executionTime' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'clearedItemIds' },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useClearShoppingListItemsMutation__
 *
 * To run a mutation, you first call `useClearShoppingListItemsMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useClearShoppingListItemsMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [clearShoppingListItemsMutation, { data, loading, error }] = useClearShoppingListItemsMutation({
 *   variables: {
 *      shoppingListId: // value for 'shoppingListId'
 *      purchased: // value for 'purchased'
 *   },
 * });
 */
export function useClearShoppingListItemsMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    ClearShoppingListItemsMutation,
    ClearShoppingListItemsMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<
    ClearShoppingListItemsMutation,
    ClearShoppingListItemsMutationVariables
  >(ClearShoppingListItemsDocument, options);
}
export type ClearShoppingListItemsMutationHookResult = ReturnType<
  typeof useClearShoppingListItemsMutation
>;
export type ClearShoppingListItemsMutationResult =
  ApolloReactCommon.MutationResult<ClearShoppingListItemsMutation>;
export type ClearShoppingListItemsMutationOptions =
  ApolloReactCommon.BaseMutationOptions<
    ClearShoppingListItemsMutation,
    ClearShoppingListItemsMutationVariables
  >;
export const AddItemsToShoppingListDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'AddItemsToShoppingList' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'shoppingListId' },
          },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'items' },
          },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'ListType',
              type: {
                kind: 'NonNullType',
                type: {
                  kind: 'NamedType',
                  name: {
                    kind: 'Name',
                    value: 'BatchAddShoppingListItemInput',
                  },
                },
              },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'addItemsToShoppingList' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'shoppingListId' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'shoppingListId' },
                },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'items' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'items' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'results' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'index' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'clientId' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'success' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'item' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'FragmentSpread',
                              name: {
                                kind: 'Name',
                                value: 'ShoppingListItemDisplayFragment',
                              },
                            },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'quantityIncremented' },
                      },
                      { kind: 'Field', name: { kind: 'Name', value: 'error' } },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'successCount' },
                },
                { kind: 'Field', name: { kind: 'Name', value: 'failedCount' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'incrementedCount' },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'ShoppingListItemDisplayFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'ShoppingListItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'FragmentSpread',
            name: { kind: 'Name', value: 'ShoppingListItemCore' },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'sortOrder' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'item' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'imageUrl' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'images' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'url' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'kind' } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'ShoppingListItemCore' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'ShoppingListItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'itemName' } },
          { kind: 'Field', name: { kind: 'Name', value: 'quantity' } },
          { kind: 'Field', name: { kind: 'Name', value: 'quantityInput' } },
          { kind: 'Field', name: { kind: 'Name', value: 'displayFormat' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'purchaseInfo' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'isPurchased' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'version' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'category' } },
          { kind: 'Field', name: { kind: 'Name', value: 'notes' } },
          { kind: 'Field', name: { kind: 'Name', value: 'unitName' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'unit' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'symbol' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useAddItemsToShoppingListMutation__
 *
 * To run a mutation, you first call `useAddItemsToShoppingListMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useAddItemsToShoppingListMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [addItemsToShoppingListMutation, { data, loading, error }] = useAddItemsToShoppingListMutation({
 *   variables: {
 *      shoppingListId: // value for 'shoppingListId'
 *      items: // value for 'items'
 *   },
 * });
 */
export function useAddItemsToShoppingListMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    AddItemsToShoppingListMutation,
    AddItemsToShoppingListMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<
    AddItemsToShoppingListMutation,
    AddItemsToShoppingListMutationVariables
  >(AddItemsToShoppingListDocument, options);
}
export type AddItemsToShoppingListMutationHookResult = ReturnType<
  typeof useAddItemsToShoppingListMutation
>;
export type AddItemsToShoppingListMutationResult =
  ApolloReactCommon.MutationResult<AddItemsToShoppingListMutation>;
export type AddItemsToShoppingListMutationOptions =
  ApolloReactCommon.BaseMutationOptions<
    AddItemsToShoppingListMutation,
    AddItemsToShoppingListMutationVariables
  >;
export const ShareShoppingListDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'ShareShoppingList' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'input' },
          },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'NamedType',
              name: { kind: 'Name', value: 'ShareShoppingListInput' },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'shareShoppingList' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'id' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'id' },
                },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'input' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'input' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'success' } },
                { kind: 'Field', name: { kind: 'Name', value: 'message' } },
                { kind: 'Field', name: { kind: 'Name', value: 'code' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'shoppingList' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'shareCode' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'isPublic' },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useShareShoppingListMutation__
 *
 * To run a mutation, you first call `useShareShoppingListMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useShareShoppingListMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [shareShoppingListMutation, { data, loading, error }] = useShareShoppingListMutation({
 *   variables: {
 *      id: // value for 'id'
 *      input: // value for 'input'
 *   },
 * });
 */
export function useShareShoppingListMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    ShareShoppingListMutation,
    ShareShoppingListMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<
    ShareShoppingListMutation,
    ShareShoppingListMutationVariables
  >(ShareShoppingListDocument, options);
}
export type ShareShoppingListMutationHookResult = ReturnType<
  typeof useShareShoppingListMutation
>;
export type ShareShoppingListMutationResult =
  ApolloReactCommon.MutationResult<ShareShoppingListMutation>;
export type ShareShoppingListMutationOptions =
  ApolloReactCommon.BaseMutationOptions<
    ShareShoppingListMutation,
    ShareShoppingListMutationVariables
  >;
export const JoinShoppingListByShareCodeDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'JoinShoppingListByShareCode' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'shareCode' },
          },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'NamedType',
              name: { kind: 'Name', value: 'String' },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'joinShoppingListByShareCode' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'shareCode' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'shareCode' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'success' } },
                { kind: 'Field', name: { kind: 'Name', value: 'message' } },
                { kind: 'Field', name: { kind: 'Name', value: 'code' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'shoppingList' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useJoinShoppingListByShareCodeMutation__
 *
 * To run a mutation, you first call `useJoinShoppingListByShareCodeMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useJoinShoppingListByShareCodeMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [joinShoppingListByShareCodeMutation, { data, loading, error }] = useJoinShoppingListByShareCodeMutation({
 *   variables: {
 *      shareCode: // value for 'shareCode'
 *   },
 * });
 */
export function useJoinShoppingListByShareCodeMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    JoinShoppingListByShareCodeMutation,
    JoinShoppingListByShareCodeMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<
    JoinShoppingListByShareCodeMutation,
    JoinShoppingListByShareCodeMutationVariables
  >(JoinShoppingListByShareCodeDocument, options);
}
export type JoinShoppingListByShareCodeMutationHookResult = ReturnType<
  typeof useJoinShoppingListByShareCodeMutation
>;
export type JoinShoppingListByShareCodeMutationResult =
  ApolloReactCommon.MutationResult<JoinShoppingListByShareCodeMutation>;
export type JoinShoppingListByShareCodeMutationOptions =
  ApolloReactCommon.BaseMutationOptions<
    JoinShoppingListByShareCodeMutation,
    JoinShoppingListByShareCodeMutationVariables
  >;
export const SyncShoppingListItemDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'SyncShoppingListItem' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'clientId' },
          },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'input' },
          },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'NamedType',
              name: { kind: 'Name', value: 'SyncShoppingListItemInput' },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'syncShoppingListItem' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'clientId' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'clientId' },
                },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'input' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'input' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'clientId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'serverId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'operation' } },
                { kind: 'Field', name: { kind: 'Name', value: 'wasCreated' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'item' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: {
                          kind: 'Name',
                          value: 'ShoppingListItemDisplayFragment',
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'conflict' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'clientVersion' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'serverVersion' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'message' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'serverItem' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'id' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'version' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'sortOrder' },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'ShoppingListItemDisplayFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'ShoppingListItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'FragmentSpread',
            name: { kind: 'Name', value: 'ShoppingListItemCore' },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'sortOrder' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'item' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'imageUrl' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'images' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'url' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'kind' } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'ShoppingListItemCore' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'ShoppingListItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'itemName' } },
          { kind: 'Field', name: { kind: 'Name', value: 'quantity' } },
          { kind: 'Field', name: { kind: 'Name', value: 'quantityInput' } },
          { kind: 'Field', name: { kind: 'Name', value: 'displayFormat' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'purchaseInfo' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'isPurchased' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'version' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'category' } },
          { kind: 'Field', name: { kind: 'Name', value: 'notes' } },
          { kind: 'Field', name: { kind: 'Name', value: 'unitName' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'unit' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'symbol' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useSyncShoppingListItemMutation__
 *
 * To run a mutation, you first call `useSyncShoppingListItemMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useSyncShoppingListItemMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [syncShoppingListItemMutation, { data, loading, error }] = useSyncShoppingListItemMutation({
 *   variables: {
 *      clientId: // value for 'clientId'
 *      input: // value for 'input'
 *   },
 * });
 */
export function useSyncShoppingListItemMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    SyncShoppingListItemMutation,
    SyncShoppingListItemMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<
    SyncShoppingListItemMutation,
    SyncShoppingListItemMutationVariables
  >(SyncShoppingListItemDocument, options);
}
export type SyncShoppingListItemMutationHookResult = ReturnType<
  typeof useSyncShoppingListItemMutation
>;
export type SyncShoppingListItemMutationResult =
  ApolloReactCommon.MutationResult<SyncShoppingListItemMutation>;
export type SyncShoppingListItemMutationOptions =
  ApolloReactCommon.BaseMutationOptions<
    SyncShoppingListItemMutation,
    SyncShoppingListItemMutationVariables
  >;
export const SyncDeleteShoppingListItemDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'SyncDeleteShoppingListItem' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'clientId' },
          },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'version' },
          },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'Int' } },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'syncDeleteShoppingListItem' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'clientId' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'clientId' },
                },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'version' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'version' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'clientId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'serverId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'operation' } },
                { kind: 'Field', name: { kind: 'Name', value: 'wasCreated' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'item' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'itemName' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'conflict' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'clientVersion' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'serverVersion' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'message' },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useSyncDeleteShoppingListItemMutation__
 *
 * To run a mutation, you first call `useSyncDeleteShoppingListItemMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useSyncDeleteShoppingListItemMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [syncDeleteShoppingListItemMutation, { data, loading, error }] = useSyncDeleteShoppingListItemMutation({
 *   variables: {
 *      clientId: // value for 'clientId'
 *      version: // value for 'version'
 *   },
 * });
 */
export function useSyncDeleteShoppingListItemMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    SyncDeleteShoppingListItemMutation,
    SyncDeleteShoppingListItemMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<
    SyncDeleteShoppingListItemMutation,
    SyncDeleteShoppingListItemMutationVariables
  >(SyncDeleteShoppingListItemDocument, options);
}
export type SyncDeleteShoppingListItemMutationHookResult = ReturnType<
  typeof useSyncDeleteShoppingListItemMutation
>;
export type SyncDeleteShoppingListItemMutationResult =
  ApolloReactCommon.MutationResult<SyncDeleteShoppingListItemMutation>;
export type SyncDeleteShoppingListItemMutationOptions =
  ApolloReactCommon.BaseMutationOptions<
    SyncDeleteShoppingListItemMutation,
    SyncDeleteShoppingListItemMutationVariables
  >;
export const SyncMoveShoppingListItemDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'SyncMoveShoppingListItem' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'clientId' },
          },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'afterId' },
          },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
        },
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'beforeId' },
          },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
        },
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'version' },
          },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'Int' } },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'syncMoveShoppingListItem' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'clientId' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'clientId' },
                },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'afterId' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'afterId' },
                },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'beforeId' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'beforeId' },
                },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'version' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'version' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'clientId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'serverId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'operation' } },
                { kind: 'Field', name: { kind: 'Name', value: 'wasCreated' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'item' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: {
                          kind: 'Name',
                          value: 'ShoppingListItemDisplayFragment',
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'conflict' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'clientVersion' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'serverVersion' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'message' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'serverItem' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'id' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'version' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'sortOrder' },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'ShoppingListItemDisplayFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'ShoppingListItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'FragmentSpread',
            name: { kind: 'Name', value: 'ShoppingListItemCore' },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'sortOrder' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'item' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'imageUrl' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'images' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'url' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'kind' } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'ShoppingListItemCore' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'ShoppingListItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'itemName' } },
          { kind: 'Field', name: { kind: 'Name', value: 'quantity' } },
          { kind: 'Field', name: { kind: 'Name', value: 'quantityInput' } },
          { kind: 'Field', name: { kind: 'Name', value: 'displayFormat' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'purchaseInfo' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'isPurchased' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'version' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'category' } },
          { kind: 'Field', name: { kind: 'Name', value: 'notes' } },
          { kind: 'Field', name: { kind: 'Name', value: 'unitName' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'unit' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'symbol' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useSyncMoveShoppingListItemMutation__
 *
 * To run a mutation, you first call `useSyncMoveShoppingListItemMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useSyncMoveShoppingListItemMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [syncMoveShoppingListItemMutation, { data, loading, error }] = useSyncMoveShoppingListItemMutation({
 *   variables: {
 *      clientId: // value for 'clientId'
 *      afterId: // value for 'afterId'
 *      beforeId: // value for 'beforeId'
 *      version: // value for 'version'
 *   },
 * });
 */
export function useSyncMoveShoppingListItemMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    SyncMoveShoppingListItemMutation,
    SyncMoveShoppingListItemMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<
    SyncMoveShoppingListItemMutation,
    SyncMoveShoppingListItemMutationVariables
  >(SyncMoveShoppingListItemDocument, options);
}
export type SyncMoveShoppingListItemMutationHookResult = ReturnType<
  typeof useSyncMoveShoppingListItemMutation
>;
export type SyncMoveShoppingListItemMutationResult =
  ApolloReactCommon.MutationResult<SyncMoveShoppingListItemMutation>;
export type SyncMoveShoppingListItemMutationOptions =
  ApolloReactCommon.BaseMutationOptions<
    SyncMoveShoppingListItemMutation,
    SyncMoveShoppingListItemMutationVariables
  >;
export const ShoppingListChangesDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'subscription',
      name: { kind: 'Name', value: 'ShoppingListChanges' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'listId' },
          },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'shoppingListChanged' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'listId' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'listId' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'changeType' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'item' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: {
                          kind: 'Name',
                          value: 'ShoppingListItemDisplayFragment',
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'shoppingList' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'totalItems' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'completedItems' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'clearedItemIds' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'clearedCount' },
                },
                { kind: 'Field', name: { kind: 'Name', value: 'mutation' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'updatedFields' },
                },
                { kind: 'Field', name: { kind: 'Name', value: 'listId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'timestamp' } },
                { kind: 'Field', name: { kind: 'Name', value: 'userId' } },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'ShoppingListItemDisplayFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'ShoppingListItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'FragmentSpread',
            name: { kind: 'Name', value: 'ShoppingListItemCore' },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'sortOrder' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'item' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'imageUrl' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'images' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'url' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'kind' } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'ShoppingListItemCore' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'ShoppingListItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'itemName' } },
          { kind: 'Field', name: { kind: 'Name', value: 'quantity' } },
          { kind: 'Field', name: { kind: 'Name', value: 'quantityInput' } },
          { kind: 'Field', name: { kind: 'Name', value: 'displayFormat' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'purchaseInfo' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'isPurchased' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'version' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'category' } },
          { kind: 'Field', name: { kind: 'Name', value: 'notes' } },
          { kind: 'Field', name: { kind: 'Name', value: 'unitName' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'unit' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'symbol' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useShoppingListChangesSubscription__
 *
 * To run a query within a React component, call `useShoppingListChangesSubscription` and pass it any options that fit your needs.
 * When your component renders, `useShoppingListChangesSubscription` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the subscription, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useShoppingListChangesSubscription({
 *   variables: {
 *      listId: // value for 'listId'
 *   },
 * });
 */
export function useShoppingListChangesSubscription(
  baseOptions: ApolloReactHooks.SubscriptionHookOptions<
    ShoppingListChangesSubscription,
    ShoppingListChangesSubscriptionVariables
  > &
    (
      | { variables: ShoppingListChangesSubscriptionVariables; skip?: boolean }
      | { skip: boolean }
    ),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useSubscription<
    ShoppingListChangesSubscription,
    ShoppingListChangesSubscriptionVariables
  >(ShoppingListChangesDocument, options);
}
export type ShoppingListChangesSubscriptionHookResult = ReturnType<
  typeof useShoppingListChangesSubscription
>;
export type ShoppingListChangesSubscriptionResult =
  ApolloReactCommon.SubscriptionResult<ShoppingListChangesSubscription>;
export const MyShoppingListsChangesDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'subscription',
      name: { kind: 'Name', value: 'MyShoppingListsChanges' },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'myShoppingListsChanged' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'changeType' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'shoppingList' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'totalItems' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'completedItems' },
                      },
                    ],
                  },
                },
                { kind: 'Field', name: { kind: 'Name', value: 'mutation' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'updatedFields' },
                },
                { kind: 'Field', name: { kind: 'Name', value: 'listId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'timestamp' } },
                { kind: 'Field', name: { kind: 'Name', value: 'userId' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useMyShoppingListsChangesSubscription__
 *
 * To run a query within a React component, call `useMyShoppingListsChangesSubscription` and pass it any options that fit your needs.
 * When your component renders, `useMyShoppingListsChangesSubscription` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the subscription, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useMyShoppingListsChangesSubscription({
 *   variables: {
 *   },
 * });
 */
export function useMyShoppingListsChangesSubscription(
  baseOptions?: ApolloReactHooks.SubscriptionHookOptions<
    MyShoppingListsChangesSubscription,
    MyShoppingListsChangesSubscriptionVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useSubscription<
    MyShoppingListsChangesSubscription,
    MyShoppingListsChangesSubscriptionVariables
  >(MyShoppingListsChangesDocument, options);
}
export type MyShoppingListsChangesSubscriptionHookResult = ReturnType<
  typeof useMyShoppingListsChangesSubscription
>;
export type MyShoppingListsChangesSubscriptionResult =
  ApolloReactCommon.SubscriptionResult<MyShoppingListsChangesSubscription>;
