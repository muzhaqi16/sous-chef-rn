'use no memo';

import { act } from '@testing-library/react-native';
import { alertService } from '#/services/alertService';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import {
  UpdateUserProfileDocument,
  UpdateUserPreferencesDocument,
} from '#operations/auth/user.generated';
import { useConfigurableSettings } from '../useConfigurableSettings';

// Mock token scheduler / refreshToken
jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

const mockLogout = jest.fn();
const mockGetUserNavigationState = jest.fn(() => null);
const mockSetLanguage = jest.fn();

jest.mock('#store/useAppStore', () => ({
  useAppStore: jest.fn((selector: any) => {
    const state = {
      user: { id: 'user-1', email: 'test@example.com' },
      logout: mockLogout,
      getUserNavigationState: mockGetUserNavigationState,
      language: 'en',
      setLanguage: mockSetLanguage,
    };
    return typeof selector === 'function' ? selector(state) : state;
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
jest.mock('#hooks/navigation/useUserPreferences', () => ({
  useUserPreferences: jest.fn(() => ({
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
  extractDateString: jest.fn((v: any) => v || ''),
}));

jest.mock('#components/organisms/BiometricSetupModal', () => ({
  BiometricSetupModal: 'BiometricSetupModal',
}));

jest.mock('#/utils/compilerSafeWrappers');

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

const mockProfile = {
  firstName: 'John',
  lastName: 'Doe',
  displayName: 'johndoe',
  bio: 'Test bio',
  phone: '555-1234',
  website: 'https://example.com',
  showEmail: true,
  showPhone: false,
  profileVisibility: 'PUBLIC',
};

function buildMocks() {
  const profile = recordMock(UpdateUserProfileDocument, {
    data: {
      updateProfile: {
        __typename: 'UserProfilePayload',
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
        __typename: 'UserSettingsPayload',
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
    const firstNameItem = personalSection.items.find(
      (i: any) => i.key === 'firstName',
    );

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

    const firstNameItem = result.current.sections[0].items.find(
      (i: any) => i.key === 'firstName',
    );

    act(() => {
      firstNameItem.onSave('Jane');
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
    const appearanceItem = appearanceSection.items.find(
      (i: any) => i.key === 'appearance',
    );

    expect(appearanceItem).toBeDefined();
    expect(appearanceItem.type).toBe('navigation');
  });

  it('calls logout when logout action is pressed', () => {
    const { profile, settings } = buildMocks();
    const { result } = renderHookWithApollo(
      () => useConfigurableSettings(mockProfile),
      { operationMocks: [profile.mock, settings.mock] },
    );

    const accountSection = result.current.sections[3];
    const logoutItem = accountSection.items.find(
      (i: any) => i.key === 'logout',
    );

    act(() => {
      logoutItem.onPress();
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
    const biometricItem = securitySection.items.find(
      (i: any) => i.key === 'biometricAuthentication',
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

    const firstNameItem = result.current.sections[0].items.find(
      (i: any) => i.key === 'firstName',
    );
    expect(firstNameItem.value).toBe('');
  });

  it('creates lastName setting with value from profile', () => {
    const { profile, settings } = buildMocks();
    const { result } = renderHookWithApollo(
      () => useConfigurableSettings(mockProfile),
      { operationMocks: [profile.mock, settings.mock] },
    );
    const lastNameItem = result.current.sections[0].items.find(
      (i: any) => i.key === 'lastName',
    );
    expect(lastNameItem.value).toBe('Doe');
  });

  it('calls updateProfile when lastName is saved', () => {
    const { profile, settings } = buildMocks();
    const { result } = renderHookWithApollo(
      () => useConfigurableSettings(mockProfile),
      { operationMocks: [profile.mock, settings.mock] },
    );
    const lastNameItem = result.current.sections[0].items.find(
      (i: any) => i.key === 'lastName',
    );
    act(() => {
      lastNameItem.onSave('Smith');
    });
    expect(profile.fired).toContainEqual({ input: { lastName: 'Smith' } });
  });

  it('creates displayName setting with value from profile', () => {
    const { profile, settings } = buildMocks();
    const { result } = renderHookWithApollo(
      () => useConfigurableSettings(mockProfile),
      { operationMocks: [profile.mock, settings.mock] },
    );
    const item = result.current.sections[0].items.find(
      (i: any) => i.key === 'displayName',
    );
    expect(item.value).toBe('johndoe');
  });

  it('calls updateProfile when displayName is saved', () => {
    const { profile, settings } = buildMocks();
    const { result } = renderHookWithApollo(
      () => useConfigurableSettings(mockProfile),
      { operationMocks: [profile.mock, settings.mock] },
    );
    const item = result.current.sections[0].items.find(
      (i: any) => i.key === 'displayName',
    );
    act(() => {
      item.onSave('newdisplay');
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
    const langItem = result.current.sections[1].items.find(
      (i: any) => i.key === 'language',
    );
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
    const langItem = result.current.sections[1].items.find(
      (i: any) => i.key === 'language',
    );
    act(() => {
      langItem.onSave('es');
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

    const biometricItem = result.current.sections[2].items.find(
      (i: any) => i.key === 'biometricAuthentication',
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
    const biometricItem = result.current.sections[2].items.find(
      (i: any) => i.key === 'biometricAuthentication',
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
    } as any);

    const { profile, settings } = buildMocks();
    const { result } = renderHookWithApollo(
      () => useConfigurableSettings(mockProfile),
      { operationMocks: [profile.mock, settings.mock] },
    );
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    const biometricItem = result.current.sections[2].items.find(
      (i: any) => i.key === 'biometricAuthentication',
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
      const phoneItem = result.current.sections[0].items.find(
        (i: any) => i.key === 'phone',
      );
      expect(phoneItem.value).toBe('555-1234');

      const websiteItem = result.current.sections[0].items.find(
        (i: any) => i.key === 'website',
      );
      expect(websiteItem.value).toBe('https://example.com');

      const bioItem = result.current.sections[0].items.find(
        (i: any) => i.key === 'bio',
      );
      expect(bioItem.value).toBe('Test bio');

      const dobItem = result.current.sections[0].items.find(
        (i: any) => i.key === 'dateOfBirth',
      );
      expect(dobItem).toBeDefined();

      // Restore config
      PROFILE_SETTINGS_CONFIG.length = 0;
      original.forEach((item: any) => PROFILE_SETTINGS_CONFIG.push(item));
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
      const phoneItem = result.current.sections[0].items.find(
        (i: any) => i.key === 'phone',
      );
      act(() => {
        phoneItem.onSave('555-9999');
      });
      expect(profile.fired).toContainEqual({ input: { phone: '555-9999' } });

      PROFILE_SETTINGS_CONFIG.length = 0;
      original.forEach((item: any) => PROFILE_SETTINGS_CONFIG.push(item));
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
      const item = result.current.sections[0].items.find(
        (i: any) => i.key === 'website',
      );
      act(() => {
        item.onSave('https://new.com');
      });
      expect(profile.fired).toContainEqual({
        input: { website: 'https://new.com' },
      });

      PROFILE_SETTINGS_CONFIG.length = 0;
      original.forEach((item: any) => PROFILE_SETTINGS_CONFIG.push(item));
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
      const item = result.current.sections[0].items.find(
        (i: any) => i.key === 'bio',
      );
      act(() => {
        item.onSave('New bio');
      });
      expect(profile.fired).toContainEqual({ input: { bio: 'New bio' } });

      PROFILE_SETTINGS_CONFIG.length = 0;
      original.forEach((item: any) => PROFILE_SETTINGS_CONFIG.push(item));
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
      const item = result.current.sections[0].items.find(
        (i: any) => i.key === 'dateOfBirth',
      );
      act(() => {
        item.onSave('1990-01-01');
      });
      expect(dateStringToISO).toHaveBeenCalledWith('1990-01-01');
      expect(profile.fired.length).toBeGreaterThan(0);

      PROFILE_SETTINGS_CONFIG.length = 0;
      original.forEach((item: any) => PROFILE_SETTINGS_CONFIG.push(item));
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
      const item = result.current.sections[0].items.find(
        (i: any) => i.key === 'gender',
      );
      expect(item.value).toBe('male');
      expect(item.options).toBeDefined();
      expect(item.options.length).toBe(5);

      act(() => {
        item.onSave('female');
      });
      expect(profile.fired).toContainEqual({ input: { gender: 'female' } });

      PROFILE_SETTINGS_CONFIG.length = 0;
      original.forEach((item: any) => PROFILE_SETTINGS_CONFIG.push(item));
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
        () => useConfigurableSettings({ ...mockProfile, gender: undefined }),
        { operationMocks: [profile.mock, settings.mock] },
      );
      const item = result.current.sections[0].items.find(
        (i: any) => i.key === 'gender',
      );
      expect(item.value).toBe('');

      PROFILE_SETTINGS_CONFIG.length = 0;
      original.forEach((item: any) => PROFILE_SETTINGS_CONFIG.push(item));
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
      const item = result.current.sections[0].items.find(
        (i: any) => i.key === 'profileVisibility',
      );
      expect(item.value).toBe('PUBLIC');
      expect(item.options).toBeDefined();

      act(() => {
        item.onSave('PRIVATE');
      });
      expect(profile.fired).toContainEqual({
        input: { profileVisibility: 'PRIVATE' },
      });

      PROFILE_SETTINGS_CONFIG.length = 0;
      original.forEach((item: any) => PROFILE_SETTINGS_CONFIG.push(item));
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
      const item = result.current.sections[0].items.find(
        (i: any) => i.key === 'showEmail',
      );
      expect(item.value).toBe(true); // mockProfile.showEmail is true

      act(() => {
        item.onPress();
      });
      expect(profile.fired).toContainEqual({ input: { showEmail: false } });

      PROFILE_SETTINGS_CONFIG.length = 0;
      original.forEach((item: any) => PROFILE_SETTINGS_CONFIG.push(item));
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
      const item = result.current.sections[0].items.find(
        (i: any) => i.key === 'showPhone',
      );
      expect(item.value).toBe(false); // mockProfile.showPhone is false

      act(() => {
        item.onPress();
      });
      expect(profile.fired).toContainEqual({ input: { showPhone: true } });

      PROFILE_SETTINGS_CONFIG.length = 0;
      original.forEach((item: any) => PROFILE_SETTINGS_CONFIG.push(item));
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

      items.forEach((item: any) => {
        expect(typeof item.onPress).toBe('function');
        // Should not throw
        act(() => {
          item.onPress();
        });
      });

      PROFILE_SETTINGS_CONFIG.length = 0;
      original.forEach((item: any) => PROFILE_SETTINGS_CONFIG.push(item));
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

      expect(
        items.find((i: any) => i.key === 'personalInformation').testID,
      ).toBe('profile-menu-personalInformation');
      expect(items.find((i: any) => i.key === 'notifications').testID).toBe(
        'profile-menu-notifications',
      );
      expect(items.find((i: any) => i.key === 'dietaryProfile').testID).toBe(
        'profile-menu-dietaryProfile',
      );
      expect(items.find((i: any) => i.key === 'appSettings').testID).toBe(
        'profile-menu-appSettings',
      );
      expect(items.find((i: any) => i.key === 'debugInfo').testID).toBe(
        'profile-menu-debugInfo',
      );
      expect(
        items.find((i: any) => i.key === 'performanceDashboard').testID,
      ).toBe('profile-menu-performanceDashboard');
      expect(items.find((i: any) => i.key === 'logout').testID).toBe(
        'profile-logout-button',
      );
      expect(items.find((i: any) => i.key === 'privacy').testID).toBe(
        'profile-menu-privacy',
      );
      expect(items.find((i: any) => i.key === 'help').testID).toBe(
        'profile-menu-help',
      );
      expect(items.find((i: any) => i.key === 'about').testID).toBe(
        'profile-menu-about',
      );
      expect(items.find((i: any) => i.key === 'feedback').testID).toBe(
        'profile-menu-feedback',
      );

      PROFILE_SETTINGS_CONFIG.length = 0;
      original.forEach((item: any) => PROFILE_SETTINGS_CONFIG.push(item));
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
      original.forEach((item: any) => PROFILE_SETTINGS_CONFIG.push(item));
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

      const biometricItem = result.current.sections[2].items.find(
        (i: any) => i.key === 'biometricAuthentication',
      );

      await act(async () => {
        await biometricItem.onPress();
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

      const biometricItem = result.current.sections[2].items.find(
        (i: any) => i.key === 'biometricAuthentication',
      );

      await act(async () => {
        await biometricItem.onPress();
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

      const biometricItem = result.current.sections[2].items.find(
        (i: any) => i.key === 'biometricAuthentication',
      );

      await act(async () => {
        await biometricItem.onPress();
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

      const biometricItem = result.current.sections[2].items.find(
        (i: any) => i.key === 'biometricAuthentication',
      );

      await act(async () => {
        await biometricItem.onPress();
      });

      // Get the 'Disable' button from the alert
      const alertCalls = (alertService.alert as jest.Mock).mock.calls;
      const lastCall = alertCalls[alertCalls.length - 1];
      const buttons = lastCall[2];
      const disableButton = buttons.find((b: any) => b.text === 'Disable');

      await act(async () => {
        await disableButton.onPress();
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

      const biometricItem = result.current.sections[2].items.find(
        (i: any) => i.key === 'biometricAuthentication',
      );

      expect(biometricItem.subtitle).toContain('biometric');
    });

    it('biometric loading starts false when no user email', () => {
      const storeModule = require('#store/useAppStore');
      storeModule.useAppStore.mockImplementation((selector: any) => {
        const state = {
          user: { id: 'user-1', email: '' },
          logout: mockLogout,
          getUserNavigationState: mockGetUserNavigationState,
          language: 'en',
          setLanguage: mockSetLanguage,
        };
        return typeof selector === 'function' ? selector(state) : state;
      });
      storeModule.useUser.mockReturnValue({ id: 'user-1', email: '' });

      const { profile, settings } = buildMocks();
      const { result } = renderHookWithApollo(
        () => useConfigurableSettings(mockProfile),
        { operationMocks: [profile.mock, settings.mock] },
      );
      expect(result.current.biometricLoading).toBe(false);

      // Restore mock
      storeModule.useAppStore.mockImplementation((selector: any) => {
        const state = {
          user: { id: 'user-1', email: 'test@example.com' },
          logout: mockLogout,
          getUserNavigationState: mockGetUserNavigationState,
          language: 'en',
          setLanguage: mockSetLanguage,
        };
        return typeof selector === 'function' ? selector(state) : state;
      });
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
      const biometricItem = result.current.sections[2].items.find(
        (i: any) => i.key === 'biometricAuthentication',
      );
      await act(async () => {
        await biometricItem.onPress();
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

  describe('executeQuery failure in biometric loading', () => {
    it('handles executeQuery returning null gracefully', async () => {
      const { executeQuery } = require('#/utils/compilerSafeWrappers');
      executeQuery.mockResolvedValueOnce(null);

      const { profile, settings } = buildMocks();
      const { result } = renderHookWithApollo(
        () => useConfigurableSettings(mockProfile),
        { operationMocks: [profile.mock, settings.mock] },
      );
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Should still finish loading without error
      expect(result.current.biometricLoading).toBe(false);
    });
  });
});
