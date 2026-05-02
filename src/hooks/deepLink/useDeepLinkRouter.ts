import { useEffect } from 'react';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { jwtDecode } from 'jwt-decode';
import { useAppStore } from '#store/useAppStore';
import { logger } from '#/utils/environment';
import { DeepLinkAction } from '#store/slices/navigationSlice';
import { toastService } from '#/services/toastService';

interface DeepLinkTokenPayload {
  exp: number;
  iat: number;
  type?: string;
  [key: string]: any;
}

/**
 * Validates a JWT token for deep links
 *
 * @param token - JWT token string
 * @param expectedType - Optional expected token type for additional validation
 * @returns { valid: boolean, payload?: DeepLinkTokenPayload, error?: string }
 */
const validateDeepLinkToken = (
  token: string,
  expectedType?: string,
): { valid: boolean; payload?: DeepLinkTokenPayload; error?: string } => {
  try {
    // Basic format validation
    if (!token || typeof token !== 'string') {
      return { valid: false, error: 'Invalid token format' };
    }

    // JWT should have 3 parts separated by dots
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { valid: false, error: 'Malformed JWT token' };
    }

    // Decode the token
    const decoded = jwtDecode<DeepLinkTokenPayload>(token);

    // Check expiration
    if (decoded.exp) {
      const now = Math.floor(Date.now() / 1000); // Current time in seconds
      if (decoded.exp < now) {
        return { valid: false, error: 'Token has expired', payload: decoded };
      }
    } else {
      logger.warn('Token does not have expiration field');
    }

    // Check issued at time (token shouldn't be from the future)
    if (decoded.iat) {
      const now = Math.floor(Date.now() / 1000);
      const fiveMinutesFromNow = now + 300; // Allow 5 minute clock skew
      if (decoded.iat > fiveMinutesFromNow) {
        return {
          valid: false,
          error: 'Token issued in the future',
          payload: decoded,
        };
      }
    }

    // Validate token type if specified
    if (expectedType && decoded.type && decoded.type !== expectedType) {
      return {
        valid: false,
        error: `Invalid token type. Expected ${expectedType}, got ${decoded.type}`,
        payload: decoded,
      };
    }

    return { valid: true, payload: decoded };
  } catch (error) {
    logger.error('Token validation error:', error);
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Failed to decode token',
    };
  }
};

/**
 * Hook for handling deep link routing and integration with navigation state machine.
 * Queues deep link actions until app is hydrated and routes to appropriate handlers.
 */
