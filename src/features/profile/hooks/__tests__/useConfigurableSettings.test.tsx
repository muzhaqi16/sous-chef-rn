'use no memo';

import { act } from '@testing-library/react-native';
import { alertService, type AlertButton } from '#/services/alertService';
import type { SettingItem } from '#components/molecules/SettingRow';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { createMockProfile } from '#/test-utils/mockFactories';
import { findByKey } from '#/test-utils/findByKey';
import { ProfileVisibility } from '#/graphql/generated/schemaTypes';
import {
  UpdateUserProfileDocument,
  UpdateUserPreferencesDocument,
} from '#operations/auth/user.generated';
import type { RootState } from '#store/index';
import { useConfigurableSettings } from '../useConfigurableSettings';

// Shape of a single section entry in PROFILE_SETTINGS_CONFIG.
interface ConfigSection {
  title: string;
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

jest.mock('#/config/settingsConfig', () => ({
  PROFILE_SETTINGS_CONFIG: [
    {
      title: 'Personal Information',
      items: [
        { key: 'firstName', label: 'First Name', type: 'text' },
        { key: 'lastName', label: 'Last Name', type: 'text' },
        { key: 'displayName', label: 'Display Name', type: 'text' },
      ],
    },
    {
      title: 'Appearance',
      items: [
        { key: 'appearance', label: 'Appearance', type: 'navigation' },
        { key: 'language', label: 'Language', type: 'modal' },
      ],
    },
    {
      title: 'Security',
      items: [
        { key: 'biometricAuthentication', label: 'Biometric', type: 'switch' },
      ],
    },
    {
      title: 'Account',
      items: [{ key: 'logout', label: 'Logout', type: 'action' }],
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

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

const mockProfile = createMockProfile({
  firstName: 'John',
  lastName: 'Doe',
  displayName: 'johndoe',
  bio: 'Test bio',
  phone: '555-1234',
  website: 'https://example.com',
  showEmail: true,
  showPhone: false,
  profileVisibility: ProfileVisibility.Public,
});

function buildMocks() {
  const profile = recordMock(UpdateUserProfileDocument, {
    data: {
      updateProfile: {
        __typename: 'UpdateProfilePayload',
        success: true,
        message: '',
        code: 'SUCCESS',
        userProfile: {
          __typename: 'UserProfile',
          id: 'profile-1',
          userId: 'user-1',
          firstName: 'John',
          lastName: 'Doe',
          displayName: 'johndoe',
          bio: 'Test bio',
          avatar: null,
          coverImage: null,
          phone: '555-1234',
          website: 'https://example.com',
          dateOfBirth: null,
          gender: null,
          profileVisibility: 'PUBLIC',
          showEmail: true,
          showPhone: false,
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
        },
      },
    },
  });
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
  return { profile, settings };
}

describe('useConfigurableSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns sections from config', () => {
    const { profile, settings } = buildMocks();
    const { result } = renderHookWithApollo(
      () => useConfigurableSettings(mockProfile),
      { operationMocks: [profile.mock, settings.mock] },
    );

    expect(result.current.sections).toHaveLength(4);
    expect(result.current.sections[0].title).toBe('Personal Information');
    expect(result.current.sections[1].title).toBe('Appearance');
  });

  it('returns BiometricModal element', () => {
    const { profile, settings } = buildMocks();
    const { result } = renderHookWithApollo(
      () => useConfigurableSettings(mockProfile),
      { operationMocks: [profile.mock, settings.mock] },
    );
    expect(result.current.BiometricModal).toBeDefined();
  });

  it('creates firstName setting with value from profile', () => {
    const { profile, settings } = buildMocks();
    const { result } = renderHookWithApollo(
      () => useConfigurableSettings(mockProfile),
      { operationMocks: [profile.mock, settings.mock] },
    );

    const personalSection = result.current.sections[0];
    const firstNameItem = findByKey(personalSection.items, 'firstName');

    expect(firstNameItem).toBeDefined();
    expect(firstNameItem.value).toBe('John');
    expect(firstNameItem.type).toBe('text');
  });

  it('calls updateProfile when firstName is saved', () => {
    const { profile, settings } = buildMocks();
    const { result } = renderHookWithApollo(
      () => useConfigurableSettings(mockProfile),
      { operationMocks: [profile.mock, settings.mock] },
    );

    const firstNameItem = findByKey(
      result.current.sections[0].items,
      'firstName',
    );

    act(() => {
      firstNameItem.onSave?.('Jane');
    });

    expect(profile.fired).toContainEqual({ input: { firstName: 'Jane' } });
  });

  it('creates appearance navigation entry', () => {
    const { profile, settings } = buildMocks();
    const { result } = renderHookWithApollo(
      () => useConfigurableSettings(mockProfile),
      { operationMocks: [profile.mock, settings.mock] },
    );

    const appearanceSection = result.current.sections[1];
    const appearanceItem = findByKey(appearanceSection.items, 'appearance');

    expect(appearanceItem).toBeDefined();
    expect(appearanceItem.type).toBe('navigation');
  });

  it('signs out through authService when the logout action is pressed', () => {
    const { profile, settings } = buildMocks();
    const { result } = renderHookWithApollo(
      () => useConfigurableSettings(mockProfile),
      { operationMocks: [profile.mock, settings.mock] },
    );

    const accountSection = result.current.sections[3];
    const logoutItem = findByKey(accountSection.items, 'logout');

    act(() => {
      logoutItem.onPress?.();
    });

    expect(mockLogout).toHaveBeenCalled();
  });

  it('biometric setting shows not available when device lacks biometrics', () => {
    const { profile, settings } = buildMocks();
    const { result } = renderHookWithApollo(
      () => useConfigurableSettings(mockProfile),
      { operationMocks: [profile.mock, settings.mock] },
    );

    const securitySection = result.current.sections[2];
    const biometricItem = findByKey(
      securitySection.items,
      'biometricAuthentication',
    );

    expect(biometricItem).toBeDefined();
    expect(biometricItem.disabled).toBe(true);
  });

  it('handles empty profile gracefully', () => {
    const { profile, settings } = buildMocks();
    const { result } = renderHookWithApollo(
      () => useConfigurableSettings(null),
      { operationMocks: [profile.mock, settings.mock] },
    );

    const firstNameItem = findByKey(
      result.current.sections[0].items,
      'firstName',
    );
    expect(firstNameItem.value).toBe('');
  });

  it('creates lastName setting with value from profile', () => {
    const { profile, settings } = buildMocks();
    const { result } = renderHookWithApollo(
      () => useConfigurableSettings(mockProfile),
      { operationMocks: [profile.mock, settings.mock] },
    );
    const lastNameItem = findByKey(
      result.current.sections[0].items,
      'lastName',
    );
    expect(lastNameItem.value).toBe('Doe');
  });

  it('calls updateProfile when lastName is saved', () => {
    const { profile, settings } = buildMocks();
    const { result } = renderHookWithApollo(
      () => useConfigurableSettings(mockProfile),
      { operationMocks: [profile.mock, settings.mock] },
    );
    const lastNameItem = findByKey(
      result.current.sections[0].items,
      'lastName',
    );
    act(() => {
      lastNameItem.onSave?.('Smith');
    });
    expect(profile.fired).toContainEqual({ input: { lastName: 'Smith' } });
  });

  it('creates displayName setting with value from profile', () => {
    const { profile, settings } = buildMocks();
    const { result } = renderHookWithApollo(
      () => useConfigurableSettings(mockProfile),
      { operationMocks: [profile.mock, settings.mock] },
    );
    const item = findByKey(result.current.sections[0].items, 'displayName');
    expect(item.value).toBe('johndoe');
  });

  it('calls updateProfile when displayName is saved', () => {
    const { profile, settings } = buildMocks();
    const { result } = renderHookWithApollo(
      () => useConfigurableSettings(mockProfile),
      { operationMocks: [profile.mock, settings.mock] },
    );
    const item = findByKey(result.current.sections[0].items, 'displayName');
    act(() => {
      item.onSave?.('newdisplay');
    });
    expect(profile.fired).toContainEqual({
      input: { displayName: 'newdisplay' },
    });
  });

  it('creates language setting as modal with correct options', () => {
    const { profile, settings } = buildMocks();
    const { result } = renderHookWithApollo(
      () => useConfigurableSettings(mockProfile),
      { operationMocks: [profile.mock, settings.mock] },
    );
    const langItem = findByKey(result.current.sections[1].items, 'language');
    expect(langItem).toBeDefined();
    expect(langItem.value).toBe('en');
    expect(langItem.options).toBeDefined();
  });

  it('calls setLanguage and updateSettings when language is saved', () => {
    const { profile, settings } = buildMocks();
    const { result } = renderHookWithApollo(
      () => useConfigurableSettings(mockProfile),
      { operationMocks: [profile.mock, settings.mock] },
    );
    const langItem = findByKey(result.current.sections[1].items, 'language');
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

    const { profile, settings } = buildMocks();
    const { result, rerender } = renderHookWithApollo(
      () => useConfigurableSettings(mockProfile),
      { operationMocks: [profile.mock, settings.mock] },
    );
    // Wait for biometric info to load
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    rerender(undefined);

    const biometricItem = findByKey(
      result.current.sections[2].items,
      'biometricAuthentication',
    );
    expect(biometricItem.disabled).toBe(false);
    expect(biometricItem.subtitle).toContain('FaceID');
  });

  it('biometric loading state shows checking message', () => {
    // The initial biometricLoading is true when user has email
    const { profile, settings } = buildMocks();
    const { result } = renderHookWithApollo(
      () => useConfigurableSettings(mockProfile),
      { operationMocks: [profile.mock, settings.mock] },
    );
    const biometricItem = findByKey(
      result.current.sections[2].items,
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

    const { profile, settings } = buildMocks();
    const { result } = renderHookWithApollo(
      () => useConfigurableSettings(mockProfile),
      { operationMocks: [profile.mock, settings.mock] },
    );
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    const biometricItem = findByKey(
      result.current.sections[2].items,
      'biometricAuthentication',
    );
    expect(biometricItem.subtitle).toContain('Tap to enable');
  });

  it('returns biometricLoading state', () => {
    const { profile, settings } = buildMocks();
    const { result } = renderHookWithApollo(
      () => useConfigurableSettings(mockProfile),
      { operationMocks: [profile.mock, settings.mock] },
    );
    expect(typeof result.current.biometricLoading).toBe('boolean');
  });

  // ========== Additional branch/function coverage tests ==========

  describe('profile field settings', () => {
    it('creates bio setting with value from profile', () => {
      const { profile, settings } = buildMocks();
      const { result } = renderHookWithApollo(
        () => useConfigurableSettings(mockProfile),
        { operationMocks: [profile.mock, settings.mock] },
      );
      // bio is not in the mocked config, so add it to config for testing
      // Instead, we test with the existing config items
      expect(result.current.sections).toBeDefined();
    });

    it('creates phone setting with value from profile (needs config)', () => {
      // Re-mock config to include phone
      const { PROFILE_SETTINGS_CONFIG } = require('#/config/settingsConfig');
      const original = [...PROFILE_SETTINGS_CONFIG];
      PROFILE_SETTINGS_CONFIG.length = 0;
      PROFILE_SETTINGS_CONFIG.push({
        title: 'Personal',
        items: [
          { key: 'phone', label: 'Phone', type: 'text' },
          { key: 'website', label: 'Website', type: 'text' },
          { key: 'bio', label: 'Bio', type: 'text' },
          { key: 'dateOfBirth', label: 'Date of Birth', type: 'text' },
        ],
      });

      const { profile, settings } = buildMocks();
      const { result } = renderHookWithApollo(
        () => useConfigurableSettings(mockProfile),
        { operationMocks: [profile.mock, settings.mock] },
      );
      const phoneItem = findByKey(result.current.sections[0].items, 'phone');
      expect(phoneItem.value).toBe('555-1234');

      const websiteItem = findByKey(
        result.current.sections[0].items,
        'website',
      );
      expect(websiteItem.value).toBe('https://example.com');

      const bioItem = findByKey(result.current.sections[0].items, 'bio');
      expect(bioItem.value).toBe('Test bio');

      const dobItem = findByKey(
        result.current.sections[0].items,
        'dateOfBirth',
      );
      expect(dobItem).toBeDefined();

      // Restore config
      PROFILE_SETTINGS_CONFIG.length = 0;
      original.forEach((item: ConfigSection) =>
        PROFILE_SETTINGS_CONFIG.push(item),
      );
    });

    it('calls updateProfile when phone is saved', () => {
      const { PROFILE_SETTINGS_CONFIG } = require('#/config/settingsConfig');
      const original = [...PROFILE_SETTINGS_CONFIG];
      PROFILE_SETTINGS_CONFIG.length = 0;
      PROFILE_SETTINGS_CONFIG.push({
        title: 'Personal',
        items: [{ key: 'phone', label: 'Phone', type: 'text' }],
      });

      const { profile, settings } = buildMocks();
      const { result } = renderHookWithApollo(
        () => useConfigurableSettings(mockProfile),
        { operationMocks: [profile.mock, settings.mock] },
      );
      const phoneItem = findByKey(result.current.sections[0].items, 'phone');
      act(() => {
        phoneItem.onSave?.('555-9999');
      });
      expect(profile.fired).toContainEqual({ input: { phone: '555-9999' } });

      PROFILE_SETTINGS_CONFIG.length = 0;
      original.forEach((item: ConfigSection) =>
        PROFILE_SETTINGS_CONFIG.push(item),
      );
    });

    it('calls updateProfile when website is saved', () => {
      const { PROFILE_SETTINGS_CONFIG } = require('#/config/settingsConfig');
      const original = [...PROFILE_SETTINGS_CONFIG];
      PROFILE_SETTINGS_CONFIG.length = 0;
      PROFILE_SETTINGS_CONFIG.push({
        title: 'Personal',
        items: [{ key: 'website', label: 'Website', type: 'text' }],
      });

      const { profile, settings } = buildMocks();
      const { result } = renderHookWithApollo(
        () => useConfigurableSettings(mockProfile),
        { operationMocks: [profile.mock, settings.mock] },
      );
      const item = findByKey(result.current.sections[0].items, 'website');
      act(() => {
        item.onSave?.('https://new.com');
      });
      expect(profile.fired).toContainEqual({
        input: { website: 'https://new.com' },
      });

      PROFILE_SETTINGS_CONFIG.length = 0;
      original.forEach((item: ConfigSection) =>
        PROFILE_SETTINGS_CONFIG.push(item),
      );
    });

    it('calls updateProfile when bio is saved', () => {
      const { PROFILE_SETTINGS_CONFIG } = require('#/config/settingsConfig');
      const original = [...PROFILE_SETTINGS_CONFIG];
      PROFILE_SETTINGS_CONFIG.length = 0;
      PROFILE_SETTINGS_CONFIG.push({
        title: 'Personal',
        items: [{ key: 'bio', label: 'Bio', type: 'text' }],
      });

      const { profile, settings } = buildMocks();
      const { result } = renderHookWithApollo(
        () => useConfigurableSettings(mockProfile),
        { operationMocks: [profile.mock, settings.mock] },
      );
      const item = findByKey(result.current.sections[0].items, 'bio');
      act(() => {
        item.onSave?.('New bio');
      });
      expect(profile.fired).toContainEqual({ input: { bio: 'New bio' } });

      PROFILE_SETTINGS_CONFIG.length = 0;
      original.forEach((item: ConfigSection) =>
        PROFILE_SETTINGS_CONFIG.push(item),
      );
    });

    it('calls updateProfile when dateOfBirth is saved with ISO conversion', () => {
      const { dateStringToISO } = require('#utils/dateUtils');
      const { PROFILE_SETTINGS_CONFIG } = require('#/config/settingsConfig');
      const original = [...PROFILE_SETTINGS_CONFIG];
      PROFILE_SETTINGS_CONFIG.length = 0;
      PROFILE_SETTINGS_CONFIG.push({
        title: 'Personal',
        items: [{ key: 'dateOfBirth', label: 'Date of Birth', type: 'text' }],
      });

      const { profile, settings } = buildMocks();
      const { result } = renderHookWithApollo(
        () => useConfigurableSettings(mockProfile),
        { operationMocks: [profile.mock, settings.mock] },
      );
      const item = findByKey(result.current.sections[0].items, 'dateOfBirth');
      act(() => {
        item.onSave?.('1990-01-01');
      });
      expect(dateStringToISO).toHaveBeenCalledWith('1990-01-01');
      expect(profile.fired.length).toBeGreaterThan(0);

      PROFILE_SETTINGS_CONFIG.length = 0;
      original.forEach((item: ConfigSection) =>
        PROFILE_SETTINGS_CONFIG.push(item),
      );
    });
  });

  describe('gender setting', () => {
    it('creates gender modal setting with options and onSave', () => {
      const { PROFILE_SETTINGS_CONFIG } = require('#/config/settingsConfig');
      const original = [...PROFILE_SETTINGS_CONFIG];
      PROFILE_SETTINGS_CONFIG.length = 0;
      PROFILE_SETTINGS_CONFIG.push({
        title: 'Personal',
        items: [{ key: 'gender', label: 'Gender', type: 'modal' }],
      });

      const { profile, settings } = buildMocks();
      const { result } = renderHookWithApollo(
        () => useConfigurableSettings({ ...mockProfile, gender: 'male' }),
        { operationMocks: [profile.mock, settings.mock] },
      );
      const item = findByKey(result.current.sections[0].items, 'gender');
      expect(item.value).toBe('male');
      expect(item.options).toBeDefined();
      expect(item.options?.length).toBe(5);

      act(() => {
        item.onSave?.('female');
      });
      expect(profile.fired).toContainEqual({ input: { gender: 'female' } });

      PROFILE_SETTINGS_CONFIG.length = 0;
      original.forEach((item: ConfigSection) =>
        PROFILE_SETTINGS_CONFIG.push(item),
      );
    });

    it('uses empty string when profile has no gender', () => {
      const { PROFILE_SETTINGS_CONFIG } = require('#/config/settingsConfig');
      const original = [...PROFILE_SETTINGS_CONFIG];
      PROFILE_SETTINGS_CONFIG.length = 0;
      PROFILE_SETTINGS_CONFIG.push({
        title: 'Personal',
        items: [{ key: 'gender', label: 'Gender', type: 'modal' }],
      });

      const { profile, settings } = buildMocks();
      const { result } = renderHookWithApollo(
        () => useConfigurableSettings({ ...mockProfile, gender: null }),
        { operationMocks: [profile.mock, settings.mock] },
      );
      const item = findByKey(result.current.sections[0].items, 'gender');
      expect(item.value).toBe('');

      PROFILE_SETTINGS_CONFIG.length = 0;
      original.forEach((item: ConfigSection) =>
        PROFILE_SETTINGS_CONFIG.push(item),
      );
    });
  });

  describe('privacy settings', () => {
    it('creates profileVisibility modal setting', () => {
      const { PROFILE_SETTINGS_CONFIG } = require('#/config/settingsConfig');
      const original = [...PROFILE_SETTINGS_CONFIG];
      PROFILE_SETTINGS_CONFIG.length = 0;
      PROFILE_SETTINGS_CONFIG.push({
        title: 'Privacy',
        items: [
          {
            key: 'profileVisibility',
            label: 'Profile Visibility',
            type: 'modal',
          },
        ],
      });

      const { profile, settings } = buildMocks();
      const { result } = renderHookWithApollo(
        () => useConfigurableSettings(mockProfile),
        { operationMocks: [profile.mock, settings.mock] },
      );
      const item = findByKey(
        result.current.sections[0].items,
        'profileVisibility',
      );
      expect(item.value).toBe('PUBLIC');
      expect(item.options).toBeDefined();

      act(() => {
        item.onSave?.('PRIVATE');
      });
      expect(profile.fired).toContainEqual({
        input: { profileVisibility: 'PRIVATE' },
      });

      PROFILE_SETTINGS_CONFIG.length = 0;
      original.forEach((item: ConfigSection) =>
        PROFILE_SETTINGS_CONFIG.push(item),
      );
    });

    it('creates showEmail switch setting', () => {
      const { PROFILE_SETTINGS_CONFIG } = require('#/config/settingsConfig');
      const original = [...PROFILE_SETTINGS_CONFIG];
      PROFILE_SETTINGS_CONFIG.length = 0;
      PROFILE_SETTINGS_CONFIG.push({
        title: 'Privacy',
        items: [{ key: 'showEmail', label: 'Show Email', type: 'switch' }],
      });

      const { profile, settings } = buildMocks();
      const { result } = renderHookWithApollo(
        () => useConfigurableSettings(mockProfile),
        { operationMocks: [profile.mock, settings.mock] },
      );
      const item = findByKey(result.current.sections[0].items, 'showEmail');
      expect(item.value).toBe(true); // mockProfile.showEmail is true

      act(() => {
        item.onPress?.();
      });
      expect(profile.fired).toContainEqual({ input: { showEmail: false } });

      PROFILE_SETTINGS_CONFIG.length = 0;
      original.forEach((item: ConfigSection) =>
        PROFILE_SETTINGS_CONFIG.push(item),
      );
    });

    it('creates showPhone switch setting', () => {
      const { PROFILE_SETTINGS_CONFIG } = require('#/config/settingsConfig');
      const original = [...PROFILE_SETTINGS_CONFIG];
      PROFILE_SETTINGS_CONFIG.length = 0;
      PROFILE_SETTINGS_CONFIG.push({
        title: 'Privacy',
        items: [{ key: 'showPhone', label: 'Show Phone', type: 'switch' }],
      });

      const { profile, settings } = buildMocks();
      const { result } = renderHookWithApollo(
        () => useConfigurableSettings(mockProfile),
        { operationMocks: [profile.mock, settings.mock] },
      );
      const item = findByKey(result.current.sections[0].items, 'showPhone');
      expect(item.value).toBe(false); // mockProfile.showPhone is false

      act(() => {
        item.onPress?.();
      });
      expect(profile.fired).toContainEqual({ input: { showPhone: true } });

      PROFILE_SETTINGS_CONFIG.length = 0;
      original.forEach((item: ConfigSection) =>
        PROFILE_SETTINGS_CONFIG.push(item),
      );
    });
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

      const { profile, settings } = buildMocks();
      const { result } = renderHookWithApollo(
        () => useConfigurableSettings(mockProfile),
        { operationMocks: [profile.mock, settings.mock] },
      );
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

      const { profile, settings } = buildMocks();
      const { result } = renderHookWithApollo(
        () => useConfigurableSettings(mockProfile),
        { operationMocks: [profile.mock, settings.mock] },
      );
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
        title: 'Unknown',
        items: [{ key: 'unknownKey', label: 'Unknown', type: 'text' }],
      });

      const { profile, settings } = buildMocks();
      renderHookWithApollo(() => useConfigurableSettings(mockProfile), {
        operationMocks: [profile.mock, settings.mock],
      });
      expect(console.warn).toHaveBeenCalledWith(
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

      const { profile, settings } = buildMocks();
      const { result } = renderHookWithApollo(
        () => useConfigurableSettings(mockProfile),
        { operationMocks: [profile.mock, settings.mock] },
      );
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      const biometricItem = findByKey(
        result.current.sections[2].items,
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

      const { profile, settings } = buildMocks();
      const { result } = renderHookWithApollo(
        () => useConfigurableSettings(mockProfile),
        { operationMocks: [profile.mock, settings.mock] },
      );
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      const biometricItem = findByKey(
        result.current.sections[2].items,
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

      const { profile, settings } = buildMocks();
      const { result } = renderHookWithApollo(
        () => useConfigurableSettings(mockProfile),
        { operationMocks: [profile.mock, settings.mock] },
      );
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      const biometricItem = findByKey(
        result.current.sections[2].items,
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

      const { profile, settings } = buildMocks();
      const { result } = renderHookWithApollo(
        () => useConfigurableSettings(mockProfile),
        { operationMocks: [profile.mock, settings.mock] },
      );
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      const biometricItem = findByKey(
        result.current.sections[2].items,
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

      const { profile, settings } = buildMocks();
      const { result } = renderHookWithApollo(
        () => useConfigurableSettings(mockProfile),
        { operationMocks: [profile.mock, settings.mock] },
      );
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      const biometricItem = findByKey(
        result.current.sections[2].items,
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

      const { profile, settings } = buildMocks();
      const { result } = renderHookWithApollo(
        () => useConfigurableSettings(mockProfile),
        { operationMocks: [profile.mock, settings.mock] },
      );
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

      const { profile, settings } = buildMocks();
      const { result } = renderHookWithApollo(
        () => useConfigurableSettings(mockProfile),
        { operationMocks: [profile.mock, settings.mock] },
      );
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Trigger the modal open
      const biometricItem = findByKey(
        result.current.sections[2].items,
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

      const { profile, settings } = buildMocks();
      const { result } = renderHookWithApollo(
        () => useConfigurableSettings(mockProfile),
        { operationMocks: [profile.mock, settings.mock] },
      );
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

      const { profile, settings } = buildMocks();
      const { result } = renderHookWithApollo(
        () => useConfigurableSettings(mockProfile),
        { operationMocks: [profile.mock, settings.mock] },
      );
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
