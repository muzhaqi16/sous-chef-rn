import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import {
  BottomSheetModal,
  BottomSheetTextInput,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { StyleSheet } from 'react-native-unistyles';
import { Controller, useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { object, string, type AnyObjectSchema } from 'yup';

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
  const { ref, modalProps, contentContainerStyle, theme } =
    useStandardBottomSheet({
      visible,
      onDismiss: onClose,
      snapPoints: ['30%'],
      keyboardBehavior: 'interactive',
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

  return (
    <BottomSheetModal ref={ref} {...modalProps} index={0}>
      <BottomSheetView style={[styles.content, contentContainerStyle]}>
        {/* Header with Cancel/Save at TOP */}
        <View style={styles.header}>
          <Pressable
            onPress={handleCancel}
            style={({ pressed }) => [
              styles.headerButton,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text
              style={[styles.cancelText, { color: theme.colors.textSecondary }]}
            >
              Cancel
            </Text>
          </Pressable>

          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
            {title}
          </Text>

          <Pressable
            onPress={() => form.handleSubmit(handleSave)()}
            style={({ pressed }) => [
              styles.headerButton,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Save"
          >
            <Text style={[styles.saveText, { color: theme.colors.primary }]}>
              Save
            </Text>
          </Pressable>
        </View>

        {/* Divider */}
        <View
          style={[styles.divider, { backgroundColor: theme.colors.border }]}
        />

        {/* Input Field */}
        <View style={styles.inputContainer}>
          {!!label && (
            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
              {label}
            </Text>
          )}

          <Controller
            control={form.control}
            name={fieldKey}
            render={({ field, fieldState }) => (
              <View>
                <BottomSheetTextInput
                  style={[
                    styles.input,
                    multiline && styles.inputMultiline,
                    {
                      color: theme.colors.textPrimary,
                      backgroundColor: theme.colors.surfaceVariant,
                      borderColor: fieldState.error
                        ? theme.colors.error
                        : theme.colors.border,
                    },
                  ]}
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  placeholder={placeholder}
                  placeholderTextColor={theme.colors.textTertiary}
                  autoFocus
                  multiline={multiline}
                  maxLength={maxLength}
                  keyboardType={keyboardType}
                  textAlignVertical={multiline ? 'top' : 'center'}
                />
                {!!fieldState.error && (
                  <Text
                    style={[styles.errorText, { color: theme.colors.error }]}
                  >
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
  headerButton: {
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.xs,
    minWidth: 60,
  },
  title: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.fonts.weight.semibold,
    textAlign: 'center',
    flex: 1,
  },
  cancelText: {
    fontSize: theme.typography.fontSize.md,
  },
  saveText: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.fonts.weight.semibold,
    textAlign: 'right',
  },
  divider: {
    height: 1,
    marginBottom: theme.spacing.lg,
  },
  inputContainer: {
    marginBottom: theme.spacing.md,
  },
  label: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.fonts.weight.medium,
    marginBottom: theme.spacing.sm,
  },
  input: {
    fontSize: theme.typography.fontSize.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderWidth: 1,
  },
  inputMultiline: {
    minHeight: 100,
    paddingTop: theme.spacing.md,
  },
  errorText: {
    fontSize: theme.typography.fontSize.sm,
    marginTop: theme.spacing.xs,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));

export default TextEditBottomSheet;
