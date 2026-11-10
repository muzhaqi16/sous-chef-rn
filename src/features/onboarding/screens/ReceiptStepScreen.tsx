import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { appConfig } from '#/config/appConfig';
import { Text } from '#components/atoms/Text';
import { Button } from '#components/molecules/Button';
import { Loading } from '#components/molecules/Loading';
import { DataStateView } from '#components/organisms/DataStateView';
import { useIsApiUnavailable } from '#hooks/app/useIsApiUnavailable';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { useSelectedPantryId } from '#store/useAppStore';
import {
  OnboardingStepScaffold,
  type StepPrimary,
} from '#features/onboarding/components/OnboardingStepScaffold';
import { StaplesPicker } from '#features/onboarding/components/StaplesPicker';
import {
  startOnboardingSetup,
  useOnboardingSetup,
} from '#features/onboarding/hooks/useOnboardingSetup';
import { useStaplesSelection } from '#features/onboarding/hooks/useStaplesSelection';
import {
  useOnboardingProgressStore,
  useOnboardingSetupStore,
  type OnboardingSetupStatus,
} from '#features/onboarding/store/onboardingProgressStore';
import { onboardingTestIDs } from '#features/onboarding/testIDs';
import { useOnboardingNavigation } from './useOnboardingNavigation';
import { useOnboardingInvites } from './useOnboardingInvites';

/**
 * Fills the pantry from a receipt and from staples, on one screen. A cancelled
 * scan, a refused camera or a closed review comes back here, staples intact.
 */
export const ReceiptStepScreen = () => {
  useScreenTransition('ReceiptStepScreen');
  const { navigateToNextStep, navigateToPreviousStep, navigateWithinStep } =
    useOnboardingNavigation();
  const hasPantry = !!useSelectedPantryId();
  const onBack = () => navigateToPreviousStep('Receipt');
  const onNext = () => navigateToNextStep('Receipt');

  return hasPantry ? (
    <KitchenChoices
      onBack={onBack}
      onNext={onNext}
      onScan={() => navigateWithinStep('OnboardingReceiptScan')}
    />
  ) : (
    <SetupPending onBack={onBack} onNext={onNext} />
  );
};

/**
 * The step while setup has not left a pantry. The account's reads live here:
 * with a pantry in place, the step needs none of them.
 */
const SetupPending = ({
  onBack,
  onNext,
}: {
  onBack: () => void;
  onNext: () => void;
}) => {
  const { t } = useTranslation();
  const setupStatus = useOnboardingSetupStore(state => state.setup);
  const setup = useOnboardingSetup();
  const { refetch: refetchInvites } = useOnboardingInvites();

  return (
    <OnboardingStepScaffold
      title={t('onBoarding.receiptTitle')}
      onBack={onBack}
      onSkip={onNext}
      primary={
        setupStatus.kind === 'failed'
          ? {
              label: t('labels.tryAgain'),
              onPress: () =>
                startOnboardingSetup(setup.run, setupStatus.createMissingHome),
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
};

/** The scan and the staples, once setup has left a pantry to fill. */
const KitchenChoices = ({
  onBack,
  onNext,
  onScan,
}: {
  onBack: () => void;
  onNext: () => void;
  onScan: () => void;
}) => {
  const { t } = useTranslation();
  const offline = useIsApiUnavailable();
  const receiptItems = useOnboardingProgressStore(state => state.receiptItems);
  const staples = useStaplesSelection();
  const canScan = appConfig.features.receipts !== false;
  const added = receiptItems > 0;

  const primary: StepPrimary =
    staples.hasChanges && !offline
      ? {
          label: staples.isFirstVisit
            ? t(
                staples.selectedCount === 1
                  ? 'onBoarding.addItemSingular'
                  : 'onBoarding.addItemPlural',
                { count: staples.selectedCount },
              )
            : t('labels.saveChanges'),
          // A refused staple is reported and left out; the step moves on.
          onPress: () => {
            void staples.save().then(onNext);
          },
          loading: staples.saving,
        }
      : { label: t('labels.continue'), onPress: onNext };

  return (
    <OnboardingStepScaffold
      title={t('onBoarding.receiptTitle')}
      question={
        canScan
          ? t('onBoarding.receiptSubtitle')
          : t('onBoarding.receiptStaplesOnlySubtitle')
      }
      onBack={onBack}
      onSkip={onNext}
      primary={primary}
      testID={onboardingTestIDs.receiptScreen}
    >
      {offline ? (
        <Text
          role="body"
          tone="secondary"
          align="center"
          testID={onboardingTestIDs.receiptOffline}
        >
          {t('onBoarding.kitchenOffline')}
        </Text>
      ) : (
        <View style={styles.body}>
          {added ? (
            <Text role="body" testID={onboardingTestIDs.receiptAdded}>
              {t('onBoarding.receiptAdded', { count: receiptItems })}
            </Text>
          ) : null}
          {canScan ? (
            <Button
              title={
                added
                  ? t('receipts.saved.scanAnother')
                  : t('labels.scanReceipt')
              }
              icon="receipt-outline"
              onPress={onScan}
              variant="outline"
              testID={onboardingTestIDs.receiptScan}
            />
          ) : null}
          <StaplesSection staples={staples} />
        </View>
      )}
    </OnboardingStepScaffold>
  );
};

/** The staples list, or why it is not there yet. */
const StaplesSection = ({
  staples,
}: {
  staples: ReturnType<typeof useStaplesSelection>;
}) => {
  const { t } = useTranslation();
  switch (staples.state) {
    case 'loading':
      return <Loading />;
    case 'failed':
      return (
        <View style={styles.body}>
          <Text role="error" tone="error" align="center">
            {t('errors.loadItemsFailed')}
          </Text>
          <Button
            title={t('labels.tryAgain')}
            onPress={staples.retry}
            variant="outline"
          />
        </View>
      );
    case 'unread':
      // Unread, a held food would show unpicked and be added twice.
      return <DataStateView state="error" onRetry={staples.retry} />;
    case 'ready':
      return (
        <StaplesPicker
          groups={staples.groups}
          selectedCount={staples.selectedCount}
          isMaxReached={staples.isMaxReached}
          onToggle={staples.toggle}
        />
      );
  }
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
    gap: theme.spacing.lg,
  },
}));
