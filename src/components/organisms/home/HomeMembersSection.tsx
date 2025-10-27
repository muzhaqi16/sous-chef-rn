import React from 'react';
import { View, Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils';
import { getMemberDisplayName, getInviteDisplayName, type Member } from '#utils/formatters';
import { HomeMemberCard } from './HomeMemberCard';
import { HomeInviteCard } from './HomeInviteCard';

interface Invite {
  id: string;
  email: string;
  recipientName?: string | null;
  status: string;
}

interface HomeMembersSectionProps {
  members: Member[];
  invites: Invite[];
  currentUserId?: string;
  currentUserMembership?: Member | null;
  onChangeRole: (membershipId: string, role: string, name: string) => void;
  onRemove: (membershipId: string, name: string) => void;
  onRevokeInvite: (inviteId: string, email: string) => void;
}

/**
 * HomeMembersSection - Complete section for members and invites management
 */
export const HomeMembersSection: React.FC<HomeMembersSectionProps> = ({
  members,
  invites,
  currentUserId,
  currentUserMembership,
  onChangeRole,
  onRemove,
  onRevokeInvite,
}) => {
  // Filter pending invites
  const pendingInvites = invites.filter(inv => inv.status !== 'ACCEPTED');

  return (
    <View>
      {/* Active Members */}
      {members && members.length > 0 ? (
        members.map(member => {
          const isCurrentUser = member.user?.id === currentUserId;
          const displayName = getMemberDisplayName(member, currentUserId);

          return (
            <HomeMemberCard
              key={member.id}
              member={member}
              displayName={displayName}
              isCurrentUser={isCurrentUser}
              currentUserMembership={currentUserMembership}
              onChangeRole={() =>
                onChangeRole(member.id, member.role, displayName)
              }
              onRemove={() => onRemove(member.id, displayName)}
            />
          );
        })
      ) : (
        <View style={styles.emptyContainer}>
          <Icon name="people-outline" size={48} color="#ccc" />
          <Text style={styles.emptyText}>No members</Text>
        </View>
      )}

      {/* Pending Invites */}
      {pendingInvites && pendingInvites.length > 0 && (
        <View style={styles.invitesSection}>
          <Text style={styles.invitesSectionTitle}>Pending Invitations</Text>
          {pendingInvites.map(invite => {
            const displayName = getInviteDisplayName(invite);

            return (
              <HomeInviteCard
                key={invite.id}
                invite={invite}
                displayName={displayName}
                onRevoke={() => onRevokeInvite(invite.id, invite.email)}
              />
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xl * 2,
  },
  emptyText: {
    fontSize: theme.fonts.size.md,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.md,
  },
  invitesSection: {
    marginTop: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  invitesSectionTitle: {
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
}));
