import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Pressable } from '#components/atoms/themedComponents';
import { StyleSheet } from 'react-native-unistyles';
import {
  ThemedTextInput,
  WhiteActivityIndicator as ThemedActivityIndicator,
} from '#components/atoms/themedComponents';

import { TextInputModalProps } from './types';
import { executeWithLoadingState } from '#/utils/compilerSafeWrappers';

/** Module-level helper to initialize text input modal state */
function initTextInputModal(
  initialValue: string,
  setText: (v: string) => void,
  setError: (v: string) => void,
) {
  setText(initialValue);
  setError('');
}

export const TextInputModal: React.FC<TextInputModalProps> = ({
  visible,
  onClose,
  onSubmit,
  title,
  placeholder,
  submitText,
  cancelText,
  primaryColor,
  errorColor,
  loading = false,
  initialValue = '',
  validationRules = [],
  textInputProps = {},
  multiline = false,
}) => {
  const { t } = useTranslation();
  const resolvedTitle = title ?? t('textInputModal.title');
  const resolvedPlaceholder = placeholder ?? t('textInputModal.placeholder');
  const resolvedSubmitText = submitText ?? t('textInputModal.submit');
  const resolvedCancelText = cancelText ?? t('labels.cancel');
  const [text, setText] = useState(initialValue);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const errorOverrideStyle = errorColor ? { color: errorColor } : undefined;
  const errorBorderOverrideStyle = errorColor
    ? { borderColor: errorColor }
    : undefined;
  const primaryOverrideStyle = primaryColor
    ? { backgroundColor: primaryColor }
    : undefined;
  styles.useVariants({ hasError: !!error });

  useEffect(() => {
    if (visible) {
      initTextInputModal(initialValue, setText, setError);
    }
  }, [visible, initialValue]);

  const validateText = (value: string) => {
    const trimmedValue = value.trim();

    // Check if empty
    if (!trimmedValue) {
      return t('textInputModal.required');
    }

    // Run custom validation rules
    for (const rule of validationRules) {
      if (!rule.test(trimmedValue)) {
        return rule.message;
      }
    }

    return null;
  };

  const handleSubmit = () => {
    const trimmedText = text.trim();
    const validationError = validateText(text);

    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');

    executeWithLoadingState(
      async () => {
        await onSubmit(trimmedText);
        handleClose();
      },
      setIsSubmitting,
      () => {
        setError(t('textInputModal.submitFailed'));
      },
    );
  };

  const handleClose = () => {
    setText(initialValue);
    setError('');
    onClose();
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={handleClose}
      statusBarTranslucent={true}
      navigationBarTranslucent={true}
      presentationStyle="overFullScreen"
    >
      <KeyboardAvoidingView
        style={styles.centeredView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.modalView}>
          <Text style={styles.title}>{resolvedTitle}</Text>

          <ThemedTextInput
            style={[
              multiline ? styles.multilineInput : styles.input,
              errorBorderOverrideStyle,
            ]}
            placeholder={resolvedPlaceholder}
            value={text}
            onChangeText={newText => {
              setText(newText);
              setError('');
            }}
            editable={!isSubmitting}
            multiline={multiline}
            numberOfLines={multiline ? 4 : 1}
            textAlignVertical={multiline ? 'top' : 'center'}
            {...textInputProps}
          />

          {error ? (
            <Text style={[styles.errorText, errorOverrideStyle]}>{error}</Text>
          ) : null}

          <View style={styles.buttonContainer}>
            <Pressable
              style={({ pressed }) => [
                styles.cancelButton,
                pressed && styles.pressed,
              ]}
              onPress={handleClose}
              disabled={isSubmitting}
            >
              <Text style={styles.cancelButtonText}>{resolvedCancelText}</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.submitButton,
                primaryOverrideStyle,
                isSubmitting && styles.disabledButton,
                pressed && styles.pressed,
              ]}
              onPress={handleSubmit}
              disabled={isSubmitting || loading}
            >
              {isSubmitting || loading ? (
                <ThemedActivityIndicator size="small" />
              ) : (
                <Text style={styles.submitButtonText}>
                  {resolvedSubmitText}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create(theme => ({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.overlays.medium,
  },
  modalView: {
    margin: theme.spacing['5'],
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: theme.spacing['5'],
    boxShadow: [
      {
        offsetX: 0,
        offsetY: 2,
        blurRadius: theme.spacing.xs,
        spreadDistance: 0,
        color: 'rgba(0, 0, 0, 0.25)',
      },
    ],
    minWidth: 300,
    maxWidth: '90%',
  },
  title: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.fonts.weight.semibold,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
    color: theme.colors.textPrimary,
  },
  input: {
    borderWidth: 1,
    borderRadius: theme.radii.md,
    padding: theme.spacing['3'],
    fontSize: theme.typography.fontSize.base,
    marginBottom: theme.spacing.sm,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.background,
    variants: {
      hasError: {
        true: { borderColor: theme.colors.error },
        false: { borderColor: theme.colors.border },
      },
    },
  },
  multilineInput: {
    borderWidth: 1,
    borderRadius: theme.radii.md,
    padding: theme.spacing['3'],
    fontSize: theme.typography.fontSize.base,
    marginBottom: theme.spacing.sm,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.background,
    minHeight: theme.spacing['2xl'] + theme.spacing.xl,
    maxHeight: theme.spacing['3xl'] * 2,
    variants: {
      hasError: {
        true: { borderColor: theme.colors.error },
        false: { borderColor: theme.colors.border },
      },
    },
  },
  errorText: {
    fontSize: theme.typography.fontSize.xs,
    marginBottom: theme.spacing['3'],
    color: theme.colors.error,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: theme.spacing['3'],
  },
  cancelButton: {
    flex: 1,
    padding: theme.spacing['3'],
    borderRadius: theme.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: theme.sizes.button.md,
    backgroundColor: theme.colors.background,
    marginRight: theme.spacing.sm,
  },
  submitButton: {
    flex: 1,
    padding: theme.spacing['3'],
    borderRadius: theme.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: theme.sizes.button.md,
    marginLeft: theme.spacing.sm,
    backgroundColor: theme.colors.primary,
  },
  disabledButton: {
    opacity: theme.opacity.disabled,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
  cancelButtonText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.fonts.weight.medium,
  },
  submitButtonText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.fonts.weight.semibold,
  },
}));
