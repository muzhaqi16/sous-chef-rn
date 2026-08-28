/**
 * Auth Service - Singleton service for authentication operations.
 *
 * The single source of truth for login/register/logout business logic, as a
 * testable, non-React service (replacing the former useAuth/useAuthOperations
 * hooks). All dependencies are singletons:
 * - Apollo client for mutations
 * - toastService for user feedback
 * - errorService for structured error handling
 * - useStore (Zustand) for state via getState()
 * - keychain for credential storage
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
  LoginDocument,
  RegisterDocument,
} from '#operations/auth/auth.generated';
import {
  LoginUserFragmentDoc,
  type LoginUserFragment,
} from '#operations/auth/userFragments.generated';
import {
  RegisterDeviceDocument,
  UpdateDeviceDocument,
} from '#operations/auth/device.generated';
import {
  type LoginInput,
  type RegisterInput,
  type RegisterDeviceInput,
} from '#/graphql/generated/schemaTypes';
import { PermissionService } from '#/services/permissions/PermissionService';
import {
  acquirePushToken,
  getPushTokenProvider,
  onPushTokenRefresh,
} from '#/services/push/pushTokenProvider';
import {
  loadCredentials,
  saveCredentials,
  hasCredentials,
  clearCredentials,
  getStoredAccounts,
  getBiometricCapability,
  getLastBiometricEmail,
  saveTempRegistrationPassword,
  clearTempRegistrationPassword,
} from '#/storage/keychain';
import { storage } from '#/storage/mmkv';
import { t } from '#/i18n';
import {
  collectDeviceInformation,
  validateDeviceInformation,
} from '#/utils/deviceInfo';

// Re-export for consumers
export interface LoginCredentials {
  email: string;
  password: string;
}

// --- Credential management (pure async, no React) ---

async function checkStoredCredentials(email?: string | null): Promise<boolean> {
  if (!email) return false;
  try {
    return await hasCredentials(email);
  } catch (error) {
    logger.error('Error checking credentials:', error);
    return false;
  }
}

async function getAvailableAccounts() {
  try {
    return await getStoredAccounts();
  } catch (error) {
    logger.error('Error getting available accounts:', error);
    return [];
  }
}

async function getBiometricInfo(): Promise<{
  isAvailable: boolean;
  biometryType: string | null;
}> {
  try {
    return await getBiometricCapability();
  } catch (error) {
    logger.error('Error getting biometric capability:', error);
    return { isAvailable: false, biometryType: null };
  }
}

async function storeCredentials(
  email: string,
  password: string,
): Promise<boolean> {
  try {
    await saveCredentials(email, password);
    return true;
  } catch (error) {
    logger.error('Error storing credentials:', error);
    return false;
  }
}

async function removeCredentials(email?: string): Promise<boolean> {
  if (!email) return false;
  try {
    await clearCredentials(email);
    return true;
  } catch (error) {
    logger.error('Error removing credentials:', error);
    return false;
  }
}

async function loadStoredCredentials(
  email?: string,
): Promise<LoginCredentials | null> {
  if (!email) return null;
  const store = useStore.getState();
  store.setAuthIsLoadingCredentials(true);

  try {
    const credentials = await loadCredentials(email);

    store.setAuthIsLoadingCredentials(false);

    return credentials
      ? { email: credentials.username, password: credentials.password }
      : null;
  } catch (error) {
    logger.error('Error loading credentials:', error);
    store.setAuthIsLoadingCredentials(false);
    return null;
  }
}

// --- Device registration (fire-and-forget) ---

function buildDeviceInput(
  deviceInfo: Awaited<ReturnType<typeof collectDeviceInformation>>,
  pushToken: string | null,
): RegisterDeviceInput {
  return {
    deviceId: deviceInfo.deviceId,
    deviceName: deviceInfo.deviceName,
    deviceType: deviceInfo.deviceType,
    platform: deviceInfo.platform,
    appVersion: deviceInfo.appVersion,
    pushToken: pushToken ?? undefined,
    details: {
      browserOs: {
        osName: deviceInfo.osName,
        osVersion: deviceInfo.osVersion,
        userAgent: deviceInfo.userAgent,
        browserName: deviceInfo.browserName,
        browserVersion: deviceInfo.browserVersion,
        screenResolution: deviceInfo.screenResolution,
      },
      characteristics: {
        hasNotch: deviceInfo.hasNotch,
        hasDynamicIsland: deviceInfo.hasDynamicIsland,
        isEmulator: deviceInfo.isEmulator,
        isTablet: deviceInfo.isTablet,
      },
      identification: {
        manufacturer: deviceInfo.manufacturer,
        model: deviceInfo.model,
        brand: deviceInfo.brand,
        androidId: deviceInfo.androidId,
        instanceId: deviceInfo.instanceId,
        apiLevel: deviceInfo.apiLevel,
        deviceFingerprint: deviceInfo.deviceFingerprint,
        iosVendorId: deviceInfo.iosVendorId,
        securityPatch: deviceInfo.securityPatch,
        firstInstallTime: deviceInfo.firstInstallTime,
        lastUpdateTime: deviceInfo.lastUpdateTime,
        systemVersion: deviceInfo.systemVersion,
        readableVersion: deviceInfo.readableVersion,
        buildNumber: deviceInfo.buildNumber,
        bundleId: deviceInfo.bundleId,
      },
      hardware: {
        totalMemory: deviceInfo.totalMemory,
        usedMemory: deviceInfo.usedMemory,
        maxMemory: deviceInfo.maxMemory,
        totalDiskCapacity: deviceInfo.totalDiskCapacity,
        freeDiskStorage: deviceInfo.freeDiskStorage,
        supportedAbis: deviceInfo.supportedAbis,
      },
      connectivity: {
        carrier: deviceInfo.carrier,
        isAirplaneMode: deviceInfo.isAirplaneMode,
        isLocationEnabled: deviceInfo.isLocationEnabled,
      },
      power: {
        batteryLevel: deviceInfo.batteryLevel,
        isBatteryCharging: deviceInfo.isBatteryCharging,
        powerState: deviceInfo.powerState
          ? JSON.parse(deviceInfo.powerState)
          : undefined,
      },
      peripherals: {
        isHeadphonesConnected: deviceInfo.isHeadphonesConnected,
        isKeyboardConnected: deviceInfo.isKeyboardConnected,
        isMouseConnected: deviceInfo.isMouseConnected,
      },
      availableLocationProviders: deviceInfo.availableLocationProviders,
      hostNames: deviceInfo.hostNames,
      supportedMediaTypes: deviceInfo.supportedMediaTypes,
    },
    location: {
      ipAddress: deviceInfo.deviceIpAddress,
      ipCountry: deviceInfo.country,
      timezone: deviceInfo.timezone,
      language: deviceInfo.language,
    },
  };
}

/** Unsubscribe for the active token-refresh listener, so we don't stack them. */
let pushTokenRefreshUnsubscribe: (() => void) | null = null;

