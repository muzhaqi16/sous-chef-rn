import React, {useState} from 'react';
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
} from 'react-native';

interface EmailInputModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (email: string) => Promise<void> | void;
  title?: string;
  placeholder?: string;
  submitText?: string;
  cancelText?: string;
  primaryColor?: string;
  errorColor?: string;
  loading?: boolean;
}

export const EmailInputModal: React.FC<EmailInputModalProps> = ({
  visible,
  onClose,
  onSubmit,
  title = 'Invite Member',
  placeholder = 'Enter email address',
  submitText = 'Send Invite',
  cancelText = 'Cancel',
  primaryColor = '#007AFF',
  errorColor = '#FF3B30',
  loading = false,
}) => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setError('Please enter an email address');
      return;
    }

    if (!validateEmail(trimmedEmail)) {
      setError('Please enter a valid email address');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      await onSubmit(trimmedEmail);
      // Only close on success
      handleClose();
    } catch (err: any) {
      console.log('❌ Modal caught error:', err);
      // Extract the actual error message from the API
      let errorMessage = 'Failed to send invite. Please try again.';

      // Try different ways to extract the error message
      if (err?.message) {
        errorMessage = err.message.replace('ApolloError: ', '');
      } else if (err?.graphQLErrors?.length > 0) {
        errorMessage = err.graphQLErrors[0].message;
      } else if (err?.networkError?.message) {
        errorMessage = err.networkError.message;
      } else if (typeof err === 'string') {
        errorMessage = err;
      }

      setError(errorMessage);
      // Don't close the modal on error - keep it open for retry
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setEmail('');
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
      <View style={styles.centeredView}>
        <View style={styles.modalView}>
          <Text style={styles.title}>{title}</Text>

          <TextInput
            style={[styles.input, error ? {borderColor: errorColor} : {}]}
            placeholder={placeholder}
            placeholderTextColor="#999"
            value={email}
            onChangeText={text => {
              setEmail(text);
              if (error) setError(''); // Clear error when user types
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isSubmitting}
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
      </View>
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
