import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { PrimaryActivityIndicator } from '#components/atoms/themedComponents';
import { Icon } from '#utils/iconUtils';
import { Text } from '#components/atoms/Text';

interface ChartSectionProps {
  title: string;
  children: React.ReactNode;
  loading?: boolean;
  error?: string;
  emptyMessage?: string;
  isEmpty?: boolean;
}

export const ChartSection: React.FC<ChartSectionProps> = ({
  title,
  children,
  loading = false,
  error,
  emptyMessage = 'No data available',
  isEmpty = false,
}) => {
  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.stateContainer}>
          <PrimaryActivityIndicator size="large" />
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.stateContainer}>
          <Icon name="alert-circle-outline" size={40} tone="error" />
          <Text size="sm" align="center" tone="error">
            {error}
          </Text>
        </View>
      );
    }

    if (isEmpty) {
      return (
        <View style={styles.stateContainer}>
          <Icon name="bar-chart-outline" size={40} tone="textSecondary" />
          <Text size="sm" align="center" tone="secondary">
            {emptyMessage}
          </Text>
        </View>
      );
    }

    return children;
  };

  return (
    <View style={styles.container}>
      <Text size="lg" weight="semibold" style={styles.title}>
        {title}
      </Text>
      {renderContent()}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.surface,
  },
  title: {
    marginBottom: theme.spacing.md,
  },
  stateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
}));
