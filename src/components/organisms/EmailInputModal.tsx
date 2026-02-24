import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useUnistyles } from 'react-native-unistyles';

interface EmailInputModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (email: string) => Promise<void> | void;
  title?: string;
  placeholder?: string;
  submitText?: string;
  cancelText?: string;
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
  loading = false,
}) => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { theme } = useUnistyles();

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
      presentationStyle="overFullScreen"
    >
      <View style={styles.centeredView}>
        <View style={styles.modalView}>
          <Text style={styles.title}>{title}</Text>

          <TextInput
            style={[
              styles.input,
              error ? { borderColor: theme.colors.error } : {},
            ]}
            placeholder={placeholder}
            placeholderTextColor={theme.colors.textTertiary}
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
            <Text style={[styles.errorText, { color: theme.colors.error }]}>
              {error}
            </Text>
          ) : null}

          <View style={styles.buttonContainer}>
            <Pressable
              style={({pressed}) => [styles.button, styles.cancelButton, pressed && styles.pressed]}
              onPress={handleClose}
              disabled={isSubmitting}
            >
              <Text style={styles.cancelButtonText}>{cancelText}</Text>
            </Pressable>

            <Pressable
              style={({pressed}) => [
                styles.button,
                styles.submitButton,
                { backgroundColor: theme.colors.primary },
                isSubmitting && styles.disabledButton,
                pressed && styles.pressed,
              ]}
              onPress={handleSubmit}
              disabled={isSubmitting || loading}
            >
              {isSubmitting || loading ? (
                <ActivityIndicator size="small" color={theme.colors.white} />
              ) : (
                <Text style={styles.submitButtonText}>{submitText}</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
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
    margin: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    padding: theme.spacing.lg,
    minWidth: 300,
    maxWidth: '90%',
    ...theme.shadows.lg,
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
    borderRadius: theme.radii.sm,
    padding: theme.spacing['3'],
    fontSize: theme.typography.fontSize.md,
    marginBottom: theme.spacing.sm,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.inputBackground,
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
    borderRadius: theme.radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: theme.sizes.input.md - 4,
  },
  cancelButton: {
    backgroundColor: theme.colors.surfaceVariant,
    marginRight: theme.spacing.sm,
  },
  submitButton: {
    marginLeft: theme.spacing.sm,
  },
  disabledButton: {
    opacity: theme.opacity.disabled,
  },
  cancelButtonText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.fonts.weight.medium,
  },
  submitButtonText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.fonts.weight.semibold,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