/**
 * Server-assigned device id from the most recent registration this process.
 * Captured so logout can deregister the device server-side (the local
 * `deviceInfo.deviceId` is not the server PK). Null until a registration
 * succeeds; cleared on logout.
 */
let registeredDeviceId: string | null = null;

/** Push a rotated push token to the server for the registered device. */
async function pushRotatedTokenToServer(
  deviceId: string,
  pushToken: string,
): Promise<void> {
  try {
    await client.mutate({
      mutation: UpdateDeviceDocument,
      variables: { input: { id: deviceId, pushToken } },
    });
    logger.info('Device push token updated after rotation');
  } catch (error) {
    logger.error('Failed to update rotated push token:', error);
  }
}

/**
 * Best-effort server-side device deregistration on logout, so the server stops
 * pushing to the logged-out session on a shared device. Uses
 * `updateDevice(delete: true)` — the schema's documented replacement for the
 * deleteDevice mutation. Fire-and-forget: never throws and never awaited by
 * logout, so a slow/absent network can't block the local teardown.
 */
function deregisterDeviceOnLogout(): void {
  const deviceId = registeredDeviceId;
  if (!deviceId) return;
  void client
    .mutate({
      mutation: UpdateDeviceDocument,
      variables: { input: { id: deviceId, delete: true } },
    })
    .then(() => logger.info('Device deregistered on logout'))
    .catch(error =>
      logger.warn('Failed to deregister device on logout:', error),
    );
}

