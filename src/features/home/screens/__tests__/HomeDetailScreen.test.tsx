import React from 'react';
import { Share } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { act, screen, userEvent } from '@testing-library/react-native';
import {
  inputOf,
  recordMock,
  renderWithApollo,
  type MockDataFor,
} from '#/test-utils/apolloMockProvider';
import { operationLog } from '#/test-utils/operationLog';
import { useStore } from '#store';
import { resetSessionScopedStores } from '#store/sessionScopedStores';
import { t } from '#/i18n';
import { alertService } from '#/services/alertService';
import {
  ErrorCode,
  ErrorDisposition,
  MembershipRole,
} from '#/graphql/generated/schemaTypes';
import {
  EnableHomeJoinLinkDocument,
  LeaveHomeDocument,
  TransferHomeOwnershipDocument,
  UpdateHomeDocument,
  UpdateHomeJoinCodeDocument,
  UpdateMembershipDocument,
} from '#operations/home/home.generated';
import { GetHomeDocument } from '#features/home/screens/useHomeDetailManagement.generated';
import { EditableField } from '#features/home/components/EditableField';
import { HomeMembersSection } from '#features/home/components/HomeMembersSection';
import { DetailTemplate } from '#components/templates/DetailTemplate';
import { SettingSwitch } from '#components/molecules/SettingSwitch';
import { homeTestIDs } from '#features/home/testIDs';
import { HomeDetailScreen } from '../HomeDetailScreen';

jest.mock('#hooks/navigation/useAppNavigation');

const mockNav = jest
  .requireMock('#hooks/navigation/useAppNavigation')
  .useAppNavigation();

let log = operationLog();

const HOME_ID = 'home-1';
const LINK = 'https://souschef.example/join/ABC123';

type HomeRead = NonNullable<MockDataFor<typeof GetHomeDocument>['home']>;
type MemberEdge = NonNullable<
  NonNullable<NonNullable<HomeRead['membersConnection']>['edges']>[number]
>;

const memberEdge = (
  id: string,
  userId: string,
  role: MembershipRole,
  displayName: string | null = null,
): MemberEdge => ({
  __typename: 'MembershipEdge',
  // Stated: completion would hand every member, the viewer among them, the flag.
  node: {
    __typename: 'Membership',
    id,
    userId,
    role,
    displayName,
    canManageHome: role !== MembershipRole.Member,
  },
});

/** The home as read, the person its owner unless `role` says otherwise. */
const homeOf = ({
  role = MembershipRole.Owner,
  members = 2,
  allowJoinCode = true,
}: {
  role?: MembershipRole;
  members?: 1 | 2;
  allowJoinCode?: boolean;
} = {}): HomeRead => ({
  __typename: 'Home',
  id: HOME_ID,
  name: 'Kitchen',
  allowJoinCode,
  joinCode: 'ABC123',
  joinLink: { universal: LINK },
  myMembership: {
    __typename: 'Membership',
    id: 'member-me',
    role,
    canManageHome: role !== MembershipRole.Member,
  },
  membersConnection: {
    __typename: 'MembershipConnection',
    totalCount: members,
    edges: [
      memberEdge('member-me', 'user-1', role),
      ...(members > 1
        ? [memberEdge('member-2', 'user-2', MembershipRole.Admin, 'Sam')]
        : []),
    ],
  },
  invitesConnection: {
    __typename: 'HomeInviteConnection',
    totalCount: 0,
    edges: [],
  },
});

