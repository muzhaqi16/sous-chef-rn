import React from 'react';
import {View, Text, Pressable} from 'react-native';
import {Icon} from '#utils/iconUtils';
import {StyleSheet} from 'react-native-unistyles';

interface NotificationHeaderProps {
  onMarkAllRead: () => void;
  onClearAll: () => void;
  hasNotifications: boolean;
}

export const NotificationHeader: React.FC<NotificationHeaderProps> = ({
  onMarkAllRead,
  onClearAll,
  hasNotifications,
}) => {
  if (!hasNotifications) return null;

  return (
    <View style={styles.container}>
      <Pressable style={({pressed}) => [styles.button, pressed && styles.pressed]} onPress={onMarkAllRead}>
        <Icon name="done-all" size={20} color={styles.buttonText.color} />
        <Text style={styles.buttonText}>Mark all read</Text>
      </Pressable>

      <Pressable style={({pressed}) => [styles.button, pressed && styles.pressed]} onPress={onClearAll}>
        <Icon name="clear-all" size={20} color={styles.buttonText.color} />
        <Text style={styles.buttonText}>Clear all</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.sm,
  },
  buttonText: {
    marginLeft: theme.spacing.xs,
    fontSize: theme.fonts.size.sm,
    color: theme.colors.primary,
    fontWeight: theme.fonts.weight.medium,
  },
  pressed: {
    opacity: 0.7,
  },
}));
