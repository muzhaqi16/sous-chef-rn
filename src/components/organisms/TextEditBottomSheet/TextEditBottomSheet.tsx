import React, { useEffect } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { StyleSheet } from 'react-native-unistyles';
import { ThemedBottomSheetTextInput } from '#components/atoms/themedComponents';
import { Controller, useForm, type FieldValues } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { object, string, type AnyObjectSchema } from 'yup';
import { Button } from '#components/molecules/Button';
import { logValidationErrors } from '#utils/validation/common';
import { Text } from '#components/atoms/Text';
import { Divider } from '#components/atoms/Divider';
import { Sheet } from '#components/templates/Sheet';

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
  keyboardType?:
    | 'default'
    | 'email-address'
    | 'numeric'
    | 'phone-pad'
    | 'decimal-pad';
}

/** Bottom sheet for editing a single text field, validated by a yup schema. */
export const TextEditBottomSheet: React.FC<TextEditBottomSheetProps> = ({
  visible,
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

  const schema = validationSchema || object({ [fieldKey]: string() });

  const form = useForm({
    resolver: yupResolver(schema),
    defaultValues: { [fieldKey]: initialValue },
  });

  useEffect(() => {
    if (visible) {
      form.reset({ [fieldKey]: initialValue });
    }
  }, [visible, initialValue, fieldKey, form]);

  const handleSave = (data: FieldValues) => {
    onSave(data[fieldKey]);
    onClose();
  };

  const handleCancel = () => {
    form.reset();
    onClose();
  };

  const fieldError = form.formState.errors[fieldKey];
  styles.useVariants({ multiline, error: !!fieldError });

  return (
    <Sheet
      mode="view"
      visible={visible}
      onDismiss={onClose}
      snapPoints={['30%']}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <Button
          variant="ghost"
          size="small"
          onPress={handleCancel}
          accessibilityLabel={t('labels.cancel')}
        >
          {t('labels.cancel')}
        </Button>

        <Text role="heading" align="center" style={styles.title}>
          {title}
        </Text>

        <Button
          variant="ghost"
          size="small"
          onPress={form.handleSubmit(handleSave, logValidationErrors)}
          accessibilityLabel={t('labels.save')}
        >
          {t('labels.save')}
        </Button>
      </View>

      <Divider style={styles.divider} />

      <View style={styles.inputContainer}>
        {!!label && (
          <Text role="label" tone="secondary" style={styles.label}>
            {label}
          </Text>
        )}

        <Controller
          control={form.control}
          name={fieldKey}
          render={({ field, fieldState }) => (
            <View>
              <ThemedBottomSheetTextInput
                style={styles.input}
                value={field.value}
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
                <Text role="caption" tone="error" style={styles.errorText}>
                  {fieldState.error.message}
                </Text>
              )}
            </View>
          )}
        />
      </View>
    </Sheet>
  );
};

const styles = StyleSheet.create(theme => ({
  content: {
    paddingHorizontal: theme.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
  },
  title: {
    flex: 1,
  },
  divider: {
    marginBottom: theme.spacing.lg,
  },
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

export default TextEditBottomSheet;
