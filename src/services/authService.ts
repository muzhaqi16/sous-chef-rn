/**
 * The single source of truth for login/register/logout business logic, as a
 * non-React service. Every dependency is a singleton: the Apollo client,
 * toastService, errorService and the Zustand store via `getState()`. What a
 * device adds — its registration, a stored biometric sign-in — comes from the
 * steps its host registers (`sessionHost`).
 */

import { requireApolloClient } from '#/apollo/clientRegistry';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import { queueManager } from '#/apollo/offlineQueue/queueManager';
import { queueStore } from '#/apollo/offlineQueue/queueStore';
import { errorService } from '#/services/errorService';
import { toastService } from '#/services/toastService';
import { useStore } from '#store';
import { runSessionTeardown } from '#store/sessionTeardown';
import { whileSessionEnds } from '#store/sessionEnding';
import { logger } from '#/utils/environment';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { incrementLoginCount } from '#/hooks/settings/useFeatureHint';
import { UpdateUserPreferencesDocument } from '#operations/auth/user.generated';
import {
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
import { type PostSignInGate, sessionHost } from '#/services/auth/sessionHost';

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

// --- User preferences helpers (direct Zustand access) ---

function getUserPreferences(targetUserId: string) {
  const store = useStore.getState();

  return {
    trackCredentialPromptShown: () => {
      store.setUserNavigationState(targetUserId, {
        lastCredentialPromptShown: Date.now(),
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

// `handleApolloError` reports the code as a plain string, so membership is
// tested against the enum members read as strings.
const AUTH_CLEARING_CODES: ReadonlySet<string> = new Set([
  ErrorCode.AuthTokenExpired,
  ErrorCode.AuthRefreshTokenInvalid,
]);

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
    if (isAuthError && AUTH_CLEARING_CODES.has(code)) {
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

async function handleLogin(
  loginResponse: ResolvedAuthPayload,
  shouldRemember?: boolean,
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
    );
  }

  // Set auth state
  store.setAuth(user, accessToken, refreshToken);
  queueManager.onUserChange(user.id, previousUserId);
  bootstrapUserStore(user);
  void applyRegionCurrencyDefault(user);

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
  sessionHost().afterSignIn();
  incrementLoginCount(user.id);

  // Navigation flow control
  if (!user.emailVerified) {
    // A previous session's "skip for now" doesn't carry into a fresh login;
    // clearing it also keeps resolveNavTarget from routing past this screen.
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
  if (gate === 'biometricSetup' && loginCredentials) {
    store.setPostLoginCredentials(loginCredentials);
    store.setShowBiometricSetup(true);
    store.setNavigationState('biometric_setup');
    return true;
  }

  // Stays on the auth screen for LoginScreen's RememberMe modal, which enters
  // main_app on an answer; RootNavigator's postLoginCredentials guard keeps
  // the user-change effect from forcing it meanwhile.
  if (gate === 'rememberMe' && loginCredentials) {
    store.setPostLoginCredentials(loginCredentials);
    getUserPreferences(user.id).trackCredentialPromptShown();
    return true;
  }

  store.setNavigationState('main_app');
  return false;
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
      await handleLogin(
        unmaskedLogin,
        true,
        loginCredentials,
        showRememberPrompt,
      );

      store.setAuthIsLoading(false);
      return true;
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

async function register(
  input: RegisterInput,
  shouldRemember = true,
): Promise<RegisterOutcome> {
  const store = useStore.getState();
  store.setAuthIsLoading(true);

  // A refusal, a resolved error and a throw all toast the app's own copy and
  // keep the user on the sign-up screen. A refused attempt to START a session
  // clears a dead token rather than ending a session, as `handleAuthError` does.
  const clearAuth = () => {
    store.clearAuth();
  };
  // Bound to the device, as `login` explains.
  await ensureDeviceId();
  const settled = await settleMutation(
    () =>
      requireApolloClient().mutate({
        mutation: RegisterDocument,
        variables: { input },
      }),
    {
      document: RegisterDocument,
      fallback: t('errors.codes.genericRetry'),
      present: 'toast',
      on: {
        [ErrorCode.AuthTokenExpired]: clearAuth,
        [ErrorCode.AuthRefreshTokenInvalid]: clearAuth,
      },
    },
  );

  if (settled.failure) {
    store.setAuthIsLoading(false);
    return 'failed';
  }
  if (settled.status !== 'applied') {
    store.setAuthIsLoading(false);
    return 'failed';
  }

  store.setRememberMe(shouldRemember);
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
      await sessionHost().forgetStoredSignIn(currentUserEmail);
    }

    // The teardown `endSession` runs too, so both exits rest the same. One scope
    // over the whole descent, released however it exits: a latched gate refuses
    // the next sign-in until the app restarts.
    await whileSessionEnds(async () => {
      await runSessionTeardown();

      if (currentUserId) {
        queueManager.onLogout(currentUserId);
      }

      // `resetStore`, not `clearAuth`, which leaves the selections, inbox and
      // LRUs persisted for whoever signs in next. Apollo is already cleared by
      // the teardown's `apollo` step.
      await store.resetStore({ auth: true, ui: true, clearApolloCache: false });
      store.setNavigationState('auth');
    });

    if (currentUserId) {
      getUserPreferences(currentUserId).trackLogout();
    }
  } catch (error) {
    logger.error('Logout error:', error);
  }
}

export const authService = {
  login,
  register,
  logout,

  // Post-auth flow handlers, also run by a host's own sign-in paths
  handleLogin,
  handleAuthError,
  handleRejectedAuthPayload,
  resolveAuthPayload: unmaskAuthPayload,
};
