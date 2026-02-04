import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { MembershipRole } from '#generated';
import { useIsEffectivelyOffline } from '#hooks/settings/useOfflineMode';

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
  const isOffline = useIsEffectivelyOffline();

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async () => {
    if (isOffline) {
      setError('Cannot send invite while offline');
      return;
    }

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
              placeholderTextColor={theme.colors.textSecondary}
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
                  (isSubmitting || isOffline) && styles.disabledButton,
                ]}
                onPress={handleSubmit}
                disabled={isSubmitting || isOffline}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color={theme.colors.white} />
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
    width: '90%',
    maxHeight: '80%',
    ...theme.shadows.lg,
  },
  title: {
    fontSize: theme.typography.fontSize.lg + 2,
    fontWeight: '600',
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
    color: theme.colors.textPrimary,
  },
  label: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  roleLabel: {
    marginTop: theme.spacing.md,
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
  roleOption: {
    borderWidth: 2,
    borderRadius: theme.radii.md,
    padding: theme.spacing['3'],
    marginBottom: theme.spacing['3'],
    backgroundColor: theme.colors.inputBackground,
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
    marginBottom: theme.spacing.xs,
  },
  roleIcon: {
    fontSize: theme.typography.fontSize.xl,
  },
  radioContainer: {
    position: 'absolute',
    right: 0,
    top: 0,
  },
  radioOuter: {
    width: theme.sizes.icon.md,
    height: theme.sizes.icon.md,
    borderRadius: theme.radii.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: theme.sizes.icon.sm,
    height: theme.sizes.icon.sm,
    borderRadius: theme.radii.full,
  },
  roleOptionLabel: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  roleDescription: {
    fontSize: theme.typography.fontSize.sm - 1,
    color: theme.colors.textSecondary,
    lineHeight: theme.typography.lineHeight.tight,
  },
  warningText: {
    fontSize: theme.typography.fontSize.xs,
    marginTop: theme.spacing.xs + 2,
    fontWeight: '500',
  },
  errorText: {
    fontSize: theme.typography.fontSize.xs,
    marginBottom: theme.spacing['3'],
    marginTop: theme.spacing.xs,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: theme.spacing.md,
  },
  button: {
    flex: 1,
    padding: theme.spacing['3'] + 2,
    borderRadius: theme.radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: theme.sizes.input.md,
  },
  cancelButton: {
    backgroundColor: theme.colors.surfaceVariant,
    marginRight: theme.spacing.sm,
  },
  submitButton: {
    marginLeft: theme.spacing.sm,
  },
  disabledButton: {
    opacity: 0.6,
  },
  cancelButtonText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.md,
    fontWeight: '500',
  },
  submitButtonText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.md,
    fontWeight: '600',
  },
}));
