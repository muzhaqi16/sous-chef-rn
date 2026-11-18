import React from 'react';
import { screen, userEvent } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import {
  recordMock,
  renderWithApollo,
  seedQuery,
  type MockDataFor,
} from '#/test-utils/apolloMockProvider';
import { operationLog } from '#/test-utils/operationLog';
import {
  makeQueuedMutation,
  queuedMutationFor,
} from '#/test-utils/queuedMutation';
import { useStore } from '#store';
import { t } from '#/i18n';
import { Environment } from '#/utils/environment';
import { authService } from '#/services/authService';
import { queueStore } from '#/apollo/offlineQueue/queueStore';
import { QueueStatus } from '#/apollo/offlineQueue/types';
import { storage } from '#/store/deviceStorage';
import { GetUserProfileDocument } from '#operations/auth/user.generated';
import { UpdatePantryItemDocument } from '#features/pantry/graphql/pantry.generated';
import { profileTestIDs } from '#features/profile/testIDs';
import { isRecord } from '#/utils/isRecord';
import { alertService } from '#/services/alertService';
import { biometricService } from '#/services/biometric/deviceCredential';
import { authoritativeBiometryName } from '#components/organisms/biometric/biometryLabel';
import { SettingsSection } from '#components/organisms/SettingsSection';
import { BiometricSetupModal } from '#features/profile/components/BiometricSetupModal';
import { GetCurrenciesDocument } from '#features/profile/graphql/currency.generated';
import { UpdateUserPreferencesDocument } from '#operations/auth/user.generated';
import { inputOf } from '#/test-utils/apolloMockProvider';
import { act } from '@testing-library/react-native';
import { ProfileScreen } from '../ProfileScreen';

jest.mock('#hooks/navigation/useAppNavigation');

const mockNav = jest
  .requireMock('#hooks/navigation/useAppNavigation')
  .useAppNavigation();

const ME = 'user-1';

let log = operationLog();

type Profile = NonNullable<
  NonNullable<MockDataFor<typeof GetUserProfileDocument>['me']>['profile']
>;

const profileOf = (overrides: Partial<Profile> = {}): Profile => ({
  __typename: 'UserProfile',
  id: 'profile-1',
  firstName: 'Ana',
  lastName: 'Lima',
  displayName: null,
  bio: null,
  avatar: null,
  phone: null,
  dateOfBirth: null,
  gender: null,
  ...overrides,
});

const answer = (
  profile: Profile,
): MockDataFor<typeof GetUserProfileDocument> => ({
  me: { __typename: 'User', id: ME, profile },
});

async function openProfile({
  profile = profileOf(),
  /** The profile the device already holds, read again while the screen opens. */
  held = false,
  answers = [],
  currenciesFail = false,
}: {
  profile?: Profile;
  held?: boolean;
  answers?: ReturnType<typeof recordMock>[];
  currenciesFail?: boolean;
} = {}) {
  const cache = makeCache();
  if (held) {
    seedQuery(cache, { query: GetUserProfileDocument, data: answer(profile) });
  }
  renderWithApollo(<ProfileScreen />, {
    cache,
    links: [log.link],
    operationMocks: [
      ...answers.map(each => each.mock),
      recordMock(GetUserProfileDocument, {
        held,
        data: answer(profile),
      }).mock,
      currenciesFail
        ? recordMock(GetCurrenciesDocument, {
            error: new Error('Network request failed'),
          }).mock
        : recordMock(GetCurrenciesDocument, {
            data: {
              currencies: [
                {
                  __typename: 'Currency',
                  id: 'cur-usd',
                  code: 'USD',
                  name: 'US Dollar',
                  symbol: '$',
                  decimalPlaces: 2,
                },
                {
                  __typename: 'Currency',
                  id: 'cur-eur',
                  code: 'EUR',
                  name: 'Euro',
                  symbol: '€',
                  decimalPlaces: 2,
                },
              ],
            },
          }).mock,
    ],
  });
  if (!held) await log.landed(GetUserProfileDocument);
  // The device's biometrics answer a few promise turns after mount.
  await act(async () => undefined);
}

/** A settings row as its section is handed it, by its key. */
const row = (key: string) => {
  const items: unknown[] = screen
    .UNSAFE_getAllByType(SettingsSection)
    .flatMap(section => section.props.items);
  const found = items.find(item => isRecord(item) && item.key === key);
  if (!isRecord(found)) throw new Error(`no row ${key}`);
  return found;
};

const call = async (key: string, handler: string, ...args: unknown[]) => {
  const fn = row(key)[handler];
  if (typeof fn !== 'function') throw new Error(`row ${key} has no ${handler}`);
  await act(async () => {
    fn(...args);
  });
};

