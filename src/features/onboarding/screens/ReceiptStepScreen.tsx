import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { appConfig } from '#/config/appConfig';
import { Text } from '#components/atoms/Text';
import { Button } from '#components/molecules/Button';
import { Loading } from '#components/molecules/Loading';
import { DataStateView } from '#components/organisms/DataStateView';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { useSelectedPantryId } from '#store/useAppStore';
import { OnboardingStepScaffold } from '#features/onboarding/components/OnboardingStepScaffold';
import {
  startOnboardingSetup,
  useOnboardingSetup,
} from '#features/onboarding/hooks/useOnboardingSetup';
import {
  useOnboardingProgressStore,
  type OnboardingSetupStatus,
} from '#features/onboarding/store/onboardingProgressStore';
import { onboardingTestIDs } from '#features/onboarding/testIDs';
import { useOnboardingNavigation } from './useOnboardingNavigation';
import { useOnboardingInvites } from './useOnboardingInvites';

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

  const hasPantry = !!useSelectedPantryId();
  const setupStatus = useOnboardingProgressStore(state => state.setup);
  const setup = useOnboardingSetup();
  const { refetch: refetchInvites } = useOnboardingInvites();
  if (!hasPantry) {
    return (
      <OnboardingStepScaffold
        title={t('onBoarding.receiptTitle')}
        onBack={() => navigateToPreviousStep('Receipt')}
        onSkip={() => navigateToNextStep('Receipt')}
        primary={
          setupStatus.kind === 'failed'
            ? {
                label: t('labels.tryAgain'),
                onPress: () =>
                  startOnboardingSetup(
                    setup.run,
                    setupStatus.createMissingHome,
                  ),
              }
            : undefined
        }
        testID={onboardingTestIDs.receiptScreen}
      >
        <SetupWait
          status={setupStatus}
          readState={setup.readState}
          onRetryRead={() => {
            // With no home, invitations decide what setup creates.
            setup.retryRead();
            void refetchInvites();
          }}
        />
      </OnboardingStepScaffold>
    );
  }

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

/** The step before setup has left a pantry: still making it, or why not. */
const SetupWait = ({
  status,
  readState,
  onRetryRead,
}: {
  status: OnboardingSetupStatus;
  readState: ReturnType<typeof useOnboardingSetup>['readState'];
  onRetryRead: () => void;
}) => {
  const { t } = useTranslation();
  if (status.kind === 'failed') {
    return (
      <View style={styles.body} testID={onboardingTestIDs.receiptSetupFailed}>
        <Text role="bodyStrong" align="center">
          {t('onBoarding.setupFailedTitle')}
        </Text>
        <Text role="body" tone="secondary" align="center">
          {status.message}
        </Text>
      </View>
    );
  }
  if (status.kind === 'owed') {
    return (
      <View style={styles.body}>
        <DataStateView
          state={readState === 'offline' ? 'offline' : 'error'}
          onRetry={onRetryRead}
        />
        <Text role="body" tone="secondary" align="center">
          {t('onBoarding.finishSetupLater')}
        </Text>
      </View>
    );
  }
  return (
    <View testID={onboardingTestIDs.receiptSetupRunning}>
      <Loading message={t('onBoarding.settingUpTitle')} />
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  body: {
    gap: theme.spacing.md,
  },
}));
