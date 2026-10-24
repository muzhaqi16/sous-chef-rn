/**
 * The single source of truth for login/register/logout business logic, as a
 * non-React service. Every dependency is a singleton: the Apollo client,
 * toastService, errorService and the Zustand store via `getState()`. What a
 * device adds — its registration, a stored biometric sign-in — comes from the
 * steps its host registers (`sessionHost`).
 */

import { requireApolloClient } from '#/apollo/clientRegistry';
import { queueManager } from '#/apollo/offlineQueue/queueManager';
import { queueStore } from '#/apollo/offlineQueue/queueStore';
import { reconnectWebSocket } from '#/apollo/links/wsLink';
import { errorService, isTransportFailure } from '#/services/errorService';
import { toastService } from '#/services/toastService';
import { useStore } from '#store';
import { holdsSessionTokens } from '#store/slices/authSlice';
import { logger } from '#/utils/environment';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { getRateLimitDetails } from '#/utils/errors/rateLimit';
import {
  isDeadCredentialCode,
  isStaleSignInTokenCode,
} from '#/utils/authErrorCodes';
import { incrementLoginCount } from '#/hooks/settings/useFeatureHint';
import { UpdateUserPreferencesDocument } from '#operations/auth/user.generated';
import {
  ExchangeDeviceCredentialDocument,
  IssueDeviceCredentialDocument,
  LoginDocument,
  RegisterDocument,
} from '#operations/auth/auth.generated';
import { ensureDeviceId } from '#/services/auth/deviceId';
import {
  deviceRegionCurrency,
  isUnchosenCurrency,
} from '#/domain/regionCurrency';
import {
  LoginUserFragmentDoc,
  type LoginUserFragment,
} from '#operations/auth/userFragments.generated';
import type {
  LoginInput,
  RegisterInput,
} from '#/graphql/generated/schemaTypes';
import { t } from '#/i18n';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { operationNameOf } from '#/apollo/utils/documentOperation';
import {
  type PostSignInGate,
  type StoredSignInRenewal,
  sessionHost,
} from '#/services/auth/sessionHost';

// --- Store bootstrap (pre-populate Zustand from auth response) ---

