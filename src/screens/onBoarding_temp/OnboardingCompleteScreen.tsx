import React from 'react';
import {Text, View} from 'react-native';
import {createStyleSheet, useStyles} from 'react-native-unistyles';
import {useNavigation, CommonActions} from '@react-navigation/native';
import {OnBoardingWrapper} from '#components/templates';
import {Button} from '#components';
import {OnboardingCompleteNavProp} from '#navigation/types';
import {useStore} from '#store';
import {OnBoardingSteps} from '#store/slices/preferencesSlice';
import {useUpdateUserMutation} from '#generated';

export const OnboardingCompleteScreen = () => {
  const navigation = useNavigation<OnboardingCompleteNavProp>();
  const {styles} = useStyles(stylesheet);
  const {setOnBoardingStep, user} = useStore();

  const [updateUser] = useUpdateUserMutation({
    onCompleted: () => {
      console.log('User onboarding marked as complete');
    },
    onError: e => console.error(e),
  });

  const handleComplete = () => {
    // Mark onboarding as fully complete
    setOnBoardingStep(OnBoardingSteps.complete);

    // Update user as onboarded
    if (user?.id) {
      updateUser({
        variables: {
          id: user.id,
          input: {
            onBoarded: true,
          },
        },
      });
    }

    // Navigate to home and clear the navigation stack
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{name: 'HomeStack'}],
      }),
    );
  };

  return (
    <OnBoardingWrapper
      title="All set!"
      subtitle="Your home is ready to use"
      step={5}
      totalSteps={5}>
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
      </View>

      <Button
        title="Get Started"
        onPress={handleComplete}
        btnStyle={styles.completeButton}
        txtStyle={styles.completeText}
      />
    </OnBoardingWrapper>
  );
};

const stylesheet = createStyleSheet(theme => ({
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
  completeText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
}));
