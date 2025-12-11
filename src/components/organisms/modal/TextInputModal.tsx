import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { TextInputModalProps } from './types';

export const TextInputModal: React.FC<TextInputModalProps> = ({
  visible,
  onClose,
  onSubmit,
  title = 'Enter Text',
  placeholder = 'Enter text',
  submitText = 'Submit',
  cancelText = 'Cancel',
  primaryColor = '#007AFF',
  errorColor = '#FF3B30',
  loading = false,
  initialValue = '',
  validationRules = [],
  textInputProps = {},
  multiline = false,
}) => {
  const [text, setText] = useState(initialValue);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setText(initialValue);
      setError('');
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

  const handleSubmit = async () => {
    const trimmedText = text.trim();
    const validationError = validateText(text);

    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      await onSubmit(trimmedText);
      handleClose();
    } catch (err) {
      setError('Operation failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
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
              styles.input,
              multiline && styles.multilineInput,
              error ? { borderColor: errorColor } : {},
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
            <Text style={[styles.errorText, { color: errorColor }]}>
              {error}
            </Text>
          ) : null}

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleClose}
              disabled={isSubmitting}
            >
              <Text style={styles.cancelButtonText}>{cancelText}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                styles.submitButton,
                { backgroundColor: primaryColor },
                isSubmitting && styles.disabledButton,
              ]}
              onPress={handleSubmit}
              disabled={isSubmitting || loading}
            >
              {isSubmitting || loading ? (
                <ActivityIndicator size="small" color={styles.submitButtonText.color} />
              ) : (
                <Text style={styles.submitButtonText}>{submitText}</Text>
              )}
            </TouchableOpacity>
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
    shadowColor: theme.colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: theme.spacing.xs,
    elevation: 5,
    minWidth: 300,
    maxWidth: '90%',
  },
  title: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: '600',
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
  button: {
    flex: 1,
    padding: theme.spacing['3'],
    borderRadius: theme.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: theme.sizes.button.md,
  },
  cancelButton: {
    backgroundColor: theme.colors.background,
    marginRight: theme.spacing.sm,
  },
  submitButton: {
    marginLeft: theme.spacing.sm,
  },
  disabledButton: {
    opacity: 0.6,
  },
  cancelButtonText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.fontSize.base,
    fontWeight: '500',
  },
  submitButtonText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.base,
    fontWeight: '600',
  },
}));
