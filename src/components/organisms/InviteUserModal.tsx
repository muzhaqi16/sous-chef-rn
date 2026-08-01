import React, { useState } from 'react';
import { Modal, View, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppPressable } from '#components/atoms/AppPressable';
import { Text } from '#components/atoms/Text';
import { StyleSheet } from 'react-native-unistyles';
import {
  ThemedTextInput,
  WhiteActivityIndicator as ThemedActivityIndicator,
} from '#components/atoms/themedComponents';
import { MembershipRole } from '#/graphql/generated/schemaTypes';
import { Icon } from '#/utils/iconUtils';
import { useIsEffectivelyOffline } from '#hooks/settings/useOfflineMode';
import { executeWithLoadingState } from '#/utils/compilerSafeWrappers';
import { errorMessageOr } from '#/services/errorService';

type TFn = ReturnType<typeof useTranslation>['t'];

interface InviteUserModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (email: string, role: MembershipRole) => Promise<void> | void;
  title?: string;
  submitText?: string;
  cancelText?: string;
  allowedRoles?: MembershipRole[];
}

function buildRoleOptions(t: TFn) {
  return [
    {
      value: MembershipRole.Member,
      label: t('inviteUser.roleMemberLabel'),
      description: t('inviteUser.roleMemberDescription'),
      icon: 'person',
    },
    {
      value: MembershipRole.Admin,
      label: t('inviteUser.roleAdminLabel'),
      description: t('inviteUser.roleAdminDescription'),
      icon: 'settings-outline',
    },
    {
      value: MembershipRole.Guest,
      label: t('inviteUser.roleGuestLabel'),
      description: t('inviteUser.roleGuestDescription'),
      icon: 'eye-outline',
    },
    {
      value: MembershipRole.Owner,
      label: t('inviteUser.roleOwnerLabel'),
      description: t('inviteUser.roleOwnerDescription'),
      icon: 'key',
      warning: true,
    },
  ];
}

type RoleOption = ReturnType<typeof buildRoleOptions>[number];

interface RoleOptionProps {
  role: RoleOption;
  selected: boolean;
  onPress: () => void;
  disabled: boolean;
  warningText: string;
}

const RoleOption: React.FC<RoleOptionProps> = ({
  role,
  selected,
  onPress,
  disabled,
  warningText,
}) => {
  styles.useVariants({ selected });
  return (
    <AppPressable
      style={styles.roleOption}
      onPress={onPress}
      disabled={disabled}
    >
      <View style={styles.roleOptionContent}>
        <View style={styles.roleMain}>
          <View style={styles.roleHeaderLeft}>
            <Icon
              name={role.icon}
              size={22}
              tone={selected ? 'primary' : 'textSecondary'}
            />
            <Text style={styles.roleOptionLabel}>{role.label}</Text>
          </View>
          <Text style={styles.roleDescription}>{role.description}</Text>
          {!!role.warning && selected ? (
            <Text style={styles.warningText}>{warningText}</Text>
          ) : null}
        </View>
        <View style={styles.radioContainer}>
          <View style={styles.radioOuter}>
            {selected ? <View style={styles.radioInner} /> : null}
          </View>
        </View>
      </View>
    </AppPressable>
  );
};

export const InviteUserModal: React.FC<InviteUserModalProps> = ({
  visible,
  onClose,
  onSubmit,
  title,
  submitText,
  cancelText,
  allowedRoles,
}) => {
  const { t } = useTranslation();
  const resolvedTitle = title ?? t('inviteUser.title');
  const resolvedSubmitText = submitText ?? t('inviteUser.submit');
  const resolvedCancelText = cancelText ?? t('labels.cancel');
  const roleOptions = buildRoleOptions(t);
  // Filter role options based on allowed roles
  // If no allowedRoles provided, exclude Owner by default (it's reserved for home creators)
  const availableRoleOptions = roleOptions.filter(roleOption => {
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
      setError(t('inviteUser.offlineError'));
      return;
    }

    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setError(t('inviteUser.emailRequired'));
      return;
    }

    if (!validateEmail(trimmedEmail)) {
      setError(t('inviteUser.emailInvalid'));
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
        // Extract the actual error message from the API (errorMessageOr reads
        // Error.message / string and falls back to the localized default).
        setError(
          errorMessageOr(err, t('inviteUser.sendFailed')).replace(
            'ApolloError: ',
            '',
          ),
        );
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
            <Text style={styles.title}>{resolvedTitle}</Text>

            {/* Email Input */}
            <Text style={styles.label}>{t('inviteUser.emailLabel')}</Text>
            <ThemedTextInput
              style={styles.input}
              placeholder={t('inviteUser.emailPlaceholder')}
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
            <Text style={styles.roleSectionLabel}>
              {t('inviteUser.selectRole')}
            </Text>
            {availableRoleOptions.map(role => (
              <RoleOption
                key={role.value}
                role={role}
                selected={selectedRole === role.value}
                onPress={() => setSelectedRole(role.value)}
                disabled={isSubmitting}
                warningText={t('inviteUser.ownerWarning')}
              />
            ))}

            {/* Error Message */}
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {/* Action Buttons */}
            <View style={styles.buttonContainer}>
              <AppPressable
                style={styles.cancelButton}
                onPress={handleClose}
                disabled={isSubmitting}
              >
                <Text style={styles.cancelButtonText}>
                  {resolvedCancelText}
                </Text>
              </AppPressable>

              <AppPressable
                style={[
                  styles.submitButton,
                  (isSubmitting || isOffline) && styles.disabledButton,
                ]}
                onPress={handleSubmit}
                disabled={isSubmitting || isOffline}
              >
                {isSubmitting ? (
                  <ThemedActivityIndicator size="small" />
                ) : (
                  <Text style={styles.submitButtonText}>
                    {resolvedSubmitText}
                  </Text>
                )}
              </AppPressable>
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
    borderCurve: 'continuous',
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
    borderCurve: 'continuous',
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
    borderCurve: 'continuous',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  roleMain: {
    flex: 1,
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
    marginBottom: theme.spacing.xs,
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
    borderCurve: 'continuous',
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
    borderCurve: 'continuous',
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
