import React from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { StyleSheet } from 'react-native-unistyles';
import { useUser } from '#store/useAppStore';
import { formatRole } from '#/utils/formatters/roleFormatters';
import {
  formatInviteStatus,
  getInviteDisplayName,
} from '#features/home/utils/inviteFormatters';
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
      <Text role="bodyStrong" style={styles.inviteChipText}>
        {displayName}
      </Text>
      <Text role="bodyStrong" style={styles.inviteStatus}>
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
      <Text role="bodyStrong" style={styles.memberChipText}>
        {displayName}
      </Text>
      <Text role="caption" style={styles.memberRole}>
        {formatRole(role)}
      </Text>
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
      <Text role="label" tone="secondary" style={styles.membersSectionTitle}>
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
    borderTopWidth: theme.borderWidth.hairline,
    borderTopColor: theme.colors.border,
    marginTop: theme.spacing.base,
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
    paddingHorizontal: theme.spacing.base,
    paddingVertical: theme.spacing.xsPlus,
    borderRadius: theme.radii.xl,
    borderCurve: 'continuous',
    minWidth: theme.spacing['3xl'],
    alignItems: 'center',
    variants: {
      currentUser: {
        true: {
          backgroundColor: theme.colors.primary,
          borderWidth: theme.borderWidth.hairline,
          borderColor: theme.colors.primary,
        },
        false: {
          backgroundColor: theme.colors.primary + '20',
        },
      },
    },
  },
  memberChipText: {
    variants: {
      currentUser: {
        true: {
          color: theme.colors.onPrimary,
        },
        false: {
          color: theme.colors.primary,
        },
      },
    },
  },
  memberRole: {
    textAlign: 'center',
    variants: {
      currentUser: {
        true: { color: theme.colors.onPrimary },
        false: { color: theme.colors.textSecondary },
      },
    },
  },
  inviteChip: {
    backgroundColor: theme.colors.transparent,
    paddingHorizontal: theme.spacing.base,
    paddingVertical: theme.spacing.xsPlus,
    borderRadius: theme.radii.xl,
    borderCurve: 'continuous',
    borderWidth: theme.borderWidth.hairline,
    borderStyle: 'dashed',
    minWidth: theme.spacing['3xl'],
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
    textAlign: 'center',
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
