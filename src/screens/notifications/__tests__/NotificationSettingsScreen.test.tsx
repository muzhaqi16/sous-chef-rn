'use no memo';

import React from 'react';
import { render } from '@testing-library/react-native';
import { Alert } from 'react-native';
import NotificationSettingsScreen from '../NotificationSettingsScreen';

// Mock token scheduler / refreshToken
jest.mock('#/apollo/links/tokenScheduler', () => ({
  scheduleTokenRefresh: jest.fn(),
  cancelScheduledRefresh: jest.fn(),
}));
jest.mock('#/apollo/links/refreshToken', () => ({
  refreshAccessToken: jest.fn(),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(() => ({
    addListener: jest.fn(() => jest.fn()),
  })),
}));

const mockUpdateNotificationSetting = jest.fn().mockResolvedValue(true);
const mockResetToDefaults = jest.fn().mockResolvedValue(true);
const mockIsQuietTime = jest.fn(() => false);

jest.mock('#hooks/notifications/useNotificationSettings', () => ({
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

jest.mock('#hooks/notifications/useNotificationPermissions', () => ({
  useNotificationPermissions: jest.fn(() => ({
    hasPermission: true,
    requestPermissions: jest.fn().mockResolvedValue(true),
    checkPermissions: jest.fn(),
  })),
}));

jest.mock('#generated', () => ({
  ExpirationFrequency: {
    RealTime: 'REAL_TIME',
    DailyMorning: 'DAILY_MORNING',
    DailyEvening: 'DAILY_EVENING',
    WeeklyDigest: 'WEEKLY_DIGEST',
    Never: 'NEVER',
  },
}));

jest.mock('#components/settings/SettingSwitch', () => ({
  SettingSwitch: ({ title }: any) => title,
}));

jest.mock('#components/settings/SettingSection', () => ({
  SettingSection: ({ children }: any) => children,
}));

jest.mock('#components/templates/ProfileScreenWrapper', () => ({
  ProfileScreenWrapper: ({ children }: any) => children,
}));

jest.mock('#components/molecules/ModalPicker', () => ({
  ModalPicker: () => null,
}));

jest.mock('#components/molecules/AlertBanner', () => ({
  AlertBanner: () => null,
}));

jest.mock('#/utils/compilerSafeWrappers', () => ({
  executeWithLoadingState: jest.fn(async (fn: any, setLoading: any, onError?: any) => {
    setLoading(true);
    try {
      return await fn();
    } catch (e) {
      onError?.(e);
    } finally {
      setLoading(false);
    }
  }),
  executeRefreshWithFinally: jest.fn(async (fn: any, setLoading: any) => {
    setLoading(true);
    try {
      return await fn();
    } finally {
      setLoading(false);
    }
  }),
}));

jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());

describe('NotificationSettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders settings sections', () => {
    const tree = render(<NotificationSettingsScreen />);
    expect(tree.toJSON()).toBeTruthy();
  });

  it('shows loading state when settings are loading', () => {
    const { useNotificationSettings } = jest.requireMock(
      '#hooks/notifications/useNotificationSettings',
    );
    useNotificationSettings.mockReturnValue({
      settings: {},
      loading: true,
      updateNotificationSetting: jest.fn(),
      resetToDefaults: jest.fn(),
      isQuietTime: jest.fn(() => false),
    });

    const tree = render(<NotificationSettingsScreen />);
    expect(tree.getByText('Loading settings...')).toBeTruthy();
  });

  it('renders when quiet time is active', () => {
    const { useNotificationSettings } = jest.requireMock(
      '#hooks/notifications/useNotificationSettings',
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
      '#hooks/notifications/useNotificationPermissions',
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
      '#hooks/notifications/useNotificationSettings',
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
      '#hooks/notifications/useNotificationSettings',
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
      '#hooks/notifications/useNotificationSettings',
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
      '#hooks/notifications/useNotificationSettings',
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
      '#hooks/notifications/useNotificationSettings',
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
