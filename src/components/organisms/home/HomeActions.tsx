import React from 'react';
import { View } from 'react-native';
import { Pressable } from '#components/atoms/themedComponents';
import { Icon } from '#utils/iconUtils';
import { StyleSheet } from 'react-native-unistyles';
import { Text } from '#components/atoms/Text';

interface HomeActionsProps {
  homeId: string;
  isDefault: boolean;
  canInvite?: boolean;
  canDelete?: boolean;
  onSetDefault: (homeId: string) => void;
  onInvite: (homeId: string) => void;
  onDelete: (homeId: string) => void;
}

export const HomeActions: React.FC<HomeActionsProps> = ({
  homeId,
  isDefault,
  canInvite = true, // Default to true for backward compatibility
  canDelete = true, // Default to true for backward compatibility
  onSetDefault,
  onInvite,
  onDelete,
}) => {
  const hasVisibleActions = !isDefault || canInvite || canDelete;
  if (!hasVisibleActions) return null;

  return (
    <View style={styles.homeActions}>
      {!isDefault && (
        <Pressable
          style={({ pressed }) => [
            styles.actionButton,
            pressed && styles.pressed,
          ]}
          onPress={() => onSetDefault(homeId)}
        >
          <Icon name="star-outline" size={20} tone="textSecondary" />
          <Text size="sm" tone="secondary" style={styles.actionText}>
            Set Default
          </Text>
        </Pressable>
      )}

      {!!canInvite && (
        <Pressable
          style={({ pressed }) => [
            styles.actionButton,
            pressed && styles.pressed,
          ]}
          onPress={() => onInvite(homeId)}
        >
          <Icon name="person-add" size={20} tone="textSecondary" />
          <Text size="sm" tone="secondary" style={styles.actionText}>
            Invite
          </Text>
        </Pressable>
      )}

      {!!canDelete && (
        <Pressable
          style={({ pressed }) => [
            styles.actionButton,
            pressed && styles.pressed,
          ]}
          onPress={() => onDelete(homeId)}
        >
          <Icon name="trash-outline" size={20} tone="error" />
          <Text size="sm" tone="error" style={styles.actionText}>
            Delete
          </Text>
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  homeActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    paddingTop: theme.spacing['3'],
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing['3'],
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.surface,
  },
  actionText: {
    marginLeft: theme.spacing.xs + 2,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
