import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native-unistyles';
import { useUser } from '#store/useAppStore';
import { formatRole } from '#/utils/formatters/roleFormatters';
import {
  formatInviteStatus,
  getInviteDisplayName,
} from '#/utils/formatters/inviteFormatters';
import {
  getMemberDisplayName,
  type Member,
} from '#/utils/formatters/memberFormatters';
import { Text } from '#components/atoms/Text';

interface ListInvite {
  id: string;
  email: string | null;
  recipientName: string | null;
  status: string;
}

type StatusKey = 'pending' | 'accepted' | 'declined' | 'expired';

function getStatusKey(status: string): StatusKey {
  switch (status) {
    case 'PENDING':
      return 'pending';
    case 'ACCEPTED':
      return 'accepted';
    case 'DECLINED':
      return 'declined';
    case 'EXPIRED':
    case 'REVOKED':
    default:
      return 'expired';
  }
}

const InviteChip: React.FC<{ invite: ListInvite }> = ({ invite }) => {
  const statusKey = getStatusKey(invite.status);
  const displayName = getInviteDisplayName(invite);
  styles.useVariants({ status: statusKey });
  return (
    <View style={styles.inviteChip}>
      <Text style={styles.inviteChipText}>{displayName}</Text>
      <Text style={styles.inviteStatus}>
        {formatInviteStatus(invite.status)}
      </Text>
    </View>
  );
};

const MemberChip: React.FC<{
  displayName: string;
  role: string;
  isCurrentUser: boolean;
}> = ({ displayName, role, isCurrentUser }) => {
  styles.useVariants({ currentUser: isCurrentUser });
  return (
    <View style={styles.memberChip}>
      <Text style={styles.memberChipText}>{displayName}</Text>
      <Text style={styles.memberRole}>{formatRole(role)}</Text>
    </View>
  );
};

interface MembersListProps {
  members: Member[];
  invites?: ListInvite[];
}

export const MembersList: React.FC<MembersListProps> = ({
  members,
  invites = [],
}) => {
  const { t } = useTranslation();
  const currentUser = useUser();

  // API now only returns pending invites, so no client-side filtering needed
  const pendingInvites = invites;

  if (
    (!members || members.length === 0) &&
    (!pendingInvites || pendingInvites.length === 0)
  )
    return null;

  return (
    <View style={styles.membersSection}>
      <Text
        size="sm"
        weight="semibold"
        tone="secondary"
        style={styles.membersSectionTitle}
      >
        {t('homeManagement.cardMembersSectionTitle')}
      </Text>
      <View style={styles.membersList}>
        {members.map(member => {
          const displayName = getMemberDisplayName(member, currentUser?.id);
          const isCurrentUser = member.user?.id === currentUser?.id;
          return (
            <MemberChip
              key={member.id}
              displayName={displayName}
              role={member.role}
              isCurrentUser={isCurrentUser}
            />
          );
        })}

        {pendingInvites.map(invite => (
          <InviteChip key={invite.id} invite={invite} />
        ))}
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
    marginBottom: theme.spacing.sm,
  },
  membersList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  memberChip: {
    paddingHorizontal: theme.spacing['3'],
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.xl,
    minWidth: theme.spacing['3xl'] - 4,
    alignItems: 'center',
    variants: {
      currentUser: {
        true: {
          backgroundColor: theme.colors.primary,
          borderWidth: 1,
          borderColor: theme.colors.primary,
        },
        false: {
          backgroundColor: theme.colors.primary + '20',
        },
      },
    },
  },
  memberChipText: {
    fontSize: theme.typography.fontSize.sm - 1,
    fontWeight: theme.fonts.weight.semibold,
    variants: {
      currentUser: {
        true: {
          color: theme.colors.white,
          fontWeight: theme.fonts.weight.bold,
        },
        false: {
          color: theme.colors.primary,
        },
      },
    },
  },
  memberRole: {
    fontSize: theme.typography.fontSize.xs - 2,
    marginTop: 2,
    textAlign: 'center',
    variants: {
      currentUser: {
        true: { color: theme.colors.white },
        false: { color: theme.colors.textSecondary },
      },
    },
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
    variants: {
      status: {
        pending: { borderColor: theme.colors.status.pending },
        accepted: { borderColor: theme.colors.status.accepted },
        declined: { borderColor: theme.colors.status.declined },
        expired: { borderColor: theme.colors.status.expired },
      },
    },
  },
  inviteChipText: {
    fontSize: theme.typography.fontSize.sm - 1,
    fontWeight: theme.fonts.weight.semibold,
    variants: {
      status: {
        pending: { color: theme.colors.status.pending },
        accepted: { color: theme.colors.status.accepted },
        declined: { color: theme.colors.status.declined },
        expired: { color: theme.colors.status.expired },
      },
    },
  },
  inviteStatus: {
    fontSize: theme.typography.fontSize.xs - 2,
    marginTop: 2,
    textAlign: 'center',
    fontWeight: theme.fonts.weight.medium,
    variants: {
      status: {
        pending: { color: theme.colors.status.pending },
        accepted: { color: theme.colors.status.accepted },
        declined: { color: theme.colors.status.declined },
        expired: { color: theme.colors.status.expired },
      },
    },
  },
}));
