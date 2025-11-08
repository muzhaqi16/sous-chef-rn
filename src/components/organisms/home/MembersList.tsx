import React from 'react';
import { View, Text } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useStore } from '#store';
import { HomeInviteFragment } from '#generated';
import {
  formatRole,
  formatInviteStatus,
  getInviteStatusColor,
  getMemberDisplayName,
  getInviteDisplayName,
} from '#utils/formatters';

interface Member {
  id: string;
  role: string;
  status: string;
  userId?: string;
  displayName?: string;
  user?: {
    id: string;
    email?: string;
    profile?: {
      firstName?: string;
      lastName?: string;
      displayName?: string;
    };
  };
}

interface MembersListProps {
  members: Member[];
  invites?: HomeInviteFragment[];
}

export const MembersList: React.FC<MembersListProps> = ({
  members,
  invites = [],
}) => {
  const currentUser = useStore(state => state.user);
  const { theme } = useUnistyles();

  // Filter out accepted invites since they are now members
  const pendingInvites = invites.filter(invite => invite.status !== 'ACCEPTED');

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
              <Text style={styles.memberRole}>{formatRole(member.role)}</Text>
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
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    marginTop: 12,
  },
  membersSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  membersList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  memberChip: {
    backgroundColor: theme.colors.primary + '20',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    minWidth: 60,
    alignItems: 'center',
  },
  memberChipText: {
    fontSize: 13,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  memberRole: {
    fontSize: 10,
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
    fontWeight: '700',
  },
  inviteChip: {
    backgroundColor: theme.colors.transparent,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    minWidth: 60,
    alignItems: 'center',
  },
  inviteChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  inviteStatus: {
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center',
    fontWeight: '500',
  },
}));
