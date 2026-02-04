import React from 'react';
import {Text, View, ActivityIndicator} from 'react-native';
import { OnBoardingWrapper } from '#components/templates/OnBoardingWrapper';
import {StyleSheet} from 'react-native-unistyles';

export const LoadingView = ({onSkip}: {onSkip: () => void}) => (
  <OnBoardingWrapper
    title="Welcome! Let's set up your home"
    subtitle="Checking your existing setup..."
    step={1}
    totalSteps={7}
    onSkip={onSkip}>
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={styles.loadingIndicator.color} />
      <Text style={styles.loadingText}>Checking your existing setup...</Text>
    </View>
  </OnBoardingWrapper>
);

const styles = StyleSheet.create(theme => ({
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing['2xl'],
  },
  loadingIndicator: {
    color: theme.colors.primary,
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.textSecondary,
  },
}));
