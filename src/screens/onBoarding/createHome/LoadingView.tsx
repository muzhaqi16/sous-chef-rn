import React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { OnBoardingWrapper } from '#components/templates/OnBoardingWrapper';
import { StyleSheet } from 'react-native-unistyles';
import { SousChefLoader } from '#/components/base/SousChefLoader';

export const LoadingView = ({ onSkip }: { onSkip: () => void }) => {
  const { t } = useTranslation();
  return (
    <OnBoardingWrapper
      title={t('onBoarding.welcomeTitle')}
      subtitle={t('onBoarding.checkingExistingSetup')}
      step={1}
      totalSteps={7}
      onSkip={onSkip}
    >
      <View style={styles.loadingContainer}>
        <SousChefLoader
          size="small"
          showBrand={false}
          message={t('onBoarding.checkingExistingSetup')}
        />
      </View>
    </OnBoardingWrapper>
  );
};

const styles = StyleSheet.create(theme => ({
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing['2xl'],
  },
}));
