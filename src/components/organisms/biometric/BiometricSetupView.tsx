import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Pressable } from '#components/atoms/themedComponents';
import { Icon } from '#utils/iconUtils';
import { Text } from '#components/atoms/Text';
import { PasswordInput } from '#components/atoms/PasswordInput';

interface BiometricSetupViewProps {
  iconName: string;
  title: string;
  description: string;
  /** Optional bullet list (shown on the full-screen surfaces, omitted in the modal). */
  benefits?: string[];
  /** Optional footer note (shown on the full-screen surfaces). */
  footer?: string;
  needsPassword: boolean;
  password: string;
  onPasswordChange: (value: string) => void;
  passwordLabel: string;
  passwordPlaceholder: string;
  isEnabling: boolean;
  enableLabel: string;
  skipLabel: string;
  onEnable: () => void;
  onSkip: () => void;
  testID?: string;
}

/**
 * Centralized, presentational biometric-enrollment card. Layout-neutral — the
 * caller provides the container (onboarding wrapper, full-screen safe area, or
 * modal). All copy/state come from `useBiometricSetup`. This is the single
 * source of truth for how the enrollment prompt looks across the app.
 */
export const BiometricSetupView: React.FC<BiometricSetupViewProps> = ({
  iconName,
  title,
  description,
  benefits,
  footer,
  needsPassword,
  password,
  onPasswordChange,
  passwordLabel,
  passwordPlaceholder,
  isEnabling,
  enableLabel,
  skipLabel,
  onEnable,
  onSkip,
  testID,
}) => (
  <View style={styles.container} testID={testID}>
    <View style={styles.iconContainer}>
      <View style={styles.iconBackground}>
        <Icon name={iconName} size={48} tone="primary" />
      </View>
    </View>

    <Text size="xl" weight="bold" align="center" style={styles.title}>
      {title}
    </Text>
    <Text size="md" tone="secondary" align="center" style={styles.description}>
      {description}
    </Text>

    {!!benefits?.length && (
      <View style={styles.benefits}>
        {benefits.map(benefit => (
          <View key={benefit} style={styles.benefitItem}>
            <Icon name="checkmark-circle" size={20} tone="success" />
            <Text size="md" style={styles.benefitText}>
              {benefit}
            </Text>
          </View>
        ))}
      </View>
    )}

    {!!needsPassword && (
      <View style={styles.passwordSection}>
        <Text
          size="sm"
          tone="secondary"
          align="center"
          style={styles.passwordLabel}
        >
          {passwordLabel}
        </Text>
        <PasswordInput
          value={password}
          onChangeText={onPasswordChange}
          placeholder={passwordPlaceholder}
          showToggle
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
        onPress={onEnable}
        disabled={isEnabling}
        testID={testID ? `${testID}-enable` : undefined}
        accessibilityLabel={enableLabel}
      >
        <Text size="md" weight="semibold" style={styles.primaryButtonText}>
          {enableLabel}
        </Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [
          styles.secondaryButton,
          pressed && styles.pressed,
        ]}
        onPress={onSkip}
        disabled={isEnabling}
        testID={testID ? `${testID}-skip` : undefined}
        accessibilityLabel={skipLabel}
      >
        <Text size="md" weight="semibold" tone="secondary">
          {skipLabel}
        </Text>
      </Pressable>
    </View>

    {!!footer && (
      <Text size="sm" tone="secondary" align="center">
        {footer}
      </Text>
    )}
  </View>
);

const styles = StyleSheet.create(theme => ({
  container: {
    alignItems: 'center',
    alignSelf: 'stretch',
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
    marginBottom: theme.spacing.md,
  },
  description: {
    lineHeight: theme.fonts.size.md * 1.5,
    marginBottom: theme.spacing.xl,
    paddingHorizontal: theme.spacing.md,
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
    flex: 1,
  },
  passwordSection: {
    alignSelf: 'stretch',
    marginBottom: theme.spacing.lg,
  },
  passwordLabel: {
    marginBottom: theme.spacing.sm,
  },
  passwordInput: {
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
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
  primaryButtonText: {
    color: theme.colors.background,
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
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
