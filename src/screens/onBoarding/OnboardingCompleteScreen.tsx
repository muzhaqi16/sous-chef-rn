import React, {useState} from 'react';
import {Text, View, ActivityIndicator} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {OnBoardingWrapper} from '#components/templates';
import {Button} from '#components';
import {useAppStore} from '#store/useAppStore';
import {useCompleteOnboardingMutation} from '#generated';

export const OnboardingCompleteScreen = () => {
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
        btnStyle={[
          styles.completeButton,
          isCompleting && styles.disabledButton,
        ]}
        txtStyle={styles.completeText}
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
    paddingVertical: 32,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.success || '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  checkmark: {
    fontSize: 48,
    color: theme.colors.white,
    fontWeight: 'bold',
  },
  congratsText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textPrimary || '#222',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  summaryList: {
    marginBottom: 32,
  },
  summaryItem: {
    fontSize: 16,
    color: theme.colors.textSecondary || '#666',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: theme.colors.textSecondary || '#666',
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 20,
  },
  completeButton: {
    backgroundColor: theme.colors.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  disabledButton: {
    opacity: 0.6,
  },
  completeText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorContainer: {
    marginTop: 16,
    paddingHorizontal: 20,
  },
  errorText: {
    color: theme.colors.error || '#FF3B30',
    fontSize: 14,
    textAlign: 'center',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  loadingIndicator: {
    color: theme.colors.primary,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: theme.colors.textSecondary || '#666',
  },
}));
