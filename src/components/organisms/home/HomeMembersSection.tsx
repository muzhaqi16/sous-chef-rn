import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { HomeMemberCard } from './HomeMemberCard';
import { HomeInviteCard } from './HomeInviteCard';
import { Text } from '#components/atoms/Text';
import { InviteStatus } from '#/graphql/generated/schemaTypes';
import type { MembershipPermissionKey } from '#hooks/home/useHomeDetailManagement';
import type { HomeDetailScreen_HomeFragment } from '#/screens/home/HomeDetailScreen.generated';

type MemberNode =
  HomeDetailScreen_HomeFragment['membersConnection']['edges'][number]['node'];
type InviteNode =
  HomeDetailScreen_HomeFragment['invitesConnection']['edges'][number]['node'];

interface HomeMembersSectionProps {
  members: ReadonlyArray<MemberNode>;
  invites: ReadonlyArray<InviteNode>;
  canManageHome?: boolean;
  /** Current user is the home OWNER — gates the transfer-ownership action. */
  isOwner?: boolean;
  /** Resolve a member's label (display name + isCurrentUser flag). The screen
   *  owns the user-store dependency so this component stays presentational. */
  resolveMemberLabel: (member: MemberNode) => {
    isCurrentUser: boolean;
    displayName: string;
  };
  resolveInviteLabel: (invite: InviteNode) => string;
  onChangeRole: (membershipId: string, role: string, name: string) => void;
  onRemove: (membershipId: string, name: string) => void;
  onTransferOwnership: (memberUserId: string, name: string) => void;
  onUpdatePermission: (
    membershipId: string,
    permission: MembershipPermissionKey,
    value: boolean,
  ) => void;
  onRevokeInvite: (inviteId: string, email: string) => void;
}

/**
 * HomeMembersSection - Members + pending invites for HomeDetailScreen.
 *
 * Each row passes its node down as a fragment ref; the row component runs its
 * own `useFragment` so cells refresh independently when their entity changes.
 */
export const HomeMembersSection: React.FC<HomeMembersSectionProps> = ({
  members,
  invites,
  canManageHome,
  isOwner,
  resolveMemberLabel,
  resolveInviteLabel,
  onChangeRole,
  onRemove,
  onTransferOwnership,
  onUpdatePermission,
  onRevokeInvite,
}) => {
  const pendingInvites = invites.filter(
    inv => inv.status !== InviteStatus.Accepted,
  );

  return (
    <View>
      {/* Active Members */}
      {members.length > 0 ? (
        members.map(member => {
          const { isCurrentUser, displayName } = resolveMemberLabel(member);

          return (
            <HomeMemberCard
              key={member.id}
              memberRef={member}
              displayName={displayName}
              isCurrentUser={isCurrentUser}
              canManageHome={canManageHome}
              isOwner={isOwner}
              onChangeRole={() =>
                onChangeRole(member.id, member.role, displayName)
              }
              onRemove={() => onRemove(member.id, displayName)}
              onTransferOwnership={() =>
                onTransferOwnership(member.userId, displayName)
              }
              onUpdatePermission={(permission, value) =>
                onUpdatePermission(member.id, permission, value)
              }
            />
          );
        })
      ) : (
        <View style={styles.emptyContainer}>
          <Icon name="people-outline" size={24} tone="textSecondary" />
          <Text size="sm" tone="secondary" style={styles.emptyText}>
            No members
          </Text>
        </View>
      )}

      {/* Pending Invites */}
      {pendingInvites.length > 0 && (
        <View style={styles.invitesSection}>
          <Text
            size="sm"
            weight="semibold"
            tone="secondary"
            style={styles.invitesSectionTitle}
          >
            Pending Invitations
          </Text>
          {pendingInvites.map(invite => (
            <HomeInviteCard
              key={invite.id}
              inviteRef={invite}
              displayName={resolveInviteLabel(invite)}
              canRevoke={canManageHome}
              onRevoke={() => onRevokeInvite(invite.id, invite.email)}
            />
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  emptyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  emptyText: {},
  invitesSection: {
    marginTop: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  invitesSectionTitle: {
    marginBottom: theme.spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
}));
