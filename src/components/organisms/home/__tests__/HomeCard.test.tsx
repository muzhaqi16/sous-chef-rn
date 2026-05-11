import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { HomeCard } from '../HomeCard';
import {
  MembershipRole,
  MembershipStatus,
} from '#/graphql/generated/schemaTypes';

jest.mock('#utils/iconUtils', () => ({
  Icon: 'Icon',
}));

jest.mock('#constants/animations', () => ({
  TIMING: { FAST: 200 },
}));

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
    }: any) => (
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
    MembersList: ({ members }: any) => (
      <View testID="members-list">
        {members.map((m: any) => (
          <Text key={m.id}>{m.displayName || m.id}</Text>
        ))}
      </View>
    ),
  };
});

describe('HomeCard', () => {
  const mockHome = {
    id: 'home-1',
    name: 'My Kitchen',
    members: [
      {
        id: 'm1',
        role: MembershipRole.Admin,
        status: MembershipStatus.Active,
        displayName: 'Alice',
      },
      {
        id: 'm2',
        role: MembershipRole.Member,
        status: MembershipStatus.Active,
        displayName: 'Bob',
      },
    ],
    pantries: [{ id: 'p1' }],
    invites: [],
  };

  const defaultProps = {
    home: mockHome,
    isDefault: false,
    onPress: jest.fn(),
    onSetDefault: jest.fn(),
    onInvite: jest.fn(),
    onDelete: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders home name', () => {
    render(<HomeCard {...defaultProps} />);
    expect(screen.getByText('My Kitchen')).toBeTruthy();
  });

  it('renders member and pantry counts', () => {
    render(<HomeCard {...defaultProps} />);
    expect(screen.getByText(/2 members/)).toBeTruthy();
    expect(screen.getByText(/1 pantry/)).toBeTruthy();
  });

  it('renders "Default" badge when isDefault is true', () => {
    render(<HomeCard {...defaultProps} isDefault={true} />);
    expect(screen.getByText('Default')).toBeTruthy();
  });

  it('does not render "Default" badge when isDefault is false', () => {
    render(<HomeCard {...defaultProps} isDefault={false} />);
    expect(screen.queryByText('Default')).toBeNull();
  });

  it('calls onDelete with home id and name', async () => {
    const user = userEvent.setup();
    render(<HomeCard {...defaultProps} />);
    await user.press(screen.getByTestId('delete-btn'));
    expect(defaultProps.onDelete).toHaveBeenCalledWith('home-1', 'My Kitchen');
  });

  it('calls onInvite with home id', async () => {
    const user = userEvent.setup();
    render(<HomeCard {...defaultProps} />);
    await user.press(screen.getByTestId('invite-btn'));
    expect(defaultProps.onInvite).toHaveBeenCalledWith('home-1');
  });

  it('renders members list', () => {
    render(<HomeCard {...defaultProps} />);
    expect(screen.getByTestId('members-list')).toBeTruthy();
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();
  });

  it('uses singular "member" for single member', () => {
    const singleMemberHome = {
      ...mockHome,
      members: [
        {
          id: 'm1',
          role: MembershipRole.Admin,
          status: MembershipStatus.Active,
          displayName: 'Alice',
        },
      ],
    };
    render(<HomeCard {...defaultProps} home={singleMemberHome} />);
    expect(screen.getByText(/1 member/)).toBeTruthy();
  });
});
