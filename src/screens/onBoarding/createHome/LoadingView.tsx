import React from 'react';
import { View } from 'react-native';
import { OnBoardingWrapper } from '#components/templates/OnBoardingWrapper';
import { StyleSheet } from 'react-native-unistyles';
import { SousChefLoader } from '#/components/base/SousChefLoader';

export const LoadingView = ({ onSkip }: { onSkip: () => void }) => (
  <OnBoardingWrapper
    title="Welcome! Let's set up your home"
    subtitle="Checking your existing setup..."
    step={1}
    totalSteps={7}
    onSkip={onSkip}
  >
    <View style={styles.loadingContainer}>
      <SousChefLoader
        size="small"
        showBrand={false}
        message="Checking your existing setup..."
      />
    </View>
  </OnBoardingWrapper>
);

const styles = StyleSheet.create(theme => ({
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing['2xl'],
  },
}));