export const useDeepLinkRouter = () => {
  const navigation = useNavigation();
  const isHydrated = useAppStore(state => state.isHydrated);
  const isAuthenticated = useAppStore(
    state => !!(state.user && state.accessToken),
  );

  // Queue for deep link actions that arrive before app is ready
  const pendingDeepLinkAction = useAppStore(
    state => state.pendingDeepLinkAction,
  );
  const setPendingDeepLinkAction = useAppStore(
    state => state.setPendingDeepLinkAction,
  );
  const clearPendingDeepLinkAction = useAppStore(
    state => state.clearPendingDeepLinkAction,
  );

  const handleEmailVerification = (token: string) => {
    logger.info('Handling email verification deep link', {
      token: token.substring(0, 8) + '...',
    });

    // Validate token before proceeding
    const validation = validateDeepLinkToken(token, 'email_verification');
    if (!validation.valid) {
      logger.error('Invalid email verification token:', validation.error);
      toastService.error(
        `Invalid or expired verification link: ${validation.error}`,
      );
      return;
    }

    if (!isAuthenticated) {
      // Store token and redirect to auth for login first
      setPendingDeepLinkAction({
        type: 'email_verification',
        token,
        timestamp: Date.now(),
      });
      navigation.dispatch(CommonActions.navigate('Auth'));
      return;
    }

    // User is authenticated, proceed with verification
    navigation.dispatch(CommonActions.navigate('EmailVerification', { token }));
  };

  const handlePasswordReset = (token: string) => {
    logger.info('Handling password reset deep link', {
      token: token.substring(0, 8) + '...',
    });

    // Validate token before proceeding
    const validation = validateDeepLinkToken(token, 'password_reset');
    if (!validation.valid) {
      logger.error('Invalid password reset token:', validation.error);
      toastService.error(`Invalid or expired reset link: ${validation.error}`);
      return;
    }

    // Always redirect to auth stack for password reset
    // This will clear any existing auth state
    navigation.dispatch(CommonActions.navigate('ResetPassword', { token }));
  };

  const handleAcceptInvitation = (token: string) => {
    logger.info('Handling accept invitation deep link', {
      token: token.substring(0, 8) + '...',
    });

    // Validate token before proceeding
    const validation = validateDeepLinkToken(token, 'invitation');
    if (!validation.valid) {
      logger.error('Invalid invitation token:', validation.error);
      toastService.error(`Invalid or expired invitation: ${validation.error}`);
      return;
    }

    if (!isAuthenticated) {
      // Store token and redirect to auth for login first
      setPendingDeepLinkAction({
        type: 'accept_invitation',
        token,
        timestamp: Date.now(),
      });
      navigation.dispatch(CommonActions.navigate('Auth'));
      return;
    }

    // User is authenticated, proceed with invitation
    navigation.dispatch(CommonActions.navigate('AcceptInvitation', { token }));
  };

  const routeDeepLink = (action: DeepLinkAction) => {
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
  };

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

    // Route deep link inline to avoid dependency on handler functions
    const { type, token } = pendingDeepLinkAction;
    const routeAction = (actionToken: string, actionType: string) => {
      const validation = validateDeepLinkToken(
        actionToken,
        actionType === 'email_verification'
          ? 'email_verification'
          : actionType === 'password_reset'
          ? 'password_reset'
          : 'invitation',
      );
      if (!validation.valid) {
        logger.error(`Invalid ${actionType} token:`, validation.error);
        toastService.error(`Invalid or expired link: ${validation.error}`);
        return;
      }

      if (actionType === 'email_verification') {
        if (!isAuthenticated) {
          setPendingDeepLinkAction({
            type: 'email_verification',
            token: actionToken,
            timestamp: Date.now(),
          });
          navigation.dispatch(CommonActions.navigate('Auth'));
        } else {
          navigation.dispatch(
            CommonActions.navigate('EmailVerification', { token: actionToken }),
          );
        }
      } else if (actionType === 'password_reset') {
        navigation.dispatch(
          CommonActions.navigate('ResetPassword', { token: actionToken }),
        );
      } else if (actionType === 'accept_invitation') {
        if (!isAuthenticated) {
          setPendingDeepLinkAction({
            type: 'accept_invitation',
            token: actionToken,
            timestamp: Date.now(),
          });
          navigation.dispatch(CommonActions.navigate('Auth'));
        } else {
          navigation.dispatch(
            CommonActions.navigate('AcceptInvitation', { token: actionToken }),
          );
        }
      } else {
        logger.warn('Unknown deep link action type', { type: actionType });
      }
    };

    routeAction(token, type);
    clearPendingDeepLinkAction();
  }, [
    isHydrated,
    pendingDeepLinkAction,
    isAuthenticated,
    clearPendingDeepLinkAction,
    navigation,
    setPendingDeepLinkAction,
  ]);

  // Public API for triggering deep link actions
  const triggerDeepLinkAction = (action: DeepLinkAction) => {
    if (!isHydrated) {
      // Queue the action if app isn't ready
      setPendingDeepLinkAction(action);
      return;
    }

    // Process immediately if app is ready
    routeDeepLink(action);
  };

  return {
    triggerDeepLinkAction,
    handleEmailVerification,
    handlePasswordReset,
    handleAcceptInvitation,
    pendingDeepLinkAction,
  };
};
