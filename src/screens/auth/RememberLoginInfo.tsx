import React, {useState} from 'react';
import {Text, TouchableOpacity, Alert} from 'react-native';
import {useForm} from 'react-hook-form';
import {StyleSheet} from 'react-native-unistyles';
import {CommonActions} from '@react-navigation/native';
import {AuthWrapper, AuthFormTemplate} from '../../components/templates';
import {saveCredentials} from '../../storage/keychain';
import {useStore} from '../../store';
import {RememberLoginInfoProps} from '../../navigation';

type RememberValues = {};

export const RememberLoginInfoScreen = ({
  navigation,
}: RememberLoginInfoProps) => {
  const {
    user,
    setRememberMe,
    pendingEmail,
    pendingPassword,
    clearPendingCredentials,
  } = useStore();

  const [isSaving, setIsSaving] = useState(false);

  const {
    control,
    handleSubmit,
    formState: {errors},
  } = useForm<{}>({
    defaultValues: {},
  });

  const navigateToNextScreen = () => {
    // Figure out which branch AppNavigator will pick next
    const nextRoute: 'AuthStack' | 'OnBoardingStack' | 'HomeStack' =
      !user || !user.emailVerified
        ? 'AuthStack'
        : !user?.onBoarded
          ? 'OnBoardingStack'
          : 'HomeStack';

    // Reset the root navigator into that branch
    navigation.getParent()?.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{name: nextRoute}],
      }),
    );
  };

  const onRemember = async (choice: boolean) => {
    // Prevent multiple simultaneous operations
    if (isSaving) return;

    try {
      if (choice) {
        // Validate we have the required credentials
        if (!pendingEmail || !pendingPassword) {
          console.warn('Cannot save credentials: missing email or password');
          Alert.alert(
            'Error',
            'Unable to save login credentials. Please try logging in again.',
            [
              {
                text: 'OK',
                onPress: () => {
                  // Navigate back to login if credentials are missing
                  navigation.getParent()?.dispatch(
                    CommonActions.reset({
                      index: 0,
                      routes: [{name: 'AuthStack'}],
                    }),
                  );
                },
              },
            ],
          );
          return;
        }

        setIsSaving(true);
        await saveCredentials(pendingEmail, pendingPassword);
      }

      // Set the remember preference
      setRememberMe(choice);

      // Clear pending credentials after successful save (or skip)
      clearPendingCredentials();

      // Navigate to next screen
      navigateToNextScreen();
    } catch (error) {
      console.error('Error saving credentials:', error);

      // Show user-friendly error message
      Alert.alert(
        'Error Saving Credentials',
        "We couldn't save your login information. You can try again later in settings.",
        [
          {
            text: 'Continue Anyway',
            onPress: () => {
              // Set remember to false and continue
              setRememberMe(false);
              clearPendingCredentials();
              navigateToNextScreen();
            },
          },
          {
            text: 'Try Again',
            onPress: () => onRemember(choice),
            style: 'default',
          },
        ],
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AuthWrapper>
      <AuthFormTemplate<RememberValues>
        title="Remember login info?"
        subtitle="We'll remember the login info for your account, so you won't need to enter it on your iCloud devices."
        fields={[]}
        control={control}
        errors={errors}
        submitText={isSaving ? 'Saving...' : 'Remember'}
        onSubmit={handleSubmit(() => onRemember(true))}
        isLoading={isSaving}
      />

      <TouchableOpacity
        style={[styles.btnSecondary, isSaving && styles.btnSecondaryDisabled]}
        onPress={() => onRemember(false)}
        disabled={isSaving}>
        <Text
          style={[
            styles.btnSecondaryText,
            isSaving && styles.btnSecondaryTextDisabled,
          ]}>
          Skip for now
        </Text>
      </TouchableOpacity>
    </AuthWrapper>
  );
};

const styles = StyleSheet.create(theme => ({
  btnSecondary: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 30,
    paddingVertical: 10,
    borderWidth: 2,
    borderColor: '#C8D3D9',
    marginHorizontal: 24,
    marginTop: 12,
  },
  btnSecondaryText: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '600',
    color: '#1D2A32',
  },
  btnSecondaryDisabled: {
    opacity: 0.5,
  },
  btnSecondaryTextDisabled: {
    opacity: 0.5,
  },
}));