/** The device's biometrics, as the credential service reports them. */
const device = ({
  available = true,
  stored = false,
  forgets = true,
}: { available?: boolean; stored?: boolean; forgets?: boolean } = {}) => {
  jest.spyOn(biometricService, 'getBiometricInfo').mockResolvedValue({
    isAvailable: available,
    biometryType: 'FaceID',
  });
  jest
    .spyOn(biometricService, 'checkStoredCredentials')
    .mockResolvedValue(stored);
  return jest
    .spyOn(biometricService, 'forgetStoredSignIn')
    .mockResolvedValue(forgets);
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

const FACE_ID = authoritativeBiometryName('FaceID') ?? '';

const signOut = () => jest.spyOn(authService, 'logout').mockResolvedValue();

beforeEach(() => {
  jest.clearAllMocks();
  log = operationLog();
  storage.clearAll();
  queueStore.invalidateCache();
  queueStore.setCurrentUserId(ME);
  jest.mocked(Environment.shouldEnableDebugFeatures).mockReturnValue(false);
  device();
  useStore.setState({
    user: {
      id: ME,
      email: 'cook@example.com',
      emailVerified: true,
      onBoarded: true,
      canAccessDevTools: false,
    },
    isOnline: true,
    apiReachable: true,
  });
});

describe('the profile screen', () => {
  it('names the person by their full name and shows their email', async () => {
    await openProfile();

    expect(screen.getByText('Ana Lima')).toBeTruthy();
    expect(screen.getByText('cook@example.com')).toBeTruthy();
  });

  it('names the person by their display name when they have one', async () => {
    await openProfile({ profile: profileOf({ displayName: 'Annie' }) });

    expect(screen.getByText('Annie')).toBeTruthy();
  });

  it('shows the profile it holds while reading it again', async () => {
    await openProfile({ held: true });

    expect(screen.getByText('Ana Lima')).toBeTruthy();
  });

  it('opens the photo upload from the avatar', async () => {
    await openProfile();

    await userEvent.setup().press(screen.getByLabelText(t('a11y.changePhoto')));

    expect(mockNav.toProfilePhotoUpload).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['personalInformation', 'toPersonalInformation'],
    ['dietaryProfile', 'toDietaryProfile'],
  ])('opens %s from its row', async (key, opened) => {
    await openProfile();

    await userEvent
      .setup()
      .press(screen.getByTestId(profileTestIDs.menuItem(key)));

    expect(mockNav[opened]).toHaveBeenCalledTimes(1);
  });

  it('saves a language picked', async () => {
    await openProfile();

    await call('language', 'onSave', 'es');

    expect(row('language').value).toBe('es');
  });

  it('saves a currency picked', async () => {
    const saved = recordMock(UpdateUserPreferencesDocument, { held: true });
    await openProfile({ answers: [saved] });

    await log.landed(GetCurrenciesDocument);
    await call('currency', 'onSave', 'EUR');
    // It asks first: prices already held keep their own currency.
    await answerAlert(t('labels.confirm'));
    await log.requested(UpdateUserPreferencesDocument);

    expect(inputOf(saved.fired[0] ?? {})).toMatchObject({
      regional: { preferredCurrency: 'EUR' },
    });
  });

  it('says when the currencies cannot be read', async () => {
    await openProfile({ currenciesFail: true });
    await log.landed(GetCurrenciesDocument);
    await act(async () => undefined);

    expect(row('currency').unavailable).toBeTruthy();
  });
});

describe('its banners', () => {
  it('ask an unverified address to be verified, and open that', async () => {
    useStore.setState(state => ({
      user: state.user ? { ...state.user, emailVerified: false } : null,
    }));
    await openProfile();

    await userEvent
      .setup()
      .press(screen.getByTestId(profileTestIDs.verifyEmailBanner));

    expect(mockNav.toVerifyEmail).toHaveBeenCalledTimes(1);
  });

  it('show none for a verified address with every change saved', async () => {
    await openProfile();

    expect(
      screen.queryByTestId(profileTestIDs.verifyEmailBanner),
    ).not.toBeOnTheScreen();
    expect(
      screen.queryByTestId(profileTestIDs.changesNotSavedBanner),
    ).not.toBeOnTheScreen();
  });

  it('point at changes not saved, and open them', async () => {
    queueStore.addMutation(
      makeQueuedMutation({
        id: 'change',
        ...queuedMutationFor(UpdatePantryItemDocument),
        status: QueueStatus.REFUSED,
        refusedResource: 'PantryItem',
      }),
    );
    await openProfile();

    await userEvent
      .setup()
      .press(screen.getByTestId(profileTestIDs.changesNotSavedBanner));

    expect(mockNav.toChangesNotSaved).toHaveBeenCalledTimes(1);
  });
});

describe('the developer section', () => {
  const developer = () => screen.queryByText(t('profile.sections.developer'));

  it('is hidden from a release build without dev access', async () => {
    await openProfile();

    expect(developer()).not.toBeOnTheScreen();
    // The other sections stay.
    expect(
      screen.getByTestId(profileTestIDs.menuItem('dietaryProfile')),
    ).toBeTruthy();
  });

  it('shows in a build that enables debug features', async () => {
    jest.mocked(Environment.shouldEnableDebugFeatures).mockReturnValue(true);
    await openProfile();

    expect(developer()).toBeOnTheScreen();
  });

  it('shows for an account with dev-tool access', async () => {
    useStore.setState(state => ({
      user: state.user ? { ...state.user, canAccessDevTools: true } : null,
    }));
    await openProfile();

    expect(developer()).toBeOnTheScreen();
  });
});

describe('leaving', () => {
  it('signs out from the last row, keeping the biometric sign-in', async () => {
    const logout = signOut();
    await openProfile();

    await userEvent.setup().press(screen.getByTestId(profileTestIDs.logoutRow));

    expect(logout).toHaveBeenCalledWith({ keepBiometricCredentials: true });
  });

  it('signs out, or opens account deletion, from the more menu', async () => {
    const logout = signOut();
    await openProfile();
    const user = userEvent.setup();

    await user.press(screen.getByTestId(profileTestIDs.moreButton));
    await user.press(screen.getByTestId(profileTestIDs.logoutButton));
    expect(logout).toHaveBeenCalledTimes(1);

    await user.press(screen.getByTestId(profileTestIDs.moreButton));
    await user.press(screen.getByText(t('account.deleteTitle')));
    expect(mockNav.toDeleteAccount).toHaveBeenCalledTimes(1);
  });
});

describe('biometric sign-in', () => {
  const setup = () => screen.UNSAFE_getByType(BiometricSetupModal);

  it('is offered by name once the device says it has it', async () => {
    await openProfile();

    expect(row('biometricAuthentication')).toMatchObject({
      value: false,
      disabled: false,
      subtitle: t('biometrics.useToLogin', { method: FACE_ID }),
    });
  });

  it('says the device has none, and does nothing on a tap', async () => {
    device({ available: false });
    await openProfile();

    expect(row('biometricAuthentication')).toMatchObject({
      disabled: true,
      subtitle: t('biometrics.notAvailable'),
    });
    await call('biometricAuthentication', 'onPress');
    expect(setup().props.visible).toBe(false);
  });

  it('is offered again to someone who once declined it', async () => {
    useStore.getState().setUserNavigationState(ME, {
      biometricDeclinedPermanently: true,
    });
    await openProfile();

    expect(row('biometricAuthentication').subtitle).toBe(
      t('biometrics.tapToEnable', { method: FACE_ID }),
    );
  });

  it('is set up on a tap, and on once done, no longer counted declined', async () => {
    useStore.getState().setUserNavigationState(ME, {
      biometricDeclinedPermanently: true,
    });
    await openProfile();

    await call('biometricAuthentication', 'onPress');
    expect(setup().props.visible).toBe(true);
    await act(async () => {
      await setup().props.onComplete(true);
    });

    expect(row('biometricAuthentication').value).toBe(true);
    expect(
      useStore.getState().getUserNavigationState(ME)
        ?.biometricDeclinedPermanently,
    ).toBe(false);
  });

  it('stays off when its setup is cancelled', async () => {
    await openProfile();
    await call('biometricAuthentication', 'onPress');

    await act(async () => {
      await setup().props.onComplete(false);
    });

    expect(row('biometricAuthentication').value).toBe(false);
  });

  it('is turned off once confirmed', async () => {
    const forget = device({ stored: true });
    await openProfile();
    expect(row('biometricAuthentication').value).toBe(true);

    await call('biometricAuthentication', 'onPress');
    await answerAlert(t('biometrics.disable'));

    expect(forget).toHaveBeenCalledWith('cook@example.com');
    expect(row('biometricAuthentication').value).toBe(false);
  });

  it('says so when it cannot be turned off', async () => {
    device({ stored: true, forgets: false });
    await openProfile();

    await call('biometricAuthentication', 'onPress');
    await answerAlert(t('biometrics.disable'));

    expect(alertService.alert).toHaveBeenLastCalledWith(
      t('labels.error'),
      t('biometrics.disableFailed'),
    );
    expect(row('biometricAuthentication').value).toBe(true);
  });
});

describe('signing out with changes waiting', () => {
  it('asks first, and signs out only once confirmed', async () => {
    const logout = signOut();
    queueStore.addMutation(
      makeQueuedMutation({
        id: 'waiting',
        ...queuedMutationFor(UpdatePantryItemDocument),
        status: QueueStatus.PENDING,
      }),
    );
    await openProfile();

    await userEvent.setup().press(screen.getByTestId(profileTestIDs.logoutRow));
    expect(logout).not.toHaveBeenCalled();
    await answerAlert(t('profile.labels.logout'));

    expect(logout).toHaveBeenCalledWith({ keepBiometricCredentials: true });
  });
});
