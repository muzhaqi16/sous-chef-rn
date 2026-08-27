'use no memo';

import { act } from '@testing-library/react-native';
import { alertService, type AlertButton } from '#/services/alertService';
import type { SettingItem } from '#components/molecules/SettingRow';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { findByKey } from '#/test-utils/findByKey';
import { UpdateUserPreferencesDocument } from '#operations/auth/user.generated';
import type { RootState } from '#store/index';
import { useConfigurableSettings } from '../useConfigurableSettings';
import { logger } from '#/utils/environment';

// Shape of a single section entry in PROFILE_SETTINGS_CONFIG.
interface ConfigSection {
  id: string;
  titleKey: string;
  items: SettingItem[];
}

// Mock token scheduler / refreshToken
jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

// The sign-out button goes through authService, not the store's own `logout`
// action — the store action never deregisters the device for push, hands the
// offline queue its owner change, or removes the persisted queue/navigation
// keys, and two sign-out paths clearing different subsets is what left the
// previous person's data on a shared device.
const mockLogout = jest.fn();
jest.mock('#/services/authService', () => ({
  authService: { logout: (...args: unknown[]) => mockLogout(...args) },
}));

const mockGetUserNavigationState = jest.fn(
  (): ReturnType<RootState['getUserNavigationState']> => null,
);
const mockSetLanguage = jest.fn();

jest.mock('#store/useAppStore', () => ({
  useAppStore: jest.fn(<T,>(selector: (state: RootState) => T) => {
    const state: Partial<RootState> = {
      user: {
        id: 'user-1',
        email: 'test@example.com',
        emailVerified: true,
        onBoarded: true,
      },
      getUserNavigationState: mockGetUserNavigationState,
      language: 'en',
      setLanguage: mockSetLanguage,
    };
    return typeof selector === 'function'
      ? selector(state as RootState)
      : state;
  }),
  useUser: jest.fn(() => ({ id: 'user-1', email: 'test@example.com' })),
  useNavigationUtils: jest.fn(() => ({
    getUserNavigationState: mockGetUserNavigationState,
  })),
  usePreferences: jest.fn(() => ({
    language: 'en',
    setLanguage: mockSetLanguage,
  })),
}));

const mockCheckStoredCredentials = jest.fn().mockResolvedValue(false);
const mockGetBiometricInfo = jest.fn().mockResolvedValue({
  isAvailable: false,
  biometryType: null,
});
const mockRemoveCredentials = jest.fn();

jest.mock('#hooks/auth/useCredentialStorage', () => ({
  useCredentialStorage: jest.fn(() => ({
    checkStoredCredentials: mockCheckStoredCredentials,
    getBiometricInfo: mockGetBiometricInfo,
    removeCredentials: mockRemoveCredentials,
  })),
}));

const mockResetBiometricDeclination = jest.fn();
const mockMarkBiometricEnabled = jest.fn();
jest.mock('#hooks/navigation/useAuthPreferences', () => ({
  useAuthPreferences: jest.fn(() => ({
    resetBiometricDeclination: mockResetBiometricDeclination,
    markBiometricEnabled: mockMarkBiometricEnabled,
  })),
}));

// Mirrors the real PROFILE_SETTINGS_CONFIG's SHAPE — navigation, modal, switch
// and action rows. It deliberately contains no personal-information fields:
// those live in PERSONAL_INFO_CONFIG and are rendered by
// PersonalInformationScreen, so a fixture that put them here would test a path
// production cannot reach. It previously did, and eleven unreachable branches
// in the hook survived because of it.
jest.mock('#/config/settingsConfig', () => ({
  PROFILE_SETTINGS_CONFIG: [
    {
      id: 'appearanceAndLanguage',
      titleKey: 'profile.sections.appearanceAndLanguage',
      items: [
        {
          key: 'appearance',
          labelKey: 'labels.appearance',
          type: 'navigation',
        },
        { key: 'language', labelKey: 'labels.language', type: 'modal' },
      ],
    },
    {
      id: 'security',
      titleKey: 'labels.security',
      items: [
        {
          key: 'biometricAuthentication',
          labelKey: 'profile.labels.biometricAuthentication',
          type: 'switch',
        },
      ],
    },
    {
      id: 'logout',
      titleKey: '',
      items: [
        { key: 'logout', labelKey: 'profile.labels.logout', type: 'action' },
      ],
    },
  ],
}));

