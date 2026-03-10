/**
 * Auth Service - Singleton service for authentication operations.
 *
 * Extracts business logic from useAuthOperations + useCredentialStorage into
 * a testable, non-React service. All dependencies are singletons:
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
  RegisterDeviceDocument,
  type LoginInput,
  type RegisterInput,
  type LoginMutation,
  type LoginMutationVariables,
  type RegisterMutation,
  type RegisterMutationVariables,
  type RegisterDeviceMutation,
  type RegisterDeviceMutationVariables,
  type DeviceRegistrationInput,
} from '#generated';
import {
  loadCredentials,
  loadCredentialsForAccount,
  saveCredentials,
  hasCredentials,
  hasCredentialsForAccount,
  clearCredentials,
  getStoredAccounts,
  getBiometricCapability,
  saveTempRegistrationPassword,
  clearTempRegistrationPassword,
} from '#/storage/keychain';
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
  try {
    if (email) {
      return await hasCredentialsForAccount();
    }
    return await hasCredentials();
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
  const store = useStore.getState();
  store.setAuthIsLoadingCredentials(true);

  try {
    const credentials = email
      ? await loadCredentialsForAccount()
      : await loadCredentials();

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
): DeviceRegistrationInput {
  return {
    deviceId: deviceInfo.deviceId,
    deviceName: deviceInfo.deviceName,
    deviceType: deviceInfo.deviceType,
    platform: deviceInfo.platform,
    appVersion: deviceInfo.appVersion,
    pushToken: undefined,
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

async function registerDeviceOnce(): Promise<boolean> {
  try {
    const deviceInfo = await collectDeviceInformation();
    if (!validateDeviceInformation(deviceInfo)) {
      logger.error('Invalid device information collected');
      return false;
    }

    const result = await client.mutate<
      RegisterDeviceMutation,
      RegisterDeviceMutationVariables
    >({
      mutation: RegisterDeviceDocument,
      variables: { input: buildDeviceInput(deviceInfo) },
    });

    if (!result.data?.registerDevice?.success) {
      logger.error(
        'Device registration failed:',
        result.data?.registerDevice?.message,
      );
      return false;
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

function bootstrapUserStore(user: any): void {
  const storeState = useStore.getState();
  if (user.defaultHomeId) {
    const pantries = user.defaultHome?.pantriesConnection?.edges;
    const defaultPantry =
      pantries?.find((e: any) => e.node.isDefault)?.node ?? pantries?.[0]?.node;
    const pantryId = defaultPantry?.id ?? null;

    storeState.setHomeAndPantry(user.defaultHomeId, pantryId);
    if (pantryId) {
      storeState.setIsHomeSelectionReady(true);
    }
  }
  if (user.defaultShoppingListId) {
    storeState.setSelectedShoppingListId(user.defaultShoppingListId);
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

// --- Core auth operations ---

function handleAuthError(error: any, operation = 'Authentication'): void {
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
  loginResponse: any,
  shouldRemember?: boolean,
  loginCredentials?: LoginCredentials,
): Promise<boolean> {
  if (!loginResponse?.user) return false;

  const { user, accessToken, refreshToken } = loginResponse;
  const store = useStore.getState();
  const previousUserId = queueStore.getCurrentUserId();

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
  registerDeviceInBackground();
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

  // Check biometric setup eligibility (skip during registration)
  if (loginCredentials && user.emailVerified && user.onBoarded) {
    try {
      const biometricResult =
        await shouldShowPostLoginBiometricPrompt(user);
      if (biometricResult.shouldShow) {
        store.setPostLoginCredentials(loginCredentials);
        store.setShowBiometricSetup(true);
        return true;
      }
    } catch {
      logger.error('Error checking biometric eligibility');
    }
  }

  store.setNavigationState('main_app');
  return false;
}

async function handleRegistration(
  registerResponse: any,
  shouldRemember?: boolean,
): Promise<void> {
  if (!registerResponse?.user) return;

  const { user, accessToken, refreshToken } = registerResponse;
  const store = useStore.getState();

  store.setAuth(user, accessToken, refreshToken);
  bootstrapUserStore(user);

  if (shouldRemember !== undefined) {
    store.setRememberMe(shouldRemember);
  }

  if (user.id) {
    store.setUserNavigationState(user.id, {
      lastLoginTimestamp: Date.now(),
      rememberMeChoice: shouldRemember,
      isNewUser: true,
    });
  }

  logger.info('Auth success: Registration successful');
  registerDeviceInBackground();

  if (!user.emailVerified) {
    store.setNavigationState('verification');
    return;
  }
  if (!user.onBoarded) {
    store.setNavigationState('onboarding');
    return;
  }
  store.setNavigationState('main_app');
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

    const hasCreds = await hasCredentialsForAccount();
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

      const biometricTriggered = await handleLogin(
        result.data.login,
        true,
        loginCredentials,
      );

      if (showRememberPrompt && !biometricTriggered) {
        const hasStoredCreds = await checkStoredCredentials(input.email);
        const prefs = getUserPreferences();
        if (!hasStoredCreds && prefs?.shouldShowCredentialPrompt()) {
          // Store pending credentials in Zustand for the RememberMe modal
          store.setPostLoginCredentials(loginCredentials);
          // Signal that RememberMe prompt should show
          // (useRememberMe hook in useAuth reads this)
          prefs.trackCredentialPromptShown();
        }
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

    if (result.data?.register) {
      store.setRegistrationPassword(input.password);

      // Persist to keychain (non-fatal)
      try {
        await clearTempRegistrationPassword();
        await saveTempRegistrationPassword(input.email, input.password);
      } catch {
        logger.warn('Non-fatal: failed to persist registration password');
      }

      if (result.data.register.user?.id) {
        const prefs = getUserPreferences(result.data.register.user.id);
        prefs?.clearRegistrationPreferences();
      }

      await handleRegistration(result.data.register, shouldRemember);
      store.setAuthIsLoading(false);
      return true;
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

async function logout(clearAllCredentials = false): Promise<void> {
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

    if (clearAllCredentials) {
      await removeCredentials();
    } else if (currentUserEmail) {
      await removeCredentials(currentUserEmail);
    }
  } catch (error) {
    logger.error('Logout error:', error);
  }
}

async function autoLogin(): Promise<boolean> {
  try {
    const hasStoredCreds = await checkStoredCredentials();
    if (!hasStoredCreds) {
      logger.info('No stored credentials found for auto-login');
      return false;
    }

    const credentials = await loadStoredCredentials();
    if (!credentials) {
      logger.info('Failed to load stored credentials');
      return false;
    }

    if (!credentials.email || !credentials.password) {
      logger.warn('Invalid credentials found, clearing them');
      await removeCredentials();
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
      await handleLogin(result.data.login, true);
      logger.info('Auto-login successful');
      return true;
    }

    if (result.error) {
      logger.warn('Auto-login failed, clearing stored credentials');
      await removeCredentials();
      handleAuthError(result.error, 'Auto-login');
    }

    return false;
  } catch (error) {
    logger.error('Auto-login error:', error);
    try {
      await removeCredentials();
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
  handleRegistration,
  handleAuthError,

  // Credential management
  checkStoredCredentials,
  loadStoredCredentials,
  storeCredentials,
  removeCredentials,
  getAvailableAccounts,
  getBiometricInfo,

  // Device registration
  registerDeviceInBackground,
};
