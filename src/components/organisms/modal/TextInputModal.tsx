import React, {useState, useEffect} from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  TextInputProps,
} from 'react-native';

import {TextInputModalProps, ValidationRule} from './types';

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
      presentationStyle="overFullScreen">
      <KeyboardAvoidingView
        style={styles.centeredView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.modalView}>
          <Text style={styles.title}>{title}</Text>

          <TextInput
            style={[
              styles.input,
              multiline && styles.multilineInput,
              error ? {borderColor: errorColor} : {},
            ]}
            placeholder={placeholder}
            placeholderTextColor="#999"
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
            <Text style={[styles.errorText, {color: errorColor}]}>{error}</Text>
          ) : null}

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleClose}
              disabled={isSubmitting}>
              <Text style={styles.cancelButtonText}>{cancelText}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                styles.submitButton,
                {backgroundColor: primaryColor},
                isSubmitting && styles.disabledButton,
              ]}
              onPress={handleSubmit}
              disabled={isSubmitting || loading}>
              {isSubmitting || loading ? (
                <ActivityIndicator size="small" color="#FFF" />
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

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalView: {
    margin: 20,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    minWidth: 300,
    maxWidth: '90%',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
    color: '#000',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 8,
    color: '#000',
    backgroundColor: '#FAFAFA',
  },
  multilineInput: {
    minHeight: 80,
    maxHeight: 120,
  },
  errorText: {
    fontSize: 12,
    marginBottom: 12,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  button: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  cancelButton: {
    backgroundColor: '#F0F0F0',
    marginRight: 8,
  },
  submitButton: {
    marginLeft: 8,
  },
  disabledButton: {
    opacity: 0.6,
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
