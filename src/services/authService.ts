/**
 * The single source of truth for login/register/logout business logic, as a
 * non-React service. Every dependency is a singleton: the Apollo client,
 * toastService, errorService, the Zustand store via `getState()`, and keychain.
 */

import { client } from '#/apollo/client';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import { LogoutCleanup } from '#/apollo/logoutCleanup';
import { queueManager } from '#/apollo/offlineQueue/queueManager';
import { queueStore } from '#/apollo/offlineQueue/queueStore';
import { errorService } from '#/services/errorService';
import { toastService } from '#/services/toastService';
import { useStore } from '#store';
import { logger } from '#/utils/environment';
import { isDeadCredentialCode } from '#/utils/authErrorCodes';
import { isSuccessPayload } from '#/utils/errors/mutationPayload';
import { incrementLoginCount } from '#/hooks/useFeatureHint';
import {
  ExchangeDeviceCredentialDocument,
  IssueDeviceCredentialDocument,
  LoginDocument,
  MyDeviceCredentialsDocument,
  RegisterDocument,
  RevokeDeviceCredentialDocument,
} from '#operations/auth/auth.generated';
import { getDeviceId } from '#/storage/deviceId';
import {
  LoginUserFragmentDoc,
  type LoginUserFragment,
} from '#operations/auth/userFragments.generated';
import {} from '#operations/auth/device.generated';
import {
  type LoginInput,
  type RegisterInput,
} from '#/graphql/generated/schemaTypes';
import {} from '#/services/push/pushTokenProvider';
import {
  hasCredentials,
  getBiometricCapability,
  getLastBiometricEmail,
} from '#/storage/keychain';
import { t } from '#/i18n';
import { localizedRefusalMessage } from '#/apollo/utils/alertRejectedMutation';
import {
  deregisterDeviceOnLogout,
  registerDeviceInBackground,
} from '#/services/auth/deviceRegistration';
import {
  checkStoredCredentials,
  getAvailableAccounts,
  getBiometricInfo,
  loadStoredCredentials,
  markDeviceCredential,
  readDeviceCredential,
  removeCredentials,
  storeCredentials,
} from '#/services/auth/credentials';

// --- Store bootstrap (pre-populate Zustand from auth response) ---

function bootstrapUserStore(user: LoginUserFragment): void {
  const storeState = useStore.getState();
  if (user.defaultHomeId) {
    const pantries = user.defaultHome?.pantriesConnection?.edges;
    const defaultPantry =
      pantries?.find(e => e.node.isDefault)?.node ?? pantries?.[0]?.node;
    const pantryId = defaultPantry?.id ?? null;

    storeState.setHomeAndPantry(user.defaultHomeId, pantryId);
    // Raised without a cache check because this pair IS the server's answer,
    // from the login response — not a restored selection.
    if (pantryId) {
      storeState.setIsHomeSelectionReady(true);
    }
  }
  if (user.defaultShoppingListId) {
    storeState.setSelectedShoppingListId(user.defaultShoppingListId);
  }

  // Seeded before any screen's tutorial hooks mount, so a user who disabled
  // tutorials sees no flash of coach marks on a new device. Only this master
  // switch syncs; per-screen completion (feature_hint_shown_*) stays local.
  if (user.settings) {
    useStore.getState().setShowTutorials(user.settings.showTutorials);
  }
}

// --- User preferences helpers (direct Zustand access) ---

function getUserPreferences(userId?: string) {
  const store = useStore.getState();
  const targetUserId = userId || store.user?.id;
  if (!targetUserId) return null;

  return {
    userId: targetUserId,
    navState: store.getUserNavigationState(targetUserId),
    shouldShowCredentialPrompt: () => {
      const navState = store.getUserNavigationState(targetUserId);
      return !navState?.credentialPromptDeclined;
    },
    trackCredentialPromptShown: () => {
      store.setUserNavigationState(targetUserId, {
        lastCredentialPromptShown: Date.now(),
      });
    },
    clearRegistrationPreferences: () => {
      store.setUserNavigationState(targetUserId, {
        credentialPromptDeclined: false,
        biometricDeclinedPermanently: false,
      });
    },
    trackLogout: () => {
      store.setUserNavigationState(targetUserId, {
        biometricEnabled: false,
      });
    },
  };
}

// The masked AuthPayload resolved into a plain LoginUser via the Apollo cache.
interface ResolvedAuthPayload {
  accessToken: string;
  refreshToken: string;
  user: LoginUserFragment;
}

