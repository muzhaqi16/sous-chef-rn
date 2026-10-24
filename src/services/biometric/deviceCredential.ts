/**
 * Biometric sign-in on this device: a server-issued device credential behind
 * biometry, never the password. The session core reaches it only through the
 * steps `src/app/mobileSessionHost.ts` registers.
 */

import { requireApolloClient } from '#/apollo/clientRegistry';
import {
  MyDeviceCredentialsDocument,
  RevokeDeviceCredentialDocument,
} from '#operations/auth/auth.generated';
import type { LoginUserFragment } from '#operations/auth/userFragments.generated';
import { authService } from '#/services/authService';
import { ensureDeviceId } from '#/services/auth/deviceId';
import type {
  PostSignInGate,
  StoredSignInRenewal,
} from '#/services/auth/sessionHost';
import { toastService } from '#/services/toastService';
import { useStore } from '#store';
import { isApiUnavailable } from '#store/slices/networkSlice';
import { t } from '#/i18n';
import { logger } from '#/utils/environment';
import { withinMs } from '#/utils/withinMs';
import {
  getBiometricCapability,
  getLastBiometricEmail,
  hasCredentials,
} from '#native/storage/keychain';
import {
  checkStoredCredentials,
  getBiometricInfo,
  loadStoredCredentials,
  markDeviceCredential,
  readDeviceCredential,
  removeCredentials,
  storeCredentials,
} from './credentials';

/** Longest a best-effort revoke may hold the sign-out. */
const REVOKE_BUDGET_MS = 3000;

/**
 * Whether the server still honours this device's credential, asked with the
 * sign-in's own token. `null` when it can't be asked: dropping a working
 * sign-in over a flaky network is worse than offering setup late.
 */
async function deviceCredentialIsLive(
  signInToken: string,
): Promise<boolean | null> {
  try {
    const deviceId = await ensureDeviceId();
    if (!deviceId) return null;
    // `no-cache`: this runs before the session commits, so nothing it reads
    // belongs in the cache yet.
    const listed = await requireApolloClient().query({
      query: MyDeviceCredentialsDocument,
      fetchPolicy: 'no-cache',
      context: { signInToken },
    });
    if (!listed.data) return null;
    return listed.data.deviceCredentials.some(
      credential => credential.deviceId === deviceId,
    );
  } catch (error) {
    logger.warn('Could not check the device credential', error);
    return null;
  }
}

async function shouldShowPostLoginBiometricPrompt(
  targetUser: {
    id: string;
    email?: string | null;
  },
  signInToken: string,
): Promise<{ shouldShow: boolean; reason?: string }> {
  // Keychain entries are namespaced by email, so an account with no readable
  // email can't be matched against stored credentials.
  const accountEmail = targetUser.email;
  if (!targetUser.id || !accountEmail) {
    return { shouldShow: false, reason: 'No user found' };
  }

  const store = useStore.getState();
  const navState = store.getUserNavigationState(targetUser.id);

  if (navState?.isNewUser && !navState.hasCompletedOnboarding) {
    return {
      shouldShow: false,
      reason: 'New user - biometric setup handled during onboarding',
    };
  }

  try {
    const biometricInfo = await getBiometricCapability();
    if (!biometricInfo.isAvailable) {
      return { shouldShow: false, reason: 'Biometric not available' };
    }

    // A password change or reset revokes the credential server-side and tells
    // no device, so a slot is only trusted once the server lists it.
    if (await hasCredentials(accountEmail)) {
      if ((await deviceCredentialIsLive(signInToken)) !== false) {
        return { shouldShow: false, reason: 'Already has biometric setup' };
      }
      logger.warn('Stored device credential was revoked; offering setup again');
      await removeCredentials(accountEmail);
      forgetBiometricSlot();
    }

    if (navState?.biometricDeclinedPermanently) {
      return {
        shouldShow: false,
        reason: 'User permanently declined biometric authentication',
      };
    }

    return { shouldShow: true };
  } catch {
    return { shouldShow: false, reason: 'Error checking eligibility' };
  }
}

/**
 * Take the biometric affordance down with the slot it offers. The login screen
 * gates its button on `hasStoredCredentials`, so a slot proven unusable stops
 * being offered without waiting for a remount.
 */
function forgetBiometricSlot(): void {
  useStore.getState().setHasStoredCredentials(false);
}

/**
 * The one biometric sign-in path, so the dead-versus-transient rule below is
 * written once.
 */
