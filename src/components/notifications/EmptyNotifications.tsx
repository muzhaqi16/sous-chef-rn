import React from 'react';
import { View, Text } from 'react-native';
import { Icon } from '#utils/iconUtils';

import { StyleSheet } from 'react-native-unistyles';

export const EmptyNotifications: React.FC = () => {
  return (
    <View style={styles.container}>
      <Icon name="notifications-outline" size={64} color={styles.icon.color} />
      <Text style={styles.title}>No notifications yet</Text>
      <Text style={styles.subtitle}>
        We'll notify you when something important happens
      </Text>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  icon: {
    color: theme.colors.textTertiary,
    marginBottom: theme.spacing.lg,
  },
  title: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: 'bold',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
}));
