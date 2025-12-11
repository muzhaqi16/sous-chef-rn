import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import type { FieldValues, Control, FieldErrors } from 'react-hook-form';
import { DynamicFormFields, FieldDef } from '../molecules/DynamicFormFields';
import { Button } from '../base';
import { IconButton } from '../atoms';

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
        {onBackPress && (
          <IconButton
            name="chevron-left"
            onPress={onBackPress}
            size="md"
            style={styles.headerAction}
            color={theme.colors.textOnSurfaceVariant}
            accessibilityLabel="Go back"
          />
        )}

        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>

      <DynamicFormFields<T> fields={fields} control={control} errors={errors} />

      {linkText && onLinkPress && (
        <TouchableOpacity onPress={onLinkPress} testID={linkTestID}>
          <Text style={styles.link}>{linkText}</Text>
        </TouchableOpacity>
      )}

      <View style={styles.action}>
        <Button
          title={submitText}
          onPress={onSubmit}
          disabled={isLoading}
          testID={submitButtonTestID}
        />
      </View>

      {footerText && footerLinkText && onFooterLinkPress && (
        <TouchableOpacity
          onPress={onFooterLinkPress}
          disabled={footerLinkDisabled}
          testID={footerLinkTestID}
        >
          <Text
            style={[styles.footer, footerLinkDisabled && styles.footerDisabled]}
          >
            {footerText}{' '}
            <Text
              style={[styles.link, footerLinkDisabled && styles.linkDisabled]}
            >
              {footerLinkCountdown && footerLinkCountdown > 0
                ? `${footerLinkText} (${footerLinkCountdown}s)`
                : footerLinkText}
            </Text>
          </Text>
        </TouchableOpacity>
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
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    backgroundColor: 'transparent',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  link: {
    textAlign: 'right',
    fontWeight: '600',
    color: theme.colors.primary,
    textDecorationLine: 'underline',
  },
  action: {
    marginVertical: 24,
  },
  button: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    alignSelf: 'center',
  },
  buttonText: {
    color: theme.colors.onPrimary,
    textTransform: 'uppercase',
  },
  footer: {
    marginTop: 'auto',
    textAlign: 'center',
    paddingVertical: 24,
    color: theme.colors.textSecondary,
  },
  footerDisabled: {
    opacity: 0.5,
  },
  linkDisabled: {
    textDecorationLine: 'none',
  },
}));
