import React, { useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { OnBoardingWrapper } from '#components/templates/OnBoardingWrapper';
import { Button } from '#components/base/Button';
import { useUpdateUser, useUser } from '#store/useAppStore';
import { useMutation } from '@apollo/client/react';
import { CompleteOnboardingDocument } from '#operations/auth/user.generated';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { Text } from '#components/atoms/Text';

export const OnboardingCompleteScreen = () => {
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
      console.error('Failed to complete onboarding:', error);
      setError('Failed to complete onboarding. Please try again.');
      setIsCompleting(false);
    },
  });

  const handleComplete = async () => {
    if (!user?.id) {
      setError('User not found. Please try again.');
      return;
    }

    setIsCompleting(true);
    setError(null);

    try {
      await completeOnboardingMutation();
    } catch (err) {
      console.error('Error in handleComplete:', err);
    }
  };

  return (
    <OnBoardingWrapper
      title="All set!"
      subtitle="Your home is ready to use"
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
          Congratulations! You've successfully set up:
        </Text>

        <View style={styles.summaryList}>
          <Text size="md" tone="secondary" style={styles.summaryItem}>
            • Your home and pantry
          </Text>
          <Text size="md" tone="secondary" style={styles.summaryItem}>
            • Your shopping list
          </Text>
          <Text size="md" tone="secondary" style={styles.summaryItem}>
            • Initial pantry items
          </Text>
          <Text size="md" tone="secondary" style={styles.summaryItem}>
            • Invited family & friends
          </Text>
        </View>

        <Text
          size="sm"
          tone="secondary"
          align="center"
          lineHeight="normal"
          style={styles.infoText}
        >
          You can now start managing your pantry, create shopping lists, and
          collaborate with family members!
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
        title="Get Started"
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
