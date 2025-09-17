import {useMemo} from 'react';
import {useGetShoppingListsQuery} from '#generated';
import {useAuth} from '#hooks/auth/useAuth';

/**
 * Hook to validate that a shopping list ID belongs to the current user
 * 
 * @param listId - The shopping list ID to validate
 * @returns Object containing validation result and safe listId
 */
export function useShoppingListValidation(listId: string | null) {
  const { isLoggingOut, isLoggedOut, canAttemptQueries } = useAuth();

  // Get user's shopping lists to validate the listId belongs to current user
  const {data: listsData} = useGetShoppingListsQuery({
    skip: !canAttemptQueries,
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
    if (!canAttemptQueries) {
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
  }, [listId, canAttemptQueries, userLists]);
  
  return validation;
}