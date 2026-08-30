import { useTranslation } from '#/i18n';
import {
  useAppStore,
  useUserId,
  useHasUnverifiedEmail,
} from '#store/useAppStore';
import { alertService } from '#/services/alertService';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';

/**
 * The post-login gate is a headerless conditional group at the root navigator,
 * so an account that never receives its code has no way out. `skipVerification`
 * sets the per-user flag `resolveNavTarget` reads. Deliberately no counterpart:
 * clearing it swaps the navigator group and strands the user on the sign-in gate.
 */
export function useEmailVerificationActions() {
  const userId = useUserId();
  const setUserNavigationState = useAppStore(
    state => state.setUserNavigationState,
  );

  const skipVerification = () => {
    if (!userId) return;
    setUserNavigationState(userId, { verificationSkipped: true });
  };

  return { skipVerification };
}

/**
 * Gate for actions that share data with other people. Call
 * `requireVerifiedEmail()` at the top of the handler. CLIENT-SIDE ONLY — an
 * unverified account holds real tokens and the API accepts these mutations, so
 * this is UX, not a security boundary.
 */
export function useVerifiedEmailGate() {
  const { t } = useTranslation();
  const hasUnverifiedEmail = useHasUnverifiedEmail();
  const { toVerifyEmail } = useAppNavigation();

  const requireVerifiedEmail = (): boolean => {
    if (!hasUnverifiedEmail) return true;

    alertService.alert(
      t('auth.verifyToCollaborateTitle'),
      t('auth.verifyToCollaborateMessage'),
      [
        { text: t('labels.cancel'), style: 'cancel' },
        { text: t('auth.verifyNow'), onPress: toVerifyEmail },
      ],
    );
    return false;
  };

  return { requireVerifiedEmail, hasUnverifiedEmail };
}
