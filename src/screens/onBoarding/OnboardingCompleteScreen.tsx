import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { OnBoardingWrapper } from '#components/templates/OnBoardingWrapper';
import { Button } from '#components/base/Button';
import { useUpdateUser, useUser } from '#store/useAppStore';
import { useMutation } from '@apollo/client/react';
import { CompleteOnboardingDocument } from '#operations/auth/user.generated';
import { handleMutationError } from '#/utils/errorHandlers';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { Text } from '#components/atoms/Text';

export const OnboardingCompleteScreen = () => {
  const { t } = useTranslation();
  useScreenTransition('OnboardingCompleteScreen');
  const user = useUser();
  const updateUser = useUpdateUser();
  const [isCompleting, setIsCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [completeOnboardingMutation] = useMutation(CompleteOnboardingDocument, {
    onCompleted: () => {
      // Update the user in the store
      if (user) {
        updateUser({ ...user, onBoarded: true });
      }

      setIsCompleting(false);

      // Navigate to main app - onboarding is now complete
      // The RootNavigator will automatically navigate to main_app since user.onBoarded = true
    },
    onError: error => {
      handleMutationError(error, { operation: 'Complete Onboarding' });
      setError(t('onBoarding.completeOnboardingError'));
      setIsCompleting(false);
    },
  });

  const handleComplete = async () => {
    if (!user?.id) {
      setError(t('onBoarding.userNotFoundError'));
      return;
    }

    setIsCompleting(true);
    setError(null);

    // The mutation's onError handler (declared above) covers failures, and
    // with errorPolicy:'all' the call doesn't throw — so no try/catch wrapper
    // (which would bail the React Compiler out of this component) is needed.
    await completeOnboardingMutation();
  };

  return (
    <OnBoardingWrapper
      title={t('onBoarding.completeTitle')}
      subtitle={t('onBoarding.completeSubtitle')}
      step={7}
      totalSteps={7}
      testID="onboarding-complete-screen"
    >
      <View style={styles.container}>
        <View style={styles.successIcon}>
          <Text weight="bold" style={styles.checkmark}>
            ✓
          </Text>
        </View>

        <Text
          size="lg"
          weight="semibold"
          align="center"
          style={styles.congratsText}
        >
          {t('onBoarding.congratulations')}
        </Text>

        <View style={styles.summaryList}>
          <Text size="md" tone="secondary" style={styles.summaryItem}>
            {`• ${t('onBoarding.summaryHomeAndPantry')}`}
          </Text>
          <Text size="md" tone="secondary" style={styles.summaryItem}>
            {`• ${t('onBoarding.summaryShoppingList')}`}
          </Text>
          <Text size="md" tone="secondary" style={styles.summaryItem}>
            {`• ${t('onBoarding.summaryInitialPantryItems')}`}
          </Text>
          <Text size="md" tone="secondary" style={styles.summaryItem}>
            {`• ${t('onBoarding.summaryInvitedFamily')}`}
          </Text>
        </View>

        <Text
          size="sm"
          tone="secondary"
          align="center"
          lineHeight="normal"
          style={styles.infoText}
        >
          {t('onBoarding.completeInfo')}
        </Text>

        {!!error && (
          <View style={styles.errorContainer}>
            <Text size="sm" tone="error" align="center">
              {error}
            </Text>
          </View>
        )}
      </View>

      <Button
        title={t('onBoarding.getStarted')}
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
  checkmark: {
    fontSize: theme.typography.fontSize['3xl'] + 16,
    color: theme.colors.white,
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