async function openHome({
  home = homeOf(),
  readFails = false,
  readAgainFails = false,
  answers = [],
}: {
  home?: HomeRead | null;
  readFails?: boolean;
  readAgainFails?: boolean;
  answers?: ReturnType<typeof recordMock>[];
} = {}) {
  const read = recordMock(GetHomeDocument, {
    data: { home },
    ...(readAgainFails ? { maxUsageCount: 1 } : {}),
  });
  renderWithApollo(
    <HomeDetailScreen route={{ params: { homeId: HOME_ID } }} />,
    {
      links: [log.link],
      operationMocks: [
        ...answers.map(answer => answer.mock),
        ...(readFails
          ? [
              recordMock(GetHomeDocument, {
                error: new Error('Network request failed'),
                maxUsageCount: 1,
              }).mock,
            ]
          : []),
        read.mock,
        ...(readAgainFails
          ? [
              recordMock(GetHomeDocument, {
                error: new Error('Network request failed'),
              }).mock,
            ]
          : []),
      ],
    },
  );
  await log.landed(GetHomeDocument);
}

/** Presses a button of the last alert raised. */
async function answerAlert(text: string) {
  const [, , buttons] = jest.mocked(alertService.alert).mock.lastCall ?? [];
  const onPress = buttons?.find(button => button.text === text)?.onPress;
  if (!onPress) throw new Error(`no "${text}" in the last alert`);
  await act(async () => {
    onPress();
  });
}

/** Runs a handler the screen hands a child, as the child would. */
const handOn = (run: () => unknown) => {
  act(() => {
    void run();
  });
};

const joinSwitch = () => {
  const found = screen
    .UNSAFE_getAllByType(SettingSwitch)
    .find(each => each.props.title === t('homeDetail.labelAllowJoinCode'));
  if (!found) throw new Error('no join switch');
  return found;
};

const unverified = () => {
  useStore.setState({
    user: {
      id: 'user-1',
      email: 'cook@example.com',
      emailVerified: false,
      onBoarded: true,
    },
  });
};

const leaving = (answer: MockDataFor<typeof LeaveHomeDocument>['leaveHome']) =>
  recordMock(LeaveHomeDocument, { data: { leaveHome: answer } });

beforeEach(() => {
  jest.clearAllMocks();
  log = operationLog();
  resetSessionScopedStores();
  useStore.setState({
    user: {
      id: 'user-1',
      email: 'cook@example.com',
      emailVerified: true,
      onBoarded: true,
    },
    isOnline: true,
    apiReachable: true,
  });
});

describe('a home', () => {
  it('says it could not be read, and is read again', async () => {
    await openHome({ readFails: true });

    await userEvent.setup().press(screen.getByText(t('labels.tryAgain')));
    await log.landed(GetHomeDocument, 2);

    expect(screen.UNSAFE_getByType(EditableField).props.value).toBe('Kitchen');
  });

  it('says so when there is no such home', async () => {
    await openHome({ home: null });

    expect(screen.getByText(t('errors.codes.homeNotFound'))).toBeTruthy();
  });

  it('stays on screen when it cannot be read again', async () => {
    await openHome({ readAgainFails: true });

    act(() => {
      screen.UNSAFE_getByType(DetailTemplate).props.onRefresh();
    });
    await log.landed(GetHomeDocument, 2);

    expect(screen.UNSAFE_getByType(EditableField).props.value).toBe('Kitchen');
  });

  it('is read again on a pull', async () => {
    await openHome();

    act(() => {
      screen.UNSAFE_getByType(DetailTemplate).props.onRefresh();
    });

    await log.requested(GetHomeDocument, 2);
  });

  it('checks a new name as the API does', async () => {
    await openHome();
    const { validation } = screen.UNSAFE_getByType(EditableField).props;

    expect(validation('  ')).toBeTruthy();
    expect(validation('Cabin')).toBeNull();
  });

  it('names the viewer You', async () => {
    await openHome();

    expect(screen.getByText(t('homeDetail.youLabel'))).toBeTruthy();
  });

  it('opens its storage and its usual stores', async () => {
    await openHome();
    const user = userEvent.setup();

    await user.press(screen.getByText(t('labels.storageLocations')));
    await user.press(screen.getByTestId(homeTestIDs.usualStoresRow));

    expect(mockNav.toStorageLocations).toHaveBeenCalledWith({
      homeId: HOME_ID,
    });
    expect(mockNav.toUsualStores).toHaveBeenCalledWith({ homeId: HOME_ID });
  });

  it('offers its dietary needs once someone else lives there', async () => {
    await openHome();

    await userEvent
      .setup()
      .press(screen.getByTestId(homeTestIDs.dietaryNeedsRow));

    expect(mockNav.toHomeDietaryNeeds).toHaveBeenCalledWith({
      homeId: HOME_ID,
    });
  });

  it('offers no dietary needs to a home of one', async () => {
    await openHome({ home: homeOf({ members: 1 }) });

    expect(
      screen.queryByTestId(homeTestIDs.dietaryNeedsRow),
    ).not.toBeOnTheScreen();
  });
});

