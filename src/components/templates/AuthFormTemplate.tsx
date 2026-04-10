import React from 'react';
import { View, Text } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import type { FieldValues, Control, FieldErrors } from 'react-hook-form';
import { DynamicFormFields, FieldDef } from '../molecules/DynamicFormFields';
import { Button } from '../base/Button';
import { BackButton } from '../atoms/BackButton';
import { Link } from '../atoms/Link';
import { Pressable } from 'react-native-gesture-handler';

interface Props<T extends FieldValues> {
  title: string;
  subtitle?: string | React.ReactNode;
  onBackPress?: () => void;
  fields: FieldDef<T>[];
  control: Control<T>;
  errors: FieldErrors<T>;
  submitText: string;
  submitButtonTestID?: string;
  onSubmit: () => void;
  footerText?: string;
  footerLinkText?: string;
  footerLinkTestID?: string;
  onFooterLinkPress?: () => void;
  footerLinkDisabled?: boolean;
  footerLinkCountdown?: number; // seconds remaining for countdown display
  onLinkPress?: () => void;
  linkText?: string;
  linkTestID?: string;
  isLoading?: boolean;
}
export function AuthFormTemplate<T extends FieldValues>({
  title,
  subtitle,
  onBackPress = undefined,
  fields,
  control,
  errors,
  submitText,
  submitButtonTestID,
  onSubmit,
  footerText,
  footerLinkText,
  footerLinkTestID,
  onFooterLinkPress,
  footerLinkDisabled,
  footerLinkCountdown,
  linkText,
  linkTestID,
  onLinkPress,
  isLoading = false,
}: Props<T>) {
  const { theme } = useUnistyles();
  return (
    <View style={styles.formContainer}>
      <View>
        {!!onBackPress && (
          <BackButton
            onPress={onBackPress}
            style={styles.headerAction}
            color={theme.colors.textOnSurfaceVariant}
          />
        )}

        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>

      <DynamicFormFields<T> fields={fields} control={control} errors={errors} />

      {!!linkText && !!onLinkPress && (
        <View style={styles.linkRow}>
          <Link onPress={onLinkPress} testID={linkTestID}>
            {linkText}
          </Link>
        </View>
      )}

      <View style={styles.action}>
        <Button
          title={submitText}
          onPress={onSubmit}
          disabled={isLoading}
          loading={isLoading}
          testID={submitButtonTestID}
        />
      </View>

      {!!footerText && !!footerLinkText && !!onFooterLinkPress && (
        <Pressable
          onPress={onFooterLinkPress}
          disabled={footerLinkDisabled}
          testID={footerLinkTestID}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Text
            style={[styles.footer, footerLinkDisabled && styles.footerDisabled]}
          >
            {footerText}{' '}
            <Link disabled={footerLinkDisabled}>
              {footerLinkCountdown && footerLinkCountdown > 0
                ? `${footerLinkText} (${footerLinkCountdown}s)`
                : footerLinkText}
            </Link>
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create(theme => ({
  formContainer: {
    flex: 1,
    justifyContent: 'space-around',
  },
  headerAction: {
    width: theme.sizes.button.md,
    height: theme.sizes.button.md,
    borderRadius: theme.radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.transparent,
  },
  title: {
    fontSize: theme.typography.fontSize['2xl'],
    fontWeight: theme.fonts.weight.bold,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
  },
  linkRow: {
    alignItems: 'flex-end',
  },
  action: {
    marginVertical: theme.spacing.xl,
  },
  footer: {
    marginTop: 'auto',
    textAlign: 'center',
    paddingVertical: theme.spacing.xl,
    color: theme.colors.textSecondary,
  },
  footerDisabled: {
    opacity: theme.opacity.disabled,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
