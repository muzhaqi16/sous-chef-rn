import React from 'react';
import { Linking } from 'react-native';
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { t } from '#/i18n';
import { useStore } from '#store';
import { alertService } from '#/services/alertService';
import { toastService } from '#/services/toastService';
import { PermissionService } from '#/services/permissions/PermissionService';
import { registerDeviceInBackground } from '#/services/device/deviceRegistration';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { ModalPicker } from '#components/molecules/ModalPicker';
import {
  recordMock,
  renderWithApollo,
  type MockDataFor,
} from '#/test-utils/apolloMockProvider';
import { operationLog } from '#/test-utils/operationLog';
import {
  ErrorCode,
  ErrorDisposition,
  ExpirationFrequency,
} from '#/graphql/generated/schemaTypes';
import {
  GetNotificationPreferencesDocument,
  UpdateNotificationPreferencesDocument,
} from '#operations/user/user.generated';
import { notificationsTestIDs } from '#features/notifications/testIDs';
import { NotificationSettingsScreen } from '../NotificationSettingsScreen';

jest.mock('#hooks/navigation/useAppNavigation');
// Registration carries the device's push token, read from the OS.
jest.mock('#/services/device/deviceRegistration');

const ME = 'user-1';

let log = operationLog();

type Preferences = NonNullable<
  NonNullable<
    MockDataFor<typeof GetNotificationPreferencesDocument>['me']
  >['notificationPreferences']
>;

const preferencesOf = (overrides: Partial<Preferences> = {}): Preferences => ({
  __typename: 'NotificationPreferences',
  id: 'prefs-1',
  userId: ME,
  pushEnabled: false,
  expirationNotifications: true,
  expirationNotificationFrequency: ExpirationFrequency.DailyMorning,
  expirationDaysThreshold: 3,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
  quietHoursTimezone: null,
  ...overrides,
});

const saved = () =>
  recordMock(UpdateNotificationPreferencesDocument, {
    data: {
      updateNotificationPreferences: {
        __typename: 'UpdateNotificationPreferencesPayload',
        notificationPreferences: preferencesOf(),
      },
    },
  });

const refused = () =>
  recordMock(UpdateNotificationPreferencesDocument, {
    data: {
      updateNotificationPreferences: {
        __typename: 'ValidationError',
        code: ErrorCode.ValidationFailed,
        disposition: ErrorDisposition.Fail,
        message: 'Refused.',
        field: null,
      },
    },
  });

interface Visit {
  preferences?: Partial<Preferences>;
  readHeld?: boolean;
  answers?: ReturnType<typeof recordMock>[];
}

/** The screen over the user's stored preferences. */
async function openSettings({
  preferences = {},
  readHeld = false,
  answers = [],
}: Visit = {}) {
  const read = recordMock(GetNotificationPreferencesDocument, {
    held: readHeld,
    data: {
      me: {
        __typename: 'User',
        id: ME,
        notificationPreferences: preferencesOf(preferences),
      },
    },
  });
  renderWithApollo(<NotificationSettingsScreen />, {
    links: [log.link],
    operationMocks: [read.mock, ...answers.map(answer => answer.mock)],
  });
  if (!readHeld)
    await act(() => log.landed(GetNotificationPreferencesDocument));
  return read;
}

/** The screen comes into focus, which re-reads the OS permission. */
async function focus() {
  const [rendered] = jest.mocked(useAppNavigation).mock.results;
  if (rendered?.type !== 'return')
    throw new Error('the screen read no navigation');
  const { addListener } = rendered.value.navigation;
  await act(async () => {
    for (const [event, listener] of jest.mocked(addListener).mock.calls) {
      if (event === 'focus') listener({ type: 'focus' });
    }
  });
}

const switchFor = (key: string) =>
  screen.getByTestId(notificationsTestIDs.settingSwitch(key));

const toggle = (key: string, value: boolean) =>
  fireEvent(switchFor(key), 'valueChange', value);

/** Presses a button of the last alert raised; a cancel has no handler. */
async function answerAlert(text: string) {
  const [, , buttons] = jest.mocked(alertService.alert).mock.lastCall ?? [];
  const button = buttons?.find(candidate => candidate.text === text);
  if (!button) throw new Error(`no "${text}" in the last alert`);
  await act(async () => {
    button.onPress?.();
  });
}

const pickerLabelled = (label: string) =>
  screen
    .UNSAFE_getAllByType(ModalPicker)
    .find(picker => picker.props.label === label);

/** Opens the picker a row names, and presses one of its options. */
function pick(label: string, option: string) {
  fireEvent.press(screen.getByText(label));
  const picker = pickerLabelled(label);
  if (!picker) throw new Error(`no picker labelled "${label}"`);
  fireEvent.press(within(picker).getByText(option));
}

