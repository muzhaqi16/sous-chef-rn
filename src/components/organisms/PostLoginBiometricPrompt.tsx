import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, Modal } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { authService } from '#/services/authService';
import { executeWithLoadingState } from '#/utils/compilerSafeWrappers';

interface PostLoginBiometricPromptProps {
  visible: boolean;
  onComplete: (enabled: boolean, declined?: boolean) => void;
  userEmail: string;
  userPassword: string;
}

export const PostLoginBiometricPrompt = ({
  visible,
  onComplete,
  userEmail,
  userPassword,
}: PostLoginBiometricPromptProps) => {
  const { theme } = useUnistyles();
  const [biometricInfo, setBiometricInfo] = useState<{
    isAvailable: boolean;
    biometryType: string | null;
  }>({ isAvailable: true, biometryType: null }); // Default to available since pre-checked
  const [isEnabling, setIsEnabling] = useState(false);

  // Load biometric info when modal becomes visible
  useEffect(() => {
    if (visible) {
      authService.getBiometricInfo()
        .then(info => {
          setBiometricInfo(info);
        })
        .catch(error => {
          console.error('Error loading biometric info:', error);
        });
    }
  }, [visible]);

  const handleEnableNow = () => {
    if (isEnabling) return;

    executeWithLoadingState(
      async () => {
        if (!userEmail || !userPassword) {
          console.error('Missing credentials for biometric setup');
          onComplete(false);
          return;
        }

        const success = await authService.storeCredentials(userEmail, userPassword);
        onComplete(success);
      },
      setIsEnabling,
      (error) => {
        console.error('Error enabling biometric authentication:', error);
        onComplete(false);
      },
    );
  };

  const handleDecline = () => {
    onComplete(false, true);
  };

  const getBiometricIcon = () => {
    switch (biometricInfo.biometryType) {
      case 'Face ID':
        return 'scan-outline';
      case 'Touch ID':
      case 'Fingerprint':
        return 'finger-print';
      default:
        return 'finger-print';
    }
  };

  const getBiometricTitle = () => {
    return `Set up ${biometricInfo.biometryType || 'Biometric'} Login?`;
  };

  const getBiometricDescription = () => {
    const authType = biometricInfo.biometryType || 'biometric authentication';
    return `Use ${authType} for faster, more secure login next time. You can always enable this later in Settings if you change your mind.`;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay} testID="post-login-biometric-prompt">
        <View style={styles.container} testID="post-login-biometric-prompt-container">
          <View style={styles.iconContainer}>
            <View style={styles.iconBackground}>
              <Icon name={getBiometricIcon()} size={40} color={theme.colors.primary} />
            </View>
          </View>

          <Text style={styles.title}>{getBiometricTitle()}</Text>
          <Text style={styles.description}>{getBiometricDescription()}</Text>

          <View style={styles.buttons}>
            <Pressable
              style={({pressed}) => [styles.button, styles.primaryButton, pressed && styles.pressed]}
              onPress={handleEnableNow}
              disabled={isEnabling}
              testID="biometric-prompt-enable"
              accessibilityLabel="Enable Now"
            >
              <Text style={[styles.buttonText, styles.primaryButtonText]}>
                {isEnabling ? 'Setting up...' : 'Enable Now'}
              </Text>
            </Pressable>

            <Pressable
              style={({pressed}) => [styles.button, styles.secondaryButton, pressed && styles.pressed]}
              onPress={handleDecline}
              disabled={isEnabling}
              testID="biometric-prompt-decline"
              accessibilityLabel="Not now"
            >
              <Text style={[styles.buttonText, styles.secondaryButtonText]}>
                Not now
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create(theme => ({
  overlay: {
    flex: 1,
    backgroundColor: theme.colors.overlays.heavy,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  container: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.spacing.lg,
    padding: theme.spacing.xl,
    alignItems: 'center',
    maxWidth: 340,
    width: '100%',
    boxShadow: [{ offsetX: 0, offsetY: 4, blurRadius: 12, spreadDistance: 0, color: 'rgba(0, 0, 0, 0.1)' }],
  },
  iconContainer: {
    marginBottom: theme.spacing.lg,
  },
  iconBackground: {
    width: 70,
    height: 70,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  title: {
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.bold,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  description: {
    fontSize: theme.fonts.size.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: theme.fonts.size.md * 1.4,
    marginBottom: theme.spacing.lg,
  },
  benefits: {
    alignSelf: 'stretch',
    marginBottom: theme.spacing.xl,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  benefitText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textPrimary,
    flex: 1,
  },
  buttons: {
    alignSelf: 'stretch',
    gap: theme.spacing.sm,
  },
  button: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.spacing.sm,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  buttonText: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.semibold,
  },
  primaryButtonText: {
    color: theme.colors.background,
  },
  secondaryButtonText: {
    color: theme.colors.textSecondary,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
