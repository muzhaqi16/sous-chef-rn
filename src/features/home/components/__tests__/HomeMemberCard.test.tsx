import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import {
  renderWithApollo,
  toFragmentRef,
} from '#/test-utils/apolloMockProvider';
import { HomeMemberCard } from '../HomeMemberCard';
import {
  HomeMemberCard_MemberFragmentDoc,
  type HomeMemberCard_MemberFragment,
} from '../HomeMemberCard.generated';
import {
  MembershipRole,
  MembershipStatus,
} from '#/graphql/generated/schemaTypes';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

const member: HomeMemberCard_MemberFragment = {
  __typename: 'Membership',
  id: 'm-2',
  homeId: 'home-1',
  userId: 'user-2',
  role: MembershipRole.Member,
  status: MembershipStatus.Active,
  canManageHome: false,
  canViewPantry: true,
  canEditPantry: false,
  canAddItems: true,
  canRemoveItems: false,
  canInviteOthers: false,
  user: {
    __typename: 'User',
    id: 'user-2',
    email: 'jane@test.com',
    displayName: 'Jane',
  },
};

function renderCard(transferDisabled: boolean, onTransfer: () => void) {
  const cache = makeCache();
  cache.writeFragment({
    id: cache.identify({ __typename: 'Membership', id: member.id }),
    fragment: HomeMemberCard_MemberFragmentDoc,
    fragmentName: 'HomeMemberCard_member',
    data: member,
  });
  return renderWithApollo(
    <HomeMemberCard
      memberRef={toFragmentRef<typeof HomeMemberCard_MemberFragmentDoc>(member)}
      displayName="Jane"
      isCurrentUser={false}
      canManageHome
      isOwner
      onChangeRole={jest.fn()}
      onRemove={jest.fn()}
      onTransferOwnership={onTransfer}
      transferDisabled={transferDisabled}
    />,
    { cache },
  );
}

describe('HomeMemberCard', () => {
  it('offers "Make Owner" to the owner when no transfer is running', () => {
    const onTransfer = jest.fn();
    renderCard(false, onTransfer);

    const makeOwner = screen.getByRole('button', { name: /Make Owner/ });
    expect(makeOwner).toBeEnabled();
    fireEvent.press(makeOwner);
    expect(onTransfer).toHaveBeenCalledTimes(1);
  });

  it('disables "Make Owner" while another transfer is in flight', () => {
    const onTransfer = jest.fn();
    renderCard(true, onTransfer);

    const makeOwner = screen.getByRole('button', { name: /Make Owner/ });
    expect(makeOwner).toBeDisabled();
    fireEvent.press(makeOwner);
    expect(onTransfer).not.toHaveBeenCalled();
  });
});
