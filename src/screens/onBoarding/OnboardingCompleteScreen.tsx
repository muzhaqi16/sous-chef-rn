import React, {useState} from 'react';
import {Text, View, ActivityIndicator} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {useNavigation, CommonActions} from '@react-navigation/native';
import {OnBoardingWrapper} from '#components/templates';
import {Button} from '#components';
import {OnboardingCompleteNavProp} from '#navigation/types';
import {useStore} from '#store';
import {OnBoardingSteps} from '#store/slices/preferencesSlice';
import {useUpdateUserMutation} from '#generated';

export const OnboardingCompleteScreen = () => {
  const navigation = useNavigation<OnboardingCompleteNavProp>();

  const {setOnBoardingStep, user, updateUser} = useStore(); // Add setUser
  const [isCompleting, setIsCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [updateUserMutation] = useUpdateUserMutation({
    onCompleted: data => {
      console.log('User onboarding marked as complete');

      // Update the user in the store with the response from the server
      if (data?.updateUser) {
        updateUser(data.updateUser);
      }

      // Mark onboarding as fully complete in store
      setOnBoardingStep(OnBoardingSteps.complete);

      // Navigate to home and clear the navigation stack
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{name: 'HomeStack'}],
        }),
      );

      setIsCompleting(false);
    },
    onError: error => {
      console.error('Failed to update user onboarding status:', error);
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
      await updateUserMutation({
        variables: {
          id: user.id,
          input: {
            onBoarded: true,
          },
        },
      });
    } catch (err) {
      // Error handling is done in onError callback
      console.error('Error in handleComplete:', err);
    }
  };

  return (
    <OnBoardingWrapper
      title="All set!"
      subtitle="Your home is ready to use"
      step={6}
      totalSteps={6}>
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
