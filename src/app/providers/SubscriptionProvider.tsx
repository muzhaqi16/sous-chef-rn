import React, { useEffect, useState } from 'react';
import { useUser } from '#store/useAppStore';
import { useAppStore } from '#store/useAppStore';
import { subscriptionService } from '#/services/subscriptions/SubscriptionService';
import {
  enableAutoReconnect,
  disableAutoReconnect,
} from '#/apollo/links/wsLink';
import { AuthenticatedSubscriptions } from '#/app/providers/AuthenticatedSubscriptions';
import { AuthenticatedDataProvider } from '#/app/providers/AuthenticatedDataProvider';
import { ListAnimationProvider } from '#/context/ListAnimationContext';

interface SubscriptionProviderProps {
  children: React.ReactNode;
}

/**
 * Mounts every domain's real-time subscription through `SubscriptionService`, so
 * deduplication, cache updates and logout teardown behave the same everywhere.
 * Must sit inside `ApolloProvider`, alongside `DataProvider`.
 */
export const SubscriptionProvider: React.FC<SubscriptionProviderProps> = ({
  children,
}) => {
  const user = useUser();
  const isAuthenticated = useAppStore(
    state => !!(state.user && state.accessToken),
  );
  // Gate subscriptions behind auth state — server handles token refresh during WS connection
  const [isTokenReady, setIsTokenReady] = useState(false);
  // Defer WebSocket subscriptions to avoid competing with startup queries on the JS thread
  const [subscriptionsReady, setSubscriptionsReady] = useState(false);

  // Enable/disable auto-reconnect and cleanup subscriptions based on auth state
  useEffect(() => {
    const initializeWebSocket = () => {
      if (isAuthenticated) {
        // No blocking refresh: `connectionParams` sends the refresh token too,
        // and the server rotates an expired access token during the handshake,
        // so reconnecting is safe even with a stale stored token.
        enableAutoReconnect();
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
      {/* Only initialize data when user is authenticated AND token is ready. */}
      {/* Key by userId to force remount when user changes - this ensures hooks
          like useDefaultHome reset their refs and fetch fresh data for the new user */}
      {!!isAuthenticated && !!user?.id && !!isTokenReady && (
        <AuthenticatedDataProvider key={`data-${user.id}`} userId={user.id} />
      )}
      {/* Subscriptions deferred by 3s — initial data comes from queries, real-time
          updates can safely start after the startup window completes */}
      {!!isAuthenticated && !!user?.id && !!subscriptionsReady && (
        <AuthenticatedSubscriptions key={`subs-${user.id}`} userId={user.id} />
      )}
      {children}
    </ListAnimationProvider>
  );
};

export default SubscriptionProvider;
