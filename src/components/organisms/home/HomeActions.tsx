import React from 'react';
import {View, Text, Pressable} from 'react-native';
import {Icon} from '#utils/iconUtils';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';

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
  const {theme} = useUnistyles();
  return (
    <View style={styles.homeActions}>
      {!isDefault && (
        <Pressable
          style={({pressed}) => [styles.actionButton, pressed && styles.pressed]}
          onPress={() => onSetDefault(homeId)}>
          <Icon
            name="star-outline"
            size={20}
            color={theme.colors.textSecondary}
          />
          <Text style={styles.actionText}>Set Default</Text>
        </Pressable>
      )}

      {!!canInvite && (
        <Pressable
          style={({pressed}) => [styles.actionButton, pressed && styles.pressed]}
          onPress={() => onInvite(homeId)}>
          <Icon name="person-add" size={20} color={theme.colors.textSecondary} />
          <Text style={styles.actionText}>Invite</Text>
        </Pressable>
      )}

      {!!canDelete && (
        <Pressable
          style={({pressed}) => [styles.actionButton, pressed && styles.pressed]}
          onPress={() => onDelete(homeId)}>
          <Icon name="trash-outline" size={20} color={theme.colors.error} />
          <Text style={[styles.actionText, {color: theme.colors.error}]}>
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
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    marginLeft: theme.spacing.xs + 2,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