async function signInWithDeviceCredential(email: string): Promise<boolean> {
  try {
    // Every attempt spends the server's per-device budget, so a refused one is
    // held off rather than re-offered. A DEADLINE, so a relaunch cannot skip it.
    const heldUntil = useStore.getState().biometricRetryAt;
    const waitMs = heldUntil - Date.now();
    if (waitMs > 0) {
      toastService.error(
        t('auth.biometricRetryIn', { count: Math.ceil(waitMs / 1000) }),
      );
      return false;
    }

    const hasStoredCreds = await checkStoredCredentials(email);
    if (!hasStoredCreds) {
      logger.info('No stored credentials found for auto-login');
      // The affordance outlives the slot: it is rendered from a flag the clear
      // below does not reach, so say why and take the button away.
      forgetBiometricSlot();
      toastService.error(t('auth.biometricNeedsSetupAgain'));
      return false;
    }

    const stored = await loadStoredCredentials(email);
    // Dismissing the prompt is choosing the password; nothing went wrong.
    if (stored.status === 'cancelled') return false;
    if (stored.status === 'unavailable') {
      logger.info('Failed to load stored credentials');
      toastService.error(t('auth.biometricUnavailableOnDevice'));
      return false;
    }

    // A slot older than device credentials holds a PASSWORD: dropped, never
    // replayed, and the person re-enrols on their next password sign-in.
    const credential =
      stored.credential && readDeviceCredential(stored.credential);
    if (!stored.email || !credential) {
      logger.warn('Biometric slot predates the device credential; clearing it');
      await removeCredentials(email);
      forgetBiometricSlot();
      toastService.error(t('auth.biometricNeedsSetupAgain'));
      return false;
    }

    // A credential is bound to a device id, so an exchange without one cannot
    // succeed. Deliberately not cleared: the slot is fine, the device is not.
    const deviceId = await ensureDeviceId();
    if (!deviceId) {
      logger.warn('No device id available; skipping the credential exchange');
      toastService.error(t('auth.biometricUnavailableOnDevice'));
      return false;
    }

    logger.info('Exchanging the stored device credential');
    const exchange = await authService.exchangeDeviceCredential(
      credential,
      deviceId,
    );
    switch (exchange.status) {
      case 'signedIn':
        useStore.getState().clearBiometricBackoff();
        logger.info('Auto-login successful');
        return true;
      case 'dead':
        logger.warn('Auto-login refused the credential; clearing the slot');
        await removeCredentials(email);
        forgetBiometricSlot();
        return false;
      case 'incomplete':
      case 'refused':
        // The slot survives, so the button is offered again — hold it off, or
        // every tap spends another of the server's attempts for nothing.
        useStore.getState().registerBiometricRefusal();
        return false;
      case 'failed':
        logger.warn('Auto-login failed; stored credentials kept');
        useStore.getState().registerBiometricRefusal(exchange.retryAfterMs);
        return false;
      case 'unreachable':
        // A lockout recorded here is PERSISTED and not session-scoped, so one
        // launch without connectivity would outlast the outage that caused it.
        logger.warn('Auto-login could not reach the server; nothing recorded');
        return false;
      case 'discarded':
        return false;
    }
  } catch (error) {
    // Deliberately does NOT clear. A throw here is a transport or client fault,
    // never the server saying these credentials are dead — and the branches
    // above already handle the one case that is.
    logger.error('Auto-login error:', error);
    toastService.error(t('errors.codes.genericRetry'));
    return false;
  }
}

/**
 * Paired with DROPPING the local slot, so a secret lifted off the device is
 * already dead; never on a sign-out that KEEPS it. Best effort: a failure costs
 * the server a stale row, not the person a working sign-in.
 */
async function revokeDeviceCredentialForThisDevice(): Promise<boolean> {
  // With the API unreachable there is nothing to revoke against, and httpLink's
  // abort plus retryLink's attempts would otherwise hold the sign-out for ~30s
  // on the one path where the person is trying to leave the device.
  if (isApiUnavailable(useStore.getState())) return false;
  try {
    // `DeviceCredential.deviceId` is non-null, so a null here matches nothing
    // and the revoke would resolve having done nothing at all.
    const deviceId = await ensureDeviceId();
    if (!deviceId) {
      logger.warn('No device id available; cannot revoke this device');
      return false;
    }

    // Both round trips belong to the sign-out, whose session-ending gate can
    // close before they finish on a slow link — without the opt-in `authLink`
    // refuses the cleanup the sign-out is waiting for.
    const listed = await requireApolloClient().query({
      query: MyDeviceCredentialsDocument,
      fetchPolicy: 'network-only',
      context: { allowDuringLogout: true },
    });
    // A failed listing resolves with no data; it is not "nothing to revoke".
    if (!listed.data) return false;
    const mine = listed.data.deviceCredentials.find(
      credential => credential.deviceId === deviceId,
    );
    if (!mine) return true;

    const revoked = await requireApolloClient().mutate({
      mutation: RevokeDeviceCredentialDocument,
      variables: { input: { id: mine.id } },
      context: { allowDuringLogout: true },
    });
    // A refusal is a union member resolved as data, so the absence of a throw
    // is not a revoke: the credential stays exchangeable while the local slot
    // is dropped.
    return (
      revoked.data?.revokeDeviceCredential.__typename ===
      'RevokeDeviceCredentialPayload'
    );
  } catch (error) {
    logger.warn('Could not revoke the device credential server-side', error);
    return false;
  }
}

