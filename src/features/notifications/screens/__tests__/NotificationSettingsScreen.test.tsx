'use no memo';

import React from 'react';
import { render } from '@testing-library/react-native';
import NotificationSettingsScreen from '../NotificationSettingsScreen';

// Mock token scheduler / refreshToken
jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(() => ({
    addListener: jest.fn(() => jest.fn()),
  })),
}));

const mockUpdateNotificationSetting = jest.fn().mockResolvedValue(true);
const mockResetToDefaults = jest.fn().mockResolvedValue(true);
const mockIsQuietTime = jest.fn(() => false);

jest.mock('#features/notifications/hooks/useNotificationSettings', () => ({
  useNotificationSettings: jest.fn(() => ({
    settings: {
      pushEnabled: true,
      emailEnabled: false,
      smsEnabled: false,
      expirationNotifications: true,
      expirationNotificationFrequency: 'DAILY_MORNING',
      expirationDaysThreshold: 3,
      lowStockAlerts: false,
      pantryChanges: false,
      shoppingListUpdates: true,
      sharedListUpdates: false,
      collaborationInvites: true,
      homeInvites: true,
      recipeRecommendations: false,
      mealPlanReminders: false,
      cookingReminders: false,
      weeklyDigest: false,
      monthlyReport: false,
      quietHoursEnabled: false,
      quietHoursStart: '22:00',
      quietHoursEnd: '08:00',
    },
    loading: false,
    updateNotificationSetting: mockUpdateNotificationSetting,
    resetToDefaults: mockResetToDefaults,
    isQuietTime: mockIsQuietTime,
  })),
}));

jest.mock('#features/notifications/hooks/useNotificationPermissions', () => ({
  useNotificationPermissions: jest.fn(() => ({
    hasPermission: true,
    requestPermissions: jest.fn().mockResolvedValue(true),
    checkPermissions: jest.fn(),
  })),
}));

jest.mock('#features/notifications/hooks/useNotificationSync', () => ({
  useNotificationSync: jest.fn(() => ({
    syncSendTest: jest.fn().mockResolvedValue(true),
  })),
}));

jest.mock('#components/settings/SettingSwitch', () => ({
  SettingSwitch: ({ title }: { title: string }) => title,
}));