async function registerDeviceOnce(): Promise<boolean> {
  try {
    const deviceInfo = await collectDeviceInformation();
    if (!validateDeviceInformation(deviceInfo)) {
      logger.error('Invalid device information collected');
      return false;
    }

    // Acquire the push token only when OS notification permission is already
    // granted, so login never triggers the permission prompt. The prompt happens
    // in-context when the user enables push in settings, which then re-runs
    // registration (registerDeviceInBackground) to deliver the token. A null
    // token registers the device without push, as before.
    const notificationStatus = await PermissionService.check('notifications');
    const pushToken =
      notificationStatus === 'granted' ? await acquirePushToken() : null;

    const result = await client.mutate({
      mutation: RegisterDeviceDocument,
      variables: { input: buildDeviceInput(deviceInfo, pushToken) },
    });

    const registerPayload = result.data?.registerDevice;
    if (registerPayload?.__typename !== 'RegisterDevicePayload') {
      const message =
        registerPayload && 'message' in registerPayload
          ? registerPayload.message
          : null;
      logger.error('Device registration failed:', message);
      return false;
    }

    // Keep the server token current: the OS rotates push tokens periodically, so
    // subscribe once and updateDevice on each rotation.
    const deviceId = registerPayload.device?.id;
    if (deviceId) {
      registeredDeviceId = deviceId;
      pushTokenRefreshUnsubscribe?.();
      pushTokenRefreshUnsubscribe = onPushTokenRefresh(token => {
        void pushRotatedTokenToServer(deviceId, token);
      });

      // Close the getToken-timeout dead window: the OS can deliver a token after
      // acquirePushToken's timeout resolved null but before the refresh listener
      // subscribed just above — that token is cached yet was pushed to nobody.
      // Re-check now (after subscribing, so any later arrival still hits the
      // listener) and update the device if a token has since materialized.
      if (notificationStatus === 'granted') {
        const laterToken = await getPushTokenProvider().getToken();
        if (laterToken && laterToken !== pushToken) {
          await pushRotatedTokenToServer(deviceId, laterToken);
        }
      }
    }

    logger.info('Device registered successfully:', {
      deviceId: deviceInfo.deviceId,
    });
    return true;
  } catch (error) {
    logger.error('Device registration error:', error);
    return false;
  }
}

