import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { appConfig } from '#/config/appConfig';
import { Text } from '#components/atoms/Text';
import { Button } from '#components/molecules/Button';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { OnboardingStepScaffold } from '#features/onboarding/components/OnboardingStepScaffold';
import { useOnboardingProgressStore } from '#features/onboarding/store/onboardingProgressStore';
import { onboardingTestIDs } from '#features/onboarding/testIDs';
import { useOnboardingNavigation } from './useOnboardingNavigation';

/**
 * Fills the pantry from one receipt, or from staples instead. A cancelled scan,
 * a refused camera or a closed review comes back here, so staples stay offered.
 */
export const ReceiptStepScreen = () => {
  const { t } = useTranslation();
  useScreenTransition('ReceiptStepScreen');
  const { navigateToNextStep, navigateToPreviousStep, navigateWithinStep } =
    useOnboardingNavigation();
  const receiptItems = useOnboardingProgressStore(state => state.receiptItems);
  const canScan = appConfig.features.receipts !== false;
  const added = receiptItems > 0;

  const scan = () => navigateWithinStep('OnboardingReceiptScan');
  const pickStaples = () => navigateWithinStep('Staples');

  return (
    <OnboardingStepScaffold
      title={t('onBoarding.receiptTitle')}
      question={
        canScan
          ? t('onBoarding.receiptSubtitle')
          : t('onBoarding.receiptStaplesOnlySubtitle')
      }
      onBack={() => navigateToPreviousStep('Receipt')}
      onSkip={() => navigateToNextStep('Receipt')}
      primary={
        added
          ? {
              label: t('labels.continue'),
              onPress: () => navigateToNextStep('Receipt'),
            }
          : canScan
          ? {
              label: t('labels.scanReceipt'),
              icon: 'receipt-outline',
              onPress: scan,
              testID: onboardingTestIDs.receiptScan,
            }
          : {
              label: t('onBoarding.receiptPickStaplesOnly'),
              onPress: pickStaples,
              testID: onboardingTestIDs.receiptStaples,
            }
      }
      testID={onboardingTestIDs.receiptScreen}
    >
      <View style={styles.body}>
        {added ? (
          <Text role="body" testID={onboardingTestIDs.receiptAdded}>
            {t('onBoarding.receiptAdded', { count: receiptItems })}
          </Text>
        ) : null}
        {added && canScan ? (
          <Button
            title={t('receipts.saved.scanAnother')}
            onPress={scan}
            variant="outline"
            testID={onboardingTestIDs.receiptScan}
          />
        ) : null}
        {!added && canScan ? (
          <Button
            title={t('onBoarding.receiptPickStaples')}
            onPress={pickStaples}
            variant="outline"
            testID={onboardingTestIDs.receiptStaples}
          />
        ) : null}
      </View>
    </OnboardingStepScaffold>
  );
};

const styles = StyleSheet.create(theme => ({
  body: {
    gap: theme.spacing.md,
  },
}));
