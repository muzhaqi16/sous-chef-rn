import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Text } from '#components/atoms/Text';

interface NotificationGroupHeaderProps {
  title: string;
}

export const NotificationGroupHeader: React.FC<
  NotificationGroupHeaderProps
> = ({ title }) => {
  return (
    <View style={styles.container}>
      <Text size="sm" weight="bold" tone="secondary" style={styles.title}>
        {title}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.background,
  },
  title: {
    textTransform: 'uppercase',
  },
}));
