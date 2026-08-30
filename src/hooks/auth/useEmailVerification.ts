import { useTranslation } from '#/i18n';
import {
  useAppStore,
  useUserId,
  useHasUnverifiedEmail,
} from '#store/useAppStore';
import { alertService } from '#/services/alertService';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';

/**
 * Deferring email verification.
 *
 * The post-login gate is a conditional group at the root navigator holding a
 * single headerless screen, so an account that never receives its code has no
 * way out. `skipVerification` sets the per-user flag that `resolveNavTarget`
 * reads, letting the account through to the rest of the app.
 *
 * There is deliberately no `resumeVerification` counterpart. Re-opening
 * verification from inside the app used to clear the flag and set the
 * navigation state back to `verification`, which swapped the whole navigator
 * group — so the user landed on the sign-in GATE: its back button signed them
 * out, and verifying successfully remounted the MainApp group at its initial
 * route, dropping them on Home instead of the screen they came from. A user
 * who is already inside the app has a session and somewhere to return to, so
 * verification there is a pushed screen (`toVerifyEmail`) and the flag is
 * never touched.
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