async function registerDeviceWithRetry(maxRetries = 3): Promise<boolean> {
  let attempts = 0;
  while (attempts < maxRetries) {
    attempts++;
    const success = await registerDeviceOnce();
    if (success) return true;
    if (attempts < maxRetries) {
      const delay = Math.pow(2, attempts) * 1000;
      logger.info(`Device registration retry in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  logger.warn(`Device registration failed after ${maxRetries} attempts`);
  return false;
}

function registerDeviceInBackground(): void {
  registerDeviceWithRetry(3)
    .then(success => {
      if (!success) {
        logger.warn('Background device registration failed');
      }
    })
    .catch(error => {
      logger.error('Background device registration error:', error);
    });
}

// --- Store bootstrap (pre-populate Zustand from auth response) ---

function bootstrapUserStore(user: LoginUserFragment): void {
  const storeState = useStore.getState();
  if (user.defaultHomeId) {
    const pantries = user.defaultHome?.pantriesConnection?.edges;
    const defaultPantry =
      pantries?.find(e => e.node.isDefault)?.node ?? pantries?.[0]?.node;
    const pantryId = defaultPantry?.id ?? null;

    storeState.setHomeAndPantry(user.defaultHomeId, pantryId);
    if (pantryId) {
      storeState.setIsHomeSelectionReady(true);
    }
  }
  if (user.defaultShoppingListId) {
    storeState.setSelectedShoppingListId(user.defaultShoppingListId);
  }

  // Seed the tutorials master switch from the account's server setting before
  // any screen (and its tutorial hooks) mounts, so a user who explicitly
  // disabled tutorials in Settings doesn't see a flash of coach marks on a
  // new device. Per-screen completion itself is tracked locally per device
  // (feature_hint_shown_*) and is never synced — only this explicit
  // enabled/disabled preference is. useShowTutorials reads this MMKV key;
  // useAppSettings keeps it in sync later.
  if (user.settings) {
    storage.set('user_show_tutorials', user.settings.showTutorials);
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

    // `clearAuth` and deliberately not `endSession`, unlike the link-layer
    // sites that see these same codes. This runs while a sign-in, register or
    // verification request is in flight, and a full auth reset would also drop
    // the selected-entity ids (breaking verification resume) and the
    // session-scoped state a sign-out clears. There is also no established
    // session's cache to clear here — this is a refused attempt to start one,
    // not a revoked one.
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
  toastService.error(
    errorService.getUserFriendlyMessage(payload.code, payload.message),
  );
  useStore.getState().setAuthIsLoading(false);
}

async function handleLogin(
  loginResponse: ResolvedAuthPayload,
  shouldRemember?: boolean,
  loginCredentials?: LoginCredentials,
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

  // RememberMe prompt is the no-biometrics fallback: offer to save credentials
  // when the device can't (or the user hasn't) set up biometric login, the user
  // has no stored credentials yet, and they haven't previously declined.
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
      const loginCredentials = {
        email: input.email,
        password: input.password,
      };

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
      // user activates via the emailed link, then logs in. Persist the
      // just-entered credentials so the post-verification login can prefill.
      store.setRegistrationPassword(input.password);

      // Persist to keychain (non-fatal)
      try {
        await clearTempRegistrationPassword();
        await saveTempRegistrationPassword(input.email, input.password);
      } catch {
        logger.warn('Non-fatal: failed to persist registration password');
      }

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
      // error, so surface its message the way handleAuthError surfaces
      // transport failures — a toast — and stay on the sign-up screen.
      toastService.error(payload.message);
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
   * Also delete this account's stored biometric credentials.
   *
   * Default FALSE, and deliberately so: biometric login exists precisely to
   * get the user back IN after a sign-out, so clearing the keychain here made
   * the feature structurally impossible — `hasCredentials` came back false on
   * the login screen (no biometric button) AND in
   * `shouldShowPostLoginBiometricPrompt` (enrol again, every login), and
   * `autoLogin` could never succeed after a manual sign-out.
   *
   * Enrolment is per account and biometry-gated, so leaving it in place does
   * not expose anything on a shared device — reading the slot still costs a
   * successful biometric prompt from that account's owner.
   *
   * Pass `true` only when the account itself is going away (delete account).
   * The user-facing way to forget a device is Profile → Security → disable,
   * which calls `removeCredentials` directly.
   */
  forgetDevice?: boolean;
}

async function logout(options?: LogoutOptions): Promise<void> {
  const store = useStore.getState();
  const user = store.user;

  try {
    const currentUserEmail = user?.email;
    const currentUserId = user?.id;

    // Biometric credentials SURVIVE a sign-out (see `LogoutOptions`). Only an
    // account that is going away takes its keychain slot with it; credentials
    // are scoped per account, so this never touches another user's.
    //
    // Done FIRST, not last. Everything below can throw, and the whole body is
    // wrapped in a catch that only logs — so a security-relevant deletion
    // parked at the end is a deletion that silently may not happen. There is
    // nothing to lose by clearing early: the caller has already decided the
    // account is gone, and logout always ends locally signed-out regardless.
    if (options?.forgetDevice && currentUserEmail) {
      await removeCredentials(currentUserEmail);
    }

    // Tear down the prior user's push/notification state before clearing auth,
    // so nothing survives on a shared device. Deregistration dispatches while
    // the client is still authenticated; the listener unsubscribe stops a
    // rotated token from being pushed under the logged-out session; and the
    // notification reset clears the persisted inbox/badge (badge follows via
    // badgeSync's post-hydration path).
    deregisterDeviceOnLogout();
    pushTokenRefreshUnsubscribe?.();
    pushTokenRefreshUnsubscribe = null;
    registeredDeviceId = null;

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

async function autoLogin(): Promise<boolean> {
  try {
    // No logged-in user yet — fall back to the most-recently-enrolled account.
    const email = await getLastBiometricEmail();
    if (!email) {
      logger.info('No stored credentials found for auto-login');
      return false;
    }

    const hasStoredCreds = await checkStoredCredentials(email);
    if (!hasStoredCreds) {
      logger.info('No stored credentials found for auto-login');
      return false;
    }

    const credentials = await loadStoredCredentials(email);
    if (!credentials) {
      logger.info('Failed to load stored credentials');
      return false;
    }

    if (!credentials.email || !credentials.password) {
      logger.warn('Invalid credentials found, clearing them');
      await removeCredentials(email);
      return false;
    }

    logger.info('Attempting auto-login with stored credentials');
    const result = await client.mutate({
      mutation: LoginDocument,
      variables: {
        input: { email: credentials.email, password: credentials.password },
      },
    });

    const payload = result.data?.login;

    if (isSuccessPayload(payload, 'AuthPayload')) {
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
      logger.warn('Auto-login failed, clearing stored credentials');
      await removeCredentials(email);
      handleAuthError(result.error, 'Auto-login');
    }

    return false;
  } catch (error) {
    logger.error('Auto-login error:', error);
    try {
      const email = await getLastBiometricEmail();
      if (email) await removeCredentials(email);
    } catch {
      logger.error('Failed to cleanup credentials after auto-login error');
    }
    return false;
  }
}

export const authService = {
  // Core operations
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
