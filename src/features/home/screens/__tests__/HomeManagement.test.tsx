import React from 'react';
import {
  act,
  fireEvent,
  screen,
  userEvent,
  within,
} from '@testing-library/react-native';
import {
  inputOf,
  recordMock,
  renderWithApollo,
  type MockDataFor,
} from '#/test-utils/apolloMockProvider';
import { operationLog } from '#/test-utils/operationLog';
import { homesData } from '#/test-utils/fixtures/homeFixtures';
import { useStore } from '#store';
import { resetSessionScopedStores } from '#store/sessionScopedStores';
import { t } from '#/i18n';
import { alertService } from '#/services/alertService';
import {
  ErrorCode,
  ErrorDisposition,
  MembershipRole,
  ShareLinkTargetType,
} from '#/graphql/generated/schemaTypes';
import {
  CreateHomeDocument,
  GetHomesDocument,
  InviteToHomeDocument,
  JoinHomeByCodeDocument,
  ResolveShareLinkDocument,
} from '#operations/home/home.generated';
import { MarkHomeAsDefaultDocument } from '#operations/home/userSettings.generated';
import { CreatePantryDocument } from '#features/pantry/graphql/pantry.generated';
import { SubScreen } from '#components/templates/SubScreen';
import { HomeCard } from '#features/home/components/HomeCard';
import { CreateHomeForm } from '#features/home/components/CreateHomeForm';
import { InviteUserModal } from '#features/home/components/InviteUserModal';
import { homeTestIDs } from '#features/home/testIDs';
import { HomeManagement } from '../HomeManagement';

jest.mock('#hooks/navigation/useAppNavigation');

const mockNav = jest
  .requireMock('#hooks/navigation/useAppNavigation')
  .useAppNavigation();

let log = operationLog();

interface Held {
  id: string;
  name: string;
  isDefault?: boolean;
  role?: MembershipRole;
  canInviteOthers?: boolean;
}

const KITCHEN: Held = { id: 'home-1', name: 'Kitchen', isDefault: true };
const CABIN: Held = { id: 'home-2', name: 'Cabin' };

/** The homes read, the person holding the role stated in each (owner by default). */
const homesRead = (homes: Held[]): MockDataFor<typeof GetHomesDocument> => {
  const data = homesData(homes);
  return {
    ...data,
    homes: {
      ...data.homes,
      edges: data.homes.edges.map(edge => {
        const held = homes.find(home => home.id === edge.node.id);
        return {
          ...edge,
          node: {
            ...edge.node,
            myMembership: {
              ...edge.node.myMembership,
              role: held?.role ?? MembershipRole.Owner,
              canInviteOthers: held?.canInviteOthers ?? true,
            },
          },
        };
      }),
    },
  };
};

async function openHomes({
  homes = [KITCHEN, CABIN],
  readFails = false,
  answers = [],
}: {
  homes?: Held[];
  readFails?: boolean;
  answers?: ReturnType<typeof recordMock>[];
} = {}) {
  renderWithApollo(<HomeManagement />, {
    links: [log.link],
    operationMocks: [
      ...answers.map(answer => answer.mock),
      ...(readFails
        ? [
            recordMock(GetHomesDocument, {
              error: new Error('Network request failed'),
              maxUsageCount: 1,
            }).mock,
          ]
        : []),
      recordMock(GetHomesDocument, { data: homesRead(homes) }).mock,
    ],
  });
  await log.landed(GetHomesDocument);
}

const cardOf = (homeId: string) => {
  const card = screen
    .UNSAFE_getAllByType(HomeCard)
    .find(each => each.props.homeId === homeId);
  if (!card) throw new Error(`no card for ${homeId}`);
  return card;
};

const idOf = (vars: Record<string, unknown>) => {
  const { id } = inputOf(vars);
  if (typeof id !== 'string') throw new Error('sent with no id');
  return id;
};

const created = () =>
  recordMock(CreateHomeDocument, {
    dataFor: (vars): MockDataFor<typeof CreateHomeDocument> => ({
      createHome: {
        __typename: 'CreateHomePayload',
        home: { __typename: 'Home', id: idOf(vars), isDefault: false },
      },
    }),
  });

const pantryCreated = () =>
  recordMock(CreatePantryDocument, {
    dataFor: (vars): MockDataFor<typeof CreatePantryDocument> => ({
      createPantry: {
        __typename: 'CreatePantryPayload',
        pantry: { __typename: 'Pantry', id: idOf(vars) },
      },
    }),
  });

const openForm = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.press(screen.getByTestId(homeTestIDs.managementAddButton));
};

