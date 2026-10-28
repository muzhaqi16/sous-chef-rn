import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import { t } from '#/i18n';
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
import type { HomeViewer } from '#features/home/utils/homePermissions';

const member: HomeMemberCard_MemberFragment = {
  __typename: 'Membership',
  id: 'm-2',
  version: 1,
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

const viewerAs = (
  role: MembershipRole,
  flags: Partial<HomeViewer> = {},
): HomeViewer => ({
  role,
  canManageHome: false,
  canViewPantry: true,
  canEditPantry: false,
  canAddItems: true,
  canRemoveItems: false,
  canInviteOthers: false,
  ...flags,
});

function renderCard(
  transferDisabled: boolean,
  onTransfer: () => void,
  viewer: HomeViewer = viewerAs(MembershipRole.Owner),
  memberRole: MembershipRole = member.role,
) {
  const cache = makeCache();
  cache.writeFragment({
    id: cache.identify({ __typename: 'Membership', id: member.id }),
    fragment: HomeMemberCard_MemberFragmentDoc,
    fragmentName: 'HomeMemberCard_member',
    data: { ...member, role: memberRole },
  });
  return renderWithApollo(
    <HomeMemberCard
      memberRef={toFragmentRef<typeof HomeMemberCard_MemberFragmentDoc>(member)}
      displayName="Jane"
      isCurrentUser={false}
      viewer={viewer}
      onUpdatePermission={jest.fn()}
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

  // The API's roster ceiling: below OWNER a manager reaches only roles under
  // their own, and switches on only flags they hold.
  it('lets an admin manage a member', () => {
    renderCard(false, jest.fn(), viewerAs(MembershipRole.Admin));

    expect(screen.getByText(t('homeDetail.changeRole'))).toBeOnTheScreen();
    expect(screen.queryByText(t('homeDetail.makeOwner'))).toBeNull();
  });

  it('does not let an admin manage another admin', () => {
    renderCard(
      false,
      jest.fn(),
      viewerAs(MembershipRole.Admin),
      MembershipRole.Admin,
    );

    expect(screen.queryByText(t('homeDetail.changeRole'))).toBeNull();
  });

  it('does not let a member holding canManageHome manage a peer', () => {
    renderCard(
      false,
      jest.fn(),
      viewerAs(MembershipRole.Member, { canManageHome: true }),
    );

    expect(screen.queryByText(t('homeDetail.changeRole'))).toBeNull();
  });

  it("disables switching on a flag the admin doesn't hold", () => {
    renderCard(false, jest.fn(), viewerAs(MembershipRole.Admin));
    fireEvent.press(screen.getByText(t('homeDetail.permissions')));

    expect(
      screen.getByRole('switch', { name: t('homeDetail.permEditPantry') }),
    ).toBeDisabled();
    expect(
      screen.getByRole('switch', { name: t('labels.canAddItems') }),
    ).toBeEnabled();
  });
});
