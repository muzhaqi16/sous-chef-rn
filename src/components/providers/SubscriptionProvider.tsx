import React, { useEffect } from 'react';
import { useAuth } from '#/hooks/auth/useAuth';
import { subscriptionService } from '#/services/subscriptions';
import {
  useShoppingListSubscriptions,
  usePantrySubscriptions,
  useHomeSubscriptions,
  useNotificationSubscriptions,
} from '#/hooks/subscriptions';

interface SubscriptionProviderProps {
  children: React.ReactNode;
}

/**
 * SubscriptionProvider - Centralizes all real-time subscription management
 *
 * This component wraps the app to initialize and manage all real-time
 * subscriptions across different domains (shopping lists, pantry, home, notifications).
 *
 * Architecture:
 * - Uses the unified SubscriptionService for consistent behavior
 * - Provides automatic deduplication (filters self-echo and duplicates)
 * - Handles cache updates automatically based on mutation type
 * - Provides consistent error handling and logging
 * - Cleans up subscriptions on logout
 *
 * Benefits:
 * - Eliminates 90%+ of subscription boilerplate in individual hooks
 * - Consistent subscription patterns across the entire app
 * - Easier to add new subscriptions (just register with service)
 * - Better testability (test service once, not every hook)
 * - Improved debugging (centralized logging)
 *
 * This component should be placed inside ApolloProvider (requires Apollo context)
 * and alongside DataProvider in the component tree.
 *
 * @example
 * ```tsx
 * <ApolloProvider client={client}>
 *   <DataProvider>
 *     <SubscriptionProvider>
 *       <Navigation />
 *     </SubscriptionProvider>
 *   </DataProvider>
 * </ApolloProvider>
 * ```
 */
export const SubscriptionProvider: React.FC<SubscriptionProviderProps> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();

  // Initialize domain-specific subscriptions
  // These hooks register their subscriptions with the SubscriptionService
  // and automatically handle cleanup when unmounted or when dependencies change
  useShoppingListSubscriptions(user?.id);
  usePantrySubscriptions(user?.id);
  useHomeSubscriptions(user?.id);
  useNotificationSubscriptions(user?.id);

  // Cleanup subscriptions on logout
  useEffect(() => {
    if (!isAuthenticated) {
      subscriptionService.cleanup();
    }
  }, [isAuthenticated]);

  // Return children immediately - subscriptions run in background
  return <>{children}</>;
};

export default SubscriptionProvider;
