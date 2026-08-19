import { useTranslation } from '#/i18n';
import {
  useAppStore,
  useUserId,
  useHasUnverifiedEmail,
} from '#store/useAppStore';
import { alertService } from '#/services/alertService';

/**
 * Deferring and resuming email verification.
 *
 * Verification is a conditional group at the root navigator holding a single
 * headerless screen, so an account that never receives its code has no way out.
 * `skipVerification` sets the per-user flag that `resolveNavTarget` reads,
 * letting the account through to the rest of the app; `resumeVerification`
 * clears it and routes back. Because the target is derived from the same flag,
 * clearing it on the way in is what keeps the navigator from immediately
 * bouncing the user back out.
 */
export function useEmailVerificationActions() {
  const userId = useUserId();
  const setUserNavigationState = useAppStore(
    state => state.setUserNavigationState,
  );
  const setNavigationState = useAppStore(state => state.setNavigationState);

  const skipVerification = () => {
    if (!userId) return;
    setUserNavigationState(userId, { verificationSkipped: true });
  };

  const resumeVerification = () => {
    if (!userId) return;
    setUserNavigationState(userId, { verificationSkipped: false });
    setNavigationState('verification');
  };

  return { skipVerification, resumeVerification };
}

/**
 * Gate for actions that share data with, or pull in, other people.
 *
 * Call `requireVerifiedEmail()` at the top of the handler: it returns true when
 * the action may proceed, or explains why not and returns false. This is a
 * client-side gate only — an unverified account still holds real access tokens,
 * so the API accepts these mutations today. Server-side enforcement is tracked
 * separately; until it lands, treat this as UX rather than a security boundary.
 */
export function useVerifiedEmailGate() {
  const { t } = useTranslation();
  const hasUnverifiedEmail = useHasUnverifiedEmail();
  const { resumeVerification } = useEmailVerificationActions();

  const requireVerifiedEmail = (): boolean => {
    if (!hasUnverifiedEmail) return true;

    alertService.alert(
      t('auth.verifyToCollaborateTitle'),
      t('auth.verifyToCollaborateMessage'),
      [
        { text: t('labels.cancel'), style: 'cancel' },
        { text: t('auth.verifyNow'), onPress: resumeVerification },
      ],
    );
    return false;
  };

  return { requireVerifiedEmail, hasUnverifiedEmail };
}
