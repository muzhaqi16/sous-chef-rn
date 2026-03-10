import React, { useEffect, useState } from 'react';
import { jwtDecode } from 'jwt-decode';
import { useAuthUser } from '#/hooks/auth/useAuthUser';
import { useAppStore } from '#store/useAppStore';
import { subscriptionService } from '#/services/subscriptions/SubscriptionService';
import { enableAutoReconnect, disableAutoReconnect } from '#/apollo/links/wsLink';
import { proactiveTokenRefresh } from '#/apollo/links/refreshToken';
import { AuthenticatedSubscriptions } from './AuthenticatedSubscriptions';
import { AuthenticatedDataProvider } from './AuthenticatedDataProvider';
import { ListAnimationProvider } from '#/context/ListAnimationContext';
import { useStore } from '#store';
import { logger } from '#/utils/environment';

/**
 * Check if token is expired or expiring soon (within 30 seconds)
 */
const isTokenExpiredOrExpiringSoon = (token: string | null): boolean => {
  if (!token) return true;
  try {
    const decoded = jwtDecode<{ exp: number }>(token);
    const expiresAt = decoded.exp * 1000;
    // Consider expired if less than 30 seconds remaining
    return expiresAt - Date.now() < 30 * 1000;
  } catch {
    return true;
  }
};

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
  const user = useAuthUser();
  const isAuthenticated = useAppStore(state => !!(state.user && state.accessToken));
  // Block subscriptions until token is validated/refreshed to prevent 401 race condition
  const [isTokenReady, setIsTokenReady] = useState(false);
  // Defer WebSocket subscriptions to avoid competing with startup queries on the JS thread
  const [subscriptionsReady, setSubscriptionsReady] = useState(false);

  // Enable/disable auto-reconnect and cleanup subscriptions based on auth state
  useEffect(() => {
    const initializeWebSocket = async () => {
      if (isAuthenticated) {
        const accessToken = useStore.getState().accessToken;

        // Validate token before enabling WebSocket
        if (isTokenExpiredOrExpiringSoon(accessToken)) {
          logger.info('[SubscriptionProvider] Token expired/expiring, refreshing before WebSocket init');
          try {
            await proactiveTokenRefresh();
          } catch {
            logger.warn('[SubscriptionProvider] Token refresh failed, WebSocket may fail initially');
          }
        }

        // Enable WebSocket auto-reconnection when authenticated
        enableAutoReconnect();
        // Don't call reconnectWebSocket() here - the lazy WebSocket client
        // will connect automatically when subscriptions start.
        // reconnectWebSocket() is only needed for token refresh scenarios.

        // NOW subscriptions can start - token is validated/refreshed
        setIsTokenReady(true);
      } else {
        // Disable auto-reconnection and cleanup on logout
        disableAutoReconnect();
        subscriptionService.cleanup();
        // Reset for next login
        setIsTokenReady(false);
        setSubscriptionsReady(false);
      }
    };

    initializeWebSocket();
  }, [isAuthenticated]);

  // Render-time reset: clear subscriptions ready state when token becomes invalid
  const [prevIsTokenReady, setPrevIsTokenReady] = useState(isTokenReady);
  if (isTokenReady !== prevIsTokenReady) {
    setPrevIsTokenReady(isTokenReady);
    if (!isTokenReady) {
      setSubscriptionsReady(false);
    }
  }

  // Delay subscription mounting by 3s so startup queries (GetHomes, GetPantry)
  // complete without competing with 12+ WebSocket subscription setups on the JS thread
  useEffect(() => {
    if (isTokenReady) {
      const timer = setTimeout(() => setSubscriptionsReady(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [isTokenReady]);

  return (
    <ListAnimationProvider>
      {/* Only initialize data when user is authenticated AND token is ready
          This prevents WebSocket connection attempts with expired tokens on app restart,
          eliminating "Socket closed" 401 errors by ensuring token is validated first */}
      {/* Key by userId to force remount when user changes - this ensures hooks
          like useDefaultHome reset their refs and fetch fresh data for the new user */}
      {!!isAuthenticated && !!user?.id && !!isTokenReady && <AuthenticatedDataProvider key={`data-${user.id}`} userId={user.id} />}
      {/* Subscriptions deferred by 3s — initial data comes from queries, real-time
          updates can safely start after the startup window completes */}
      {!!isAuthenticated && !!user?.id && !!subscriptionsReady && <AuthenticatedSubscriptions key={`subs-${user.id}`} userId={user.id} />}
      {children}
    </ListAnimationProvider>
  );
};

export default SubscriptionProvider;
