'use no memo';
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { HomeInviteCard } from '../HomeInviteCard';
import { InviteStatus } from '#/graphql/generated/schemaTypes';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');
jest.mock('#utils/iconUtils', () => ({
  Icon: ({ name }: any) => {
    const { Text } = require('react-native');
    return <Text>{name}</Text>;
  },
}));
jest.mock('#/utils/formatters/inviteFormatters', () => ({
  formatInviteStatus: (status: string) => status.toLowerCase(),
  getInviteStatusColor: () => '#FF0000',
}));

describe('HomeInviteCard', () => {
  const invite = {
    id: '1',
    email: 'user@test.com',
    recipientName: 'Test User',
    status: InviteStatus.Pending,
  };
  const onRevoke = jest.fn();

  it('renders invite display name and email', () => {
    render(
      <HomeInviteCard
        invite={invite}
        displayName="Test User"
        onRevoke={onRevoke}
      />,
    );
    expect(screen.getByText('Test User')).toBeTruthy();
    expect(screen.getByText('user@test.com')).toBeTruthy();
  });

  it('shows revoke button for pending invites when canRevoke is true', () => {
    render(
      <HomeInviteCard
        invite={invite}
        displayName="Test User"
        canRevoke
        onRevoke={onRevoke}
      />,
    );
    // close icon is the revoke button
    expect(screen.getByText('close')).toBeTruthy();
  });

  it('hides revoke button for pending invites when canRevoke is false', () => {
    render(
      <HomeInviteCard
        invite={invite}
        displayName="Test User"
        canRevoke={false}
        onRevoke={onRevoke}
      />,
    );
    expect(screen.queryByText('close')).toBeNull();
  });

  it('hides revoke button for non-pending invites', () => {
    const acceptedInvite = { ...invite, status: InviteStatus.Accepted };
    render(
      <HomeInviteCard
        invite={acceptedInvite}
        displayName="Test User"
        canRevoke
        onRevoke={onRevoke}
      />,
    );
    expect(screen.queryByText('close')).toBeNull();
  });
});
