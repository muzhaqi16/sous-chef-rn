import React from 'react';
import {
  act,
  fireEvent,
  screen,
  userEvent,
} from '@testing-library/react-native';
import {
  inputOf,
  recordMock,
  renderWithApollo,
  type MockDataFor,
} from '#/test-utils/apolloMockProvider';
import { operationLog } from '#/test-utils/operationLog';
import { useStore } from '#store';
import { t } from '#/i18n';
import { alertService } from '#/services/alertService';
import { toastService } from '#/services/toastService';
import { AppTheme, UnitSystem } from '#/graphql/generated/schemaTypes';
import {
  GetUserSettingsDocument,
  UpdateUserPreferencesDocument,
} from '#operations/auth/user.generated';
import { useReceiptPhotoConsentStore } from '#features/receipts/store/receiptPhotoConsentStore';
import { profileTestIDs } from '#features/profile/testIDs';
import { AppSettingsScreen } from '../AppSettingsScreen';

jest.mock('#hooks/navigation/useAppNavigation');

const ME = 'user-1';

let log = operationLog();

type Settings = NonNullable<
  NonNullable<MockDataFor<typeof GetUserSettingsDocument>['me']>['settings']
>;

const SETTINGS: Settings = {
  __typename: 'UserSettings',
  id: 'settings-1',
  theme: AppTheme.System,
  compactMode: false,
  showTutorials: false,
  shareUsageData: true,
  shareWithPartners: false,
  personalizedAds: false,
  preferredUnitSystem: UnitSystem.Imperial,
  deviceUnitSystem: UnitSystem.Imperial,
  language: 'en',
  timezone: 'UTC',
  preferredCurrency: 'USD',
  storeMode: false,
  budgetAndPrices: true,
};

async function openSettings({
  readFails = false,
  answers = [],
}: { readFails?: boolean; answers?: ReturnType<typeof recordMock>[] } = {}) {
  renderWithApollo(<AppSettingsScreen />, {
    links: [log.link],
    operationMocks: [
      ...answers.map(each => each.mock),
      ...(readFails
        ? [
            recordMock(GetUserSettingsDocument, {
              error: new Error('Network request failed'),
              maxUsageCount: 1,
            }).mock,
          ]
        : []),
      recordMock(GetUserSettingsDocument, {
        data: { me: { __typename: 'User', id: ME, settings: SETTINGS } },
      }).mock,
    ],
  });
  await log.landed(GetUserSettingsDocument);
}

const saved = () => recordMock(UpdateUserPreferencesDocument, { held: true });

const flip = (testID: string, value: boolean) => {
  fireEvent(screen.getByTestId(testID), 'valueChange', value);
};

/** Presses a button of the last alert raised. */
async function answerAlert(text: string) {
  const [, , buttons] = jest.mocked(alertService.alert).mock.lastCall ?? [];
  const onPress = buttons?.find(button => button.text === text)?.onPress;
  if (!onPress) throw new Error(`no "${text}" in the last alert`);
  await act(async () => {
    onPress();
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  log = operationLog();
  useReceiptPhotoConsentStore.setState({ consent: null });
  useStore.setState({
    user: {
      id: ME,
      email: 'cook@example.com',
      emailVerified: true,
      onBoarded: true,
    },
    hapticFeedbackEnabled: true,
    showNavigationLabels: true,
    userConsent: null,
    isOnline: true,
    apiReachable: true,
  });
});

describe('app settings', () => {
  it('offers to read them again when they could not be read', async () => {
    await openSettings({ readFails: true });

    expect(screen.getByTestId(profileTestIDs.settingsState)).toBeTruthy();
    await userEvent.setup().press(screen.getByText(t('labels.tryAgain')));
    await log.landed(GetUserSettingsDocument, 2);

    expect(
      screen.getByTestId(profileTestIDs.settingsUnitSystemPicker),
    ).toBeTruthy();
  });

  it('names the unit system chosen, and saves another picked', async () => {
    const update = saved();
    await openSettings({ answers: [update] });
    const picker = screen.getByTestId(profileTestIDs.settingsUnitSystemPicker);
    expect(picker.props.accessibilityValue).toEqual({
      text: t('settings.unitImperial'),
    });
    const user = userEvent.setup();

    await user.press(picker);
    await user.press(screen.getByText(t('settings.unitMetric')));
    await log.requested(UpdateUserPreferencesDocument);

    expect(inputOf(update.fired[0] ?? {})).toMatchObject({
      regional: { preferredUnitSystem: UnitSystem.Metric },
    });
  });

  it.each([
    [
      profileTestIDs.settingsShowTutorialsSwitch,
      { ui: { showTutorials: true } },
    ],
    [profileTestIDs.settingsStoreModeSwitch, { shopping: { storeMode: true } }],
  ])('saves the switch %s', async (testID, sent) => {
    const update = saved();
    await openSettings({ answers: [update] });

    flip(testID, true);
    await log.requested(UpdateUserPreferencesDocument);

    expect(inputOf(update.fired[0] ?? {})).toMatchObject(sent);
  });

  it('keeps the device switches on the device', async () => {
    await openSettings();

    flip(profileTestIDs.settingsHapticFeedbackSwitch, false);
    flip(profileTestIDs.settingsNavigationLabelsSwitch, false);
    flip(profileTestIDs.settingsShowShoppingListImagesSwitch, false);
    flip(profileTestIDs.settingsShareUsageDataSwitch, false);
    flip(profileTestIDs.settingsReceiptPhotosSwitch, false);

    const state = useStore.getState();
    expect(state.hapticFeedbackEnabled).toBe(false);
    expect(state.showNavigationLabels).toBe(false);
    expect(state.userConsent).toBe(false);
    expect(useReceiptPhotoConsentStore.getState().consent).toBe('declined');
    expect(
      screen.getByTestId(profileTestIDs.settingsShowShoppingListImagesSwitch)
        .props.value,
    ).toBe(false);
  });

  it('reads usage sharing as on before it is chosen', async () => {
    await openSettings();

    expect(
      screen.getByTestId(profileTestIDs.settingsShareUsageDataSwitch).props
        .value,
    ).toBe(true);
  });

  it('replays the tips, turning them on, and says so', async () => {
    const update = saved();
    await openSettings({ answers: [update] });

    await userEvent
      .setup()
      .press(screen.getByTestId(profileTestIDs.settingsReplayTips));
    await log.requested(UpdateUserPreferencesDocument);

    expect(inputOf(update.fired[0] ?? {})).toMatchObject({
      ui: { showTutorials: true },
    });
    expect(toastService.success).toHaveBeenCalledWith(
      t('settings.replayTipsDone'),
    );
  });

  it('resets to defaults once confirmed, and says so', async () => {
    const update = recordMock(UpdateUserPreferencesDocument, {
      data: {
        updateSettings: {
          __typename: 'UpdateSettingsPayload',
          userSettings: SETTINGS,
        },
      },
    });
    await openSettings({ answers: [update] });

    // The reset is the last switch, and has no id of its own.
    const reset = screen.getAllByRole('switch').at(-1);
    if (!reset) throw new Error('no reset switch');
    fireEvent(reset, 'valueChange', true);
    await answerAlert(t('settings.resetSection'));
    await log.landed(UpdateUserPreferencesDocument);
    await act(async () => undefined);

    expect(update.fired).toHaveLength(1);
    expect(toastService.success).toHaveBeenCalledWith(
      t('settings.resetSuccess'),
    );
  });
});
