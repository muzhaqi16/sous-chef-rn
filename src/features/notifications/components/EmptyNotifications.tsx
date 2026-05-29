import React from 'react';
import { View } from 'react-native';
import { Icon } from '#utils/iconUtils';

import { StyleSheet } from 'react-native-unistyles';
import { Text } from '#components/atoms/Text';

export const EmptyNotifications: React.FC = () => {
  return (
    <View style={styles.container}>
      <Icon name="notifications-outline" size={64} tone="textTertiary" />
      <Text size="lg" weight="bold" style={styles.title}>
        No notifications yet
      </Text>
      <Text size="sm" tone="secondary" align="center">
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
  title: {
    marginBottom: theme.spacing.sm,
  },
}));