const joinMode = async (user: ReturnType<typeof userEvent.setup>) => {
  await openForm(user);
  await user.press(screen.getByText(t('homeManagement.modeJoin')));
  return screen.getByPlaceholderText(t('labels.enterJoinCode'));
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

const askedToVerify = () =>
  expect(alertService.alert).toHaveBeenCalledWith(
    t('auth.verifyToCollaborateTitle'),
    t('auth.verifyToCollaborateMessage'),
    expect.any(Array),
  );

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
    selectedHomeId: null,
    selectedPantryId: null,
    isOnline: true,
    apiReachable: true,
  });
});

describe('the homes', () => {
  it('say they could not be read, and are read again', async () => {
    await openHomes({ readFails: true });

    await userEvent.setup().press(screen.getByText(t('labels.tryAgain')));
    await log.landed(GetHomesDocument, 2);

    expect(screen.getByText('Kitchen')).toBeTruthy();
  });

  it('list the server default first, marked Default', async () => {
    await openHomes({
      homes: [
        { ...KITCHEN, isDefault: false },
        { ...CABIN, isDefault: true },
      ],
    });

    expect(
      screen.UNSAFE_getAllByType(HomeCard).map(card => card.props.homeId),
    ).toEqual([CABIN.id, KITCHEN.id]);
    expect(
      within(cardOf(CABIN.id)).getByText(t('homeManagement.cardDefault')),
    ).toBeTruthy();
    expect(
      within(cardOf(KITCHEN.id)).queryByText(t('homeManagement.cardDefault')),
    ).not.toBeOnTheScreen();
  });

  it('open a home pressed', async () => {
    await openHomes();

    await userEvent.setup().press(screen.getByText('Cabin'));

    expect(mockNav.toHomeDetail).toHaveBeenCalledWith({ homeId: CABIN.id });
  });

  it('offer delete to the owner alone, and invite to whoever may', async () => {
    await openHomes({
      homes: [
        KITCHEN,
        { ...CABIN, role: MembershipRole.Admin },
        {
          id: 'home-3',
          name: 'Loft',
          role: MembershipRole.Member,
          canInviteOthers: false,
        },
      ],
    });

    expect(
      within(cardOf(KITCHEN.id)).getByText(t('labels.delete')),
    ).toBeTruthy();
    expect(
      within(cardOf(CABIN.id)).queryByText(t('labels.delete')),
    ).not.toBeOnTheScreen();
    expect(
      within(cardOf(CABIN.id)).getByText(t('homeManagement.cardInvite')),
    ).toBeTruthy();
    expect(
      within(cardOf('home-3')).queryByText(t('homeManagement.cardInvite')),
    ).not.toBeOnTheScreen();
  });

  it('read again on a pull', async () => {
    await openHomes();

    act(() => {
      screen.UNSAFE_getByType(SubScreen).props.refresh.onRefresh();
    });

    await log.requested(GetHomesDocument, 2);
  });
});

describe('an invite', () => {
  it('goes out with the role picked', async () => {
    const invite = recordMock(InviteToHomeDocument, { held: true });
    await openHomes({ answers: [invite] });

    await userEvent
      .setup()
      .press(
        within(cardOf(CABIN.id)).getByText(t('homeManagement.cardInvite')),
      );
    const modal = screen.UNSAFE_getByType(InviteUserModal);
    expect(modal.props.visible).toBe(true);
    act(() => {
      void modal.props.onSubmit('sam@example.com', MembershipRole.Admin);
    });
    await log.requested(InviteToHomeDocument);

    expect(inputOf(invite.fired[0] ?? {})).toEqual({
      homeId: CABIN.id,
      email: 'sam@example.com',
      role: MembershipRole.Admin,
    });
  });

  it('asks for a verified email first', async () => {
    unverified();
    await openHomes();

    await userEvent
      .setup()
      .press(
        within(cardOf(CABIN.id)).getByText(t('homeManagement.cardInvite')),
      );

    askedToVerify();
    expect(screen.UNSAFE_getByType(InviteUserModal).props.visible).toBe(false);
  });
});

