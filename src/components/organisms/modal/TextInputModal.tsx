import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

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
  title = 'Enter Text',
  placeholder = 'Enter text',
  submitText = 'Submit',
  cancelText = 'Cancel',
  primaryColor,
  errorColor,
  loading = false,
  initialValue = '',
  validationRules = [],
  textInputProps = {},
  multiline = false,
}) => {
  const { theme } = useUnistyles();
  const resolvedPrimaryColor = primaryColor ?? theme.colors.primary;
  const resolvedErrorColor = errorColor ?? theme.colors.error;
  const [text, setText] = useState(initialValue);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      initTextInputModal(initialValue, setText, setError);
    }
  }, [visible, initialValue]);

  const validateText = (value: string) => {
    const trimmedValue = value.trim();

    // Check if empty
    if (!trimmedValue) {
      return 'This field is required';
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
        setError('Operation failed. Please try again.');
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
          <Text style={styles.title}>{title}</Text>

          <TextInput
            style={[
              multiline ? styles.multilineInput : styles.input,
              error ? { borderColor: resolvedErrorColor } : {},
            ]}
            placeholder={placeholder}
            placeholderTextColor={styles.inputPlaceholder.color}
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
            <Text style={[styles.errorText, { color: resolvedErrorColor }]}>
              {error}
            </Text>
          ) : null}

          <View style={styles.buttonContainer}>
            <Pressable
              style={({ pressed }) => [
                styles.cancelButton,
                pressed && { opacity: theme.opacity.pressed },
              ]}
              onPress={handleClose}
              disabled={isSubmitting}
            >
              <Text style={styles.cancelButtonText}>{cancelText}</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.submitButton,
                { backgroundColor: resolvedPrimaryColor },
                isSubmitting && styles.disabledButton,
                pressed && { opacity: theme.opacity.pressed },
              ]}
              onPress={handleSubmit}
              disabled={isSubmitting || loading}
            >
              {isSubmitting || loading ? (
                <ActivityIndicator
                  size="small"
                  color={styles.submitButtonText.color}
                />
              ) : (
                <Text style={styles.submitButtonText}>{submitText}</Text>
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
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    padding: theme.spacing['3'],
    fontSize: theme.typography.fontSize.base,
    marginBottom: theme.spacing.sm,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.background,
  },
  inputPlaceholder: {
    color: theme.colors.textSecondary,
  },
  multilineInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    padding: theme.spacing['3'],
    fontSize: theme.typography.fontSize.base,
    marginBottom: theme.spacing.sm,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.background,
    minHeight: theme.spacing['2xl'] + theme.spacing.xl,
    maxHeight: theme.spacing['3xl'] * 2,
  },
  errorText: {
    fontSize: theme.typography.fontSize.xs,
    marginBottom: theme.spacing['3'],
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
  },
  disabledButton: {
    opacity: theme.opacity.disabled,
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