jest.mock('#utils/dateUtils', () => ({
  dateStringToISO: jest.fn((v: string) => v),
  extractDateString: jest.fn((v: unknown) => v || ''),
}));

jest.mock('#components/organisms/BiometricSetupModal', () => ({
  BiometricSetupModal: 'BiometricSetupModal',
}));

jest.mock('#/utils/finallyHelpers');

const mockPendingCount = jest.fn(() => 0);
jest.mock('#/apollo/offlineQueue/queueStore', () => ({
  queueStore: { getPendingCount: () => mockPendingCount() },
}));

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

/**
 * The settings mutation this hook still fires (language + preference writes).
 *
 * It used to also mock `UpdateUserProfileDocument`; the hook no longer writes
 * profile fields, so that mock went with the branches that did.
 */
function buildMocks() {
  const settings = recordMock(UpdateUserPreferencesDocument, {
    data: {
      updateSettings: {
        __typename: 'UpdateSettingsPayload',
        success: true,
        message: '',
        code: 'SUCCESS',
        userSettings: {
          __typename: 'UserSettings',
          id: 'settings-1',
          theme: 'LIGHT',
          compactMode: false,
          showTutorials: true,
          autoSync: true,
          offlineMode: false,
          shareUsageData: false,
          shareWithPartners: false,
          personalizedAds: false,
          preferredUnitSystem: 'METRIC',
          language: 'en',
          timezone: 'UTC',
          preferredCurrency: 'USD',
          enabledFeatures: [],
          betaFeatures: [],
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
          user: {
            __typename: 'User',
            id: 'user-1',
            email: 'test@example.com',
          },
        },
      },
    },
  });
  return { settings };
}

/**
 * Sections by their stable id rather than by position.
 *
 * These assertions used to index `sections[1]` / `sections[3]`, so removing one
 * section from the fixture silently re-pointed nine tests at the wrong section.
 */
const sectionById = (
  sections: ReturnType<typeof useConfigurableSettings>['sections'],
  id: string,
) => {
  const found = sections.find(s => s.key === id);
  if (!found) throw new Error(`no section with id "${id}"`);
  return found;
};

