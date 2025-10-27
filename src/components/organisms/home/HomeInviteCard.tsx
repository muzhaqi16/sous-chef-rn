import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils';
import { formatInviteStatus } from '#utils/formatters';

interface Invite {
  id: string;
  email: string;
  recipientName?: string | null;
  status: string;
}

interface HomeInviteCardProps {
  invite: Invite;
  displayName: string;
  onRevoke: () => void;
}

/**
 * HomeInviteCard - Displays individual invite with status badge
 */
export const HomeInviteCard: React.FC<HomeInviteCardProps> = ({
  invite,
  displayName,
  onRevoke,
}) => {
  const statusText = formatInviteStatus(invite.status);

  return (
    <View style={styles.inviteCard}>
      <View style={styles.inviteInfo}>
        <Text style={styles.inviteName}>{displayName}</Text>
        <Text style={styles.inviteEmail}>{invite.email}</Text>
      </View>
      <View style={styles.inviteActions}>
        <View style={styles.inviteStatusBadge}>
          <Text style={styles.inviteStatusText}>{statusText}</Text>
        </View>
        {invite.status === 'PENDING' && (
          <TouchableOpacity style={styles.revokeButton} onPress={onRevoke}>
            <Icon name="close" size={20} />
          </TouchableOpacity>
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
    borderColor: theme.colors.status.pending,
    backgroundColor: theme.colors.surface,
  },
  inviteInfo: {
    flex: 1,
  },
  inviteName: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  inviteEmail: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
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
    backgroundColor: theme.colors.status.pending + '20',
  },
  inviteStatusText: {
    fontSize: theme.fonts.size.xs,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.status.pending,
  },
  revokeButton: {
    padding: theme.spacing.xs,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.validation.errorBg,
  },
}));
