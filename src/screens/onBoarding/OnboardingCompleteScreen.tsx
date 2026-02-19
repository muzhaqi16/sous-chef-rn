import React, {useState} from 'react';
import {Text, View, ActivityIndicator} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import { OnBoardingWrapper } from '#components/templates/OnBoardingWrapper';
import {Button} from '#components/base/Button';
import {useAppStore} from '#store/useAppStore';
import {useCompleteOnboardingMutation} from '#generated';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';

export const OnboardingCompleteScreen = () => {
  useScreenTransition('OnboardingCompleteScreen');
  const user = useAppStore(state => state.user);
  const updateUser = useAppStore(state => state.updateUser);
  const [isCompleting, setIsCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [completeOnboardingMutation] = useCompleteOnboardingMutation({
    onCompleted: () => {
      // Update the user in the store
      if (user) {
        updateUser({...user, onBoarded: true});
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
      testID="onboarding-complete-screen">
      <View style={styles.container}>
        <View style={styles.successIcon}>
          <Text style={styles.checkmark}>✓</Text>
        </View>

        <Text style={styles.congratsText}>
          Congratulations! You've successfully set up:
        </Text>

        <View style={styles.summaryList}>
          <Text style={styles.summaryItem}>• Your home and pantry</Text>
          <Text style={styles.summaryItem}>• Your shopping list</Text>
          <Text style={styles.summaryItem}>• Initial pantry items</Text>
          <Text style={styles.summaryItem}>• Invited family & friends</Text>
        </View>

        <Text style={styles.infoText}>
          You can now start managing your pantry, create shopping lists, and
          collaborate with family members!
        </Text>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </View>

      <Button
        title={isCompleting ? 'Completing Setup...' : 'Get Started'}
        onPress={handleComplete}
        variant="primary"
        disabled={isCompleting}
      />

      {isCompleting && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            size="small"
            color={styles.loadingIndicator.color}
          />
          <Text style={styles.loadingText}>Finalizing your setup...</Text>
        </View>
      )}

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
    fontWeight: 'bold',
  },
  congratsText: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
  },
  summaryList: {
    marginBottom: theme.spacing.xl,
  },
  summaryItem: {
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  infoText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: theme.spacing.xl,
    lineHeight: theme.typography.lineHeight.normal,
  },
  errorContainer: {
    marginTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: theme.typography.fontSize.sm,
    textAlign: 'center',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing['3'],
  },
  loadingIndicator: {
    color: theme.colors.primary,
  },
  loadingText: {
    marginLeft: theme.spacing.sm,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
  },
}));
