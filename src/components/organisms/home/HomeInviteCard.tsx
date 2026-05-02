import React from 'react';
import { View, Text } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import {
  formatInviteStatus,
  getInviteStatusColor,
} from '#/utils/formatters/inviteFormatters';
import { InviteStatus } from '../../../graphql/generated/schemaTypes';

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
  const { theme } = useUnistyles();
  const statusText = formatInviteStatus(invite.status);
  const statusColor = getInviteStatusColor(invite.status, theme);

  return (
    <View style={[styles.inviteCard, { borderColor: statusColor }]}>
      <View style={styles.inviteInfo}>
        <Text style={styles.inviteName}>{displayName}</Text>
        <Text style={styles.inviteEmail}>{invite.email}</Text>
      </View>
      <View style={styles.inviteActions}>
        <View
          style={[
            styles.inviteStatusBadge,
            { backgroundColor: statusColor + '20' },
          ]}
        >
          <Text style={[styles.inviteStatusText, { color: statusColor }]}>
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
    // borderColor applied dynamically based on status
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
    // backgroundColor applied dynamically based on status
  },
  inviteStatusText: {
    fontSize: theme.fonts.size.xs,
    fontWeight: theme.fonts.weight.semibold,
    // color applied dynamically based on status
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
