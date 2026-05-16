import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Pressable } from '#components/atoms/themedComponents';
import { StyleSheet } from 'react-native-unistyles';
import { alertService } from '#/services/alertService';
import { Icon } from '#utils/iconUtils';
import { PasswordInput } from '#components/atoms/PasswordInput';
import { authService } from '#/services/authService';
import {
  executeWithLoadingState,
  executeMutation,
} from '#/utils/compilerSafeWrappers';

/** Module-level helper to sync biometric check state */
function syncBiometricCheckState(setHasCheckedBiometric: (v: boolean) => void) {
  setHasCheckedBiometric(false);
}

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
  const { t } = useTranslation();
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

  useEffect(() => {
    if (visible) {
      syncBiometricCheckState(setHasCheckedBiometric); // Reset check state
      const credentialsCheck =
        mode === 'settings'
          ? authService.checkStoredCredentials(userEmail)
          : Promise.resolve(false);

      executeMutation(
        async () => {
          const [info, credentialsExist] = await Promise.all([
            authService.getBiometricInfo(),
            credentialsCheck,
          ]);

          setBiometricInfo(info);
          setHasExistingCredentials(credentialsExist);
          setHasCheckedBiometric(true);
        },
        error => {
          console.error('Error loading biometric info:', error);
          setHasCheckedBiometric(true); // Set to true even on error
        },
      );
    }
  }, [visible, mode, userEmail]);

  // Handle biometric unavailable case after checking
  useEffect(() => {
    if (visible && hasCheckedBiometric && !biometricInfo.isAvailable) {
      onComplete(false);
    }
  }, [visible, hasCheckedBiometric, biometricInfo.isAvailable, onComplete]);

  const handleEnableBiometric = () => {
    if (isEnabling) return;

    executeWithLoadingState(
      async () => {
        if (mode === 'settings') {
          // Settings mode: Only use native biometric authentication
          if (hasExistingCredentials) {
            // User has existing credentials - try to load them with biometric auth
            // Note: loadStoredCredentials may throw if biometric auth fails
            const credentials = await authService.loadStoredCredentials(
              userEmail,
            );
            if (credentials) {
              // Successfully authenticated with biometric - enable the setting
              onComplete(true);
              return;
            } else {
              // User cancelled biometric authentication
              alertService.alert(
                t('biometricSetup.authRequiredTitle'),
                t('biometricSetup.authRequiredMessage'),
                [{ text: t('labels.ok'), onPress: () => onComplete(false) }],
              );
              return;
            }
          } else {
            // No existing credentials - prompt for password to save credentials
            if (!password.trim()) {
              // Show password input if not already visible
              if (!needsPassword) {
                alertService.alert(
                  t('biometricSetup.passwordRequiredTitle'),
                  t('biometricSetup.passwordRequiredAccountMessage'),
                  [{ text: t('labels.ok') }],
                );
              }
              return;
            }

            // Save credentials with the entered password
            const success = await authService.storeCredentials(
              userEmail,
              password,
            );
            if (success) {
              onComplete(true);
              return;
            } else {
              alertService.alert(
                t('biometricSetup.setupFailedTitle'),
                t('biometricSetup.setupFailedPasswordMessage'),
                [{ text: t('labels.ok'), onPress: () => onComplete(false) }],
              );
              return;
            }
          }
        }

        // Onboarding mode - save credentials with biometric protection
        if (needsPassword && !password.trim()) {
          alertService.alert(
            t('biometricSetup.passwordRequiredTitle'),
            t('biometricSetup.passwordRequiredMessage'),
          );
          return;
        }

        // Use the provided password or the one entered by the user
        const passwordToUse = userPassword || password;

        // Store credentials with biometric protection
        const success = await authService.storeCredentials(
          userEmail,
          passwordToUse,
        );

        if (success) {
          onComplete(true);
        } else {
          // Biometric setup failed during onboarding
          alertService.alert(
            t('biometricSetup.setupFailedTitle'),
            t('biometricSetup.setupFailedGenericMessage'),
            [{ text: t('labels.ok'), onPress: () => onComplete(false) }],
          );
        }
      },
      setIsEnabling,
      error => {
        console.error('Error enabling biometric authentication:', error);
        alertService.alert(
          t('biometricSetup.setupFailedTitle'),
          t('biometricSetup.setupFailedGenericMessage'),
          [{ text: t('labels.ok'), onPress: () => onComplete(false) }],
        );
      },
    );
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
        return 'scan-outline';
      case 'Touch ID':
      case 'Fingerprint':
        return 'finger-print';
      default:
        return 'finger-print';
    }
  };

  const getBiometricTitle = () => {
    return t('biometricSetup.title', {
      type: biometricInfo.biometryType || t('biometricSetup.biometricFallback'),
    });
  };

  const getBiometricDescription = () => {
    const authType =
      biometricInfo.biometryType || t('biometricSetup.biometricAuthLabel');
    return t('biometricSetup.description', { authType });
  };

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
            <View style={styles.container}>
              <View style={styles.iconContainer}>
                <View style={styles.iconBackground}>
                  <Icon name={getBiometricIcon()} size={48} tone="primary" />
                </View>
              </View>

              <Text style={styles.title}>{getBiometricTitle()}</Text>
              <Text style={styles.description}>
                {getBiometricDescription()}
              </Text>

              {!!needsPassword && (
                <View style={styles.passwordSection}>
                  <Text style={styles.passwordLabel}>
                    {mode === 'settings'
                      ? t('biometricSetup.passwordPromptCurrent')
                      : t('biometricSetup.passwordPromptInitial')}
                  </Text>
                  <PasswordInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder={t('biometricSetup.passwordPlaceholder')}
                    showToggle={true}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={styles.passwordInput}
                  />
                </View>
              )}

              <View style={styles.buttons}>
                <Pressable
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && styles.pressed,
                  ]}
                  onPress={handleEnableBiometric}
                  disabled={isEnabling}
                >
                  <Text style={styles.primaryButtonText}>
                    {isEnabling
                      ? t('biometricSetup.settingUp')
                      : t('labels.enableNow')}
                  </Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    pressed && styles.pressed,
                  ]}
                  onPress={handleSkip}
                  disabled={isEnabling}
                >
                  <Text style={styles.secondaryButtonText}>
                    {t('biometricSetup.setupLater')}
                  </Text>
                </Pressable>
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
    backgroundColor: theme.colors.overlays.medium,
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
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  title: {
    fontSize: theme.fonts.size.xl,
    fontWeight: theme.fonts.weight.bold,
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
  primaryButton: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.spacing.md,
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
  },
  secondaryButton: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.spacing.md,
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  primaryButtonText: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.background,
  },
  secondaryButtonText: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.semibold,
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
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
