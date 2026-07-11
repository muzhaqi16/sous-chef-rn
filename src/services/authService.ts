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
import { LogoutCleanup } from '#/apollo/logoutCleanup';
import { queueManager } from '#/apollo/offlineQueue/queueManager';
import { queueStore } from '#/apollo/offlineQueue/queueStore';
import { errorService } from '#/services/errorService';
import { toastService } from '#/services/toastService';
import { useStore } from '#store';
import { logger } from '#/utils/environment';
import { incrementLoginCount } from '#/hooks/useFeatureHint';
import {
  LoginDocument,
  RegisterDocument,
  type LoginMutation,
  type LoginMutationVariables,
  type RegisterMutation,
  type RegisterMutationVariables,
} from '#operations/auth/auth.generated';
import {
  LoginUserFragmentDoc,
  type LoginUserFragment,
} from '#operations/auth/userFragments.generated';
import {
  RegisterDeviceDocument,
  type RegisterDeviceMutation,
  type RegisterDeviceMutationVariables,
  UpdateDeviceDocument,
  type UpdateDeviceMutation,
  type UpdateDeviceMutationVariables,
} from '#operations/auth/device.generated';
import {
  type LoginInput,
  type RegisterInput,
  type RegisterDeviceInput,
} from '#/graphql/generated/schemaTypes';
import {
  acquirePushToken,
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

async function checkStoredCredentials(email?: string): Promise<boolean> {
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

/** Push a rotated push token to the server for the registered device. */
async function pushRotatedTokenToServer(
  deviceId: string,
  pushToken: string,
): Promise<void> {
  try {
    await client.mutate<UpdateDeviceMutation, UpdateDeviceMutationVariables>({
      mutation: UpdateDeviceDocument,
      variables: { input: { id: deviceId, pushToken } },
    });
    logger.info('Device push token updated after rotation');
  } catch (error) {
    logger.error('Failed to update rotated push token:', error);
  }
}

async function registerDeviceOnce(): Promise<boolean> {
  try {
    const deviceInfo = await collectDeviceInformation();
    if (!validateDeviceInformation(deviceInfo)) {
      logger.error('Invalid device information collected');
      return false;
    }

    // Acquire the push token via the platform provider (no-op → null until the
    // native provider is installed; then permission-gated). Never blocks
    // registration — a null token registers the device without push, as before.
    const pushToken = await acquirePushToken();

    const result = await client.mutate<
      RegisterDeviceMutation,
      RegisterDeviceMutationVariables
    >({
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
      pushTokenRefreshUnsubscribe?.();
      pushTokenRefreshUnsubscribe = onPushTokenRefresh(token => {
        void pushRotatedTokenToServer(deviceId, token);
      });
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
  // any screen (and its tutorial hooks) mounts, so a returning user who already
  // finished the tutorials doesn't see the coach marks flash on a new device.
  // useShowTutorials reads this MMKV key; useAppSettings keeps it in sync later.
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

    if (
      isAuthError &&
      (code === 'AUTH_TOKEN_EXPIRED' || code === 'AUTH_REFRESH_TOKEN_INVALID')
    ) {
      useStore.getState().clearAuth();
    }
  } catch {
    toastService.error('Something went wrong. Please try again.');
  }
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
  email: string;
}): Promise<{ shouldShow: boolean; reason?: string }> {
  if (!targetUser?.id || !targetUser?.email) {
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

    const hasCreds = await hasCredentials(targetUser.email);
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
    const result = await client.mutate<LoginMutation, LoginMutationVariables>({
      mutation: LoginDocument,
      variables: { input },
    });

    if (result.data?.login) {
      const loginCredentials = {
        email: input.email,
        password: input.password,
      };

      const unmaskedLogin = unmaskAuthPayload(result.data.login);
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
    const result = await client.mutate<
      RegisterMutation,
      RegisterMutationVariables
    >({
      mutation: RegisterDocument,
      variables: { input },
    });

    const payload = result.data?.register;

    if (payload?.__typename === 'RegisterPayload') {
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

async function logout(): Promise<void> {
  const store = useStore.getState();
  const user = store.user;

  try {
    const currentUserEmail = user?.email;
    const currentUserId = user?.id;

    await LogoutCleanup.performLogoutCleanup();

    if (currentUserId) {
      queueManager.onLogout(currentUserId);
    }

    store.clearAuth();
    LogoutCleanup.completeLogout();
    store.setNavigationState('auth');

    if (currentUserId) {
      const prefs = getUserPreferences(currentUserId);
      prefs?.trackLogout();
    }

    // Clear only this account's biometric credentials. Credentials are scoped
    // per account, so logging one user out never touches another's slot.
    if (currentUserEmail) {
      await removeCredentials(currentUserEmail);
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
    const result = await client.mutate<LoginMutation, LoginMutationVariables>({
      mutation: LoginDocument,
      variables: {
        input: { email: credentials.email, password: credentials.password },
      },
    });

    if (result.data?.login) {
      const unmaskedLogin = unmaskAuthPayload(result.data.login);
      if (unmaskedLogin) {
        await handleLogin(unmaskedLogin, true);
      }
      logger.info('Auto-login successful');
      return true;
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