// Resolve the masked AuthPayload.user ref into a plain LoginUser by reading
// from the Apollo cache. The mutation has already written the user entity to
// the normalized cache, so this read is synchronous.
function unmaskAuthPayload<
  T extends {
    accessToken: string;
    refreshToken: string;
    user: { __typename: 'User'; id: string };
  },
>(payload: T): ResolvedAuthPayload | null {
  const user = client.cache.readFragment<LoginUserFragment>({
    fragment: LoginUserFragmentDoc,
    fragmentName: 'LoginUser',
    from: payload.user,
  });
  if (!user) return null;
  return {
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
    user,
  };
}

// --- Core auth operations ---

function handleAuthError(error: unknown, operation = 'Authentication'): void {
  try {
    const { message, code, isAuthError } = errorService.handleApolloError(
      error,
      {
        operation,
        logError: true,
      },
    );

    toastService.error(message);

    // `clearAuth`, deliberately NOT `endSession` as the link layer does for the
    // same codes: this is a refused attempt to START a session, so a full reset
    // would drop selected-entity ids (breaking verification resume) for nothing.
    if (
      isAuthError &&
      (code === ErrorCode.AuthTokenExpired ||
        code === ErrorCode.AuthRefreshTokenInvalid)
    ) {
      useStore.getState().clearAuth();
    }
  } catch {
    toastService.error(t('errors.codes.genericRetry'));
  }
  useStore.getState().setAuthIsLoading(false);
}

// A non-success member of LoginResult. It resolves 200 with no transport
// error, so surface it the way handleAuthError surfaces transport failures —
// a toast — and stay on the sign-in screen. The code is mapped through the
// shared friendly-message table so a refusal reads the same here as it does
// when the identical condition arrives as a top-level error; the server's own
// message is only the fallback.
function handleRejectedAuthPayload(
  payload: { code: string; message: string },
  operation: string,
): void {
  logger.warn(`${operation} rejected by the server: ${payload.code}`);
  // The FALLBACK must be the app's own copy, not the payload's. Passing
  // `payload.message` meant any code missing from the suffix table displayed
  // the server's English — the table is total now, but the fallback is where
  // the next gap would have surfaced.
  toastService.error(
    errorService.getUserFriendlyMessage(
      payload.code,
      t('errors.codes.genericRetry'),
    ),
  );
  useStore.getState().setAuthIsLoading(false);
}

async function handleLogin(
  loginResponse: ResolvedAuthPayload,
  shouldRemember?: boolean,
  loginCredentials?: { email: string },
  showRememberPrompt = false,
): Promise<boolean> {
  if (!loginResponse?.user) return false;

  const { user, accessToken, refreshToken } = loginResponse;
  const store = useStore.getState();
  const previousUserId = queueStore.getCurrentUserId();

  // Resolve the post-login gates BEFORE mutating auth state. RootNavigator
  // derives its target route from `user`; if we set auth first and then resolve
  // these (async) checks, the navigator briefly routes to main_app and flashes
  // the home screen behind the gate. Deciding first lets us commit auth + the
  // final navigation state together.
  let showBiometricGate = false;
  if (loginCredentials && user.emailVerified && user.onBoarded) {
    try {
      const biometricResult = await shouldShowPostLoginBiometricPrompt(user);
      showBiometricGate = biometricResult.shouldShow;
    } catch {
      logger.error('Error checking biometric eligibility');
    }
  }

  // The no-biometrics fallback: offer to save credentials only when biometrics
  // are unavailable, nothing is stored yet, and the user has not declined.
  let showRememberMeGate = false;
  if (
    showRememberPrompt &&
    !showBiometricGate &&
    loginCredentials &&
    user.emailVerified &&
    user.onBoarded
  ) {
    const hasStoredCreds = await checkStoredCredentials(loginCredentials.email);
    const prefs = getUserPreferences(user.id);
    showRememberMeGate =
      !hasStoredCreds && !!prefs?.shouldShowCredentialPrompt();
  }

  // Set auth state
  store.setAuth(user, accessToken, refreshToken);
  queueManager.onUserChange(user.id, previousUserId);
  bootstrapUserStore(user);

  if (shouldRemember !== undefined) {
    store.setRememberMe(shouldRemember);
  }

  if (user.id) {
    store.setUserNavigationState(user.id, {
      lastLoginTimestamp: Date.now(),
      rememberMeChoice: shouldRemember,
    });
  }

  logger.info('Auth success: Login successful');
  requestIdleCallback(() => registerDeviceInBackground());
  incrementLoginCount(user.id);

  // Navigation flow control
  if (!user.emailVerified) {
    // A previous session's "skip for now" doesn't carry into a fresh login —
    // prompt once more, and let them skip again if the email still hasn't
    // arrived. Clearing it here also keeps this in step with resolveNavTarget,
    // which would otherwise immediately route past the screen we just set.
    store.setUserNavigationState(user.id, { verificationSkipped: false });
    store.setNavigationState('verification');
    return false;
  }
  if (!user.onBoarded) {
    store.setNavigationState('onboarding');
    return false;
  }

  // Eligible returning user → route to the dedicated biometric enrollment
  // screen (the `biometric_setup` nav state) instead of straight to main_app,
  // so it renders as its own step, not a modal over PantryMain.
  if (showBiometricGate && loginCredentials) {
    store.setPostLoginCredentials(loginCredentials);
    store.setShowBiometricSetup(true);
    store.setNavigationState('biometric_setup');
    return true;
  }

  // RememberMe fallback → stash credentials and stay on the auth screen so
  // LoginScreen surfaces the RememberMe modal. We intentionally do NOT navigate
  // to main_app here; LoginScreen transitions there once the user responds (and
  // RootNavigator's postLoginCredentials guard keeps the user-change effect
  // from forcing main_app in the meantime).
  if (showRememberMeGate && loginCredentials) {
    store.setPostLoginCredentials(loginCredentials);
    getUserPreferences(user.id)?.trackCredentialPromptShown();
    return true;
  }

  store.setNavigationState('main_app');
  return false;
}