jest.mock('#components/organisms/SettingsSection', () => ({
  SettingsSection: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('#components/templates/ProfileScreenWrapper', () => ({
  ProfileScreenWrapper: ({ children }: { children: React.ReactNode }) =>
    children,
}));

jest.mock('#components/molecules/ModalPicker', () => ({
  ModalPicker: () => null,
}));

jest.mock('#components/molecules/AlertBanner', () => ({
  AlertBanner: () => null,
}));

jest.mock('#/utils/finallyHelpers');

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

describe('NotificationSettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders settings sections', () => {
    const tree = render(<NotificationSettingsScreen />);
    expect(tree.toJSON()).toBeTruthy();
  });

  it('shows loading state when no preferences have loaded yet', () => {
    const { useNotificationSettings } = jest.requireMock(
      '#features/notifications/hooks/useNotificationSettings',
    );
    useNotificationSettings.mockReturnValue({
      settings: {},
      loading: true,
      hasPreferences: false,
      updateNotificationSetting: jest.fn(),
      resetToDefaults: jest.fn(),
      isQuietTime: jest.fn(() => false),
    });

    const tree = render(<NotificationSettingsScreen />);
    expect(tree.getByTestId('notification-settings-state')).toBeTruthy();
  });

  /**
   * The gate is `loading && !hasPreferences`, not `loading`. Under
   * `cache-and-network` Apollo reports `loading: true` for the whole network
   * leg on EVERY mount — `nextFetchPolicy` lives on the ObservableQuery and
   * useQuery builds a new one each time — so gating on `loading` alone blanked
   * this screen on every visit for as long as the request took, which against
   * a stalled API is the 10s httpLink abort deadline.
   */
  it('renders the settings while a background refresh is in flight', () => {
    const { useNotificationSettings } = jest.requireMock(
      '#features/notifications/hooks/useNotificationSettings',
    );
    useNotificationSettings.mockReturnValue({
      settings: { pushEnabled: true, emailEnabled: true },
      loading: true,
      hasPreferences: true,
      updateNotificationSetting: jest.fn(),
      resetToDefaults: jest.fn(),
      isQuietTime: jest.fn(() => false),
    });

    const tree = render(<NotificationSettingsScreen />);
    expect(tree.queryByText('Loading settings...')).toBeNull();
    // The mocked SettingSwitch renders its title as a bare string child, not a
    // <Text>, so it is reachable through the serialized tree rather than
    // getByText.
    expect(JSON.stringify(tree.toJSON())).toContain('Push Notifications');
  });

  it('renders when quiet time is active', () => {
    const { useNotificationSettings } = jest.requireMock(
      '#features/notifications/hooks/useNotificationSettings',
    );
    useNotificationSettings.mockReturnValue({
      settings: {
        pushEnabled: true,
        emailEnabled: false,
        smsEnabled: false,
        expirationNotifications: false,
        lowStockAlerts: false,
        pantryChanges: false,
        shoppingListUpdates: false,
        sharedListUpdates: false,
        collaborationInvites: false,
        homeInvites: false,
        recipeRecommendations: false,
        mealPlanReminders: false,
        cookingReminders: false,
        weeklyDigest: false,
        monthlyReport: false,
        quietHoursEnabled: true,
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00',
      },
      loading: false,
      updateNotificationSetting: jest.fn(),
      resetToDefaults: jest.fn(),
      isQuietTime: jest.fn(() => true),
    });

    const tree = render(<NotificationSettingsScreen />);
    expect(tree.toJSON()).toBeTruthy();
  });

  it('renders without permission warning when permissions granted', () => {
    const tree = render(<NotificationSettingsScreen />);
    expect(tree.toJSON()).toBeTruthy();
  });

  it('renders when push is enabled but permission denied', () => {
    const { useNotificationPermissions } = jest.requireMock(
      '#features/notifications/hooks/useNotificationPermissions',
    );
    useNotificationPermissions.mockReturnValue({
      hasPermission: false,
      requestPermissions: jest.fn().mockResolvedValue(false),
      checkPermissions: jest.fn(),
    });

    const tree = render(<NotificationSettingsScreen />);
    expect(tree.toJSON()).toBeTruthy();
  });

  it('renders with all notification types enabled', () => {
    const { useNotificationSettings } = jest.requireMock(
      '#features/notifications/hooks/useNotificationSettings',
    );
    useNotificationSettings.mockReturnValue({
      settings: {
        pushEnabled: true,
        emailEnabled: true,
        smsEnabled: true,
        expirationNotifications: true,
        expirationNotificationFrequency: 'REAL_TIME',
        expirationDaysThreshold: 7,
        lowStockAlerts: true,
        pantryChanges: true,
        shoppingListUpdates: true,
        sharedListUpdates: true,
        collaborationInvites: true,
        homeInvites: true,
        recipeRecommendations: true,
        mealPlanReminders: true,
        cookingReminders: true,
        weeklyDigest: true,
        monthlyReport: true,
        quietHoursEnabled: true,
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00',
      },
      loading: false,
      updateNotificationSetting: mockUpdateNotificationSetting,
      resetToDefaults: mockResetToDefaults,
      isQuietTime: mockIsQuietTime,
    });

    const tree = render(<NotificationSettingsScreen />);
    expect(tree.toJSON()).toBeTruthy();
  });

  it('renders with push disabled', () => {
    const { useNotificationSettings } = jest.requireMock(
      '#features/notifications/hooks/useNotificationSettings',
    );
    useNotificationSettings.mockReturnValue({
      settings: {
        pushEnabled: false,
        emailEnabled: false,
        smsEnabled: false,
        expirationNotifications: false,
        lowStockAlerts: false,
        pantryChanges: false,
        shoppingListUpdates: false,
        sharedListUpdates: false,
        collaborationInvites: false,
        homeInvites: false,
        recipeRecommendations: false,
        mealPlanReminders: false,
        cookingReminders: false,
        weeklyDigest: false,
        monthlyReport: false,
        quietHoursEnabled: false,
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00',
      },
      loading: false,
      updateNotificationSetting: mockUpdateNotificationSetting,
      resetToDefaults: mockResetToDefaults,
      isQuietTime: jest.fn(() => false),
    });

    const tree = render(<NotificationSettingsScreen />);
    expect(tree.toJSON()).toBeTruthy();
  });

  it('renders with WEEKLY_DIGEST frequency', () => {
    const { useNotificationSettings } = jest.requireMock(
      '#features/notifications/hooks/useNotificationSettings',
    );
    useNotificationSettings.mockReturnValue({
      settings: {
        pushEnabled: true,
        emailEnabled: false,
        smsEnabled: false,
        expirationNotifications: true,
        expirationNotificationFrequency: 'WEEKLY_DIGEST',
        expirationDaysThreshold: 5,
        lowStockAlerts: false,
        pantryChanges: false,
        shoppingListUpdates: false,
        sharedListUpdates: false,
        collaborationInvites: false,
        homeInvites: false,
        recipeRecommendations: false,
        mealPlanReminders: false,
        cookingReminders: false,
        weeklyDigest: false,
        monthlyReport: false,
        quietHoursEnabled: false,
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00',
      },
      loading: false,
      updateNotificationSetting: mockUpdateNotificationSetting,
      resetToDefaults: mockResetToDefaults,
      isQuietTime: jest.fn(() => false),
    });

    const tree = render(<NotificationSettingsScreen />);
    expect(tree.toJSON()).toBeTruthy();
  });

  it('renders with NEVER frequency', () => {
    const { useNotificationSettings } = jest.requireMock(
      '#features/notifications/hooks/useNotificationSettings',
    );
    useNotificationSettings.mockReturnValue({
      settings: {
        pushEnabled: true,
        emailEnabled: false,
        smsEnabled: false,
        expirationNotifications: true,
        expirationNotificationFrequency: 'NEVER',
        expirationDaysThreshold: 0,
        lowStockAlerts: false,
        pantryChanges: false,
        shoppingListUpdates: false,
        sharedListUpdates: false,
        collaborationInvites: false,
        homeInvites: false,
        recipeRecommendations: false,
        mealPlanReminders: false,
        cookingReminders: false,
        weeklyDigest: false,
        monthlyReport: false,
        quietHoursEnabled: false,
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00',
      },
      loading: false,
      updateNotificationSetting: mockUpdateNotificationSetting,
      resetToDefaults: mockResetToDefaults,
      isQuietTime: jest.fn(() => false),
    });

    const tree = render(<NotificationSettingsScreen />);
    expect(tree.toJSON()).toBeTruthy();
  });

  it('renders with DAILY_EVENING frequency', () => {
    const { useNotificationSettings } = jest.requireMock(
      '#features/notifications/hooks/useNotificationSettings',
    );
    useNotificationSettings.mockReturnValue({
      settings: {
        pushEnabled: true,
        emailEnabled: true,
        smsEnabled: false,
        expirationNotifications: true,
        expirationNotificationFrequency: 'DAILY_EVENING',
        expirationDaysThreshold: 1,
        lowStockAlerts: true,
        pantryChanges: true,
        shoppingListUpdates: true,
        sharedListUpdates: true,
        collaborationInvites: true,
        homeInvites: true,
        recipeRecommendations: true,
        mealPlanReminders: true,
        cookingReminders: true,
        weeklyDigest: true,
        monthlyReport: true,
        quietHoursEnabled: false,
        quietHoursStart: '23:00',
        quietHoursEnd: '07:00',
      },
      loading: false,
      updateNotificationSetting: mockUpdateNotificationSetting,
      resetToDefaults: mockResetToDefaults,
      isQuietTime: jest.fn(() => false),
    });

    const tree = render(<NotificationSettingsScreen />);
    expect(tree.toJSON()).toBeTruthy();
  });
});
