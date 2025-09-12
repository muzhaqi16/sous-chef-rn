import {useMemo} from 'react';
import {useGetShoppingListsQuery} from '#generated';
import {useStore} from '#store';

/**
 * Hook to validate that a shopping list ID belongs to the current user
 * 
 * @param listId - The shopping list ID to validate
 * @returns Object containing validation result and safe listId
 */
export function useShoppingListValidation(listId: string | null) {
  const user = useStore(state => state.user);
  const isLoggingOut = useStore(state => state.isLoggingOut);
  const isLoggedOut = !user;

  // Get user's shopping lists to validate the listId belongs to current user
  const {data: listsData} = useGetShoppingListsQuery({
    skip: isLoggedOut || isLoggingOut,
    fetchPolicy: 'cache-first',
    errorPolicy: 'ignore', // Don't fail validation due to network errors
  });

  const userLists = listsData?.shoppingLists || [];
  
  // Validation logic
  const validation = useMemo(() => {
    // No listId provided
    if (!listId) {
      return {
        isValid: false,
        safeListId: null,
        reason: 'No list ID provided',
      };
    }
    
    // User is logged out
    if (isLoggedOut || isLoggingOut) {
      return {
        isValid: false,
        safeListId: null,
        reason: 'User not authenticated',
      };
    }
    
    // Empty string listId
    if (listId === '') {
      return {
        isValid: false,
        safeListId: null,
        reason: 'Empty list ID',
      };
    }
    
    // Check if listId exists in user's lists
    const listExists = userLists.some(list => list.id === listId);
    
    if (!listExists && userLists.length > 0) {
      // We have lists data but listId is not found
      return {
        isValid: false,
        safeListId: null,
        reason: 'List ID not found in user lists',
      };
    }
    
    // Valid or we don't have lists data yet (give benefit of doubt)
    return {
      isValid: true,
      safeListId: listId,
      reason: listExists ? 'Valid' : 'Pending validation',
    };
  }, [listId, isLoggedOut, isLoggingOut, userLists]);
  
  return validation;
}