beforeEach(() => {
  jest.clearAllMocks();
  log = operationLog();
  useStore.setState({
    user: {
      id: ME,
      email: 'cook@example.com',
      emailVerified: true,
      onBoarded: true,
    },
    isOnline: true,
    apiReachable: null,
  });
  jest.spyOn(PermissionService, 'check').mockResolvedValue('granted');
  jest.spyOn(PermissionService, 'request').mockResolvedValue('granted');
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('reading the preferences', () => {
  it('shows their state, not the switches, until they are read', async () => {
    const read = await openSettings({ readHeld: true });

    expect(screen.getByTestId(notificationsTestIDs.settingsState)).toBeTruthy();
    expect(
      screen.queryByTestId(notificationsTestIDs.settingSwitch('pushEnabled')),
    ).toBeNull();

    read.release();
    await act(() => log.landed(GetNotificationPreferencesDocument));
    expect(switchFor('pushEnabled')).toBeTruthy();
  });

  it('shows each switch as stored', async () => {
    await openSettings({
      preferences: { pushEnabled: false, expirationNotifications: true },
    });

    expect(switchFor('expirationNotifications')).toBeChecked();
    expect(switchFor('pushEnabled')).not.toBeChecked();
  });
});

describe('push', () => {
  it('asks the OS before saving push on, then registers the device', async () => {
    const update = saved();
    await openSettings({ answers: [update] });

    toggle('pushEnabled', true);
    await act(() => log.landed(UpdateNotificationPreferencesDocument));

    expect(PermissionService.request).toHaveBeenCalledWith('notifications');
    expect(update.fired).toEqual([
      { input: { channels: { pushEnabled: true } } },
    ]);
    expect(registerDeviceInBackground).toHaveBeenCalled();
  });

  it('offers the system settings while push is on but the OS blocks it', async () => {
    jest.mocked(PermissionService.check).mockResolvedValue('denied');
    jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await openSettings({ preferences: { pushEnabled: true } });
    await focus();

    fireEvent.press(screen.getByText(t('notifications.disabledTitle')));
    await answerAlert(t('labels.openSettings'));

    expect(Linking.openURL).toHaveBeenCalledWith('app-settings:');
  });

  it('shows no blocked-push banner while push is off', async () => {
    jest.mocked(PermissionService.check).mockResolvedValue('denied');
    await openSettings({ preferences: { pushEnabled: false } });
    await focus();

    expect(screen.queryByText(t('notifications.disabledTitle'))).toBeNull();
  });
});

describe('a setting', () => {
  it('says so when the server refuses it', async () => {
    await openSettings({ answers: [refused()] });

    toggle('lowStockAlerts', false);
    await act(() => log.landed(UpdateNotificationPreferencesDocument));

    expect(alertService.alert).toHaveBeenCalledWith(
      t('labels.error'),
      t('notifications.updateFailed'),
    );
  });
});

describe('expiry alerts', () => {
  it('offer no frequency while they are off', async () => {
    await openSettings({ preferences: { expirationNotifications: false } });

    expect(
      screen.queryByText(t('notifications.notificationFrequency')),
    ).toBeNull();
  });

  it('save a picked frequency, and close the picker', async () => {
    const update = saved();
    await openSettings({ answers: [update] });

    pick(t('notifications.notificationFrequency'), t('labels.weeklyDigest'));
    await act(() => log.landed(UpdateNotificationPreferencesDocument));

    expect(update.fired).toEqual([
      {
        input: {
          expiration: {
            expirationNotificationFrequency: ExpirationFrequency.WeeklyDigest,
          },
        },
      },
    ]);
    expect(
      pickerLabelled(t('notifications.notificationFrequency'))?.props.visible,
    ).toBe(false);
  });

  it('offer no threshold for a weekly digest', async () => {
    await openSettings({
      preferences: {
        expirationNotificationFrequency: ExpirationFrequency.WeeklyDigest,
      },
    });

    expect(screen.queryByText(t('notifications.alertThreshold'))).toBeNull();
  });

  it('save a picked threshold as a number of days', async () => {
    const update = saved();
    await openSettings({ answers: [update] });

    pick(
      t('notifications.alertThreshold'),
      t('notifications.thresholdNDaysBeforePlural', { n: 7 }),
    );
    await act(() => log.landed(UpdateNotificationPreferencesDocument));

    expect(update.fired).toEqual([
      { input: { expiration: { expirationDaysThreshold: 7 } } },
    ]);
  });
});

describe('quiet hours', () => {
  // A window from 00:00 to 23:59 holds every minute, whatever the clock says.
  it('say so while they are on and the window holds now', async () => {
    await openSettings({
      preferences: {
        quietHoursEnabled: true,
        quietHoursStart: '00:00',
        quietHoursEnd: '23:59',
      },
    });

    expect(screen.getByText(t('notifications.quietHoursActive'))).toBeTruthy();
  });

  it('show neither the banner nor the window while off', async () => {
    await openSettings({
      preferences: {
        quietHoursEnabled: false,
        quietHoursStart: '00:00',
        quietHoursEnd: '23:59',
      },
    });

    expect(screen.queryByText(t('notifications.quietHoursActive'))).toBeNull();
    expect(
      screen.queryByText(t('notifications.quietHoursSubtitle')),
    ).toBeNull();
  });
});

describe('resetting to the defaults', () => {
  const reset = async () => {
    fireEvent(
      screen.getByRole('switch', { name: t('settings.resetToDefaults') }),
      'valueChange',
      true,
    );
    await answerAlert(t('settings.resetSection'));
    await act(() => log.landed(UpdateNotificationPreferencesDocument));
  };

  it('says it is done once the server takes it', async () => {
    await openSettings({ answers: [saved()] });

    await reset();

    expect(toastService.success).toHaveBeenCalledWith(
      t('notifications.resetSuccess'),
    );
  });

  it('says so when the server refuses it', async () => {
    await openSettings({ answers: [refused()] });

    await reset();

    expect(alertService.alert).toHaveBeenLastCalledWith(
      t('labels.error'),
      t('errors.resetSettingsFailed'),
    );
  });
});