/** The revoke, bounded. A slow network must not hold the local sign-out. */
async function revokeWithinBudget(): Promise<void> {
  const revoked = await withinMs(
    revokeDeviceCredentialForThisDevice(),
    REVOKE_BUDGET_MS,
    false,
  );
  // The local slot goes either way, so this is a stale server row rather than a
  // sign-in the person loses — but it is a secret still exchangeable.
  if (!revoked) {
    logger.warn('The device credential may still be live server-side');
  }
}

/**
 * `refused` was already reported by the auth handlers; `unsaved` (no device id,
 * keychain failure) was not, so the caller says so in its own words.
 */
export type EnrolOutcome = 'enrolled' | 'refused' | 'unsaved';

/**
 * Puts a server-issued device credential behind biometry, from the live
 * session alone, so no password is retained. Issuing supersedes any credential
 * this device already held.
 */
async function enrolDeviceCredential(email: string): Promise<EnrolOutcome> {
  try {
    const deviceId = await ensureDeviceId();
    if (!deviceId) {
      logger.warn('No device id available; not issuing a device credential');
      return 'unsaved';
    }

    const issued = await authService.issueDeviceCredential(deviceId);
    if (issued.status === 'refused') return 'refused';

    const stored = await storeCredentials(
      email,
      markDeviceCredential(issued.credential),
    );
    return stored ? 'enrolled' : 'unsaved';
  } catch (error) {
    logger.error('Enrol device credential error:', error);
    return 'unsaved';
  }
}

/**
 * Offered only when biometrics are unavailable. Not to a user who refused
 * them: saving credentials enrols them into the biometric-protected slot.
 */
async function shouldOfferRememberMe(
  userId: string,
  email: string,
): Promise<boolean> {
  let biometricAvailable = false;
  try {
    const capability = await getBiometricCapability();
    biometricAvailable = capability.isAvailable;
  } catch {
    logger.error('Error checking biometric capability');
  }

  const navState = useStore.getState().getUserNavigationState(userId);
  if (biometricAvailable || navState?.biometricDeclinedPermanently) {
    return false;
  }
  const hasStoredCreds = await checkStoredCredentials(email);
  return !hasStoredCreds && !navState?.credentialPromptDeclined;
}

/** Biometric enrolment for an eligible account, else the remember-me offer. */
export async function resolvePostSignInGate(
  user: LoginUserFragment,
  email: string,
  offerRememberMe: boolean,
  signInToken: string,
): Promise<PostSignInGate> {
  let offerBiometrics = false;
  try {
    const biometricResult = await shouldShowPostLoginBiometricPrompt(
      user,
      signInToken,
    );
    offerBiometrics = biometricResult.shouldShow;
  } catch {
    logger.error('Error checking biometric eligibility');
  }
  if (offerBiometrics) return 'biometricSetup';
  if (offerRememberMe && (await shouldOfferRememberMe(user.id, email))) {
    return 'rememberMe';
  }
  return null;
}

/**
 * A password change revokes every device credential, so a slot kept through
 * one is issued again; one that can't be is dropped rather than left to fail.
 */
export async function renewStoredSignIn(
  email: string,
): Promise<StoredSignInRenewal> {
  if (!(await hasCredentials(email))) return 'none';
  if ((await enrolDeviceCredential(email)) === 'enrolled') return 'renewed';
  logger.warn('Could not renew the device credential; dropping the slot');
  await removeCredentials(email);
  forgetBiometricSlot();
  return 'dropped';
}

/**
 * The one way a stored sign-in is removed, by a sign-out or by Settings; false
 * while the slot is still there. Credentials are per account, so this never
 * touches another user's. Server first, while the session that authorises it
 * is still live: the local delete cannot be undone, so a revoke attempted after
 * it would have nothing left to authenticate with.
 */
export async function forgetStoredSignIn(email: string): Promise<boolean> {
  await revokeWithinBudget();
  // READ, not discarded: a failed delete leaves this account's device
  // credential on the device — the exact state this call exists to prevent.
  const removed = await removeCredentials(email);
  if (!removed) {
    logger.error(
      'Biometric credentials could not be removed; this account may still be unlockable on this device',
    );
    return false;
  }
  forgetBiometricSlot();
  return true;
}

export const biometricService = {
  enrolDeviceCredential,
  forgetStoredSignIn,
  revokeDeviceCredentialForThisDevice,
  signInWithDeviceCredential,
  checkStoredCredentials,
  loadStoredCredentials,
  getBiometricInfo,
  getLastBiometricEmail,
};
