import { useEffect } from 'react';
import { useAppStore, useIsHydrated } from '#store/useAppStore';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { logger } from '#/utils/environment';
import type { DeepLinkAction } from '#store/slices/navigationSlice';
import { toastService } from '#/services/toastService';
import { t, type TranslationKey } from '#/i18n';

const STALE_AFTER_MS = 5 * 60 * 1000;

const STALE_MESSAGE_KEY: Record<DeepLinkAction['type'], TranslationKey> = {
  join_home: 'joinLink.staleHome',
  join_list: 'joinLink.staleList',
};

/**
 * Replays the join link `useJoinLinkAuthGate` queued for a logged-out visitor
 * once they sign in. Token links (verify, reset, invite) reach their screens
 * through the linking config instead.
 */
export const useDeepLinkRouter = (): void => {
  const { toJoinHomeByCode, toJoinByShareCode } = useAppNavigation();
  const isHydrated = useIsHydrated();
  const isAuthenticated = useAppStore(
    state => !!(state.user && state.accessToken),
  );
  const pendingDeepLinkAction = useAppStore(
    state => state.pendingDeepLinkAction,
  );
  const clearPendingDeepLinkAction = useAppStore(
    state => state.clearPendingDeepLinkAction,
  );

  useEffect(() => {
    if (!isHydrated || !pendingDeepLinkAction) {
      return;
    }
    const action = pendingDeepLinkAction;

    if (Date.now() - action.timestamp > STALE_AFTER_MS) {
      logger.warn('Discarding stale deep link action', { action });
      toastService.warning(t(STALE_MESSAGE_KEY[action.type]));
      clearPendingDeepLinkAction();
      return;
    }

    if (!isAuthenticated) {
      return;
    }

    logger.info('Processing pending deep link action', { action });
    if (action.type === 'join_home') {
      toJoinHomeByCode(action.code);
    } else {
      toJoinByShareCode(action.code);
    }
    clearPendingDeepLinkAction();
  }, [
    isHydrated,
    pendingDeepLinkAction,
    isAuthenticated,
    clearPendingDeepLinkAction,
    toJoinHomeByCode,
    toJoinByShareCode,
  ]);
};