// --- Biometric prompting (moved from useBiometricPrompting, only the check logic) ---

async function shouldShowPostLoginBiometricPrompt(targetUser: {
  id: string;
  email?: string | null;
}): Promise<{ shouldShow: boolean; reason?: string }> {
  // Keychain entries are namespaced by email, so an account with no readable
  // email can't be matched against stored credentials.
  const accountEmail = targetUser?.email;
  if (!targetUser?.id || !accountEmail) {
    return { shouldShow: false, reason: 'No user found' };
  }

  const store = useStore.getState();
  const navState = store.getUserNavigationState(targetUser.id);

  if (navState?.isNewUser && !navState?.hasCompletedOnboarding) {
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

    const hasCreds = await hasCredentials(accountEmail);
    if (hasCreds) {
      return { shouldShow: false, reason: 'Already has biometric setup' };
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

// --- Public API ---

async function login(
  input: LoginInput,
  options?: { showRememberPrompt?: boolean },
): Promise<boolean> {
  const showRememberPrompt = options?.showRememberPrompt ?? true;
  const store = useStore.getState();
  store.setAuthIsLoading(true);

  try {
    const result = await client.mutate({
      mutation: LoginDocument,
      variables: { input },
    });

    const payload = result.data?.login;

    if (isSuccessPayload(payload, 'AuthPayload')) {
      // Only the email travels past the mutation: every downstream gate
      // identifies the account, and enrolment authorises off the session.
      const loginCredentials = { email: input.email };

      const unmaskedLogin = unmaskAuthPayload(payload);
      if (unmaskedLogin) {
        // handleLogin owns all post-login routing — verification, onboarding,
        // the biometric gate, and the RememberMe gate (driven by
        // showRememberPrompt) — so navigation is decided in one place.
        await handleLogin(
          unmaskedLogin,
          true,
          loginCredentials,
          showRememberPrompt,
        );
      }

      store.setAuthIsLoading(false);
      return true;
    }

    if (payload) {
      handleRejectedAuthPayload(payload, 'Login');
      return false;
    }

    if (result.error) {
      handleAuthError(result.error);
      store.setAuthIsLoading(false);
      return false;
    }

    store.setAuthIsLoading(false);
    return false;
  } catch (error) {
    handleAuthError(error);
    store.setAuthIsLoading(false);
    return false;
  }
}

async function register(
  input: RegisterInput,
  shouldRemember = true,
): Promise<boolean> {
  const store = useStore.getState();
  store.setAuthIsLoading(true);

  try {
    const result = await client.mutate({
      mutation: RegisterDocument,
      variables: { input },
    });

    const payload = result.data?.register;

    if (isSuccessPayload(payload, 'RegisterPayload')) {
      // Registration is verification-first and existence-blind: the API sends
      // an activation email and issues NO tokens. Do NOT set auth here — the
      // user activates via the emailed link, then logs in.
      if (shouldRemember !== undefined) {
        store.setRememberMe(shouldRemember);
      }

      logger.info('Registration successful: verification email sent');
      store.setAuthIsLoading(false);
      return true;
    }

    if (payload) {
      // Non-success union member (ValidationError / ConflictError /
      // ForbiddenError / NotFoundError). It resolves 200 with no transport
      // error, so surface it the way handleAuthError surfaces transport
      // failures — a toast — and stay on the sign-up screen. In the app's own
      // words: the payload's `message` is unlocalizable English.
      toastService.error(
        localizedRefusalMessage(payload, t('errors.codes.genericRetry')),
      );
      store.setAuthIsLoading(false);
      return false;
    }

    if (result.error) {
      handleAuthError(result.error, 'Register');
      store.setAuthIsLoading(false);
      return false;
    }

    store.setAuthIsLoading(false);
    return false;
  } catch (error) {
    handleAuthError(error, 'Register');
    store.setAuthIsLoading(false);
    return false;
  }
}

interface LogoutOptions {
  /**
   * KEEP this account's biometric credential across the sign-out, which is the
   * case biometric sign-in exists for. Safe because the slot is
   * `BIOMETRY_CURRENT_SET` and holds a revocable device credential, not the
   * password. FALSE drops the slot AND revokes it server-side.
   */
  keepBiometricCredentials?: boolean;
}

async function logout(options?: LogoutOptions): Promise<void> {
  const store = useStore.getState();
  const user = store.user;

  try {
    const currentUserEmail = user?.email;
    const currentUserId = user?.id;

    // Done FIRST: everything below can throw into a catch that only logs, so a
    // security-relevant deletion parked at the end may silently not happen.
    // Credentials are per-account, so this never touches another user's.
    if (!options?.keepBiometricCredentials && currentUserEmail) {
      // Server first, while the session that authorises it is still live: the
      // local delete below cannot be undone, so a revoke attempted after it
      // would have nothing left to authenticate with.
      await revokeDeviceCredentialForThisDevice();
      // READ, not discarded: a failed delete leaves the previous user's device
      // credential on the device — the exact state this call exists to prevent.
      const removed = await removeCredentials(currentUserEmail);
      if (!removed) {
        logger.error(
          'Logout: biometric credentials could not be removed; the previous account may still be unlockable on this device',
        );
      }
    }

    // Tear down the prior user's push/notification state before clearing auth,
    // so nothing survives on a shared device. Deregistration dispatches while
    // the client is still authenticated; the listener unsubscribe stops a
    // rotated token from being pushed under the logged-out session; and the
    // notification reset clears the persisted inbox/badge (badge follows via
    // badgeSync's post-hydration path).
    deregisterDeviceOnLogout();

    await LogoutCleanup.performLogoutCleanup();

    if (currentUserId) {
      queueManager.onLogout(currentUserId);
    }

    // `resetStore` rather than `clearAuth`: clearAuth only nulls the user and
    // tokens, leaving the selected home/pantry/list ids, the notification
    // inbox, the scanner's recent list and the item-suggestion LRU persisted
    // for whoever signs in next. The auth branch of resetStore clears all of
    // it, plus the on-disk copy. Apollo is already cleared by
    // performLogoutCleanup above, so this pass skips it.
    await store.resetStore({ auth: true, ui: true, clearApolloCache: false });
    LogoutCleanup.completeLogout();
    store.setNavigationState('auth');

    if (currentUserId) {
      const prefs = getUserPreferences(currentUserId);
      prefs?.trackLogout();
    }
  } catch (error) {
    logger.error('Logout error:', error);
  }
}

/**
 * Sign in by exchanging the account's stored device credential. The one path
 * for biometric sign-in — the login screen's button and the cold-start
 * auto-login both come through here, so the dead-versus-transient rule below
 * is written once.
 */
async function signInWithDeviceCredential(email: string): Promise<boolean> {
  try {
    const hasStoredCreds = await checkStoredCredentials(email);
    if (!hasStoredCreds) {
      logger.info('No stored credentials found for auto-login');
      return false;
    }

    const stored = await loadStoredCredentials(email);
    if (!stored) {
      logger.info('Failed to load stored credentials');
      return false;
    }

    // An enrolment made before device credentials existed holds a PASSWORD.
    // It is dropped rather than presented anywhere: replaying it is the thing
    // this whole path exists to stop, and the person re-enrols on their next
    // password sign-in.
    const credential =
      stored.credential && readDeviceCredential(stored.credential);
    if (!stored.email || !credential) {
      logger.warn('Biometric slot predates the device credential; clearing it');
      await removeCredentials(email);
      return false;
    }

    logger.info('Exchanging the stored device credential');
    const result = await client.mutate({
      mutation: ExchangeDeviceCredentialDocument,
      variables: { input: { credential, deviceId: getDeviceId() } },
    });

    const payload = result.data?.exchangeDeviceCredential;

    if (isSuccessPayload(payload, 'DeviceCredentialSessionPayload')) {
      const unmaskedLogin = unmaskAuthPayload(payload);
      if (unmaskedLogin) {
        await handleLogin(unmaskedLogin, true);
      }
      logger.info('Auto-login successful');
      return true;
    }

    if (payload) {
      // Drop the stored credentials only when the server says THESE
      // credentials will never authenticate — the password changed elsewhere,
      // or the account is gone. Token-side refusals end the session but leave
      // the credentials good, so they are deliberately not in this set; see
      // isDeadCredentialCode for how the two lists relate.
      if (isDeadCredentialCode(payload.code)) {
        logger.warn(
          `Auto-login rejected (${payload.code}), clearing stored credentials`,
        );
        await removeCredentials(email);
      }
      handleRejectedAuthPayload(payload, 'Auto-login');
      return false;
    }

    if (result.error) {
      // Same rule as the payload branch above: credentials are dropped only when
      // the failure establishes they will never authenticate. A transport failure
      // says the request did not ARRIVE, nothing about the password — clearing on
      // one silently un-enrols the device after a single blip.
      const parsed = errorService.parseApolloError(result.error, {
        logError: false,
      });
      const code = parsed.error?.code;
      if (code && isDeadCredentialCode(code)) {
        logger.warn(
          `Auto-login rejected (${code}), clearing stored credentials`,
        );
        await removeCredentials(email);
      } else {
        logger.warn('Auto-login failed; stored credentials kept');
      }
      handleAuthError(result.error, 'Auto-login');
    }

    return false;
  } catch (error) {
    // Deliberately does NOT clear. A throw here is a transport or client fault,
    // never the server saying these credentials are dead — and the branches
    // above already handle the one case that is.
    logger.error('Auto-login error:', error);
    return false;
  }
}

/** Cold start: no user yet, so fall back to the most-recently-enrolled account. */
async function autoLogin(): Promise<boolean> {
  const email = await getLastBiometricEmail();
  if (!email) {
    logger.info('No stored credentials found for auto-login');
    return false;
  }
  return signInWithDeviceCredential(email);
}

/**
 * Revoke this device's credential server-side, paired with DROPPING the local
 * slot, so a secret lifted off the device is already dead. Never on a sign-out
 * that KEEPS the slot. Best effort: the slot is gone either way, so a failure
 * costs the server a stale row, not the person a working sign-in.
 */
async function revokeDeviceCredentialForThisDevice(): Promise<void> {
  try {
    const deviceId = getDeviceId();
    const listed = await client.query({
      query: MyDeviceCredentialsDocument,
      fetchPolicy: 'network-only',
    });
    const mine = listed.data?.deviceCredentials?.find(
      credential => credential.deviceId === deviceId,
    );
    if (!mine) return;

    await client.mutate({
      mutation: RevokeDeviceCredentialDocument,
      variables: { input: { id: mine.id } },
    });
  } catch (error) {
    logger.warn('Could not revoke the device credential server-side', error);
  }
}

/**
 * Enrol biometric sign-in: ask the server for a device-bound credential and put
 * THAT behind biometry. Needs only the live session — the account password is
 * never passed in, so there is nothing to retain past the sign-in that enabled
 * this. Issuing supersedes any credential this device already held.
 */
async function enrolDeviceCredential(email: string): Promise<boolean> {
  try {
    const result = await client.mutate({
      mutation: IssueDeviceCredentialDocument,
      variables: { input: { deviceId: getDeviceId() } },
    });

    const payload = result.data?.issueDeviceCredential;
    if (!isSuccessPayload(payload, 'DeviceCredentialPayload')) {
      if (payload)
        handleRejectedAuthPayload(payload, 'Enrol device credential');
      else if (result.error)
        handleAuthError(result.error, 'Enrol device credential');
      return false;
    }

    return storeCredentials(email, markDeviceCredential(payload.credential));
  } catch (error) {
    logger.error('Enrol device credential error:', error);
    return false;
  }
}

export const authService = {
  // Core operations
  enrolDeviceCredential,
  revokeDeviceCredentialForThisDevice,
  signInWithDeviceCredential,
  login,
  register,
  logout,
  autoLogin,

  // Post-auth flow handlers
  handleLogin,
  handleAuthError,

  // Credential management
  checkStoredCredentials,
  loadStoredCredentials,
  storeCredentials,
  removeCredentials,
  getAvailableAccounts,
  getBiometricInfo,
  getLastBiometricEmail,

  // Device registration
  registerDeviceInBackground,
};
