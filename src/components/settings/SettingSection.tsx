import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Text } from '#components/atoms/Text';

interface SettingSectionProps {
  title: string;
  children: React.ReactNode;
  description?: string;
}

export const SettingSection: React.FC<SettingSectionProps> = ({
  title,
  children,
  description,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Text weight="bold" tone="secondary" style={styles.title}>
          {title}
        </Text>
        {description ? (
          <Text tone="tertiary" style={styles.description}>
            {description}
          </Text>
        ) : null}
      </View>
      <View style={styles.content}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    marginBottom: theme.spacing.xl,
  },
  headerContainer: {
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  title: {
    fontSize: theme.typography.fontSize.sm - 1,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  description: {
    fontSize: theme.typography.fontSize.sm - 1,
    marginTop: theme.spacing.xs,
  },
  content: {
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.colors.border,
  },
}));
