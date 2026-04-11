import React from 'react';
import { View, Text } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useAppStore } from '#store/useAppStore';
import { formatRole } from '#/utils/formatters/roleFormatters';
import {
  formatInviteStatus,
  getInviteStatusColor,
  getInviteDisplayName,
} from '#/utils/formatters/inviteFormatters';
import {
  getMemberDisplayName,
  type Member,
} from '#/utils/formatters/memberFormatters';

interface ListInvite {
  id: string;
  email: string | null;
  recipientName: string | null;
  status: string;
}

interface MembersListProps {
  members: Member[];
  invites?: ListInvite[];
}

export const MembersList: React.FC<MembersListProps> = ({
  members,
  invites = [],
}) => {
  const currentUser = useAppStore(state => state.user);
  const { theme } = useUnistyles();

  // API now only returns pending invites, so no client-side filtering needed
  const pendingInvites = invites;

  if (
    (!members || members.length === 0) &&
    (!pendingInvites || pendingInvites.length === 0)
  )
    return null;

  return (
    <View style={styles.membersSection}>
      <Text style={styles.membersSectionTitle}>Members</Text>
      <View style={styles.membersList}>
        {members.map(member => {
          const displayName = getMemberDisplayName(member, currentUser?.id);
          const isCurrentUser = member.user?.id === currentUser?.id;

          return (
            <View
              key={member.id}
              style={[
                styles.memberChip,
                isCurrentUser && styles.currentUserChip,
              ]}
            >
              <Text
                style={[
                  styles.memberChipText,
                  isCurrentUser && styles.currentUserText,
                ]}
              >
                {displayName}
              </Text>
              <Text
                style={[
                  styles.memberRole,
                  isCurrentUser && styles.currentUserRole,
                ]}
              >
                {formatRole(member.role)}
              </Text>
            </View>
          );
        })}

        {pendingInvites.map(invite => {
          const displayName = getInviteDisplayName(invite);
          const statusColor = getInviteStatusColor(invite.status, theme);

          return (
            <View
              key={invite.id}
              style={[styles.inviteChip, { borderColor: statusColor }]}
            >
              <Text style={[styles.inviteChipText, { color: statusColor }]}>
                {displayName}
              </Text>
              <Text style={[styles.inviteStatus, { color: statusColor }]}>
                {formatInviteStatus(invite.status)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  membersSection: {
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    marginTop: theme.spacing['3'],
  },
  membersSectionTitle: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  membersList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  memberChip: {
    backgroundColor: theme.colors.primary + '20',
    paddingHorizontal: theme.spacing['3'],
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.xl,
    minWidth: theme.spacing['3xl'] - 4,
    alignItems: 'center',
  },
  memberChipText: {
    fontSize: theme.typography.fontSize.sm - 1,
    color: theme.colors.primary,
    fontWeight: theme.fonts.weight.semibold,
  },
  memberRole: {
    fontSize: theme.typography.fontSize.xs - 2,
    color: theme.colors.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  currentUserChip: {
    backgroundColor: theme.colors.primary,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  currentUserText: {
    color: theme.colors.white,
    fontWeight: theme.fonts.weight.bold,
  },
  currentUserRole: {
    color: theme.colors.white,
  },
  inviteChip: {
    backgroundColor: theme.colors.transparent,
    paddingHorizontal: theme.spacing['3'],
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.xl,
    borderWidth: 1,
    borderStyle: 'dashed',
    minWidth: theme.spacing['3xl'] - 4,
    alignItems: 'center',
  },
  inviteChipText: {
    fontSize: theme.typography.fontSize.sm - 1,
    fontWeight: theme.fonts.weight.semibold,
  },
  inviteStatus: {
    fontSize: theme.typography.fontSize.xs - 2,
    marginTop: 2,
    textAlign: 'center',
    fontWeight: theme.fonts.weight.medium,
  },
}));
