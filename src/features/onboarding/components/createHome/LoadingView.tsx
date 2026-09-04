import React from 'react';
import { useTranslation } from '#/i18n';
import { OnBoardingWrapper } from '#features/onboarding/components/OnBoardingWrapper';
import { StyleSheet } from 'react-native-unistyles';
import { LoadingBranded } from '#components/molecules/Loading';

export const LoadingView = ({ onSkip }: { onSkip: () => void }) => {
  const { t } = useTranslation();
  return (
    <OnBoardingWrapper
      title={t('onBoarding.welcomeTitle')}
      subtitle={t('onBoarding.checkingExistingSetup')}
      step={1}
      totalSteps={8}
      onSkip={onSkip}
    >
      <LoadingBranded
        message={t('onBoarding.checkingExistingSetup')}
        style={styles.centeredSpinner}
      />
    </OnBoardingWrapper>
  );
};

const styles = StyleSheet.create(theme => ({
  centeredSpinner: {
    // Sits under the wrapper's title/subtitle, so it sizes to the loader
    // rather than filling the step.
    flex: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing['2xl'],
  },
}));
