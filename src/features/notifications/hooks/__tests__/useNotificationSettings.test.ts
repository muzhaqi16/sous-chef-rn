'use no memo';

import { act, waitFor } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { UpdateNotificationPreferencesDocument } from '#operations/user/user.generated';
import { useNotificationSettings } from '../useNotificationSettings';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('#store/useAppStore', () => {
  const getState = () => ({ user: { id: 'user-1' } });
  return {
    useAppStore: jest.fn((selector: any) => selector(getState())),
    useUser: () => (s => s.user)(getState()),
    useUserId: () => (s => s.user?.id)(getState()),
  };
});

const mockPreferencesData = {
  __typename: 'NotificationPreferences',
  id: 'pref-1',
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

jest.mock('#/utils/compilerSafeWrappers');

jest.mock('#/services/errorService', () => ({
  useErrorService: () => ({
    handleApolloError: jest.fn().mockReturnValue({ message: 'Error' }),
  }),
}));

jest.mock('#hooks/apollo/useApolloErrorLogger', () => ({
  useApolloErrorLogger: jest.fn(),
}));

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

function withPrefs(prefs: typeof mockPreferencesData | null) {
  return {
    mocks: {
      Query: () => ({
        me: {
          __typename: 'User',
          id: 'user-1',
          notificationPreferences: prefs,
        },
      }),
    },
  };
}

describe('useNotificationSettings', () => {
  it('returns settings from query data', async () => {
    const { result } = renderHookWithApollo(
      () => useNotificationSettings(),
      withPrefs(mockPreferencesData),
    );

    await waitFor(() =>
      expect(result.current.settings.expirationDaysThreshold).toBe(5),
    );
    expect(result.current.settings.emailEnabled).toBe(true);
    expect(result.current.settings.pushEnabled).toBe(true);
    expect(result.current.settings.smsEnabled).toBe(false);
  });

  it('returns defaults when no preferences data', async () => {
    const { result } = renderHookWithApollo(
      () => useNotificationSettings(),
      withPrefs(null),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.settings.emailEnabled).toBe(true);
    expect(result.current.settings.pushEnabled).toBe(false);
    expect(result.current.settings.expirationDaysThreshold).toBe(3);
  });

  it('returns loading state', async () => {
    const { result } = renderHookWithApollo(
      () => useNotificationSettings(),
      withPrefs(mockPreferencesData),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.loading).toBe(false);
  });

  it('updateNotificationSetting calls mutation with nested input', async () => {
    const update = recordMock(UpdateNotificationPreferencesDocument, {
      data: { updateNotificationPreferences: true },
    });

    const { result } = renderHookWithApollo(() => useNotificationSettings(), {
      ...withPrefs(mockPreferencesData),
      operationMocks: [update.mock],
    });

    let success: boolean = false;
    await act(async () => {
      success = await result.current.updateNotificationSetting(
        'pushEnabled',
        true,
      );
    });

    expect(update.fired).toContainEqual({
      input: { channels: { pushEnabled: true } },
    });
    expect(success).toBe(true);
  });

  it('updateNotificationSetting maps feature keys correctly', async () => {
    const update = recordMock(UpdateNotificationPreferencesDocument, {
      data: { updateNotificationPreferences: true },
    });

    const { result } = renderHookWithApollo(() => useNotificationSettings(), {
      ...withPrefs(mockPreferencesData),
      operationMocks: [update.mock],
    });

    await act(async () => {
      await result.current.updateNotificationSetting('lowStockAlerts', false);
    });

    expect(update.fired).toContainEqual({
      input: { features: { lowStockAlerts: false } },
    });
  });

  it('updateNotificationSetting maps expiration keys correctly', async () => {
    const update = recordMock(UpdateNotificationPreferencesDocument, {
      data: { updateNotificationPreferences: true },
    });

    const { result } = renderHookWithApollo(() => useNotificationSettings(), {
      ...withPrefs(mockPreferencesData),
      operationMocks: [update.mock],
    });

    await act(async () => {
      await result.current.updateNotificationSetting(
        'expirationDaysThreshold',
        7,
      );
    });

    expect(update.fired).toContainEqual({
      input: { expiration: { expirationDaysThreshold: 7 } },
    });
  });

  it('updateMultipleSettings sends batch update', async () => {
    const update = recordMock(UpdateNotificationPreferencesDocument, {
      data: { updateNotificationPreferences: true },
    });

    const { result } = renderHookWithApollo(() => useNotificationSettings(), {
      ...withPrefs(mockPreferencesData),
      operationMocks: [update.mock],
    });

    let success: boolean = false;
    await act(async () => {
      success = await result.current.updateMultipleSettings({
        pushEnabled: true,
        lowStockAlerts: false,
      });
    });

    expect(update.fired.length).toBeGreaterThan(0);
    expect(success).toBe(true);
  });

  it('resetToDefaults sends default values', async () => {
    const update = recordMock(UpdateNotificationPreferencesDocument, {
      data: { updateNotificationPreferences: true },
    });

    const { result } = renderHookWithApollo(() => useNotificationSettings(), {
      ...withPrefs(mockPreferencesData),
      operationMocks: [update.mock],
    });

    await act(async () => {
      await result.current.resetToDefaults();
    });

    expect(update.fired.length).toBeGreaterThan(0);
  });

  it('isQuietTime returns false when quiet hours disabled', async () => {
    const { result } = renderHookWithApollo(
      () => useNotificationSettings(),
      withPrefs(mockPreferencesData),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isQuietTime()).toBe(false);
  });

  it('isQuietTime evaluates correctly when enabled', async () => {
    const { result } = renderHookWithApollo(
      () => useNotificationSettings(),
      withPrefs({
        ...mockPreferencesData,
        quietHoursEnabled: true,
        quietHoursStart: '00:00',
        quietHoursEnd: '23:59',
      }),
    );
    await waitFor(() =>
      expect(result.current.settings.quietHoursEnabled).toBe(true),
    );
    expect(result.current.isQuietTime()).toBe(true);
  });
});
