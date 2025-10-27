import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { MembershipRole } from '#generated';

interface InviteUserModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (email: string, role: MembershipRole) => Promise<void> | void;
  title?: string;
  submitText?: string;
  cancelText?: string;
  allowedRoles?: MembershipRole[];
}

const ROLE_OPTIONS = [
  {
    value: MembershipRole.Member,
    label: 'Member',
    description: 'Can add and edit items in pantry',
    icon: '👤',
  },
  {
    value: MembershipRole.Admin,
    label: 'Admin',
    description: 'Can manage members and settings',
    icon: '⚙️',
  },
  {
    value: MembershipRole.Guest,
    label: 'Guest',
    description: 'View-only access to home',
    icon: '👁️',
  },
  {
    value: MembershipRole.Owner,
    label: 'Owner',
    description: 'Full control over home and all members',
    icon: '👑',
    warning: true,
  },
];

export const InviteUserModal: React.FC<InviteUserModalProps> = ({
  visible,
  onClose,
  onSubmit,
  title = 'Invite Member to Home',
  submitText = 'Send Invite',
  cancelText = 'Cancel',
  allowedRoles,
}) => {
  // Filter role options based on allowed roles
  // If no allowedRoles provided, exclude Owner by default (it's reserved for home creators)
  const availableRoleOptions = ROLE_OPTIONS.filter(roleOption => {
    if (allowedRoles) {
      return allowedRoles.includes(roleOption.value);
    }
    // By default, exclude Owner role
    return roleOption.value !== MembershipRole.Owner;
  });

  // Use first available role as default
  const defaultRole =
    availableRoleOptions.length > 0
      ? availableRoleOptions[0].value
      : MembershipRole.Member;

  const [email, setEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState<MembershipRole>(defaultRole);
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
      await onSubmit(trimmedEmail, selectedRole);
      // Only close on success
      handleClose();
    } catch (err: any) {
      // Extract the actual error message from the API
      let errorMessage = 'Failed to send invite. Please try again.';

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
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setEmail('');
    setSelectedRole(defaultRole);
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
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>{title}</Text>

            {/* Email Input */}
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={[
                styles.input,
                error ? { borderColor: theme.colors.error } : {},
              ]}
              placeholder="Enter email address"
              placeholderTextColor="#999"
              value={email}
              onChangeText={text => {
                setEmail(text);
                if (error) setError('');
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isSubmitting}
            />

            {/* Role Selection */}
            <Text style={[styles.label, styles.roleLabel]}>Select Role</Text>
            {availableRoleOptions.map(role => (
              <TouchableOpacity
                key={role.value}
                style={[
                  styles.roleOption,
                  selectedRole === role.value && styles.roleOptionSelected,
                  { borderColor: theme.colors.border },
                  selectedRole === role.value && {
                    borderColor: theme.colors.primary,
                    backgroundColor: `${theme.colors.primary}10`,
                  },
                ]}
                onPress={() => setSelectedRole(role.value)}
                disabled={isSubmitting}
              >
                <View style={styles.roleOptionContent}>
                  <View style={styles.roleHeader}>
                    <Text style={styles.roleIcon}>{role.icon}</Text>
                    <View style={styles.radioContainer}>
                      <View
                        style={[
                          styles.radioOuter,
                          { borderColor: theme.colors.border },
                          selectedRole === role.value && {
                            borderColor: theme.colors.primary,
                          },
                        ]}
                      >
                        {selectedRole === role.value && (
                          <View
                            style={[
                              styles.radioInner,
                              { backgroundColor: theme.colors.primary },
                            ]}
                          />
                        )}
                      </View>
                    </View>
                  </View>
                  <Text style={styles.roleOptionLabel}>{role.label}</Text>
                  <Text style={styles.roleDescription}>{role.description}</Text>
                  {role.warning && selectedRole === role.value && (
                    <Text
                      style={[
                        styles.warningText,
                        { color: theme.colors.warning },
                      ]}
                    >
                      ⚠️ Owners have full control
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}

            {/* Error Message */}
            {error ? (
              <Text style={[styles.errorText, { color: theme.colors.error }]}>
                {error}
              </Text>
            ) : null}

            {/* Action Buttons */}
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
                  { backgroundColor: theme.colors.primary },
                  isSubmitting && styles.disabledButton,
                ]}
                onPress={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.submitButtonText}>{submitText}</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
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
    width: '90%',
    maxHeight: '80%',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
    color: '#000',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  roleLabel: {
    marginTop: 16,
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
  roleOption: {
    borderWidth: 2,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    backgroundColor: '#FAFAFA',
  },
  roleOptionSelected: {
    borderWidth: 2,
  },
  roleOptionContent: {
    position: 'relative',
  },
  roleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  roleIcon: {
    fontSize: 24,
  },
  radioContainer: {
    position: 'absolute',
    right: 0,
    top: 0,
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  roleOptionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  roleDescription: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  warningText: {
    fontSize: 12,
    marginTop: 6,
    fontWeight: '500',
  },
  errorText: {
    fontSize: 12,
    marginBottom: 12,
    marginTop: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  button: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
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
