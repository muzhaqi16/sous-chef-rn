import { useEffect } from 'react';
import { useTranslation } from '#/i18n';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useIsLoggedOut } from '#hooks/auth/useIsLoggedOut';
import { useStore } from '#store';
import { toastService } from '#/services/toastService';

type JoinLinkType = 'join_home' | 'join_list';

const SIGN_IN_MESSAGE_KEY: Record<JoinLinkType, string> = {
  join_home: 'joinLink.signInHome',
  join_list: 'joinLink.signInList',
};

/**
 * Auth gate for the anyone-with-link join screens: a logged-out visitor's code
 * is queued as a pending deep-link action and replayed by `useDeepLinkRouter`
 * after sign-in. Returns `isLoggedOut` so the screen can show a loader and skip
 * its auth-only queries while the redirect happens.
 */
export function useJoinLinkAuthGate(type: JoinLinkType, code: string): boolean {
  const { t } = useTranslation();
  const { toAuth } = useAppNavigation();
  const isLoggedOut = useIsLoggedOut();

  useEffect(() => {
    if (!isLoggedOut) {
      return;
    }
    if (code) {
      useStore.getState().setPendingDeepLinkAction({
        type,
        code,
        timestamp: Date.now(),
      });
      toastService.info(t(SIGN_IN_MESSAGE_KEY[type]));
    }
    toAuth();
  }, [isLoggedOut, code, type, toAuth, t]);

  return isLoggedOut;
}