function bootstrapUserStore(user: LoginUserFragment): void {
  const storeState = useStore.getState();
  if (user.defaultHomeId) {
    const pantries = user.defaultHome?.pantriesConnection.edges;
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

  // Seeded before any screen's tutorial hooks mount, so a user who disabled
  // tutorials sees no flash of coach marks on a new device. Only this master
  // switch syncs; per-screen completion (feature_hint_shown_*) stays local.
  if (user.settings) {
    useStore.getState().setShowTutorials(user.settings.showTutorials);
  }
}

/**
 * Denominates a new account from the DEVICE REGION, once and silently: a cost
 * keeps the currency it was recorded in, so the answer must land before the
 * first one. A user who disagrees changes it in Profile.
 */
async function applyRegionCurrencyDefault(
  user: LoginUserFragment,
): Promise<void> {
  const store = useStore.getState();
  const navState = store.getUserNavigationState(user.id);
  if (navState?.currencyDefaultApplied) return;

  // An account that HAS settings states a currency — its holder's, or this
  // write's from another device — so the server's own row is what stops this
  // running twice, and the flag below only stops it running twice here.
  if (!isUnchosenCurrency(user.settings?.preferredCurrency)) return;

  const inferred = deviceRegionCurrency();
  if (!inferred) return;

  const previous = store.preferredCurrency;
  // Ahead of the round trip so the money on screen is denominated at once;
  // reverted below if the server refuses.
  store.setPreferredCurrency(inferred);

  // Two ways to fail, and both have to revert. `errorPolicy: 'all'` makes a
  // REFUSAL resolve, so the outcome has to be read; a transport failure still
  // THROWS, which is the offline case this runs in most often.
  let result;
  try {
    // Not `localFirst`: a queued write would leave the money on screen in a
    // currency the account does not hold until some later replay.
    result = await requireApolloClient().mutate({
      mutation: UpdateUserPreferencesDocument,
      variables: { input: { regional: { preferredCurrency: inferred } } },
    });
  } catch (error) {
    useStore.getState().setPreferredCurrency(previous);
    logger.warn('Could not apply the region currency default:', error);
    return;
  }

  if (appliedPayload(result.data)) {
    store.setUserNavigationState(user.id, { currencyDefaultApplied: true });
    // The persisted record follows, or the next launch restores the old one.
    useStore.getState().updateUser({ preferredCurrency: inferred });
    return;
  }

  useStore.getState().setPreferredCurrency(previous);
  logger.warn(
    'Could not apply the region currency default:',
    result.error ?? result.data?.updateSettings,
  );
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
  const user = requireApolloClient().cache.readFragment<LoginUserFragment>({
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
    if (isAuthError && isStaleSignInTokenCode(code)) {
      useStore.getState().clearAuth();
    }
  } catch {
    toastService.error(t('errors.codes.genericRetry'));
  }
  useStore.getState().setAuthIsLoading(false);
}

// A refusal member of LoginResult resolves 200 with no transport error, so it
// toasts like handleAuthError and stays on sign-in, through the shared
// friendly-message table so it reads as the same top-level error does.
function handleRejectedAuthPayload(
  payload: { code: string; message: string },
  operation: string,
): void {
  logger.warn(`${operation} rejected by the server: ${payload.code}`);
  // The FALLBACK is the app's own copy: `payload.message` is the server's
  // English, which a code missing from the table would display.
  toastService.error(
    errorService.getUserFriendlyMessage(
      payload.code,
      t('errors.codes.genericRetry'),
    ),
  );
  useStore.getState().setAuthIsLoading(false);
}

/** False when the sign-in was discarded: a session end was still running. */
async function handleLogin(
  loginResponse: ResolvedAuthPayload,
  loginCredentials?: { email: string },
  showRememberPrompt = false,
): Promise<boolean> {
  const { user, accessToken, refreshToken } = loginResponse;
  const store = useStore.getState();
  const previousUserId = queueStore.getCurrentUserId();

  // The gate resolves BEFORE auth state changes: RootNavigator routes from
  // `user`, so setting it first flashes main_app behind the gate. Deciding
  // first commits auth and the final navigation state together.
  let gate: PostSignInGate = null;
  if (loginCredentials && user.emailVerified && user.onBoarded) {
    gate = await sessionHost().postSignInGate(
      user,
      loginCredentials.email,
      showRememberPrompt,
      accessToken,
    );
  }

  if (!store.setAuth(user, accessToken, refreshToken)) return false;
  queueManager.onUserChange(user.id, previousUserId);
  bootstrapUserStore(user);
  void applyRegionCurrencyDefault(user);

  logger.info('Auth success: Login successful');
  sessionHost().afterSignIn();
  incrementLoginCount(user.id);

  // Navigation flow control
  if (!user.emailVerified) {
    // A previous session's "skip for now" doesn't carry into a fresh login;
    // clearing it also keeps resolveNavTarget from routing past this screen.
    store.setUserNavigationState(user.id, { verificationSkipped: false });
    store.setNavigationState('verification');
    return true;
  }
  if (!user.onBoarded) {
    store.setNavigationState('onboarding');
    return true;
  }

  // Eligible returning user → route to the dedicated biometric enrollment
  // screen (the `biometric_setup` nav state) instead of straight to main_app,
  // so it renders as its own step, not a modal over PantryMain.
  if (gate === 'biometricSetup' && loginCredentials) {
    store.setPostLoginCredentials(loginCredentials);
    store.setNavigationState('biometric_setup');
    return true;
  }

  // Stays on the auth screen for LoginScreen's RememberMe modal, which enters
  // main_app on an answer; RootNavigator's postLoginCredentials guard keeps
  // the user-change effect from forcing it meanwhile.
  if (gate === 'rememberMe' && loginCredentials) {
    store.setPostLoginCredentials(loginCredentials);
    return true;
  }

  store.setNavigationState('main_app');
  return true;
}

// --- Public API ---

async function login(
  input: LoginInput,
  options?: {
    showRememberPrompt?: boolean;
    /**
     * A refusal the CALLER can act on, carrying the union member's `code`. The
     * toast still fires; this is for a refusal with somewhere to go, such as
     * `AUTH_EMAIL_NOT_VERIFIED`, which the emailed code clears.
     */
    onRefusal?: (code: string) => void;
    /** Logs a failure without telling the user, for a caller whose fallback does. */
    quiet?: boolean;
  },
): Promise<boolean> {
  const showRememberPrompt = options?.showRememberPrompt ?? true;
  const quiet = options?.quiet ?? false;
  const store = useStore.getState();
  store.setAuthIsLoading(true);

  const reportError = (error: unknown) => {
    if (quiet) logger.warn('Login failed', error);
    else handleAuthError(error);
  };

  try {
    // `authLink` sends the id it already holds. A session minted without it is
    // bound to no device, and the server pushes only to a bound session.
    await ensureDeviceId();
    const result = await requireApolloClient().mutate({
      mutation: LoginDocument,
      variables: { input },
    });

    const payload = appliedPayload(result.data);

    if (payload) {
      // Only the email travels past the mutation: every downstream gate
      // identifies the account, and enrolment authorises off the session.
      const loginCredentials = { email: input.email };

      const unmaskedLogin = unmaskAuthPayload(payload);
      if (!unmaskedLogin) {
        // No session was opened: the 12-field LoginUser read came back
        // incomplete, so reporting success leaves the user on the form with
        // nothing said. `userProfileCompleteness.test.ts` pins the shape.
        logger.error('Login succeeded but the LoginUser read was incomplete');
        if (!quiet) toastService.error(t('errors.codes.genericRetry'));
        store.setAuthIsLoading(false);
        return false;
      }

      // handleLogin owns all post-login routing — verification, onboarding,
      // the biometric gate, and the RememberMe gate (driven by
      // showRememberPrompt) — so navigation is decided in one place.
      const signedIn = await handleLogin(
        unmaskedLogin,
        loginCredentials,
        showRememberPrompt,
      );
      if (!signedIn && !quiet)
        toastService.error(t('errors.codes.genericRetry'));
      store.setAuthIsLoading(false);
      return signedIn;
    }

    const refusal = result.data?.login;
    if (refusal && 'code' in refusal) {
      if (quiet) {
        logger.warn(`Login rejected by the server: ${refusal.code}`);
        store.setAuthIsLoading(false);
      } else {
        handleRejectedAuthPayload(refusal, operationNameOf(LoginDocument));
      }
      options?.onRefusal?.(refusal.code);
      return false;
    }

    if (result.error) {
      reportError(result.error);
      store.setAuthIsLoading(false);
      return false;
    }

    store.setAuthIsLoading(false);
    return false;
  } catch (error) {
    reportError(error);
    store.setAuthIsLoading(false);
    return false;
  }
}

/**
 * `signedIn`: `login` admitted the new, unverified account, so the verification
 * gate and its skip take over. `verificationSent`: the address refused the
 * password just typed, as one held by another account or a deleted one does.
 */
type RegisterOutcome = 'signedIn' | 'verificationSent' | 'failed';

async function register(input: RegisterInput): Promise<RegisterOutcome> {
  const store = useStore.getState();
  store.setAuthIsLoading(true);

  // A refusal, a resolved error and a throw all toast the app's own copy and
  // keep the user on the sign-up screen. A refused attempt to START a session
  // clears a dead token rather than ending a session, as `handleAuthError` does.
  const settled = await settleMutation(
    async () => {
      // Bound to the device, as `login` explains.
      await ensureDeviceId();
      return requireApolloClient().mutate({
        mutation: RegisterDocument,
        variables: { input },
      });
    },
    {
      document: RegisterDocument,
      fallback: t('errors.codes.genericRetry'),
      present: 'toast',
    },
  );

  if (settled.failure) {
    const { code } = settled.failure;
    if (code && isStaleSignInTokenCode(code)) store.clearAuth();
    store.setAuthIsLoading(false);
    return 'failed';
  }
  if (settled.status !== 'applied') {
    store.setAuthIsLoading(false);
    return 'failed';
  }

  logger.info('Registration successful: verification email sent');

  // `register` issues no tokens, but `login` admits an unverified account.
  // Never after verifying instead: a deleted account is restored under its
  // ORIGINAL password, which this one need not be.
  const signedIn = await login(
    { email: input.email, password: input.password },
    { showRememberPrompt: false, quiet: true },
  );
  return signedIn ? 'signedIn' : 'verificationSent';
}

/**
 * What exchanging a device credential did; every failure is already reported.
 * `dead`: the credential will never authenticate again. `unreachable`: the
 * request never arrived, so the server refused nothing. `retryAfterMs` is the
 * server's own deadline.
 */
export type DeviceCredentialExchange =
  | { status: 'signedIn' }
  | { status: 'incomplete' }
  | { status: 'discarded' }
  | { status: 'dead' }
  | { status: 'refused' }
  | { status: 'unreachable' }
  | { status: 'failed'; retryAfterMs?: number };

/** Sign in with a device credential, bound to `deviceId`. */
async function exchangeDeviceCredential(
  credential: string,
  deviceId: string,
): Promise<DeviceCredentialExchange> {
  const operation = 'Auto-login';
  const result = await requireApolloClient().mutate({
    mutation: ExchangeDeviceCredentialDocument,
    variables: { input: { credential, deviceId } },
  });

  const payload = appliedPayload(result.data);
  if (payload) {
    const signIn = unmaskAuthPayload(payload);
    if (!signIn) {
      // The exchange spent one of the server's attempts and opened no session.
      logger.error(
        'Auto-login succeeded but the LoginUser read was incomplete',
      );
      toastService.error(t('errors.codes.genericRetry'));
      return { status: 'incomplete' };
    }
    if (!(await handleLogin(signIn))) {
      toastService.error(t('errors.codes.genericRetry'));
      return { status: 'discarded' };
    }
    return { status: 'signedIn' };
  }

  const refusal = result.data?.exchangeDeviceCredential;
  if (refusal && 'code' in refusal) {
    handleRejectedAuthPayload(refusal, operation);
    // A token-side refusal leaves THESE credentials good (isDeadCredentialCode).
    return isDeadCredentialCode(refusal.code)
      ? { status: 'dead' }
      : { status: 'refused' };
  }

  if (result.error) {
    handleAuthError(result.error, operation);
    const code = errorService.parseApolloError(result.error, {
      logError: false,
    }).error?.code;
    if (code && isDeadCredentialCode(code)) return { status: 'dead' };
    if (isTransportFailure(result.error)) return { status: 'unreachable' };
    const rateLimit = getRateLimitDetails(result.error);
    return {
      status: 'failed',
      retryAfterMs: rateLimit?.retryAfter
        ? rateLimit.retryAfter * 1000
        : undefined,
    };
  }

  // An answer this client cannot read still spent one of the server's attempts.
  toastService.error(t('errors.codes.genericRetry'));
  return { status: 'failed' };
}

/**
 * A device credential for `deviceId`, issued from the live session alone.
 * `refused` is already reported.
 */
async function issueDeviceCredential(
  deviceId: string,
  { quiet = false }: { quiet?: boolean } = {},
): Promise<{ status: 'issued'; credential: string } | { status: 'refused' }> {
  const operation = 'Enrol device credential';
  const result = await requireApolloClient().mutate({
    mutation: IssueDeviceCredentialDocument,
    variables: { input: { deviceId } },
  });

  const payload = appliedPayload(result.data);
  if (payload) return { status: 'issued', credential: payload.credential };

  const refusal = result.data?.issueDeviceCredential;
  // `quiet`: the caller's own message says what the refusal costs.
  if (quiet) {
    logger.warn(`${operation} refused`, refusal ?? result.error);
  } else if (refusal && 'code' in refusal) {
    handleRejectedAuthPayload(refusal, operation);
  } else if (result.error) {
    handleAuthError(result.error, operation);
  }
  return { status: 'refused' };
}

/**
 * A password change this session survived. The server refused every earlier
 * token, this device's included, so the new pair is stored before anything
 * else sends on the old one; the host then renews the sign-in it stores.
 * `sentBy` is who sent the change: the pair is adopted only while that user is
 * still signed in. Not by refresh token, which a rotation during the change
 * replaces with one the change already revoked.
 */
async function adoptPasswordChangeSession(
  session: { accessToken: string; refreshToken: string },
  sentBy: string,
): Promise<StoredSignInRenewal | 'discarded'> {
  const store = useStore.getState();
  if (store.user?.id !== sentBy || !holdsSessionTokens(store)) {
    logger.info(
      'Discarded a password-change session its sender no longer holds',
    );
    return 'discarded';
  }
  const write = store.setTokens({
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
  });
  if (write !== 'stored') return 'discarded';
  // As a refresh does: the socket was opened on a token the change revoked.
  reconnectWebSocket();
  const { email } = store.user;
  if (!email) return 'none';
  return sessionHost().renewStoredSignIn(email);
}

interface LogoutOptions {
  /**
   * KEEP the sign-in the host stores across the sign-out — on mobile a
   * biometric slot holding a revocable device credential, not the password.
   * FALSE has the host drop it and revoke it server-side.
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
    if (!options?.keepBiometricCredentials && currentUserEmail) {
      // A host step settles even when it fails (`registerSessionHost`), so it
      // cannot fall into the catch below and skip the sign-out.
      await sessionHost().forgetStoredSignIn(currentUserEmail);
    }

    // The one session-end body every end runs. Deliberate: only a sign-out
    // the person chose may discard the offline queue's unsynced work.
    await store.endSession('signed_out', {
      deliberate: {
        handOffQueue: currentUserId
          ? () => queueManager.onLogout(currentUserId)
          : undefined,
      },
    });
  } catch (error) {
    logger.error('Logout error:', error);
  }
}

/** @internal The sign-in commit, for `failingHostSteps.test.ts`. */
export { handleLogin };

export const authService = {
  login,
  register,
  logout,
  adoptPasswordChangeSession,
  exchangeDeviceCredential,
  issueDeviceCredential,
};