describe('useConfigurableSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns sections from config', () => {
    const { settings } = buildMocks();
    const { result } = renderHookWithApollo(() => useConfigurableSettings(), {
      operationMocks: [settings.mock],
    });

    expect(result.current.sections).toHaveLength(3);
    // `key` is the section's stable id; `title` is the resolved i18n key. The
    // two are asserted together because the screen branches on the former and
    // renders the latter, and they used to be the same English string.
    expect(result.current.sections.map(s => s.key)).toEqual([
      'appearanceAndLanguage',
      'security',
      'logout',
    ]);
    expect(result.current.sections[0].title).toBe('Appearance & Language');
  });

  it('returns BiometricModal element', () => {
    const { settings } = buildMocks();
    const { result } = renderHookWithApollo(() => useConfigurableSettings(), {
      operationMocks: [settings.mock],
    });
    expect(result.current.BiometricModal).toBeDefined();
  });

  it('creates appearance navigation entry', () => {
    const { settings } = buildMocks();
    const { result } = renderHookWithApollo(() => useConfigurableSettings(), {
      operationMocks: [settings.mock],
    });

    const appearanceSection = sectionById(
      result.current.sections,
      'appearanceAndLanguage',
    );
    const appearanceItem = findByKey(appearanceSection.items, 'appearance');

    expect(appearanceItem).toBeDefined();
    expect(appearanceItem.type).toBe('navigation');
  });

  it('signs out through authService when the logout action is pressed', () => {
    const { settings } = buildMocks();
    const { result } = renderHookWithApollo(() => useConfigurableSettings(), {
      operationMocks: [settings.mock],
    });

    const accountSection = sectionById(result.current.sections, 'logout');
    const logoutItem = findByKey(accountSection.items, 'logout');

    act(() => {
      logoutItem.onPress?.();
    });

    expect(mockLogout).toHaveBeenCalled();
  });

  it('warns before signing out while writes are still queued', async () => {
    // Deliberate sign-out deletes the queue, so anything waiting to replay is
    // destroyed. This path used to do it silently.
    mockPendingCount.mockReturnValue(3);
    const { settings } = buildMocks();
    const { result } = renderHookWithApollo(() => useConfigurableSettings(), {
      operationMocks: [settings.mock],
    });

    const logoutItem = findByKey(
      sectionById(result.current.sections, 'logout').items,
      'logout',
    );

    act(() => {
      logoutItem.onPress?.();
    });

    expect(mockLogout).not.toHaveBeenCalled();
    expect(alertService.alert).toHaveBeenCalled();

    const alertCalls = (alertService.alert as jest.Mock).mock.calls;
    const buttons = alertCalls[alertCalls.length - 1][2] as AlertButton[];
    const confirm = buttons.find(b => b.style === 'destructive');

    await act(async () => {
      await confirm?.onPress?.();
    });

    expect(mockLogout).toHaveBeenCalled();
    mockPendingCount.mockReturnValue(0);
  });

  it('biometric setting shows not available when device lacks biometrics', () => {
    const { settings } = buildMocks();
    const { result } = renderHookWithApollo(() => useConfigurableSettings(), {
      operationMocks: [settings.mock],
    });

    const securitySection = sectionById(result.current.sections, 'security');
    const biometricItem = findByKey(
      securitySection.items,
      'biometricAuthentication',
    );

    expect(biometricItem).toBeDefined();
    expect(biometricItem.disabled).toBe(true);
  });

  it('creates language setting as modal with correct options', () => {
    const { settings } = buildMocks();
    const { result } = renderHookWithApollo(() => useConfigurableSettings(), {
      operationMocks: [settings.mock],
    });
    const langItem = findByKey(
      sectionById(result.current.sections, 'appearanceAndLanguage').items,
      'language',
    );
    expect(langItem).toBeDefined();
    expect(langItem.value).toBe('en');
    expect(langItem.options).toBeDefined();
  });

  it('calls setLanguage and updateSettings when language is saved', () => {
    const { settings } = buildMocks();
    const { result } = renderHookWithApollo(() => useConfigurableSettings(), {
      operationMocks: [settings.mock],
    });
    const langItem = findByKey(
      sectionById(result.current.sections, 'appearanceAndLanguage').items,
      'language',
    );
    act(() => {
      langItem.onSave?.('es');
    });
    expect(mockSetLanguage).toHaveBeenCalledWith('es');
    expect(settings.fired).toContainEqual({
      input: { regional: { language: 'es' } },
    });
  });

  it('biometric setting shows modal when enabled from disabled state', async () => {
    mockGetBiometricInfo.mockResolvedValue({
      isAvailable: true,
      biometryType: 'FaceID',
    });
    mockCheckStoredCredentials.mockResolvedValue(false);

    const { settings } = buildMocks();
    const { result, rerender } = renderHookWithApollo(
      () => useConfigurableSettings(),
      { operationMocks: [settings.mock] },
    );
    // Wait for biometric info to load
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    rerender(undefined);

    const biometricItem = findByKey(
      sectionById(result.current.sections, 'security').items,
      'biometricAuthentication',
    );
    expect(biometricItem.disabled).toBe(false);
    expect(biometricItem.subtitle).toContain('FaceID');
  });

  it('biometric loading state shows checking message', () => {
    // The initial biometricLoading is true when user has email
    const { settings } = buildMocks();
    const { result } = renderHookWithApollo(() => useConfigurableSettings(), {
      operationMocks: [settings.mock],
    });
    const biometricItem = findByKey(
      sectionById(result.current.sections, 'security').items,
      'biometricAuthentication',
    );
    // biometricLoading starts as true when user?.email is set
    expect(biometricItem.disabled).toBe(true);
  });

  it('biometric shows wasDeclined subtitle when permanently declined', async () => {
    mockGetBiometricInfo.mockResolvedValue({
      isAvailable: true,
      biometryType: 'FaceID',
    });
    mockCheckStoredCredentials.mockResolvedValue(false);
    mockGetUserNavigationState.mockReturnValue({
      biometricDeclinedPermanently: true,
    });

    const { settings } = buildMocks();
    const { result } = renderHookWithApollo(() => useConfigurableSettings(), {
      operationMocks: [settings.mock],
    });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    const biometricItem = findByKey(
      sectionById(result.current.sections, 'security').items,
      'biometricAuthentication',
    );
    expect(biometricItem.subtitle).toContain('Tap to enable');
  });

  it('returns biometricLoading state', () => {
    const { settings } = buildMocks();
    const { result } = renderHookWithApollo(() => useConfigurableSettings(), {
      operationMocks: [settings.mock],
    });
    expect(typeof result.current.biometricLoading).toBe('boolean');
  });

  describe('navigation items', () => {
    it('creates navigation items with onPress', () => {
      const { PROFILE_SETTINGS_CONFIG } = require('#/config/settingsConfig');
      const original = [...PROFILE_SETTINGS_CONFIG];
      PROFILE_SETTINGS_CONFIG.length = 0;
      PROFILE_SETTINGS_CONFIG.push({
        title: 'Nav',
        items: [
          {
            key: 'personalInformation',
            label: 'Personal Information',
            type: 'navigation',
          },
          { key: 'notifications', label: 'Notifications', type: 'navigation' },
          {
            key: 'dietaryProfile',
            label: 'Dietary Profile',
            type: 'navigation',
          },
          { key: 'appSettings', label: 'App Settings', type: 'navigation' },
          { key: 'debugInfo', label: 'Debug Info', type: 'navigation' },
          {
            key: 'performanceDashboard',
            label: 'Performance Dashboard',
            type: 'navigation',
          },
          {
            key: 'changePassword',
            label: 'Change Password',
            type: 'navigation',
          },
        ],
      });

      const { settings } = buildMocks();
      const { result } = renderHookWithApollo(() => useConfigurableSettings(), {
        operationMocks: [settings.mock],
      });
      const items = result.current.sections[0].items;

      items.forEach((item: SettingItem) => {
        expect(typeof item.onPress).toBe('function');
        // Should not throw
        act(() => {
          item.onPress?.();
        });
      });

      PROFILE_SETTINGS_CONFIG.length = 0;
      original.forEach((item: ConfigSection) =>
        PROFILE_SETTINGS_CONFIG.push(item),
      );
    });
  });

  describe('testID assignments', () => {
    it('assigns correct testIDs to navigation items', () => {
      const { PROFILE_SETTINGS_CONFIG } = require('#/config/settingsConfig');
      const original = [...PROFILE_SETTINGS_CONFIG];
      PROFILE_SETTINGS_CONFIG.length = 0;
      PROFILE_SETTINGS_CONFIG.push({
        title: 'Nav',
        items: [
          { key: 'personalInformation', label: 'PI', type: 'navigation' },
          { key: 'notifications', label: 'N', type: 'navigation' },
          { key: 'dietaryProfile', label: 'DP', type: 'navigation' },
          { key: 'appSettings', label: 'AS', type: 'navigation' },
          { key: 'debugInfo', label: 'DI', type: 'navigation' },
          { key: 'performanceDashboard', label: 'PD', type: 'navigation' },
          { key: 'logout', label: 'Logout', type: 'action' },
          { key: 'privacy', label: 'Privacy', type: 'navigation' },
          { key: 'help', label: 'Help', type: 'navigation' },
          { key: 'about', label: 'About', type: 'navigation' },
          { key: 'feedback', label: 'Feedback', type: 'navigation' },
        ],
      });

      const { settings } = buildMocks();
      const { result } = renderHookWithApollo(() => useConfigurableSettings(), {
        operationMocks: [settings.mock],
      });
      const items = result.current.sections[0].items;

      expect(findByKey(items, 'personalInformation').testID).toBe(
        'profile-menu-personalInformation',
      );
      expect(findByKey(items, 'notifications').testID).toBe(
        'profile-menu-notifications',
      );
      expect(findByKey(items, 'dietaryProfile').testID).toBe(
        'profile-menu-dietaryProfile',
      );
      expect(findByKey(items, 'appSettings').testID).toBe(
        'profile-menu-appSettings',
      );
      expect(findByKey(items, 'debugInfo').testID).toBe(
        'profile-menu-debugInfo',
      );
      expect(findByKey(items, 'performanceDashboard').testID).toBe(
        'profile-menu-performanceDashboard',
      );
      expect(findByKey(items, 'logout').testID).toBe('profile-logout-button');
      expect(findByKey(items, 'privacy').testID).toBe('profile-menu-privacy');
      expect(findByKey(items, 'help').testID).toBe('profile-menu-help');
      expect(findByKey(items, 'about').testID).toBe('profile-menu-about');
      expect(findByKey(items, 'feedback').testID).toBe('profile-menu-feedback');

      PROFILE_SETTINGS_CONFIG.length = 0;
      original.forEach((item: ConfigSection) =>
        PROFILE_SETTINGS_CONFIG.push(item),
      );
    });
  });

  describe('default/unknown config key', () => {
    it('logs warning for unhandled setting key', () => {
      const { PROFILE_SETTINGS_CONFIG } = require('#/config/settingsConfig');
      const original = [...PROFILE_SETTINGS_CONFIG];
      PROFILE_SETTINGS_CONFIG.length = 0;
      PROFILE_SETTINGS_CONFIG.push({
        id: 'unknown',
        titleKey: '',
        items: [
          { key: 'unknownKey', labelKey: 'labels.unknown', type: 'text' },
        ],
      });

      const { settings } = buildMocks();
      renderHookWithApollo(() => useConfigurableSettings(), {
        operationMocks: [settings.mock],
      });
      expect(logger.warn).toHaveBeenCalledWith(
        'Unhandled setting key: unknownKey',
      );

      PROFILE_SETTINGS_CONFIG.length = 0;
      original.forEach((item: ConfigSection) =>
        PROFILE_SETTINGS_CONFIG.push(item),
      );
    });
  });

  describe('biometric authentication', () => {
    it('biometric onPress does nothing when not available', async () => {
      mockGetBiometricInfo.mockResolvedValue({
        isAvailable: false,
        biometryType: null,
      });
      mockCheckStoredCredentials.mockResolvedValue(false);

      const { settings } = buildMocks();
      const { result } = renderHookWithApollo(() => useConfigurableSettings(), {
        operationMocks: [settings.mock],
      });
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      const biometricItem = findByKey(
        sectionById(result.current.sections, 'security').items,
        'biometricAuthentication',
      );

      await act(async () => {
        await biometricItem.onPress?.();
      });

      // Should not show modal or alert
      expect(alertService.alert).not.toHaveBeenCalled();
    });

    it('biometric onPress shows modal when available and not enabled', async () => {
      mockGetBiometricInfo.mockResolvedValue({
        isAvailable: true,
        biometryType: 'FaceID',
      });
      mockCheckStoredCredentials.mockResolvedValue(false);

      const { settings } = buildMocks();
      const { result } = renderHookWithApollo(() => useConfigurableSettings(), {
        operationMocks: [settings.mock],
      });
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      const biometricItem = findByKey(
        sectionById(result.current.sections, 'security').items,
        'biometricAuthentication',
      );

      await act(async () => {
        await biometricItem.onPress?.();
      });

      // The modal state should be set (no alert, but modal opened)
      expect(alertService.alert).not.toHaveBeenCalled();
    });

    it('biometric onPress shows disable alert when currently enabled', async () => {
      mockGetBiometricInfo.mockResolvedValue({
        isAvailable: true,
        biometryType: 'FaceID',
      });
      mockCheckStoredCredentials.mockResolvedValue(true);

      const { settings } = buildMocks();
      const { result } = renderHookWithApollo(() => useConfigurableSettings(), {
        operationMocks: [settings.mock],
      });
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      const biometricItem = findByKey(
        sectionById(result.current.sections, 'security').items,
        'biometricAuthentication',
      );

      await act(async () => {
        await biometricItem.onPress?.();
      });

      expect(alertService.alert).toHaveBeenCalledWith(
        'Disable Biometric Authentication',
        expect.any(String),
        expect.any(Array),
      );
    });

    it('biometric disable alert calls removeCredentials on confirm', async () => {
      mockGetBiometricInfo.mockResolvedValue({
        isAvailable: true,
        biometryType: 'FaceID',
      });
      mockCheckStoredCredentials.mockResolvedValue(true);

      const { settings } = buildMocks();
      const { result } = renderHookWithApollo(() => useConfigurableSettings(), {
        operationMocks: [settings.mock],
      });
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      const biometricItem = findByKey(
        sectionById(result.current.sections, 'security').items,
        'biometricAuthentication',
      );

      await act(async () => {
        await biometricItem.onPress?.();
      });

      // Get the 'Disable' button from the alert
      const alertCalls = (alertService.alert as jest.Mock).mock.calls;
      const lastCall = alertCalls[alertCalls.length - 1];
      const buttons = lastCall[2] as AlertButton[];
      const disableButton = buttons.find(b => b.text === 'Disable');

      await act(async () => {
        await disableButton?.onPress?.();
      });

      expect(mockRemoveCredentials).toHaveBeenCalledWith('test@example.com');
    });

    it('biometric uses "biometric" fallback when biometryType is null', async () => {
      mockGetBiometricInfo.mockResolvedValue({
        isAvailable: true,
        biometryType: null,
      });
      mockCheckStoredCredentials.mockResolvedValue(true);

      const { settings } = buildMocks();
      const { result } = renderHookWithApollo(() => useConfigurableSettings(), {
        operationMocks: [settings.mock],
      });
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      const biometricItem = findByKey(
        sectionById(result.current.sections, 'security').items,
        'biometricAuthentication',
      );

      expect(biometricItem.subtitle).toContain('biometric');
    });

    it('biometric loading starts false when no user email', () => {
      const storeModule = require('#store/useAppStore');
      storeModule.useAppStore.mockImplementation(
        <T,>(selector: (state: RootState) => T) => {
          const state: Partial<RootState> = {
            user: {
              id: 'user-1',
              email: '',
              emailVerified: true,
              onBoarded: true,
            },
            getUserNavigationState: mockGetUserNavigationState,
            language: 'en',
            setLanguage: mockSetLanguage,
          };
          return typeof selector === 'function'
            ? selector(state as RootState)
            : state;
        },
      );
      storeModule.useUser.mockReturnValue({ id: 'user-1', email: '' });

      const { settings } = buildMocks();
      const { result } = renderHookWithApollo(() => useConfigurableSettings(), {
        operationMocks: [settings.mock],
      });
      expect(result.current.biometricLoading).toBe(false);

      // Restore mock
      storeModule.useAppStore.mockImplementation(
        <T,>(selector: (state: RootState) => T) => {
          const state: Partial<RootState> = {
            user: {
              id: 'user-1',
              email: 'test@example.com',
              emailVerified: true,
              onBoarded: true,
            },
            getUserNavigationState: mockGetUserNavigationState,
            language: 'en',
            setLanguage: mockSetLanguage,
          };
          return typeof selector === 'function'
            ? selector(state as RootState)
            : state;
        },
      );
      storeModule.useUser.mockReturnValue({
        id: 'user-1',
        email: 'test@example.com',
      });
    });
  });

  describe('handleBiometricModalComplete', () => {
    it('sets biometricEnabled to true and resets declination when enabled', async () => {
      mockGetBiometricInfo.mockResolvedValue({
        isAvailable: true,
        biometryType: 'FaceID',
      });
      mockCheckStoredCredentials.mockResolvedValue(false);

      const { settings } = buildMocks();
      const { result } = renderHookWithApollo(() => useConfigurableSettings(), {
        operationMocks: [settings.mock],
      });
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Trigger the modal open
      const biometricItem = findByKey(
        sectionById(result.current.sections, 'security').items,
        'biometricAuthentication',
      );
      await act(async () => {
        await biometricItem.onPress?.();
      });

      // Simulate BiometricSetupModal completing with enabled = true
      // We need to access the BiometricModal's onComplete prop
      const modal = result.current.BiometricModal;
      expect(modal).toBeDefined();

      await act(async () => {
        await modal.props.onComplete(true);
      });

      expect(mockResetBiometricDeclination).toHaveBeenCalled();
      expect(mockMarkBiometricEnabled).toHaveBeenCalled();
    });

    it('re-checks credentials when modal completes with enabled=false', async () => {
      mockGetBiometricInfo.mockResolvedValue({
        isAvailable: true,
        biometryType: 'FaceID',
      });
      mockCheckStoredCredentials.mockResolvedValue(false);

      const { settings } = buildMocks();
      const { result } = renderHookWithApollo(() => useConfigurableSettings(), {
        operationMocks: [settings.mock],
      });
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      const modal = result.current.BiometricModal;
      await act(async () => {
        await modal.props.onComplete(false);
      });

      expect(mockCheckStoredCredentials).toHaveBeenCalledWith(
        'test@example.com',
      );
    });
  });

  describe('biometric loading failure', () => {
    // Driven through the real dependency rather than by stubbing the wrapper
    // that catches it, so the hook's own error path is what runs.
    it('finishes loading and reports biometrics unavailable when the keychain read fails', async () => {
      mockGetBiometricInfo.mockRejectedValueOnce(new Error('keychain locked'));

      const { settings } = buildMocks();
      const { result } = renderHookWithApollo(() => useConfigurableSettings(), {
        operationMocks: [settings.mock],
      });
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(result.current.biometricLoading).toBe(false);

      // An unreadable keychain must not present biometrics as set up. The row
      // is the observable surface: off, and not togglable.
      const biometricItem = findByKey(
        result.current.sections.flatMap(section => section.items),
        'biometricAuthentication',
      );
      expect(biometricItem.value).toBe(false);
      expect(biometricItem.disabled).toBe(true);
    });
  });
});
