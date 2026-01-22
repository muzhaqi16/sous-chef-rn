import React, { useCallback, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import { GlobalBottomSheetBackdrop } from '#components/atoms/GlobalBottomSheetBackdrop';
import { BottomSheetKeyboardAwareScrollView } from '#components/atoms';
import { commonStyles } from '#/styles/commonStyles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSharedBottomSheetConfigs, useBottomSheetBackHandler } from '#hooks';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const animationConfigs = useSharedBottomSheetConfigs();
  useBottomSheetBackHandler(bottomSheetRef, visible);

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
      bottomSheetRef.current?.present();
    } else {
      bottomSheetRef.current?.dismiss();
    }
  }, [visible, initialValue, fieldKey, form]);

  const handleSave = useCallback(
    (data: any) => {
      onSave(data[fieldKey]);
      onClose();
    },
    [fieldKey, onSave, onClose],
  );

  const handleCancel = useCallback(() => {
    form.reset();
    onClose();
  }, [form, onClose]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <GlobalBottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
        pressBehavior="close"
      />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      snapPoints={['25%', '50%']}
      index={0}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      onDismiss={onClose}
      animationConfigs={animationConfigs}
      handleIndicatorStyle={{ backgroundColor: theme.colors.border }}
      backgroundStyle={{ backgroundColor: theme.colors.background }}
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
    >
      <BottomSheetKeyboardAwareScrollView
        style={commonStyles.bottomSheetScrollView}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 16 }]}
        showsVerticalScrollIndicator={false}
        bottomOffset={16}
      >
        {/* Header with Cancel/Save at TOP */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleCancel}
            style={styles.headerButton}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text
              style={[styles.cancelText, { color: theme.colors.textSecondary }]}
            >
              Cancel
            </Text>
          </TouchableOpacity>

          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
            {title}
          </Text>

          <TouchableOpacity
            onPress={form.handleSubmit(handleSave)}
            style={styles.headerButton}
            accessibilityRole="button"
            accessibilityLabel="Save"
          >
            <Text style={[styles.saveText, { color: theme.colors.primary }]}>
              Save
            </Text>
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View
          style={[styles.divider, { backgroundColor: theme.colors.border }]}
        />

        {/* Input Field */}
        <View style={styles.inputContainer}>
          {label && (
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
                {fieldState.error && (
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
      </BottomSheetKeyboardAwareScrollView>
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
    fontWeight: '600',
    textAlign: 'center',
    flex: 1,
  },
  cancelText: {
    fontSize: theme.typography.fontSize.md,
  },
  saveText: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: '600',
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
    fontWeight: '500',
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
}));

export default TextEditBottomSheet;
