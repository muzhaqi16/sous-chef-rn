import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Controller, useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import type { TranslationKey } from '#i18n';
import { BaseInput } from '#components/molecules/BaseInput/BaseInput';
import { Button } from '#components/molecules/Button';
import { reportValidationErrors } from '#utils/validation/common';
import {
  codeEntrySchema,
  type CodeEntryFormValues,
} from './codeEntryFormConfig';

interface CodeEntryFormProps {
  defaultCode?: string;
  placeholder: string;
  submitLabel: string;
  /** Shown on the field when it is submitted blank. */
  requiredMessage: TranslationKey;
  /** Receives the trimmed code; a blank one never reaches it. */
  onSubmit: (code: string) => void;
  submitting?: boolean;
}

/** A share or join code typed in full width, and the one action it starts. */
export const CodeEntryForm: React.FC<CodeEntryFormProps> = ({
  defaultCode = '',
  placeholder,
  submitLabel,
  requiredMessage,
  onSubmit,
  submitting = false,
}) => {
  const { control, handleSubmit } = useForm<CodeEntryFormValues>({
    resolver: yupResolver(codeEntrySchema(requiredMessage)),
    defaultValues: { code: defaultCode },
  });
  const submit = handleSubmit(({ code }) => {
    onSubmit(code);
  }, reportValidationErrors);

  return (
    <View style={styles.form}>
      <Controller
        control={control}
        name="code"
        render={({ field, fieldState }) => (
          <BaseInput
            containerStyle={styles.inputContainer}
            style={styles.inputText}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            placeholder={placeholder}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!submitting}
            errorMessage={fieldState.error?.message}
          />
        )}
      />
      <Button
        title={submitLabel}
        onPress={() => {
          void submit();
        }}
        loading={submitting}
      />
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  form: {
    alignSelf: 'stretch',
  },
  inputContainer: {
    marginBottom: theme.spacing.lg,
  },
  inputText: {
    textAlign: 'center',
    letterSpacing: 2,
    ...theme.type.heading,
  },
}));