describe('its name', () => {
  it('is saved cleaned', async () => {
    const update = recordMock(UpdateHomeDocument, { held: true });
    await openHome({ answers: [update] });

    handOn(() =>
      screen.UNSAFE_getByType(EditableField).props.onSave('  Cabin  '),
    );
    await log.requested(UpdateHomeDocument);

    expect(inputOf(update.fired[0] ?? {})).toMatchObject({
      id: HOME_ID,
      name: 'Cabin',
    });
  });

  it('is not saved blank', async () => {
    const update = recordMock(UpdateHomeDocument, { held: true });
    await openHome({ answers: [update] });

    await act(async () => {
      await screen.UNSAFE_getByType(EditableField).props.onSave('   ');
    });

    expect(update.fired).toEqual([]);
  });
});

describe('a housemate', () => {
  it('takes the role picked', async () => {
    const update = recordMock(UpdateMembershipDocument, { held: true });
    await openHome({ answers: [update] });

    handOn(() =>
      screen
        .UNSAFE_getByType(HomeMembersSection)
        .props.onChangeRole('member-2', MembershipRole.Guest),
    );
    await log.requested(UpdateMembershipDocument);

    expect(inputOf(update.fired[0] ?? {})).toMatchObject({
      id: 'member-2',
      role: MembershipRole.Guest,
    });
  });

  it('takes a permission as switched', async () => {
    const update = recordMock(UpdateMembershipDocument, { held: true });
    await openHome({ answers: [update] });

    handOn(() =>
      screen
        .UNSAFE_getByType(HomeMembersSection)
        .props.onUpdatePermission('member-2', 'canAddItems', false),
    );
    await log.requested(UpdateMembershipDocument);

    expect(inputOf(update.fired[0] ?? {})).toMatchObject({
      id: 'member-2',
      canAddItems: false,
    });
  });
});

describe('joining by link', () => {
  it('is opened by minting a link', async () => {
    const enable = recordMock(EnableHomeJoinLinkDocument, { held: true });
    await openHome({
      home: homeOf({ allowJoinCode: false }),
      answers: [enable],
    });

    handOn(() => joinSwitch().props.onValueChange(true));
    await log.requested(EnableHomeJoinLinkDocument);

    expect(inputOf(enable.fired[0] ?? {})).toEqual({ id: HOME_ID });
  });

  it('asks for a verified email before opening', async () => {
    unverified();
    const enable = recordMock(EnableHomeJoinLinkDocument, { held: true });
    await openHome({
      home: homeOf({ allowJoinCode: false }),
      answers: [enable],
    });

    handOn(() => joinSwitch().props.onValueChange(true));

    expect(alertService.alert).toHaveBeenCalledWith(
      t('auth.verifyToCollaborateTitle'),
      t('auth.verifyToCollaborateMessage'),
      expect.any(Array),
    );
    expect(enable.fired).toEqual([]);
  });

  it('closes with no verified email', async () => {
    unverified();
    const update = recordMock(UpdateHomeDocument, { held: true });
    await openHome({ answers: [update] });

    handOn(() => joinSwitch().props.onValueChange(false));
    await log.requested(UpdateHomeDocument);

    expect(inputOf(update.fired[0] ?? {})).toMatchObject({
      id: HOME_ID,
      allowJoinCode: false,
    });
  });
});

