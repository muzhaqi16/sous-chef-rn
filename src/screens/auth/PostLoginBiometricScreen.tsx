import React, { useEffect } from 'react';
import { View } from 'react-native';
import { ThemedKeyboardAwareScrollView } from '#components/atoms/themedComponents';
import { ThemedSafeAreaView } from '#components/atoms/themedComponents';
import { StyleSheet } from 'react-native-unistyles';
import { usePostLoginState } from '#store/useAppStore';
import { useBiometricPrompting } from '#hooks/auth/useBiometricPrompting';
import { useAuthPreferences } from '#hooks/navigation/useAuthPreferences';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { BiometricSetupView } from '#components/organisms/biometric/BiometricSetupView';
import { useBiometricSetup } from '#components/organisms/biometric/useBiometricSetup';

/**
 * Post-login biometric enrollment gate. Shown as its OWN screen (via the
 * `biometric_setup` navigation state) immediately after a returning user logs
 * in and before the main app mounts — so the prompt never renders as a modal
 * over PantryMain. New users are handled inside onboarding instead; settings
 * uses `BiometricSetupModal`. All three share `BiometricSetupView` +
 * `useBiometricSetup`.
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

  // Defensive: if we ever land here without the credentials needed to enroll,
  // there's nothing to set up — proceed straight into the app.
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
