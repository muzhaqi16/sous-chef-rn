import React, { useEffect } from 'react';
import { View } from 'react-native';
import { ThemedKeyboardAwareScrollView } from '#components/atoms/themedComponents';
import { ThemedSafeAreaView } from '#components/atoms/themedComponents';
import { StyleSheet } from 'react-native-unistyles';
import { usePostLoginState } from '#store/useAppStore';
import { useBiometricPrompting } from '#features/auth/hooks/useBiometricPrompting';
import { useAuthPreferences } from '#hooks/navigation/useAuthPreferences';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { BiometricSetupView } from '#components/organisms/biometric/BiometricSetupView';
import { useBiometricSetup } from '#components/organisms/biometric/useBiometricSetup';

/**
 * Post-login biometric enrollment, as its OWN screen between login and the main
 * app so the prompt never renders as a modal over PantryMain. New users enroll in
 * onboarding, settings uses `BiometricSetupModal`; all three share the same view.
 */
export const PostLoginBiometricScreen = () => {
  useScreenTransition('PostLoginBiometricScreen');
  const {
    postLoginCredentials,
    setNavigationState,
    setShowBiometricSetup,
    setPostLoginCredentials,
  } = usePostLoginState();
  const { recordBiometricPromptResponse } = useBiometricPrompting();
  const { markBiometricEnabled, markBiometricDeclined } = useAuthPreferences();

  const handleComplete = (enabled: boolean, declined?: boolean) => {
    recordBiometricPromptResponse(enabled, declined);
    if (enabled) {
      markBiometricEnabled();
    } else if (declined) {
      markBiometricDeclined();
    }
    setShowBiometricSetup(false);
    setPostLoginCredentials(null);
    setNavigationState('main_app');
  };

  const bio = useBiometricSetup({
    mode: 'postLogin',
    userEmail: postLoginCredentials?.email ?? '',
    presetPassword: postLoginCredentials?.password,
    onComplete: handleComplete,
  });

  // Landing here without credentials leaves nothing to set up.
  useEffect(() => {
    if (!postLoginCredentials) {
      setNavigationState('main_app');
    }
  }, [postLoginCredentials, setNavigationState]);

  return (
    <ThemedSafeAreaView
      style={styles.safeArea}
      testID="post-login-biometric-screen"
    >
      <ThemedKeyboardAwareScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <BiometricSetupView
            iconName={bio.iconName}
            title={bio.title}
            description={bio.description}
            benefits={bio.benefits}
            footer={bio.footer}
            needsPassword={bio.needsPassword}
            password={bio.password}
            onPasswordChange={bio.setPassword}
            passwordLabel={bio.passwordLabel}
            passwordPlaceholder={bio.passwordPlaceholder}
            isEnabling={bio.isEnabling}
            enableLabel={bio.enableLabel}
            skipLabel={bio.skipLabel}
            onEnable={bio.handleEnable}
            onSkip={bio.handleSkip}
            testID="post-login-biometric"
          />
        </View>
      </ThemedKeyboardAwareScrollView>
    </ThemedSafeAreaView>
  );
};

const styles = StyleSheet.create(theme => ({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
  },
  content: {
    alignItems: 'center',
  },
}));
