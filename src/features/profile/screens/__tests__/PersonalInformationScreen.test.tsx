import React from 'react';
import { act, screen, userEvent } from '@testing-library/react-native';
import {
  inputOf,
  recordMock,
  renderWithApollo,
  type MockDataFor,
} from '#/test-utils/apolloMockProvider';
import { operationLog } from '#/test-utils/operationLog';
import { isRecord } from '#/utils/isRecord';
import { useStore } from '#store';
import { t } from '#/i18n';
import { ProfileVisibility } from '#/graphql/generated/schemaTypes';
import {
  GetUserProfileDocument,
  UpdateUserProfileDocument,
} from '#operations/auth/user.generated';
import { SettingsSection } from '#components/organisms/SettingsSection';
import { SubScreen } from '#components/templates/SubScreen';
import { PersonalInformationScreen } from '../PersonalInformationScreen';

jest.mock('#hooks/navigation/useAppNavigation');

const ME = 'user-1';

let log = operationLog();

type Profile = NonNullable<
  NonNullable<MockDataFor<typeof GetUserProfileDocument>['me']>['profile']
>;

const PROFILE: Profile = {
  __typename: 'UserProfile',
  id: 'profile-1',
  firstName: 'Ana',
  lastName: 'Lima',
  displayName: null,
  bio: null,
  avatar: null,
  phone: null,
  dateOfBirth: '1990-04-02',
  gender: null,
  profileVisibility: null,
};

const answer = (
  profile: Profile,
): MockDataFor<typeof GetUserProfileDocument> => ({
  me: { __typename: 'User', id: ME, profile },
});

async function openInfo({
  readFails = false,
  answers = [],
}: { readFails?: boolean; answers?: ReturnType<typeof recordMock>[] } = {}) {
  renderWithApollo(<PersonalInformationScreen />, {
    links: [log.link],
    operationMocks: [
      ...answers.map(each => each.mock),
      ...(readFails
        ? [
            recordMock(GetUserProfileDocument, {
              error: new Error('Network request failed'),
              maxUsageCount: 1,
            }).mock,
          ]
        : []),
      recordMock(GetUserProfileDocument, { data: answer(PROFILE) }).mock,
    ],
  });
  await log.landed(GetUserProfileDocument);
}

/** A row the sections render, by its key, as the section is handed it. */
const row = (key: string) => {
  const items: unknown[] = screen
    .UNSAFE_getAllByType(SettingsSection)
    .flatMap(section => section.props.items);
  const found = items.find(item => isRecord(item) && item.key === key);
  if (!isRecord(found)) throw new Error(`no row ${key}`);
  return found;
};

/** Saves a value through a row's own editor, as its save would. */
const saveRow = async (key: string, value: string) => {
  const onSave = row(key).onSave;
  if (typeof onSave !== 'function') throw new Error(`row ${key} saves nothing`);
  await act(async () => {
    onSave(value);
  });
};

const updated = () => recordMock(UpdateUserProfileDocument, { held: true });

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
    apiReachable: true,
  });
});

describe('personal information', () => {
  it('shows the email and the names held, and a private profile when unset', async () => {
    await openInfo();

    expect(row('email').value).toBe('cook@example.com');
    expect(row('firstName').value).toBe('Ana');
    expect(row('profileVisibility').value).toBe(ProfileVisibility.Private);
  });

  it.each([
    ['firstName', 'Annie', { firstName: 'Annie' }],
    ['lastName', 'Silva', { lastName: 'Silva' }],
    ['displayName', 'Chef A', { displayName: 'Chef A' }],
    ['bio', 'Cooks on Sundays', { bio: 'Cooks on Sundays' }],
    ['phone', '555 0100', { phone: '555 0100' }],
    ['gender', 'female', { gender: 'female' }],
    ['dateOfBirth', '', { dateOfBirth: null }],
    [
      'profileVisibility',
      ProfileVisibility.Friends,
      { profileVisibility: ProfileVisibility.Friends },
    ],
  ])('saves %s as edited', async (key, value, sent) => {
    const update = updated();
    await openInfo({ answers: [update] });

    await saveRow(key, value);
    await log.requested(UpdateUserProfileDocument);

    expect(inputOf(update.fired[0] ?? {})).toMatchObject(sent);
  });

  it('sends no visibility it does not know', async () => {
    const update = updated();
    await openInfo({ answers: [update] });

    await saveRow('profileVisibility', 'EVERYONE');

    expect(update.fired).toEqual([]);
  });

  it('offers to read it again when it could not be read', async () => {
    await openInfo({ readFails: true });

    await userEvent.setup().press(screen.getByText(t('labels.tryAgain')));
    await log.landed(GetUserProfileDocument, 2);

    expect(row('firstName').value).toBe('Ana');
  });

  it('reads it again on a pull', async () => {
    await openInfo();

    act(() => {
      screen.UNSAFE_getByType(SubScreen).props.refresh.onRefresh();
    });

    await log.requested(GetUserProfileDocument, 2);
  });
});
