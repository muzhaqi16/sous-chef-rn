import {useCallback, useState} from 'react';
import {useStore} from '#store';

interface UseNotificationRefreshProps {
  refetch: () => Promise<any>;
}

export const useNotificationRefresh = ({refetch}: UseNotificationRefreshProps) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refetch();
    // Clear expired notifications and cleanup orphaned subscriptions
    useStore.getState().clearExpired();
    useStore.getState().cleanupOrphanedSubscriptions();
    setIsRefreshing(false);
  }, [refetch]);

  return {
    isRefreshing,
    handleRefresh,
  };
};