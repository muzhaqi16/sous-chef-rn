import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils';
import { PasswordInput } from '#components/atoms';
import { useAuth } from '#hooks';

interface BiometricSetupModalProps {
  visible: boolean;
  onComplete: (enabled: boolean) => void;
  userEmail: string;
  userPassword?: string;
  mode?: 'onboarding' | 'settings';
}

export const BiometricSetupModal = ({
  visible,
  onComplete,
  userEmail,
  userPassword,
  mode = 'onboarding',
}: BiometricSetupModalProps) => {
  const {
    getBiometricInfo,
    storeCredentials,
    loadStoredCredentials,
    checkStoredCredentials,
  } = useAuth();
  const [biometricInfo, setBiometricInfo] = useState<{
    isAvailable: boolean;
    biometryType: string | null;
  }>({ isAvailable: false, biometryType: null });
  const [isEnabling, setIsEnabling] = useState(false);
  const [password, setPassword] = useState(userPassword || '');
  const [hasExistingCredentials, setHasExistingCredentials] = useState(false);
  const [hasCheckedBiometric, setHasCheckedBiometric] = useState(false);
  const needsPassword =
    (mode === 'onboarding' && !userPassword) ||
    (mode === 'settings' && !hasExistingCredentials);

  const loadBiometricInfo = useCallback(async () => {
    try {
      const [info, credentialsExist] = await Promise.all([
        getBiometricInfo(),
        mode === 'settings'
          ? checkStoredCredentials(userEmail)
          : Promise.resolve(false),
      ]);

      setBiometricInfo(info);
      setHasExistingCredentials(credentialsExist);
      setHasCheckedBiometric(true);

      // No additional setup needed since we removed authentication steps
    } catch (error) {
      console.error('Error loading biometric info:', error);
      setHasCheckedBiometric(true); // Set to true even on error
    }
  }, [getBiometricInfo, checkStoredCredentials, mode, userEmail]);

  useEffect(() => {
    if (visible) {
      setHasCheckedBiometric(false); // Reset check state
      loadBiometricInfo();
    }
  }, [visible, loadBiometricInfo]);

  // Handle biometric unavailable case after checking
  useEffect(() => {
    if (visible && hasCheckedBiometric && !biometricInfo.isAvailable) {
      onComplete(false);
    }
  }, [visible, hasCheckedBiometric, biometricInfo.isAvailable, onComplete]);

  const handleEnableBiometric = async () => {
    if (isEnabling) return;

    try {
      setIsEnabling(true);

      if (mode === 'settings') {
        // Settings mode: Only use native biometric authentication
        if (hasExistingCredentials) {
          // User has existing credentials - try to load them with biometric auth
          try {
            const credentials = await loadStoredCredentials(userEmail);
            if (credentials) {
              // Successfully authenticated with biometric - enable the setting
              onComplete(true);
              return;
            } else {
              // User cancelled biometric authentication
              Alert.alert(
                'Authentication Required',
                'Biometric authentication is required to enable this setting.',
                [{ text: 'OK', onPress: () => onComplete(false) }],
              );
              return;
            }
          } catch (error) {
            // Biometric auth failed
            Alert.alert(
              'Authentication Failed',
              'Could not authenticate using biometric authentication. Please try again.',
              [{ text: 'OK', onPress: () => onComplete(false) }],
            );
            return;
          }
        } else {
          // No existing credentials - prompt for password to save credentials
          if (!password.trim()) {
            // Show password input if not already visible
            if (!needsPassword) {
              Alert.alert(
                'Password Required',
                'Enter your password to enable biometric authentication with your existing account.',
                [{ text: 'OK' }],
              );
            }
            return;
          }

          // Save credentials with the entered password
          const success = await storeCredentials(userEmail, password);
          if (success) {
            onComplete(true);
            return;
          } else {
            Alert.alert(
              'Setup Failed',
              'Failed to enable biometric authentication. Please verify your password and try again.',
              [{ text: 'OK', onPress: () => onComplete(false) }],
            );
            return;
          }
        }
      }

      // Onboarding mode - save credentials with biometric protection
      if (needsPassword && !password.trim()) {
        Alert.alert(
          'Password Required',
          'Please enter your password to enable biometric authentication.',
        );
        return;
      }

      // Use the provided password or the one entered by the user
      const passwordToUse = userPassword || password;

      // Store credentials with biometric protection
      const success = await storeCredentials(userEmail, passwordToUse);

      if (success) {
        onComplete(true);
      } else {
        // Biometric setup failed during onboarding
        Alert.alert(
          'Setup Failed',
          'Biometric setup failed. You can enable it later in Settings.',
          [{ text: 'OK', onPress: () => onComplete(false) }],
        );
      }
    } catch (error) {
      console.error('Error enabling biometric authentication:', error);
      // This catch block only handles onboarding mode since settings mode returns early
      Alert.alert(
        'Setup Failed',
        'Biometric setup failed. You can enable it later in Settings.',
        [{ text: 'OK', onPress: () => onComplete(false) }],
      );
    } finally {
      setIsEnabling(false);
    }
  };

  const handleSkip = () => {
    onComplete(false);
  };

  if (!biometricInfo.isAvailable) {
    // If biometric authentication is not available, return null
    // The useEffect above will handle calling onComplete(false)
    return null;
  }

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
    return `Enable ${biometricInfo.biometryType || 'Biometric'} Login`;
  };

  const getBiometricDescription = () => {
    const authType = biometricInfo.biometryType || 'biometric authentication';
    return `Use ${authType} to securely and quickly log into your account without entering your password each time.`;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
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
            <View style={styles.container}>
              <View style={styles.iconContainer}>
                <View style={styles.iconBackground}>
                  <Icon name={getBiometricIcon()} size={48} color="#007AFF" />
                </View>
              </View>

              <Text style={styles.title}>{getBiometricTitle()}</Text>
              <Text style={styles.description}>{getBiometricDescription()}</Text>

              {needsPassword && (
                <View style={styles.passwordSection}>
                  <Text style={styles.passwordLabel}>
                    {mode === 'settings'
                      ? 'For security, please enter your current password to set up biometric login:'
                      : 'Enter your password to enable biometric authentication:'}
                  </Text>
                  <PasswordInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Current password"
                    showToggle={true}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={styles.passwordInput}
                  />
                </View>
              )}

              <View style={styles.buttons}>
                <TouchableOpacity
                  style={[styles.button, styles.primaryButton]}
                  onPress={handleEnableBiometric}
                  disabled={isEnabling}
                >
                  <Text style={[styles.buttonText, styles.primaryButtonText]}>
                    {isEnabling ? 'Setting up...' : 'Enable Now'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, styles.secondaryButton]}
                  onPress={handleSkip}
                  disabled={isEnabling}
                >
                  <Text style={[styles.buttonText, styles.secondaryButtonText]}>
                    Set up later
                  </Text>
                </TouchableOpacity>
              </View>
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
  },
  container: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.spacing.lg,
    padding: theme.spacing.xl,
    alignItems: 'center',
    maxWidth: 360,
    width: '100%',
  },
  iconContainer: {
    marginBottom: theme.spacing.lg,
  },
  iconBackground: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  title: {
    fontSize: theme.fonts.size.xl,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  description: {
    fontSize: theme.fonts.size.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: theme.fonts.size.md * 1.5,
    marginBottom: theme.spacing.xl,
  },
  benefits: {
    alignSelf: 'stretch',
    marginBottom: theme.spacing.xl,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    gap: theme.spacing.md,
  },
  benefitText: {
    fontSize: theme.fonts.size.md,
    color: theme.colors.textPrimary,
    flex: 1,
  },
  buttons: {
    alignSelf: 'stretch',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  button: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.spacing.md,
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
  footer: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  passwordSection: {
    alignSelf: 'stretch',
    marginBottom: theme.spacing.lg,
  },
  passwordLabel: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  passwordInput: {
    paddingVertical: theme.spacing.sm,
    fontSize: theme.fonts.size.md,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.surface,
  },
}));
