import { useEffect, useCallback } from 'react';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { useStore } from '#store';
import { useAuth } from '#hooks/auth/useAuth';
import { logger } from '#/utils/environment';
import { DeepLinkAction } from '#store/slices/navigationSlice';
import { RootStackParamList } from '#navigation/RootNavigator';

/**
 * Hook for handling deep link routing and integration with navigation state machine.
 * Queues deep link actions until app is hydrated and routes to appropriate handlers.
 */
export const useDeepLinkRouter = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { isHydrated } = useStore();
  const { isAuthenticated } = useAuth();

  // Queue for deep link actions that arrive before app is ready
  const {
    pendingDeepLinkAction,
    setPendingDeepLinkAction,
    clearPendingDeepLinkAction,
  } = useStore();

  const handleEmailVerification = useCallback(
    (token: string) => {
      logger.info('Handling email verification deep link', {
        token: token.substring(0, 8) + '...',
      });

      if (!isAuthenticated) {
        // Store token and redirect to auth for login first
        setPendingDeepLinkAction({
          type: 'email_verification',
          token,
          timestamp: Date.now(),
        });
        navigation.navigate('Auth');
        return;
      }

      // User is authenticated, proceed with verification
      navigation.navigate('EmailVerification', { token });
    },
    [isAuthenticated, navigation, setPendingDeepLinkAction],
  );

  const handlePasswordReset = useCallback(
    (token: string) => {
      logger.info('Handling password reset deep link', {
        token: token.substring(0, 8) + '...',
      });

      // Always redirect to auth stack for password reset
      // This will clear any existing auth state
      navigation.navigate('ResetPassword', { token });
    },
    [navigation],
  );

  const handleAcceptInvitation = useCallback(
    (token: string) => {
      logger.info('Handling accept invitation deep link', {
        token: token.substring(0, 8) + '...',
      });

      if (!isAuthenticated) {
        // Store token and redirect to auth for login first
        setPendingDeepLinkAction({
          type: 'accept_invitation',
          token,
          timestamp: Date.now(),
        });
        navigation.navigate('Auth');
        return;
      }

      // User is authenticated, proceed with invitation
      navigation.navigate('AcceptInvitation', { token });
    },
    [isAuthenticated, navigation, setPendingDeepLinkAction],
  );

  const routeDeepLink = useCallback(
    (action: DeepLinkAction) => {
      const { type, token } = action;

      switch (type) {
        case 'email_verification':
          handleEmailVerification(token);
          break;
        case 'password_reset':
          handlePasswordReset(token);
          break;
        case 'accept_invitation':
          handleAcceptInvitation(token);
          break;
        default:
          logger.warn('Unknown deep link action type', { type });
      }
    },
    [handleEmailVerification, handlePasswordReset, handleAcceptInvitation],
  );

  // Process pending deep link actions when conditions are met
  useEffect(() => {
    if (!isHydrated || !pendingDeepLinkAction) {
      return;
    }

    // Check if the action is too old (5 minutes)
    const fiveMinutes = 5 * 60 * 1000;
    if (Date.now() - pendingDeepLinkAction.timestamp > fiveMinutes) {
      logger.warn('Discarding stale deep link action', {
        action: pendingDeepLinkAction,
      });
      clearPendingDeepLinkAction();
      return;
    }

    // For email verification and invitations, wait until user is authenticated
    if (
      (pendingDeepLinkAction.type === 'email_verification' ||
        pendingDeepLinkAction.type === 'accept_invitation') &&
      !isAuthenticated
    ) {
      return; // Wait for authentication
    }

    // Process the pending action
    logger.info('Processing pending deep link action', {
      action: pendingDeepLinkAction,
    });
    routeDeepLink(pendingDeepLinkAction);
    clearPendingDeepLinkAction();
  }, [
    isHydrated,
    pendingDeepLinkAction,
    isAuthenticated,
    routeDeepLink,
    clearPendingDeepLinkAction,
  ]);

  // Public API for triggering deep link actions
  const triggerDeepLinkAction = useCallback(
    (action: DeepLinkAction) => {
      if (!isHydrated) {
        // Queue the action if app isn't ready
        setPendingDeepLinkAction(action);
        return;
      }

      // Process immediately if app is ready
      routeDeepLink(action);
    },
    [isHydrated, setPendingDeepLinkAction, routeDeepLink],
  );

  return {
    triggerDeepLinkAction,
    handleEmailVerification,
    handlePasswordReset,
    handleAcceptInvitation,
    pendingDeepLinkAction,
  };
};
