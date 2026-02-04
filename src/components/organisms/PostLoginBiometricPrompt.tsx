import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { useAuth } from '#hooks/auth/useAuth';

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
  const { getBiometricInfo, storeCredentials } = useAuth();
  const [biometricInfo, setBiometricInfo] = useState<{
    isAvailable: boolean;
    biometryType: string | null;
  }>({ isAvailable: true, biometryType: null }); // Default to available since pre-checked
  const [isEnabling, setIsEnabling] = useState(false);

  // Load biometric info when modal becomes visible
  useEffect(() => {
    if (visible) {
      getBiometricInfo()
        .then(info => {
          setBiometricInfo(info);
        })
        .catch(error => {
          console.error('Error loading biometric info:', error);
        });
    }
  }, [visible, getBiometricInfo]);

  const handleEnableNow = async () => {
    if (isEnabling) return;

    try {
      setIsEnabling(true);

      if (!userEmail || !userPassword) {
        console.error('Missing credentials for biometric setup');
        onComplete(false);
        return;
      }

      const success = await storeCredentials(userEmail, userPassword);
      onComplete(success);
    } catch (error) {
      console.error('Error enabling biometric authentication:', error);
      onComplete(false);
    } finally {
      setIsEnabling(false);
    }
  };

  const handleDecline = () => {
    onComplete(false, true);
  };

  const getBiometricIcon = () => {
    switch (biometricInfo.biometryType) {
      case 'Face ID':
        return 'face-recognition';
      case 'Touch ID':
      case 'Fingerprint':
        return 'fingerprint';
      default:
        return 'fingerprint';
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
            <TouchableOpacity
              style={[styles.button, styles.primaryButton]}
              onPress={handleEnableNow}
              disabled={isEnabling}
              testID="biometric-prompt-enable"
              accessibilityLabel="Enable Now"
              accessible={false}
            >
              <Text style={[styles.buttonText, styles.primaryButtonText]}>
                {isEnabling ? 'Setting up...' : 'Enable Now'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={handleDecline}
              disabled={isEnabling}
              testID="biometric-prompt-decline"
              accessibilityLabel="Not now"
              accessible={false}
            >
              <Text style={[styles.buttonText, styles.secondaryButtonText]}>
                Not now
              </Text>
            </TouchableOpacity>
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
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
    fontWeight: '700',
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
    fontWeight: '600',
  },
  primaryButtonText: {
    color: theme.colors.background,
  },
  secondaryButtonText: {
    color: theme.colors.textSecondary,
  },
}));
