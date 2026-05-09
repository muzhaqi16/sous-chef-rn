import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Pressable,
} from 'react-native';
import { StyleSheet, withUnistyles } from 'react-native-unistyles';
import { MembershipRole } from '#/graphql/generated/schemaTypes';
import { useIsEffectivelyOffline } from '#hooks/settings/useOfflineMode';
import { executeWithLoadingState } from '#/utils/compilerSafeWrappers';

const ThemedActivityIndicator = withUnistyles(ActivityIndicator, theme => ({
  color: theme.colors.white,
}));

const ThemedTextInput = withUnistyles(TextInput, theme => ({
  placeholderTextColor: theme.colors.textSecondary,
}));

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

interface RoleOptionProps {
  role: (typeof ROLE_OPTIONS)[number];
  selected: boolean;
  onPress: () => void;
  disabled: boolean;
}

const RoleOption: React.FC<RoleOptionProps> = ({
  role,
  selected,
  onPress,
  disabled,
}) => {
  styles.useVariants({ selected });
  return (
    <Pressable
      style={({ pressed }) => [styles.roleOption, pressed && styles.pressed]}
      onPress={onPress}
      disabled={disabled}
    >
      <View style={styles.roleOptionContent}>
        <View style={styles.roleHeader}>
          <View style={styles.roleHeaderLeft}>
            <Text style={styles.roleIcon}>{role.icon}</Text>
            <Text style={styles.roleOptionLabel}>{role.label}</Text>
          </View>
          <View style={styles.radioContainer}>
            <View style={styles.radioOuter}>
              {selected ? <View style={styles.radioInner} /> : null}
            </View>
          </View>
        </View>
        <Text style={styles.roleDescription}>{role.description}</Text>
        {!!role.warning && selected ? (
          <Text style={styles.warningText}>
            {'⚠️ Owners have full control'}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
};

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

  const isOffline = useIsEffectivelyOffline();

  styles.useVariants({ hasError: !!error });

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = () => {
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

    executeWithLoadingState(
      async () => {
        await onSubmit(trimmedEmail, selectedRole);
        // Only close on success
        handleClose();
      },
      setIsSubmitting,
      (err: unknown) => {
        // Extract the actual error message from the API
        let errorMessage = 'Failed to send invite. Please try again.';
        const error = err as any;

        if (error?.message) {
          errorMessage = error.message.replace('ApolloError: ', '');
        } else if (error?.graphQLErrors?.length > 0) {
          errorMessage = error.graphQLErrors[0].message;
        } else if (error?.networkError?.message) {
          errorMessage = error.networkError.message;
        } else if (typeof error === 'string') {
          errorMessage = error;
        }

        setError(errorMessage);
      },
    );
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
      navigationBarTranslucent={true}
      presentationStyle="overFullScreen"
    >
      <View style={styles.centeredView}>
        <View style={styles.modalView}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>{title}</Text>

            {/* Email Input */}
            <Text style={styles.label}>Email Address</Text>
            <ThemedTextInput
              style={styles.input}
              placeholder="Enter email address"
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
            <Text style={styles.roleSectionLabel}>Select Role</Text>
            {availableRoleOptions.map(role => (
              <RoleOption
                key={role.value}
                role={role}
                selected={selectedRole === role.value}
                onPress={() => setSelectedRole(role.value)}
                disabled={isSubmitting}
              />
            ))}

            {/* Error Message */}
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {/* Action Buttons */}
            <View style={styles.buttonContainer}>
              <Pressable
                style={({ pressed }) => [
                  styles.cancelButton,
                  pressed && styles.pressed,
                ]}
                onPress={handleClose}
                disabled={isSubmitting}
              >
                <Text style={styles.cancelButtonText}>{cancelText}</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.submitButton,
                  (isSubmitting || isOffline) && styles.disabledButton,
                  pressed && styles.pressed,
                ]}
                onPress={handleSubmit}
                disabled={isSubmitting || isOffline}
              >
                {isSubmitting ? (
                  <ThemedActivityIndicator size="small" />
                ) : (
                  <Text style={styles.submitButtonText}>{submitText}</Text>
                )}
              </Pressable>
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
    fontWeight: theme.fonts.weight.semibold,
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
    color: theme.colors.textPrimary,
  },
  label: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  roleSectionLabel: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  input: {
    borderWidth: 1,
    borderRadius: theme.radii.sm,
    padding: theme.spacing['3'],
    fontSize: theme.typography.fontSize.md,
    marginBottom: theme.spacing.sm,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.inputBackground,
    variants: {
      hasError: {
        true: { borderColor: theme.colors.error },
        false: { borderColor: theme.colors.border },
      },
    },
  },
  roleOption: {
    borderWidth: 2,
    borderRadius: theme.radii.md,
    padding: theme.spacing['3'],
    marginBottom: theme.spacing['3'],
    variants: {
      selected: {
        true: {
          borderColor: theme.colors.primary,
          backgroundColor: theme.colors.primary + '10',
        },
        false: {
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.inputBackground,
        },
      },
    },
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
  radioContainer: {},
  radioOuter: {
    width: theme.sizes.icon.md,
    height: theme.sizes.icon.md,
    borderRadius: theme.radii.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    variants: {
      selected: {
        true: { borderColor: theme.colors.primary },
        false: { borderColor: theme.colors.border },
      },
    },
  },
  radioInner: {
    width: theme.sizes.icon.sm,
    height: theme.sizes.icon.sm,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.primary,
  },
  roleHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  roleOptionLabel: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
  },
  roleDescription: {
    fontSize: theme.typography.fontSize.sm - 1,
    color: theme.colors.textSecondary,
    lineHeight: theme.typography.lineHeight.tight,
  },
  warningText: {
    fontSize: theme.typography.fontSize.xs,
    marginTop: theme.spacing.xs + 2,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.warning,
  },
  errorText: {
    fontSize: theme.typography.fontSize.xs,
    marginBottom: theme.spacing['3'],
    marginTop: theme.spacing.xs,
    color: theme.colors.error,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: theme.spacing.md,
  },
  cancelButton: {
    flex: 1,
    padding: theme.spacing['3'] + 2,
    borderRadius: theme.radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: theme.sizes.input.md,
    backgroundColor: theme.colors.surfaceVariant,
    marginRight: theme.spacing.sm,
  },
  submitButton: {
    flex: 1,
    padding: theme.spacing['3'] + 2,
    borderRadius: theme.radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: theme.sizes.input.md,
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
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.fonts.weight.medium,
  },
  submitButtonText: {
    color: theme.colors.white,
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.fonts.weight.semibold,
  },
}));
