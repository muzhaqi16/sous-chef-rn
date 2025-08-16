import React from 'react';
import {View, Text, TouchableOpacity} from 'react-native';
import Icon from '@react-native-vector-icons/material-icons';
import {useStyles, createStyleSheet} from 'react-native-unistyles';

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
  const {styles} = useStyles(stylesheet);

  if (!hasNotifications) return null;

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.button} onPress={onMarkAllRead}>
        <Icon name="done-all" size={20} color={styles.buttonText.color} />
        <Text style={styles.buttonText}>Mark all read</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={onClearAll}>
        <Icon name="clear-all" size={20} color={styles.buttonText.color} />
        <Text style={styles.buttonText}>Clear all</Text>
      </TouchableOpacity>
    </View>
  );
};

const stylesheet = createStyleSheet(theme => ({
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
}));