describe('a new home', () => {
  it('is created as named, and the form closes', async () => {
    const create = created();
    await openHomes({ answers: [create, pantryCreated()] });
    const user = userEvent.setup();

    await openForm(user);
    await user.type(
      screen.getByTestId(homeTestIDs.createHomeNameInput),
      'Loft',
    );
    await user.press(screen.getByTestId(homeTestIDs.createHomeSubmitButton));
    await log.landed(CreateHomeDocument);
    await log.landed(CreatePantryDocument);
    await act(async () => undefined);

    expect(inputOf(create.fired[0] ?? {})).toMatchObject({
      name: 'Loft',
      allowJoinCode: true,
    });
    expect(
      screen.queryByTestId(homeTestIDs.createHomeNameInput),
    ).not.toBeOnTheScreen();
  });

  it('keeps the form open when it is refused', async () => {
    await openHomes({
      answers: [
        recordMock(CreateHomeDocument, {
          data: {
            createHome: {
              __typename: 'ValidationError',
              code: ErrorCode.ValidationFailed,
              disposition: ErrorDisposition.Fail,
              message: 'No',
              field: 'input.name',
            },
          },
        }),
      ],
    });
    const user = userEvent.setup();

    await openForm(user);
    await user.type(
      screen.getByTestId(homeTestIDs.createHomeNameInput),
      'Loft',
    );
    await user.press(screen.getByTestId(homeTestIDs.createHomeSubmitButton));
    await log.landed(CreateHomeDocument);
    await act(async () => undefined);

    expect(alertService.alert).toHaveBeenCalled();
    expect(screen.getByTestId(homeTestIDs.createHomeNameInput)).toBeTruthy();
  });

  it('offers no join code to an unverified email', async () => {
    unverified();
    await openHomes();

    await openForm(userEvent.setup());

    expect(
      screen.UNSAFE_getByType(CreateHomeForm).props.joinCodeAvailable,
    ).toBe(false);
  });

  it('can be started when the homes could not be read', async () => {
    await openHomes({ readFails: true });

    await openForm(userEvent.setup());

    expect(screen.getByTestId(homeTestIDs.createHomeNameInput)).toBeTruthy();
  });

  it('starts again in create mode after a cancel', async () => {
    await openHomes();
    const user = userEvent.setup();

    await joinMode(user);
    await user.press(screen.getByText(t('labels.cancel')));
    await openForm(user);

    expect(screen.getByTestId(homeTestIDs.createHomeNameInput)).toBeTruthy();
  });
});

describe('joining by code', () => {
  it('previews a code once it is long enough, joins it, and closes the form', async () => {
    const preview = recordMock(ResolveShareLinkDocument, {
      data: {
        resolveShareLink: {
          targetType: ShareLinkTargetType.HomeJoin,
          homeId: 'home-9',
          name: 'Loft',
          memberCount: 3,
        },
      },
    });
    const join = recordMock(JoinHomeByCodeDocument, {
      data: {
        joinHomeByCode: {
          __typename: 'JoinHomeByCodePayload',
          membership: {
            __typename: 'Membership',
            id: 'member-9',
            homeId: 'home-9',
          },
        },
      },
    });
    await openHomes({ answers: [preview, join] });
    const user = userEvent.setup();
    const code = await joinMode(user);

    fireEvent.changeText(code, 'ABC');
    fireEvent(code, 'blur');
    expect(preview.fired).toEqual([]);
    fireEvent.changeText(code, 'ABCD');
    fireEvent(code, 'blur');
    await log.landed(ResolveShareLinkDocument);
    expect(screen.getByText('Loft')).toBeTruthy();

    await user.press(screen.getByText(t('homeManagement.join')));
    await log.landed(JoinHomeByCodeDocument);
    await act(async () => undefined);

    expect(inputOf(join.fired[0] ?? {})).toEqual({ joinCode: 'ABCD' });
    expect(
      screen.queryByPlaceholderText(t('labels.enterJoinCode')),
    ).not.toBeOnTheScreen();
  });

  it('asks for a verified email first', async () => {
    unverified();
    const join = recordMock(JoinHomeByCodeDocument, { held: true });
    await openHomes({ answers: [join] });
    const user = userEvent.setup();

    fireEvent.changeText(await joinMode(user), 'ABCD');
    await user.press(screen.getByText(t('homeManagement.join')));

    askedToVerify();
    expect(join.fired).toEqual([]);
  });
});

describe('making a home the default', () => {
  it('highlights it once the change stands', async () => {
    await openHomes({
      answers: [
        recordMock(MarkHomeAsDefaultDocument, {
          data: {
            markHomeAsDefault: { __typename: 'MarkHomeAsDefaultPayload' },
          },
        }),
      ],
    });

    await userEvent
      .setup()
      .press(within(cardOf(CABIN.id)).getByText(t('labels.setDefault')));
    await log.landed(MarkHomeAsDefaultDocument);
    await act(async () => undefined);

    expect(cardOf(CABIN.id).props.isHighlighted).toBe(true);
  });

  it('does not highlight one refused, and says so', async () => {
    await openHomes({
      answers: [
        recordMock(MarkHomeAsDefaultDocument, {
          data: {
            markHomeAsDefault: {
              __typename: 'NotFoundError',
              code: ErrorCode.NotFound,
              disposition: ErrorDisposition.Fail,
              message: 'Gone',
              resource: 'Home',
              resourceId: CABIN.id,
            },
          },
        }),
      ],
    });

    await userEvent
      .setup()
      .press(within(cardOf(CABIN.id)).getByText(t('labels.setDefault')));
    await log.landed(MarkHomeAsDefaultDocument);
    await act(async () => undefined);

    expect(alertService.alert).toHaveBeenCalled();
    expect(cardOf(CABIN.id).props.isHighlighted).toBe(false);
  });
});
