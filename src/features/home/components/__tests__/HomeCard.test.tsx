import React from 'react';
import { makeCache } from '#/apollo/cache';
import { screen, userEvent } from '@testing-library/react-native';
import {
  renderWithApollo,
  toFragmentRef,
} from '#/test-utils/apolloMockProvider';
import { HomeCard } from '../HomeCard';
import {
  HomeCard_HomeFragmentDoc,
  type HomeCard_HomeFragment,
} from '../HomeCard.generated';
import { MembershipRole } from '#/graphql/generated/schemaTypes';

jest.mock('#utils/iconUtils', () => ({
  Icon: 'Icon',
}));

jest.mock('#constants/animations', () => ({}));

jest.mock('../HomeActions', () => {
  const { View, Text, Pressable } = require('react-native');
  return {
    HomeActions: ({
      onSetDefault,
      onInvite,
      onDelete,
      homeId,
      isDefault,
      canInvite,
      canDelete,
    }: React.ComponentProps<typeof import('../HomeActions').HomeActions>) => (
      <View testID="home-actions">
        {!isDefault && (
          <Pressable
            onPress={() => onSetDefault(homeId)}
            testID="set-default-btn"
          >
            <Text>Set Default</Text>
          </Pressable>
        )}
        {canInvite !== false && (
          <Pressable onPress={() => onInvite(homeId)} testID="invite-btn">
            <Text>Invite</Text>
          </Pressable>
        )}
        {canDelete !== false && (
          <Pressable onPress={() => onDelete(homeId)} testID="delete-btn">
            <Text>Delete</Text>
          </Pressable>
        )}
      </View>
    ),
  };
});

jest.mock('../MembersList', () => {
  const { View, Text } = require('react-native');
  return {
    MembersList: ({
      members,
    }: React.ComponentProps<typeof import('../MembersList').MembersList>) => (
      <View testID="members-list">
        {members.map(m => (
          <Text key={m.id}>{m.displayName || m.id}</Text>
        ))}
      </View>
    ),
  };
});

function buildHome(
  overrides: { name?: string; memberCount?: number; pantryCount?: number } = {},
): HomeCard_HomeFragment {
  const members: HomeCard_HomeFragment['membersConnection']['edges'] = [
    {
      __typename: 'MembershipEdge',
      node: {
        __typename: 'Membership',
        id: 'm1',
        role: MembershipRole.Admin,
        userId: 'u1',
        displayName: 'Alice',
        user: {
          __typename: 'User',
          id: 'u1',
          email: 'alice@example.com',
        },
      },
    },
    {
      __typename: 'MembershipEdge',
      node: {
        __typename: 'Membership',
        id: 'm2',
        role: MembershipRole.Member,
        userId: 'u2',
        displayName: 'Bob',
        user: {
          __typename: 'User',
          id: 'u2',
          email: 'bob@example.com',
        },
      },
    },
  ];

  return {
    __typename: 'Home',
    id: 'home-1',
    name: overrides.name ?? 'My Kitchen',
    membersConnection: {
      __typename: 'MembershipConnection',
      totalCount: overrides.memberCount ?? 2,
      edges: members.slice(0, overrides.memberCount ?? members.length),
    },
    invitesConnection: {
      __typename: 'HomeInviteConnection',
      totalCount: 0,
      edges: [],
    },
    pantriesConnection: {
      __typename: 'PantryConnection',
      totalCount: overrides.pantryCount ?? 1,
    },
  };
}

function buildCache(home: HomeCard_HomeFragment) {
  const cache = makeCache();
  cache.writeFragment({
    id:
      cache.identify({ __typename: home.__typename, id: home.id }) ??
      `Home:${home.id}`,
    fragment: HomeCard_HomeFragmentDoc,
    fragmentName: 'HomeCard_home',
    data: home,
  });
  return cache;
}

function renderCard(props: Partial<React.ComponentProps<typeof HomeCard>>) {
  const home = buildHome();
  return renderWithApollo(
    <HomeCard
      homeRef={toFragmentRef<typeof HomeCard_HomeFragmentDoc>(home)}
      isDefault={false}
      onPress={props.onPress ?? jest.fn()}
      onSetDefault={props.onSetDefault ?? jest.fn()}
      onInvite={props.onInvite ?? jest.fn()}
      onDelete={props.onDelete ?? jest.fn()}
      {...props}
    />,
    { cache: buildCache(home) },
  );
}

describe('HomeCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders home name', () => {
    renderCard({});
    expect(screen.getByText('My Kitchen')).toBeTruthy();
  });

  it('renders member and pantry counts', () => {
    renderCard({});
    expect(screen.getByText(/2 members/)).toBeTruthy();
    expect(screen.getByText(/1 pantry/)).toBeTruthy();
  });

  it('renders "Default" badge when isDefault is true', () => {
    renderCard({ isDefault: true });
    expect(screen.getByText('Default')).toBeTruthy();
  });

  it('does not render "Default" badge when isDefault is false', () => {
    renderCard({ isDefault: false });
    expect(screen.queryByText('Default')).toBeNull();
  });

  it('calls onDelete with home id and name', async () => {
    const onDelete = jest.fn();
    const user = userEvent.setup();
    renderCard({ onDelete });
    await user.press(screen.getByTestId('delete-btn'));
    expect(onDelete).toHaveBeenCalledWith('home-1', 'My Kitchen');
  });

  it('calls onInvite with home id', async () => {
    const onInvite = jest.fn();
    const user = userEvent.setup();
    renderCard({ onInvite });
    await user.press(screen.getByTestId('invite-btn'));
    expect(onInvite).toHaveBeenCalledWith('home-1');
  });

  it('renders members list', () => {
    renderCard({});
    expect(screen.getByTestId('members-list')).toBeTruthy();
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();
  });

  it('uses singular "member" for single member', () => {
    const home = buildHome({ memberCount: 1 });
    renderWithApollo(
      <HomeCard
        homeRef={toFragmentRef<typeof HomeCard_HomeFragmentDoc>(home)}
        isDefault={false}
        onPress={jest.fn()}
        onSetDefault={jest.fn()}
        onInvite={jest.fn()}
        onDelete={jest.fn()}
      />,
      { cache: buildCache(home) },
    );
    expect(screen.getByText(/1 member/)).toBeTruthy();
  });
});
