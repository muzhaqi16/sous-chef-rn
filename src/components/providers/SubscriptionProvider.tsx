import React, { useEffect } from 'react';
import { useAuth } from '#/hooks/auth/useAuth';
import { subscriptionService } from '#/services/subscriptions';
import { enableAutoReconnect, disableAutoReconnect } from '#/apollo/links/wsLink';
import { AuthenticatedSubscriptions } from './AuthenticatedSubscriptions';
import { AuthenticatedDataProvider } from './AuthenticatedDataProvider';

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

  // Enable/disable auto-reconnect and cleanup subscriptions based on auth state
  useEffect(() => {
    if (isAuthenticated) {
      // Enable WebSocket auto-reconnection when authenticated
      enableAutoReconnect();
    } else {
      // Disable auto-reconnection and cleanup on logout
      disableAutoReconnect();
      subscriptionService.cleanup();
    }
  }, [isAuthenticated]);

  return (
    <>
      {/* Only initialize data and subscriptions when user is authenticated
          This prevents WebSocket connection attempts without a valid JWT token,
          eliminating "JWT token is required for WebSocket connections" errors on startup */}
      {isAuthenticated && user?.id && (
        <>
          <AuthenticatedDataProvider userId={user.id} />
          <AuthenticatedSubscriptions userId={user.id} />
        </>
      )}
      {children}
    </>
  );
};

export default SubscriptionProvider;
