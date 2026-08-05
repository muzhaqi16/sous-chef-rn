import React from 'react';
import {
  View,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { BiometricSetupView } from './biometric/BiometricSetupView';
import { useBiometricSetup } from './biometric/useBiometricSetup';

interface BiometricSetupModalProps {
  visible: boolean;
  onComplete: (enabled: boolean) => void;
  userEmail: string;
  userPassword?: string;
  mode?: 'onboarding' | 'settings';
}

/**
 * Modal shell for biometric enrollment — used from Profile → Security to
 * enable/re-enable biometric login. The card itself (icon, copy, password
 * field, enable/skip + the storeCredentials logic) is the shared
 * `BiometricSetupView` + `useBiometricSetup`, so this stays in lockstep with
 * the onboarding step and the post-login gate.
 */
export const BiometricSetupModal = ({
  visible,
  onComplete,
  userEmail,
  userPassword,
  mode = 'onboarding',
}: BiometricSetupModalProps) => {
  const bio = useBiometricSetup({
    mode: mode === 'settings' ? 'settings' : 'onboarding',
    userEmail,
    presetPassword: userPassword,
    active: visible,
    // The modal callers only care about the boolean outcome.
    onComplete: enabled => onComplete(enabled),
  });

  // Unavailable / not-yet-probed → render nothing; the hook calls onComplete
  // once the (async) probe confirms biometrics are unavailable.
  if (!visible || !bio.available) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View style={styles.overlay} />
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.contentContainer}>
            <View style={styles.card}>
              <BiometricSetupView
                iconName={bio.iconName}
                title={bio.title}
                description={bio.description}
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
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create(theme => ({
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.overlays.medium,
  },
  contentContainer: {
    // flexGrow so the card can scroll once the keyboard shrinks the avoiding
    // view, instead of being clamped to it and clipped.
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
  },
  card: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.spacing.lg,
    borderCurve: 'continuous',
    padding: theme.spacing.xl,
    alignItems: 'center',
    maxWidth: 360,
    width: '100%',
  },
}));
