import React, { useEffect } from 'react';
import { View } from 'react-native';
import { Screen } from '#components/templates/Screen';
import { StyleSheet } from 'react-native-unistyles';
import { usePostLoginState } from '#store/useAppStore';
import { useBiometricPrompting } from '#features/auth/hooks/useBiometricPrompting';
import { useAuthPreferences } from '#hooks/navigation/useAuthPreferences';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { BiometricSetupView } from '#components/organisms/biometric/BiometricSetupView';
import { useBiometricSetup } from '#components/organisms/biometric/useBiometricSetup';
import { authTestIDs } from '#features/auth/testIDs';

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
    onComplete: handleComplete,
  });

  // Landing here without credentials leaves nothing to set up.
  useEffect(() => {
    if (!postLoginCredentials) {
      setNavigationState('main_app');
    }
  }, [postLoginCredentials, setNavigationState]);

  return (
    <Screen testID={authTestIDs.postLoginBiometricScreen}>
      <View style={styles.content}>
        <BiometricSetupView
          iconName={bio.iconName}
          title={bio.title}
          description={bio.description}
          benefits={bio.benefits}
          footer={bio.footer}
          isEnabling={bio.isEnabling}
          enableLabel={bio.enableLabel}
          skipLabel={bio.skipLabel}
          onEnable={bio.handleEnable}
          onSkip={bio.handleSkip}
          testID={authTestIDs.postLoginBiometricView}
        />
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create(theme => ({
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
}));
