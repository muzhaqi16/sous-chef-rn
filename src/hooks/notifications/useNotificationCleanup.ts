import {useEffect} from 'react';
import {useStore} from '#store';

export const useNotificationCleanup = () => {
  const user = useStore(state => state.user);
  const selectedHomeId = useStore(state => state.selectedHomeId);
  const selectedPantryId = useStore(state => state.selectedPantryId);
  const selectedShoppingListId = useStore(
    state => state.selectedShoppingListId,
  );
  const cleanupOrphanedSubscriptions = useStore(
    state => state.cleanupOrphanedSubscriptions,
  );

  useEffect(() => {
    // Clean up when user state changes
    cleanupOrphanedSubscriptions();
  }, [
    selectedHomeId,
    selectedPantryId,
    selectedShoppingListId,
    user,
    cleanupOrphanedSubscriptions,
  ]);

  useEffect(() => {
    // Clean up everything when user logs out
    if (!user) {
      const resetNotifications = useStore.getState().resetNotifications;
      resetNotifications();
    }
  }, [user]);
};
