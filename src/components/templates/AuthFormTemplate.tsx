import React from 'react';
import {View, Text, TouchableOpacity} from 'react-native';
import {createStyleSheet, useStyles} from 'react-native-unistyles';
import type {FieldValues, Control, FieldErrors} from 'react-hook-form';
import {DynamicFormFields, FieldDef} from '../molecules/DynamicFormFields';

interface Props<T extends FieldValues> {
  title: string;
  subtitle?: string | React.ReactNode;
  onBackPress?: () => void;
  fields: FieldDef<T>[];
  control: Control<T>;
  errors: FieldErrors<T>;
  submitText: string;
  onSubmit: () => void;
  footerText?: string;
  footerLinkText?: string;
  onFooterLinkPress?: () => void;
  onLinkPress?: () => void;
  linkText?: string;
}
export function AuthFormTemplate<T extends FieldValues>({
  title,
  subtitle,
  onBackPress = undefined,
  fields,
  control,
  errors,
  submitText,
  onSubmit,
  footerText,
  footerLinkText,
  onFooterLinkPress,
  linkText,
  onLinkPress,
}: Props<T>) {
  const {styles} = useStyles(stylesheet);

  return (
    <>
      <View style={styles.header}>
        {onBackPress && (
          <TouchableOpacity onPress={onBackPress} style={styles.headerAction}>
            {/* you could even parametrize the icon */}
            <Text>{'<'}</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>

      <DynamicFormFields<T> fields={fields} control={control} errors={errors} />

      {linkText && onLinkPress && (
        <TouchableOpacity onPress={onLinkPress}>
          <Text style={styles.link}>{linkText}</Text>
        </TouchableOpacity>
      )}

      <View style={styles.action}>
        <TouchableOpacity onPress={onSubmit} style={styles.button}>
          <Text style={styles.buttonText}>{submitText}</Text>
        </TouchableOpacity>
      </View>

      {footerText && footerLinkText && onFooterLinkPress && (
        <TouchableOpacity onPress={onFooterLinkPress}>
          <Text style={styles.footer}>
            {footerText} <Text style={styles.link}>{footerLinkText}</Text>
          </Text>
        </TouchableOpacity>
      )}
    </>
  );
}

const stylesheet = createStyleSheet(theme => ({
  header: {
    paddingHorizontal: 0,
    marginVertical: 28,
  },
  headerAction: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
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
    marginHorizontal: 24,
    fontWeight: '600',
    color: theme.colors.primary,
    textDecorationLine: 'underline',
  },
  action: {
    marginVertical: 24,
    paddingHorizontal: 24,
  },
  button: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: theme.colors.onPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    marginTop: 'auto',
    textAlign: 'center',
    padding: 24,
    color: theme.colors.textSecondary,
  },
}));
