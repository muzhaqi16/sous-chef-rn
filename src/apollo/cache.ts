import { InMemoryCache } from '@apollo/client';

/**
 * Minimal Apollo InMemoryCache configuration
 *
 * Let Apollo handle everything automatically:
 * - Automatic normalization by id
 * - Automatic cache updates from mutations
 * - Automatic subscription merging
 *
 * No custom merge policies. No manual cache updates. Trust Apollo.
 */
export function makeCache(): InMemoryCache {
  return new InMemoryCache({
    typePolicies: {
      // Only specify keyFields for normalization - nothing else
      Query: {
        fields: {
          pantryItems: {
            keyArgs: ['pantryId'],
          },
          shoppingListItems: {
            keyArgs: ['shoppingListId'],
          },
        },
      },
      PantryItem: {
        keyFields: ['id'],
      },
      ShoppingListItem: {
        keyFields: ['id'],
      },
      Item: {
        keyFields: ['id'],
      },
      User: {
        keyFields: ['id'],
      },
      Home: {
        keyFields: ['id'],
      },
      Unit: {
        keyFields: ['id'],
      },
      ShoppingList: {
        keyFields: ['id'],
      },
      Pantry: {
        keyFields: ['id'],
      },
    },
  });
}
