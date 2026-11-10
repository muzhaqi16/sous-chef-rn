import { useEffect } from 'react';
import { useAppStore, useIsHydrated, useIsSignedIn } from '#store/useAppStore';
import { useIsMainApp } from '#hooks/navigation/useNavigationGuards';
import { useNavigationIntents } from '#platform/screen';
import { logger } from '#/utils/environment';
import type { DeepLinkAction } from '#store/slices/navigationSlice';
import { toastService } from '#/services/toastService';
import { t, type TranslationKey } from '#/i18n';

const STALE_AFTER_MS = 5 * 60 * 1000;

const STALE_MESSAGE_KEY: Record<
  Extract<DeepLinkAction, { code: string }>['type'],
  TranslationKey
> = {
  join_home: 'joinLink.staleHome',
  join_list: 'joinLink.staleList',
};

/**
 * Replays the join link `useJoinLinkAuthGate` queued for a logged-out visitor
 * once they sign in, and the recipe tapped on onboarding's payoff once the
 * main app shows. Token links (verify, reset, invite) reach their screens
 * through the linking config instead.
 */
export const useDeepLinkRouter = (): void => {
  const { toJoinHomeByCode, toJoinByShareCode, toRecipeDetail } =
    useNavigationIntents();
  const isHydrated = useIsHydrated();
  const isAuthenticated = useIsSignedIn();
  const isMainApp = useIsMainApp();
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
      // A recipe was the user's own tap a moment ago: no link to explain.
      if (action.type !== 'open_recipe') {
        toastService.warning(t(STALE_MESSAGE_KEY[action.type]));
      }
      clearPendingDeepLinkAction();
      return;
    }

    if (!isAuthenticated) {
      return;
    }

    if (action.type === 'open_recipe') {
      // Opened over Today, which mounts only once onboarding is done.
      if (!isMainApp) return;
      toRecipeDetail({ recipeId: action.recipeId });
      clearPendingDeepLinkAction();
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
    isMainApp,
    clearPendingDeepLinkAction,
    toJoinHomeByCode,
    toJoinByShareCode,
    toRecipeDetail,
  ]);
};
