import React from 'react';
import { View } from 'react-native';
import { Pressable } from '#components/atoms/themedComponents';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { formatInviteStatus } from '#/utils/formatters/inviteFormatters';
import { Text } from '#components/atoms/Text';
import { InviteStatus } from '#/graphql/generated/schemaTypes';

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

interface Invite {
  id: string;
  email: string;
  recipientName?: string | null;
  status: string;
}

interface HomeInviteCardProps {
  invite: Invite;
  displayName: string;
  canRevoke?: boolean;
  onRevoke: () => void;
}

/**
 * HomeInviteCard - Displays individual invite with status badge
 */
export const HomeInviteCard: React.FC<HomeInviteCardProps> = ({
  invite,
  displayName,
  canRevoke,
  onRevoke,
}) => {
  const statusText = formatInviteStatus(invite.status);
  const statusKey = getStatusKey(invite.status);
  styles.useVariants({ status: statusKey });

  return (
    <View style={styles.inviteCard}>
      <View style={styles.inviteInfo}>
        <Text size="md" weight="medium" style={styles.inviteName}>
          {displayName}
        </Text>
        <Text size="sm" tone="secondary">
          {invite.email}
        </Text>
      </View>
      <View style={styles.inviteActions}>
        <View style={styles.inviteStatusBadge}>
          <Text size="xs" weight="semibold" style={styles.inviteStatusText}>
            {statusText}
          </Text>
        </View>
        {!!canRevoke && invite.status === InviteStatus.Pending && (
          <Pressable
            style={({ pressed }) => [
              styles.revokeButton,
              pressed && styles.pressed,
            ]}
            onPress={onRevoke}
          >
            <Icon name="close" size={20} />
          </Pressable>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  inviteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    marginVertical: theme.spacing.xs,
    borderWidth: 1,
    borderStyle: 'dashed',
    backgroundColor: theme.colors.surface,
    variants: {
      status: {
        pending: { borderColor: theme.colors.status.pending },
        accepted: { borderColor: theme.colors.status.accepted },
        declined: { borderColor: theme.colors.status.declined },
        expired: { borderColor: theme.colors.status.expired },
      },
    },
  },
  inviteInfo: {
    flex: 1,
  },
  inviteName: {
    marginBottom: 2,
  },
  inviteActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  inviteStatusBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.sm,
    variants: {
      status: {
        pending: { backgroundColor: theme.colors.status.pending + '20' },
        accepted: { backgroundColor: theme.colors.status.accepted + '20' },
        declined: { backgroundColor: theme.colors.status.declined + '20' },
        expired: { backgroundColor: theme.colors.status.expired + '20' },
      },
    },
  },
  inviteStatusText: {
    variants: {
      status: {
        pending: { color: theme.colors.status.pending },
        accepted: { color: theme.colors.status.accepted },
        declined: { color: theme.colors.status.declined },
        expired: { color: theme.colors.status.expired },
      },
    },
  },
  revokeButton: {
    padding: theme.spacing.xs,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.validation.errorBg,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