describe('its join code', () => {
  it('is copied', async () => {
    await openHome();

    await userEvent
      .setup()
      .press(screen.getByLabelText(t('homeDetail.labelJoinCode')));

    expect(Clipboard.setString).toHaveBeenCalledWith('ABC123');
  });

  it("is shared as the server's link", async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({
      action: Share.sharedAction,
    });
    await openHome();

    await userEvent.setup().press(screen.getByLabelText(t('labels.shareLink')));

    expect(share).toHaveBeenCalledWith(expect.objectContaining({ url: LINK }));
  });

  it('is replaced once confirmed', async () => {
    const rotate = recordMock(UpdateHomeJoinCodeDocument, { held: true });
    await openHome({ answers: [rotate] });

    await userEvent
      .setup()
      .press(screen.getByLabelText(t('homeDetail.rotateJoinCodeConfirm')));
    await answerAlert(t('homeDetail.rotateJoinCodeConfirm'));
    await log.requested(UpdateHomeJoinCodeDocument);

    expect(inputOf(rotate.fired[0] ?? {})).toEqual({ id: HOME_ID });
  });

  it('is not shown while joining is off', async () => {
    await openHome({ home: homeOf({ allowJoinCode: false }) });

    expect(screen.queryByText('ABC123')).not.toBeOnTheScreen();
  });
});

describe('a member who cannot manage it', () => {
  it('sees its name, but no rename, join switch or code', async () => {
    await openHome({ home: homeOf({ role: MembershipRole.Member }) });

    expect(screen.UNSAFE_getByType(EditableField).props.readOnly).toBe(true);
    expect(
      screen.queryByText(t('homeDetail.labelAllowJoinCode')),
    ).not.toBeOnTheScreen();
    expect(screen.queryByText('ABC123')).not.toBeOnTheScreen();
  });
});

describe('ownership', () => {
  it('is handed over once confirmed', async () => {
    const transfer = recordMock(TransferHomeOwnershipDocument, { held: true });
    await openHome({ answers: [transfer] });

    act(() => {
      screen
        .UNSAFE_getByType(HomeMembersSection)
        .props.onTransferOwnership('user-2', 'Sam');
    });
    expect(alertService.alert).toHaveBeenLastCalledWith(
      t('homeDetail.transferOwnershipTitle'),
      t('homeDetail.transferOwnershipMessage', { name: 'Sam' }),
      expect.any(Array),
    );
    await answerAlert(t('homeDetail.transferOwnershipConfirm'));
    await log.requested(TransferHomeOwnershipDocument);

    expect(inputOf(transfer.fired[0] ?? {})).toEqual({
      homeId: HOME_ID,
      newOwnerId: 'user-2',
    });
  });
});

describe('leaving', () => {
  it('is not offered to the owner', async () => {
    await openHome();

    expect(screen.queryByText(t('labels.leaveHome'))).not.toBeOnTheScreen();
  });

  it('closes the home once it stands', async () => {
    await openHome({
      home: homeOf({ role: MembershipRole.Member }),
      answers: [
        leaving({
          __typename: 'LeaveHomePayload',
          converged: false,
          membership: { __typename: 'Membership', id: 'member-me' },
        }),
      ],
    });

    await userEvent.setup().press(screen.getByText(t('labels.leaveHome')));
    await answerAlert(t('labels.leave'));
    await log.landed(LeaveHomeDocument);
    await act(async () => undefined);

    expect(mockNav.goBack).toHaveBeenCalledTimes(1);
  });

  it('stays when it is refused', async () => {
    await openHome({
      home: homeOf({ role: MembershipRole.Member }),
      answers: [
        leaving({
          __typename: 'ForbiddenError',
          code: ErrorCode.Forbidden,
          disposition: ErrorDisposition.Fail,
          message: 'No',
        }),
      ],
    });

    await userEvent.setup().press(screen.getByText(t('labels.leaveHome')));
    await answerAlert(t('labels.leave'));
    await log.landed(LeaveHomeDocument);
    await act(async () => undefined);

    expect(mockNav.goBack).not.toHaveBeenCalled();
  });
});
