import React, { useEffect } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { BottomSheetModal } from '#hooks/useStandardBottomSheet';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { StyleSheet } from 'react-native-unistyles';
import { ThemedBottomSheetTextInput } from '#components/atoms/themedComponents';
import { Controller, useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { object, string, type AnyObjectSchema } from 'yup';
import { Button } from '#components/base/Button';
import { logValidationErrors } from '#utils/validation/common';
import { Text } from '#components/atoms/Text';

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

/**
 * TextEditBottomSheet - Reusable bottom sheet for editing text fields
 *
 * Features:
 * - Cancel/Save buttons at TOP for consistency
 * - Proper keyboard handling with BottomSheetTextInput
 * - Validation support via yup schema
 * - Dynamic sizing based on content
 */
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
  const { ref, modalProps, contentContainerStyle } = useStandardBottomSheet({
    visible,
    onDismiss: onClose,
    snapPoints: ['30%'],
  });

  // Default schema if none provided
  const schema = validationSchema || object({ [fieldKey]: string() });

  const form = useForm({
    resolver: yupResolver(schema),
    defaultValues: { [fieldKey]: initialValue },
  });

  // Reset form when sheet opens with new value
  useEffect(() => {
    if (visible) {
      form.reset({ [fieldKey]: initialValue });
    }
  }, [visible, initialValue, fieldKey, form]);

  const handleSave = (data: any) => {
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
    <BottomSheetModal ref={ref} {...modalProps} index={0}>
      <BottomSheetView style={[styles.content, contentContainerStyle]}>
        {/* Header with Cancel/Save at TOP */}
        <View style={styles.header}>
          <Button
            variant="ghost"
            size="small"
            onPress={handleCancel}
            accessibilityLabel={t('textEditBottomSheet.cancel')}
          >
            {t('textEditBottomSheet.cancel')}
          </Button>

          <Text size="lg" weight="semibold" align="center" style={styles.title}>
            {title}
          </Text>

          <Button
            variant="ghost"
            size="small"
            onPress={form.handleSubmit(handleSave, logValidationErrors)}
            accessibilityLabel={t('textEditBottomSheet.save')}
          >
            {t('textEditBottomSheet.save')}
          </Button>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Input Field */}
        <View style={styles.inputContainer}>
          {!!label && (
            <Text
              size="sm"
              weight="medium"
              tone="secondary"
              style={styles.label}
            >
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
                  <Text size="sm" tone="error" style={styles.errorText}>
                    {fieldState.error.message}
                  </Text>
                )}
              </View>
            )}
          />
        </View>
      </BottomSheetView>
    </BottomSheetModal>
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
    height: 1,
    marginBottom: theme.spacing.lg,
    backgroundColor: theme.colors.border,
  },
  inputContainer: {
    marginBottom: theme.spacing.md,
  },
  label: {
    marginBottom: theme.spacing.sm,
  },
  input: {
    fontSize: theme.typography.fontSize.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderWidth: 1,
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
