import React from 'react';
import { View, Modal } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { BiometricSetupView } from '#components/organisms/biometric/BiometricSetupView';
import { useBiometricSetup } from '#components/organisms/biometric/useBiometricSetup';

interface BiometricSetupModalProps {
  visible: boolean;
  onComplete: (enabled: boolean) => void;
  userEmail: string;
  mode?: 'onboarding' | 'settings';
}

/**
 * Modal shell for biometric enrollment (Profile → Security). The card itself is
 * the shared `BiometricSetupView` + `useBiometricSetup`, so this stays in
 * lockstep with the onboarding step and the post-login gate.
 */
export const BiometricSetupModal = ({
  visible,
  onComplete,
  userEmail,
  mode = 'onboarding',
}: BiometricSetupModalProps) => {
  const bio = useBiometricSetup({
    mode: mode === 'settings' ? 'settings' : 'onboarding',
    userEmail,
    active: visible,
    onComplete: enabled => onComplete(enabled),
  });

  // Renders nothing until probed; the hook calls onComplete if biometrics are
  // unavailable.
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
      <View style={styles.contentContainer}>
        <View style={styles.card}>
          <BiometricSetupView
            iconName={bio.iconName}
            title={bio.title}
            description={bio.description}
            isEnabling={bio.isEnabling}
            enableLabel={bio.enableLabel}
            skipLabel={bio.skipLabel}
            onEnable={bio.handleEnable}
            onSkip={bio.handleSkip}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create(theme => ({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.overlays.medium,
  },
  contentContainer: {
    flex: 1,
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
