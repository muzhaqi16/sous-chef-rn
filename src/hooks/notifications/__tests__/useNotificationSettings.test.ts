'use no memo';

import { renderHook, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { useNotificationSettings } from '../useNotificationSettings';

jest.mock('../../../apollo/links/tokenScheduler');
jest.mock('../../../apollo/links/refreshToken');

jest.mock('#store/useAppStore', () => ({
  useAppStore: jest.fn((selector: any) =>
    selector({ user: { id: 'user-1' } }),
  ),
}));

const mockUpdatePreferences = jest.fn();

const mockPreferencesData = {
  emailEnabled: true,
  pushEnabled: true,
  smsEnabled: false,
  expirationNotifications: true,
  expirationNotificationFrequency: 'DAILY_MORNING',
  expirationDaysThreshold: 5,
  lowStockAlerts: true,
  pantryChanges: true,
  shoppingListUpdates: true,
  collaborationInvites: true,
  homeInvites: true,
  sharedListUpdates: true,
  recipeRecommendations: true,
  mealPlanReminders: true,
  cookingReminders: true,
  weeklyDigest: true,
  monthlyReport: false,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
  quietHoursTimezone: 'America/New_York',
};

jest.mock('#generated', () => ({
  ...jest.requireActual('#generated'),
  useGetNotificationPreferencesQuery: jest.fn(() => ({
    data: { me: { notificationPreferences: mockPreferencesData } },
    loading: false,
    error: undefined,
  })),
  useUpdateNotificationPreferencesMutation: () => [mockUpdatePreferences, {}],
}));

jest.mock('#/utils/compilerSafeWrappers');

jest.mock('#/services/errorService', () => ({
  useErrorService: () => ({
    handleApolloError: jest.fn().mockReturnValue({ message: 'Error' }),
  }),
}));

jest.mock('#hooks/apollo/useApolloErrorLogger', () => ({
  useApolloErrorLogger: jest.fn(),
}));

jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useNotificationSettings', () => {
  it('returns settings from query data', () => {
    const { result } = renderHook(() => useNotificationSettings());

    expect(result.current.settings.emailEnabled).toBe(true);
    expect(result.current.settings.pushEnabled).toBe(true);
    expect(result.current.settings.smsEnabled).toBe(false);
    expect(result.current.settings.expirationDaysThreshold).toBe(5);
  });

  it('returns defaults when no preferences data', () => {
    const { useGetNotificationPreferencesQuery } = require('#generated');
    useGetNotificationPreferencesQuery.mockReturnValue({
      data: null,
      loading: false,
      error: undefined,
    });

    const { result } = renderHook(() => useNotificationSettings());

    expect(result.current.settings.emailEnabled).toBe(true);
    expect(result.current.settings.pushEnabled).toBe(false);
    expect(result.current.settings.expirationDaysThreshold).toBe(3);
  });

  it('returns loading state', () => {
    const { result } = renderHook(() => useNotificationSettings());
    expect(result.current.loading).toBe(false);
  });

  it('updateNotificationSetting calls mutation with nested input', async () => {
    mockUpdatePreferences.mockResolvedValue({ data: { updateNotificationPreferences: true } });

    const { result } = renderHook(() => useNotificationSettings());

    let success: boolean = false;
    await act(async () => {
      success = await result.current.updateNotificationSetting('pushEnabled', true);
    });

    expect(mockUpdatePreferences).toHaveBeenCalledWith({
      variables: {
        input: { channels: { pushEnabled: true } },
      },
    });
    expect(success).toBe(true);
  });

  it('updateNotificationSetting maps feature keys correctly', async () => {
    mockUpdatePreferences.mockResolvedValue({ data: { updateNotificationPreferences: true } });

    const { result } = renderHook(() => useNotificationSettings());

    await act(async () => {
      await result.current.updateNotificationSetting('lowStockAlerts', false);
    });

    expect(mockUpdatePreferences).toHaveBeenCalledWith({
      variables: {
        input: { features: { lowStockAlerts: false } },
      },
    });
  });

  it('updateNotificationSetting maps expiration keys correctly', async () => {
    mockUpdatePreferences.mockResolvedValue({ data: { updateNotificationPreferences: true } });

    const { result } = renderHook(() => useNotificationSettings());

    await act(async () => {
      await result.current.updateNotificationSetting('expirationDaysThreshold', 7);
    });

    expect(mockUpdatePreferences).toHaveBeenCalledWith({
      variables: {
        input: { expiration: { expirationDaysThreshold: 7 } },
      },
    });
  });

  it('updateMultipleSettings sends batch update', async () => {
    mockUpdatePreferences.mockResolvedValue({ data: { updateNotificationPreferences: true } });

    const { result } = renderHook(() => useNotificationSettings());

    let success: boolean = false;
    await act(async () => {
      success = await result.current.updateMultipleSettings({
        pushEnabled: true,
        lowStockAlerts: false,
      });
    });

    expect(mockUpdatePreferences).toHaveBeenCalled();
    expect(success).toBe(true);
  });

  it('resetToDefaults sends default values', async () => {
    mockUpdatePreferences.mockResolvedValue({ data: { updateNotificationPreferences: true } });

    const { result } = renderHook(() => useNotificationSettings());

    await act(async () => {
      await result.current.resetToDefaults();
    });

    expect(mockUpdatePreferences).toHaveBeenCalled();
  });

  it('isQuietTime returns false when quiet hours disabled', () => {
    const { result } = renderHook(() => useNotificationSettings());

    expect(result.current.isQuietTime()).toBe(false);
  });

  it('isQuietTime evaluates correctly when enabled', () => {
    const { useGetNotificationPreferencesQuery } = require('#generated');
    useGetNotificationPreferencesQuery.mockReturnValue({
      data: {
        me: {
          notificationPreferences: {
            ...mockPreferencesData,
            quietHoursEnabled: true,
            quietHoursStart: '00:00',
            quietHoursEnd: '23:59',
          },
        },
      },
      loading: false,
      error: undefined,
    });

    const { result } = renderHook(() => useNotificationSettings());

    // With 00:00 to 23:59, any time should be quiet
    expect(result.current.isQuietTime()).toBe(true);
  });
});
