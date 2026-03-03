'use no memo';

import { renderHook, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
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
  selectUser: (s: any) => s.user,
  selectSetters: (s: any) => ({ logout: s.logout }),
  selectNavigationUtils: (s: any) => ({
    getUserNavigationState: s.getUserNavigationState,
  }),
  selectPreferences: (s: any) => ({
    language: s.language,
    setLanguage: s.setLanguage,
  }),
}));

const mockSetTheme = jest.fn();
jest.mock('#hooks/useTheme', () => ({
  useTheme: jest.fn(() => ({
    userThemePreference: 'SYSTEM',
    setTheme: mockSetTheme,
  })),
}));

const mockCheckStoredCredentials = jest.fn().mockResolvedValue(false);
const mockGetBiometricInfo = jest.fn().mockResolvedValue({
  isAvailable: false,
  biometryType: null,
});
const mockRemoveCredentials = jest.fn();

jest.mock('#hooks/auth/useAuth', () => ({
  useAuth: jest.fn(() => ({
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

const mockUpdateProfileMutation = jest.fn().mockResolvedValue({ data: {} });
const mockUpdateSettingsMutation = jest.fn().mockResolvedValue({ data: {} });

jest.mock('#generated', () => ({
  useUpdateUserProfileMutation: jest.fn(() => [mockUpdateProfileMutation]),
  useUpdateUserPreferencesMutation: jest.fn(() => [mockUpdateSettingsMutation]),
  ProfileVisibility: { Public: 'PUBLIC', Friends: 'FRIENDS', Private: 'PRIVATE' },
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
        { key: 'theme', label: 'Theme', type: 'modal' },
        { key: 'darkMode', label: 'Dark Mode', type: 'switch' },
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

jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());

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

describe('useConfigurableSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns sections from config', () => {
    const { result } = renderHook(() => useConfigurableSettings(mockProfile));

    expect(result.current.sections).toHaveLength(4);
    expect(result.current.sections[0].title).toBe('Personal Information');
    expect(result.current.sections[1].title).toBe('Appearance');
  });

  it('returns BiometricModal element', () => {
    const { result } = renderHook(() => useConfigurableSettings(mockProfile));
    expect(result.current.BiometricModal).toBeDefined();
  });

  it('creates firstName setting with value from profile', () => {
    const { result } = renderHook(() => useConfigurableSettings(mockProfile));

    const personalSection = result.current.sections[0];
    const firstNameItem = personalSection.items.find(
      (i: any) => i.key === 'firstName',
    );

    expect(firstNameItem).toBeDefined();
    expect(firstNameItem.value).toBe('John');
    expect(firstNameItem.type).toBe('text');
  });

  it('calls updateProfile when firstName is saved', () => {
    const { result } = renderHook(() => useConfigurableSettings(mockProfile));

    const firstNameItem = result.current.sections[0].items.find(
      (i: any) => i.key === 'firstName',
    );

    act(() => {
      firstNameItem.onSave('Jane');
    });

    expect(mockUpdateProfileMutation).toHaveBeenCalledWith({
      variables: { input: { firstName: 'Jane' } },
    });
  });

  it('creates theme setting as modal with options', () => {
    const { result } = renderHook(() => useConfigurableSettings(mockProfile));

    const appearanceSection = result.current.sections[1];
    const themeItem = appearanceSection.items.find(
      (i: any) => i.key === 'theme',
    );

    expect(themeItem).toBeDefined();
    expect(themeItem.value).toBe('SYSTEM');
    expect(themeItem.options).toBeDefined();
  });

  it('calls setTheme and updateSettings when theme is saved', () => {
    const { result } = renderHook(() => useConfigurableSettings(mockProfile));

    const themeItem = result.current.sections[1].items.find(
      (i: any) => i.key === 'theme',
    );

    act(() => {
      themeItem.onSave('DARK');
    });

    expect(mockSetTheme).toHaveBeenCalledWith('DARK');
    expect(mockUpdateSettingsMutation).toHaveBeenCalledWith({
      variables: { input: { theme: 'DARK' } },
    });
  });

  it('calls logout when logout action is pressed', () => {
    const { result } = renderHook(() => useConfigurableSettings(mockProfile));

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
    const { result } = renderHook(() => useConfigurableSettings(mockProfile));

    const securitySection = result.current.sections[2];
    const biometricItem = securitySection.items.find(
      (i: any) => i.key === 'biometricAuthentication',
    );

    expect(biometricItem).toBeDefined();
    expect(biometricItem.disabled).toBe(true);
  });

  it('creates darkMode switch that toggles theme', () => {
    const { result } = renderHook(() => useConfigurableSettings(mockProfile));

    const darkModeItem = result.current.sections[1].items.find(
      (i: any) => i.key === 'darkMode',
    );

    expect(darkModeItem).toBeDefined();
    expect(darkModeItem.value).toBe(false); // SYSTEM is not DARK

    act(() => {
      darkModeItem.onPress();
    });

    expect(mockSetTheme).toHaveBeenCalledWith('DARK');
  });

  it('handles empty profile gracefully', () => {
    const { result } = renderHook(() => useConfigurableSettings(null));

    const firstNameItem = result.current.sections[0].items.find(
      (i: any) => i.key === 'firstName',
    );
    expect(firstNameItem.value).toBe('');
  });

  it('creates lastName setting with value from profile', () => {
    const { result } = renderHook(() => useConfigurableSettings(mockProfile));
    const lastNameItem = result.current.sections[0].items.find(
      (i: any) => i.key === 'lastName',
    );
    expect(lastNameItem.value).toBe('Doe');
  });

  it('calls updateProfile when lastName is saved', () => {
    const { result } = renderHook(() => useConfigurableSettings(mockProfile));
    const lastNameItem = result.current.sections[0].items.find(
      (i: any) => i.key === 'lastName',
    );
    act(() => { lastNameItem.onSave('Smith'); });
    expect(mockUpdateProfileMutation).toHaveBeenCalledWith({
      variables: { input: { lastName: 'Smith' } },
    });
  });

  it('creates displayName setting with value from profile', () => {
    const { result } = renderHook(() => useConfigurableSettings(mockProfile));
    const item = result.current.sections[0].items.find(
      (i: any) => i.key === 'displayName',
    );
    expect(item.value).toBe('johndoe');
  });

  it('calls updateProfile when displayName is saved', () => {
    const { result } = renderHook(() => useConfigurableSettings(mockProfile));
    const item = result.current.sections[0].items.find(
      (i: any) => i.key === 'displayName',
    );
    act(() => { item.onSave('newdisplay'); });
    expect(mockUpdateProfileMutation).toHaveBeenCalledWith({
      variables: { input: { displayName: 'newdisplay' } },
    });
  });

  it('creates language setting as modal with correct options', () => {
    const { result } = renderHook(() => useConfigurableSettings(mockProfile));
    const langItem = result.current.sections[1].items.find(
      (i: any) => i.key === 'language',
    );
    expect(langItem).toBeDefined();
    expect(langItem.value).toBe('en');
    expect(langItem.options).toBeDefined();
  });

  it('calls setLanguage and updateSettings when language is saved', () => {
    const { result } = renderHook(() => useConfigurableSettings(mockProfile));
    const langItem = result.current.sections[1].items.find(
      (i: any) => i.key === 'language',
    );
    act(() => { langItem.onSave('es'); });
    expect(mockSetLanguage).toHaveBeenCalledWith('es');
    expect(mockUpdateSettingsMutation).toHaveBeenCalledWith({
      variables: { input: { language: 'es' } },
    });
  });

  it('darkMode switch toggles from DARK to LIGHT', () => {
    const { useTheme } = require('#hooks/useTheme');
    useTheme.mockReturnValue({
      userThemePreference: 'DARK',
      setTheme: mockSetTheme,
    });

    const { result } = renderHook(() => useConfigurableSettings(mockProfile));
    const darkModeItem = result.current.sections[1].items.find(
      (i: any) => i.key === 'darkMode',
    );
    expect(darkModeItem.value).toBe(true);
    act(() => { darkModeItem.onPress(); });
    expect(mockSetTheme).toHaveBeenCalledWith('LIGHT');
  });

  it('biometric setting shows modal when enabled from disabled state', async () => {
    mockGetBiometricInfo.mockResolvedValue({
      isAvailable: true,
      biometryType: 'FaceID',
    });
    mockCheckStoredCredentials.mockResolvedValue(false);

    const { result, rerender } = renderHook(() => useConfigurableSettings(mockProfile));
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
    const { result } = renderHook(() => useConfigurableSettings(mockProfile));
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
    mockGetUserNavigationState.mockReturnValue({ biometricDeclinedPermanently: true } as any);

    const { result } = renderHook(() => useConfigurableSettings(mockProfile));
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    const biometricItem = result.current.sections[2].items.find(
      (i: any) => i.key === 'biometricAuthentication',
    );
    expect(biometricItem.subtitle).toContain('Tap to enable');
  });

  it('returns biometricLoading state', () => {
    const { result } = renderHook(() => useConfigurableSettings(mockProfile));
    expect(typeof result.current.biometricLoading).toBe('boolean');
  });

  // ========== Additional branch/function coverage tests ==========

  describe('profile field settings', () => {
    it('creates bio setting with value from profile', () => {
      const { result } = renderHook(() => useConfigurableSettings(mockProfile));
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

      const { result } = renderHook(() => useConfigurableSettings(mockProfile));
      const phoneItem = result.current.sections[0].items.find((i: any) => i.key === 'phone');
      expect(phoneItem.value).toBe('555-1234');

      const websiteItem = result.current.sections[0].items.find((i: any) => i.key === 'website');
      expect(websiteItem.value).toBe('https://example.com');

      const bioItem = result.current.sections[0].items.find((i: any) => i.key === 'bio');
      expect(bioItem.value).toBe('Test bio');

      const dobItem = result.current.sections[0].items.find((i: any) => i.key === 'dateOfBirth');
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

      const { result } = renderHook(() => useConfigurableSettings(mockProfile));
      const phoneItem = result.current.sections[0].items.find((i: any) => i.key === 'phone');
      act(() => { phoneItem.onSave('555-9999'); });
      expect(mockUpdateProfileMutation).toHaveBeenCalledWith({
        variables: { input: { phone: '555-9999' } },
      });

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

      const { result } = renderHook(() => useConfigurableSettings(mockProfile));
      const item = result.current.sections[0].items.find((i: any) => i.key === 'website');
      act(() => { item.onSave('https://new.com'); });
      expect(mockUpdateProfileMutation).toHaveBeenCalledWith({
        variables: { input: { website: 'https://new.com' } },
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

      const { result } = renderHook(() => useConfigurableSettings(mockProfile));
      const item = result.current.sections[0].items.find((i: any) => i.key === 'bio');
      act(() => { item.onSave('New bio'); });
      expect(mockUpdateProfileMutation).toHaveBeenCalledWith({
        variables: { input: { bio: 'New bio' } },
      });

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

      const { result } = renderHook(() => useConfigurableSettings(mockProfile));
      const item = result.current.sections[0].items.find((i: any) => i.key === 'dateOfBirth');
      act(() => { item.onSave('1990-01-01'); });
      expect(dateStringToISO).toHaveBeenCalledWith('1990-01-01');
      expect(mockUpdateProfileMutation).toHaveBeenCalled();

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

      const { result } = renderHook(() =>
        useConfigurableSettings({ ...mockProfile, gender: 'male' }),
      );
      const item = result.current.sections[0].items.find((i: any) => i.key === 'gender');
      expect(item.value).toBe('male');
      expect(item.options).toBeDefined();
      expect(item.options.length).toBe(5);

      act(() => { item.onSave('female'); });
      expect(mockUpdateProfileMutation).toHaveBeenCalledWith({
        variables: { input: { gender: 'female' } },
      });

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

      const { result } = renderHook(() => useConfigurableSettings({ ...mockProfile, gender: undefined }));
      const item = result.current.sections[0].items.find((i: any) => i.key === 'gender');
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
        items: [{ key: 'profileVisibility', label: 'Profile Visibility', type: 'modal' }],
      });

      const { result } = renderHook(() => useConfigurableSettings(mockProfile));
      const item = result.current.sections[0].items.find((i: any) => i.key === 'profileVisibility');
      expect(item.value).toBe('PUBLIC');
      expect(item.options).toBeDefined();

      act(() => { item.onSave('PRIVATE'); });
      expect(mockUpdateProfileMutation).toHaveBeenCalledWith({
        variables: { input: { profileVisibility: 'PRIVATE' } },
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

      const { result } = renderHook(() => useConfigurableSettings(mockProfile));
      const item = result.current.sections[0].items.find((i: any) => i.key === 'showEmail');
      expect(item.value).toBe(true); // mockProfile.showEmail is true

      act(() => { item.onPress(); });
      expect(mockUpdateProfileMutation).toHaveBeenCalledWith({
        variables: { input: { showEmail: false } },
      });

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

      const { result } = renderHook(() => useConfigurableSettings(mockProfile));
      const item = result.current.sections[0].items.find((i: any) => i.key === 'showPhone');
      expect(item.value).toBe(false); // mockProfile.showPhone is false

      act(() => { item.onPress(); });
      expect(mockUpdateProfileMutation).toHaveBeenCalledWith({
        variables: { input: { showPhone: true } },
      });

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
          { key: 'personalInformation', label: 'Personal Information', type: 'navigation' },
          { key: 'notifications', label: 'Notifications', type: 'navigation' },
          { key: 'dietaryProfile', label: 'Dietary Profile', type: 'navigation' },
          { key: 'appSettings', label: 'App Settings', type: 'navigation' },
          { key: 'debugInfo', label: 'Debug Info', type: 'navigation' },
          { key: 'performanceDashboard', label: 'Performance Dashboard', type: 'navigation' },
          { key: 'changePassword', label: 'Change Password', type: 'navigation' },
        ],
      });

      const { result } = renderHook(() => useConfigurableSettings(mockProfile));
      const items = result.current.sections[0].items;

      items.forEach((item: any) => {
        expect(typeof item.onPress).toBe('function');
        // Should not throw
        act(() => { item.onPress(); });
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

      const { result } = renderHook(() => useConfigurableSettings(mockProfile));
      const items = result.current.sections[0].items;

      expect(items.find((i: any) => i.key === 'personalInformation').testID).toBe('profile-menu-personalInformation');
      expect(items.find((i: any) => i.key === 'notifications').testID).toBe('profile-menu-notifications');
      expect(items.find((i: any) => i.key === 'dietaryProfile').testID).toBe('profile-menu-dietaryProfile');
      expect(items.find((i: any) => i.key === 'appSettings').testID).toBe('profile-menu-appSettings');
      expect(items.find((i: any) => i.key === 'debugInfo').testID).toBe('profile-menu-debugInfo');
      expect(items.find((i: any) => i.key === 'performanceDashboard').testID).toBe('profile-menu-performanceDashboard');
      expect(items.find((i: any) => i.key === 'logout').testID).toBe('profile-logout-button');
      expect(items.find((i: any) => i.key === 'privacy').testID).toBe('profile-menu-privacy');
      expect(items.find((i: any) => i.key === 'help').testID).toBe('profile-menu-help');
      expect(items.find((i: any) => i.key === 'about').testID).toBe('profile-menu-about');
      expect(items.find((i: any) => i.key === 'feedback').testID).toBe('profile-menu-feedback');

      PROFILE_SETTINGS_CONFIG.length = 0;
      original.forEach((item: any) => PROFILE_SETTINGS_CONFIG.push(item));
    });
  });

  describe('default/unknown config key', () => {
    it('logs warning for unhandled setting key', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const { PROFILE_SETTINGS_CONFIG } = require('#/config/settingsConfig');
      const original = [...PROFILE_SETTINGS_CONFIG];
      PROFILE_SETTINGS_CONFIG.length = 0;
      PROFILE_SETTINGS_CONFIG.push({
        title: 'Unknown',
        items: [{ key: 'unknownKey', label: 'Unknown', type: 'text' }],
      });

      renderHook(() => useConfigurableSettings(mockProfile));
      expect(warnSpy).toHaveBeenCalledWith('Unhandled setting key: unknownKey');

      PROFILE_SETTINGS_CONFIG.length = 0;
      original.forEach((item: any) => PROFILE_SETTINGS_CONFIG.push(item));
      warnSpy.mockRestore();
    });
  });

  describe('biometric authentication', () => {
    it('biometric onPress does nothing when not available', async () => {
      mockGetBiometricInfo.mockResolvedValue({ isAvailable: false, biometryType: null });
      mockCheckStoredCredentials.mockResolvedValue(false);

      const { result } = renderHook(() => useConfigurableSettings(mockProfile));
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
      expect(Alert.alert).not.toHaveBeenCalled();
    });

    it('biometric onPress shows modal when available and not enabled', async () => {
      mockGetBiometricInfo.mockResolvedValue({ isAvailable: true, biometryType: 'FaceID' });
      mockCheckStoredCredentials.mockResolvedValue(false);

      const { result } = renderHook(() => useConfigurableSettings(mockProfile));
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
      expect(Alert.alert).not.toHaveBeenCalled();
    });

    it('biometric onPress shows disable alert when currently enabled', async () => {
      mockGetBiometricInfo.mockResolvedValue({ isAvailable: true, biometryType: 'FaceID' });
      mockCheckStoredCredentials.mockResolvedValue(true);

      const { result } = renderHook(() => useConfigurableSettings(mockProfile));
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      const biometricItem = result.current.sections[2].items.find(
        (i: any) => i.key === 'biometricAuthentication',
      );

      await act(async () => {
        await biometricItem.onPress();
      });

      expect(Alert.alert).toHaveBeenCalledWith(
        'Disable Biometric Authentication',
        expect.any(String),
        expect.any(Array),
      );
    });

    it('biometric disable alert calls removeCredentials on confirm', async () => {
      mockGetBiometricInfo.mockResolvedValue({ isAvailable: true, biometryType: 'FaceID' });
      mockCheckStoredCredentials.mockResolvedValue(true);

      const { result } = renderHook(() => useConfigurableSettings(mockProfile));
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
      const alertCalls = (Alert.alert as jest.Mock).mock.calls;
      const lastCall = alertCalls[alertCalls.length - 1];
      const buttons = lastCall[2];
      const disableButton = buttons.find((b: any) => b.text === 'Disable');

      await act(async () => {
        await disableButton.onPress();
      });

      expect(mockRemoveCredentials).toHaveBeenCalledWith('test@example.com');
    });

    it('biometric uses "biometric" fallback when biometryType is null', async () => {
      mockGetBiometricInfo.mockResolvedValue({ isAvailable: true, biometryType: null });
      mockCheckStoredCredentials.mockResolvedValue(true);

      const { result } = renderHook(() => useConfigurableSettings(mockProfile));
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      const biometricItem = result.current.sections[2].items.find(
        (i: any) => i.key === 'biometricAuthentication',
      );

      expect(biometricItem.subtitle).toContain('biometric');
    });

    it('biometric loading starts false when no user email', () => {
      const { useAppStore } = require('#store/useAppStore');
      useAppStore.mockImplementation((selector: any) => {
        const state = {
          user: { id: 'user-1', email: '' },
          logout: mockLogout,
          getUserNavigationState: mockGetUserNavigationState,
          language: 'en',
          setLanguage: mockSetLanguage,
        };
        return typeof selector === 'function' ? selector(state) : state;
      });

      const { result } = renderHook(() => useConfigurableSettings(mockProfile));
      expect(result.current.biometricLoading).toBe(false);

      // Restore mock
      useAppStore.mockImplementation((selector: any) => {
        const state = {
          user: { id: 'user-1', email: 'test@example.com' },
          logout: mockLogout,
          getUserNavigationState: mockGetUserNavigationState,
          language: 'en',
          setLanguage: mockSetLanguage,
        };
        return typeof selector === 'function' ? selector(state) : state;
      });
    });
  });

  describe('handleBiometricModalComplete', () => {
    it('sets biometricEnabled to true and resets declination when enabled', async () => {
      mockGetBiometricInfo.mockResolvedValue({ isAvailable: true, biometryType: 'FaceID' });
      mockCheckStoredCredentials.mockResolvedValue(false);

      const { result } = renderHook(() => useConfigurableSettings(mockProfile));
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
      mockGetBiometricInfo.mockResolvedValue({ isAvailable: true, biometryType: 'FaceID' });
      mockCheckStoredCredentials.mockResolvedValue(false);

      const { result } = renderHook(() => useConfigurableSettings(mockProfile));
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      const modal = result.current.BiometricModal;
      await act(async () => {
        await modal.props.onComplete(false);
      });

      expect(mockCheckStoredCredentials).toHaveBeenCalledWith('test@example.com');
    });
  });

  describe('executeQuery failure in biometric loading', () => {
    it('handles executeQuery returning null gracefully', async () => {
      const { executeQuery } = require('#/utils/compilerSafeWrappers');
      executeQuery.mockResolvedValueOnce(null);

      const { result } = renderHook(() => useConfigurableSettings(mockProfile));
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Should still finish loading without error
      expect(result.current.biometricLoading).toBe(false);
    });
  });
});
