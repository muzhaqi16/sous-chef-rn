import React, { useState } from 'react';
import { useTranslation, type TranslationKey } from '#/i18n';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { OnBoardingWrapper } from '#features/onboarding/components/OnBoardingWrapper';
import { Button } from '#components/molecules/Button';
import { useUpdateUser, useUser } from '#store/useAppStore';
import { useCompleteOnboarding } from '#features/onboarding/hooks/useCompleteOnboarding';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { Text } from '#components/atoms/Text';
import { Icon } from '#components/atoms/Icon';
import { onboardingTestIDs } from '#features/onboarding/testIDs';
import { useOnboardingSummary } from '#features/onboarding/hooks/useOnboardingSummary';

export const OnboardingCompleteScreen = () => {
  const { t } = useTranslation();
  useScreenTransition('OnboardingCompleteScreen');
  const user = useUser();
  const updateUser = useUpdateUser();
  const [isCompleting, setIsCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { completeOnboarding } = useCompleteOnboarding(user?.id);
  const summary = useOnboardingSummary();
  // Only what the user has: a skipped step is never claimed.
  const lines: { done: boolean; key: TranslationKey }[] = [
    { done: summary.homeAndPantry, key: 'onBoarding.summaryHomeAndPantry' },
    { done: summary.shoppingList, key: 'onBoarding.summaryShoppingList' },
    { done: summary.pantryItems, key: 'onBoarding.summaryInitialPantryItems' },
    { done: summary.invites, key: 'onBoarding.summaryInvitedFamily' },
  ];
  const completed = lines.filter(line => line.done).map(line => line.key);

  const handleComplete = async () => {
    if (!user?.id) {
      setError(t('onBoarding.userNotFoundError'));
      return;
    }

    setIsCompleting(true);
    setError(null);

    // A failure is alerted by the hook; the inline copy keeps it on screen.
    if (!(await completeOnboarding())) {
      setError(t('onBoarding.completeOnboardingError'));
      setIsCompleting(false);
      return;
    }

    // Success — RootNavigator auto-navigates to main_app once onBoarded = true.
    updateUser({ onBoarded: true });
    setIsCompleting(false);
  };

  return (
    <OnBoardingWrapper
      title={t('onBoarding.completeTitle')}
      subtitle={
        summary.homeAndPantry
          ? t('onBoarding.completeSubtitle')
          : t('onBoarding.readyToStart')
      }
      testID={onboardingTestIDs.completeScreen}
    >
      <View style={styles.container}>
        <View style={styles.successIcon}>
          <Icon name="checkmark" size={44} tone="onSuccess" />
        </View>

        {completed.length > 0 ? (
          <>
            <Text role="heading" align="center" style={styles.congratsText}>
              {t('onBoarding.congratulations')}
            </Text>
            <View style={styles.summaryList}>
              {completed.map(key => (
                <Text
                  key={key}
                  role="body"
                  tone="secondary"
                  style={styles.summaryItem}
                >
                  {`• ${t(key)}`}
                </Text>
              ))}
            </View>
          </>
        ) : (
          <Text role="body" align="center" style={styles.congratsText}>
            {t('onBoarding.nothingSetUp')}
          </Text>
        )}

        <Text
          role="caption"
          tone="secondary"
          align="center"
          style={styles.infoText}
        >
          {t('onBoarding.completeInfo')}
        </Text>

        {!!error && (
          <View style={styles.errorContainer}>
            <Text role="error" tone="error" align="center">
              {error}
            </Text>
          </View>
        )}
      </View>

      <Button
        title={t('labels.getStarted')}
        onPress={handleComplete}
        variant="primary"
        loading={isCompleting}
      />
    </OnBoardingWrapper>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.xl,
  },
  congratsText: {
    marginBottom: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
  },
  summaryList: {
    marginBottom: theme.spacing.xl,
  },
  summaryItem: {
    marginBottom: theme.spacing.sm,
  },
  infoText: {
    paddingHorizontal: theme.spacing.xl,
  },
  errorContainer: {
    marginTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
}));
