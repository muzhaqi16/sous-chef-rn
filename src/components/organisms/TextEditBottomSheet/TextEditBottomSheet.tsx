import React from 'react';
import { View } from 'react-native';
import { useTranslation } from '#i18n';
import { StyleSheet } from 'react-native-unistyles';
import { ThemedTextInput } from '#components/atoms/themedComponents';
import { Controller, useForm, type FieldValues } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { object, string, type AnyObjectSchema } from 'yup';
import { reportValidationErrors } from '#utils/validation/common';
import { Text } from '#components/atoms/Text';
import { Sheet } from '#components/templates/Sheet';
import { SheetHeader } from '#components/templates/SheetHeader';
import { SheetHeaderSlot } from '#components/templates/SheetHeaderSlot';
import { useOpening } from '#hooks/ui/useOpening';
import { useSheetUnsavedInput } from '#components/templates/SheetCloseGuard';

/** The keypads a one-field edit offers. */
export type TextEditKeyboardType =
  | 'default'
  | 'email-address'
  | 'numeric'
  | 'phone-pad'
  | 'decimal-pad';

interface TextEditBottomSheetProps {
  visible: boolean;
  title: string;
  label?: string;
  placeholder?: string;
  initialValue: string;
  fieldKey: string;
  validationSchema?: AnyObjectSchema;
  onSave: (value: string) => void;
  onClose: () => void;
  multiline?: boolean;
  maxLength?: number;
  keyboardType?: TextEditKeyboardType;
}

/** Bottom sheet for editing a single text field, validated by a yup schema. */
export const TextEditBottomSheet: React.FC<TextEditBottomSheetProps> = ({
  visible,
  onClose,
  initialValue,
  ...content
}) => {
  // Each opening edits the value as it stood when it opened.
  const opening = useOpening(visible, initialValue);

  return (
    <Sheet
      mode="form"
      visible={visible}
      onDismiss={onClose}
      headerFromContent
      snapPoints={['30%']}
    >
      {opening ? (
        <TextEditForm
          key={opening.id}
          {...content}
          initialValue={opening.payload ?? ''}
          onClose={onClose}
        />
      ) : null}
    </Sheet>
  );
};

/** One opening's edit, from the sheet's one header. */
const TextEditForm: React.FC<Omit<TextEditBottomSheetProps, 'visible'>> = ({
  title,
  label,
  placeholder,
  initialValue,
  fieldKey,
  validationSchema,
  onSave,
  onClose,
  multiline = false,
  maxLength,
  keyboardType = 'default',
}) => {
  const { t } = useTranslation();

  const schema = validationSchema ?? object({ [fieldKey]: string() });

  const form = useForm({
    resolver: yupResolver(schema),
    defaultValues: { [fieldKey]: initialValue },
  });
  useSheetUnsavedInput(form.formState.isDirty);

  const handleSave = (data: FieldValues) => {
    const value: unknown = data[fieldKey];
    onSave(typeof value === 'string' ? value : '');
    onClose();
  };

  const fieldError = form.formState.errors[fieldKey];
  const variantStyles = styles.useVariants({ multiline, error: !!fieldError });

  return (
    <>
      <SheetHeaderSlot>
        <SheetHeader
          title={title}
          onClose={onClose}
          confirm={{
            onPress: () => {
              void form.handleSubmit(handleSave, reportValidationErrors)();
            },
            accessibilityLabel: t('labels.save'),
          }}
        />
      </SheetHeaderSlot>
      <View style={variantStyles.inputContainer}>
        {!!label && (
          <Text role="label" tone="secondary" style={variantStyles.label}>
            {label}
          </Text>
        )}

        <Controller
          control={form.control}
          name={fieldKey}
          render={({ field, fieldState }) => (
            <View>
              <ThemedTextInput
                ref={field.ref}
                style={variantStyles.input}
                value={
                  typeof field.value === 'string' ? field.value : undefined
                }
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                placeholder={placeholder}
                autoFocus
                multiline={multiline}
                maxLength={maxLength}
                keyboardType={keyboardType}
                textAlignVertical={multiline ? 'top' : 'center'}
              />
              {!!fieldState.error && (
                <Text role="error" tone="error" style={variantStyles.errorText}>
                  {fieldState.error.message}
                </Text>
              )}
            </View>
          )}
        />
      </View>
    </>
  );
};

const styles = StyleSheet.create(theme => ({
  inputContainer: {
    marginBottom: theme.spacing.md,
  },
  label: {
    marginBottom: theme.spacing.sm,
  },
  input: {
    ...theme.type.body,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    borderWidth: theme.borderWidth.hairline,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.surfaceVariant,
    borderColor: theme.colors.border,
    variants: {
      multiline: {
        true: {
          minHeight: 100,
          paddingTop: theme.spacing.md,
        },
      },
      error: {
        true: { borderColor: theme.colors.error },
      },
    },
  },
  errorText: {
    marginTop: theme.spacing.xs,
  },
}));
