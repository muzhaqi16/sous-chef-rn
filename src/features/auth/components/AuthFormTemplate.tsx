import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import type { FieldValues, Control, FieldErrors } from 'react-hook-form';
import type { FieldDef } from '#components/molecules/DynamicFormFields';
import { DynamicFormFields } from '#components/molecules/DynamicFormFields';
import { Button } from '#components/molecules/Button';
import { Link } from '#components/atoms/Link';
import { Pressable } from '#components/atoms/themedComponents';
import { Text } from '#components/atoms/Text';
import { authTestIDs } from '#features/auth/testIDs';

interface Props<T extends FieldValues> {
  title: string;
  subtitle?: string | React.ReactNode;
  /** A step the user takes before filling the form, such as opening Mail. */
  headerAction?: { title: string; onPress: () => void; testID?: string };
  fields: FieldDef<T>[];
  control: Control<T>;
  errors: FieldErrors<T>;
  submitText: string;
  submitButtonTestID?: string;
  /** A refusal of the whole submit, shown above the button while it still applies. */
  submitError?: string | null;
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
  linkDisabled?: boolean;
  /** Seconds left on a cooldown, appended to the link label while > 0. */
  linkCountdown?: number;
  isLoading?: boolean;
  /** Return key moves down the fields instead of just closing the keyboard. */
  focusChaining?: boolean;
}
export function AuthFormTemplate<T extends FieldValues>({
  title,
  subtitle,
  headerAction,
  fields,
  control,
  errors,
  submitText,
  submitError,
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
  linkDisabled,
  linkCountdown,
  isLoading = false,
  focusChaining = false,
}: Props<T>) {
  return (
    // Top-aligned with fixed gaps: the keyboard rising moves no control
    // under a finger already on its way to it.
    <View style={styles.formContainer}>
      <View style={styles.titleRow} testID={authTestIDs.formTitleRow}>
        <Text role="title" tone="primary" align="center">
          {title}
        </Text>
      </View>
      {subtitle ? (
        <Text
          role="body"
          tone="secondary"
          align="center"
          style={styles.subtitle}
        >
          {subtitle}
        </Text>
      ) : null}
      {headerAction ? (
        <View style={styles.headerAction}>
          <Button
            title={headerAction.title}
            onPress={headerAction.onPress}
            variant="secondary"
            testID={headerAction.testID}
          />
        </View>
      ) : null}

      <View style={styles.fieldsGroup}>
        <DynamicFormFields<T>
          fields={fields}
          control={control}
          errors={errors}
          focusChaining={focusChaining}
        />

        {!!linkText && !!onLinkPress && (
          <View style={styles.linkRow}>
            <Link
              onPress={onLinkPress}
              testID={linkTestID}
              disabled={linkDisabled}
            >
              {linkCountdown && linkCountdown > 0
                ? `${linkText} (${linkCountdown}s)`
                : linkText}
            </Link>
          </View>
        )}
      </View>

      <View style={styles.action}>
        {submitError ? (
          // Polite: Android reads it as it appears; iOS is told by the screen.
          <Text
            role="error"
            tone="error"
            align="center"
            accessibilityLiveRegion="polite"
            style={styles.submitError}
            testID={authTestIDs.formSubmitError}
          >
            {submitError}
          </Text>
        ) : null}
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
            role="body"
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
  submitError: {
    marginBottom: theme.spacing.sm,
  },
  formContainer: {
    // See AuthWrapper.inner — this must grow, not claim a fixed viewport box, or
    // its own content overflows past whatever a following sibling occupies.
    flexGrow: 1,
  },
  fieldsGroup: {
    marginTop: theme.spacing.md,
  },
  titleRow: {
    marginTop: theme.spacing.xl,
    minHeight: theme.sizes.button.md,
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    marginBottom: theme.spacing.lg,
  },
  headerAction: {
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  linkRow: {
    alignItems: 'flex-end',
    // The field above reserves no space beneath it when it has no error to
    // show, so without this the link sits flush against the input and reads as
    // part of it — the code field, which renders no error slot, worst of all.
    marginTop: theme.spacing.sm,
  },
  action: {
    paddingTop: theme.spacing.xl,
    marginBottom: theme.spacing.sm,
  },
  footer: {
    paddingVertical: theme.spacing.md,
  },
  footerDisabled: {
    opacity: theme.opacity.disabled,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
