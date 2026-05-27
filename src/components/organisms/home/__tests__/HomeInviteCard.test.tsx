'use no memo';
import React from 'react';
import { InMemoryCache } from '@apollo/client';
import { screen } from '@testing-library/react-native';
import {
  renderWithApollo,
  toFragmentRef,
} from '#/test-utils/apolloMockProvider';
import { HomeInviteCard } from '../HomeInviteCard';
import {
  HomeInviteCard_InviteFragmentDoc,
  type HomeInviteCard_InviteFragment,
} from '../HomeInviteCard.generated';
import { InviteStatus, MembershipRole } from '#/graphql/generated/schemaTypes';

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

function buildInvite(
  overrides: Partial<{ id: string; status: InviteStatus }> = {},
): HomeInviteCard_InviteFragment {
  return {
    __typename: 'HomeInvite',
    id: '1',
    email: 'user@test.com',
    recipientName: 'Test User',
    role: MembershipRole.Member,
    status: InviteStatus.Pending,
    expiresAt: '2099-01-01T00:00:00.000Z',
    message: null,
    ...overrides,
  };
}

/**
 * Build a cache pre-seeded with the invite via its colocated fragment doc.
 * The card's `useFragment` then reads back complete data and renders.
 */
function buildCache(invite: HomeInviteCard_InviteFragment) {
  const cache = new InMemoryCache();
  cache.writeFragment({
    id:
      cache.identify({ __typename: invite.__typename, id: invite.id }) ??
      `HomeInvite:${invite.id}`,
    fragment: HomeInviteCard_InviteFragmentDoc,
    fragmentName: 'HomeInviteCard_invite',
    data: invite,
  });
  return cache;
}

describe('HomeInviteCard', () => {
  const onRevoke = jest.fn();

  it('renders invite display name and email', () => {
    const invite = buildInvite();
    renderWithApollo(
      <HomeInviteCard
        inviteRef={toFragmentRef<typeof HomeInviteCard_InviteFragmentDoc>(
          invite,
        )}
        displayName="Test User"
        onRevoke={onRevoke}
      />,
      { cache: buildCache(invite) },
    );
    expect(screen.getByText('Test User')).toBeTruthy();
    expect(screen.getByText('user@test.com')).toBeTruthy();
  });

  it('shows revoke button for pending invites when canRevoke is true', () => {
    const invite = buildInvite();
    renderWithApollo(
      <HomeInviteCard
        inviteRef={toFragmentRef<typeof HomeInviteCard_InviteFragmentDoc>(
          invite,
        )}
        displayName="Test User"
        canRevoke
        onRevoke={onRevoke}
      />,
      { cache: buildCache(invite) },
    );
    expect(screen.getByText('close')).toBeTruthy();
  });

  it('hides revoke button for pending invites when canRevoke is false', () => {
    const invite = buildInvite();
    renderWithApollo(
      <HomeInviteCard
        inviteRef={toFragmentRef<typeof HomeInviteCard_InviteFragmentDoc>(
          invite,
        )}
        displayName="Test User"
        canRevoke={false}
        onRevoke={onRevoke}
      />,
      { cache: buildCache(invite) },
    );
    expect(screen.queryByText('close')).toBeNull();
  });

  it('hides revoke button for non-pending invites', () => {
    const accepted = buildInvite({ status: InviteStatus.Accepted });
    renderWithApollo(
      <HomeInviteCard
        inviteRef={toFragmentRef<typeof HomeInviteCard_InviteFragmentDoc>(
          accepted,
        )}
        displayName="Test User"
        canRevoke
        onRevoke={onRevoke}
      />,
      { cache: buildCache(accepted) },
    );
    expect(screen.queryByText('close')).toBeNull();
  });
});
