import React from 'react';
import { View } from 'react-native';
import { StyleSheet, withUnistyles } from 'react-native-unistyles';
import type { FieldValues, Control, FieldErrors } from 'react-hook-form';
import { DynamicFormFields, FieldDef } from '../molecules/DynamicFormFields';
import { Button } from '../base/Button';
import { BackButton } from '../atoms/BackButton';
import { Link } from '../atoms/Link';
import { Pressable } from '#components/atoms/themedComponents';
import { Text } from '#components/atoms/Text';

const ThemedBackButton = withUnistyles(BackButton, theme => ({
  color: theme.colors.textOnSurfaceVariant,
}));

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
  submitDisabled?: boolean;
  /** Seconds left on a cooldown, appended to the button label while > 0. */
  submitCountdown?: number;
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
  /** Return key moves down the fields instead of just closing the keyboard. */
  focusChaining?: boolean;
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
  submitDisabled,
  submitCountdown,
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
  focusChaining = false,
}: Props<T>) {
  return (
    <View style={styles.formContainer}>
      <View>
        {!!onBackPress && (
          <ThemedBackButton onPress={onBackPress} style={styles.headerAction} />
        )}

        <Text
          size="2xl"
          weight="bold"
          tone="primary"
          align="center"
          style={styles.title}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            size="md"
            tone="secondary"
            align="center"
            style={styles.subtitle}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      <DynamicFormFields<T>
        fields={fields}
        control={control}
        errors={errors}
        focusChaining={focusChaining}
      />

      {!!linkText && !!onLinkPress && (
        <View style={styles.linkRow}>
          <Link onPress={onLinkPress} testID={linkTestID}>
            {linkText}
          </Link>
        </View>
      )}

      <View style={styles.action}>
        <Button
          title={
            submitCountdown && submitCountdown > 0
              ? `${submitText} (${submitCountdown}s)`
              : submitText
          }
          onPress={onSubmit}
          disabled={isLoading || submitDisabled}
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
            tone="secondary"
            align="center"
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
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
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
    paddingVertical: theme.spacing.xl,
  },
  footerDisabled: {
    opacity: theme.opacity.disabled,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
