import React, { useState } from 'react';
import { Modal, View, ScrollView } from 'react-native';
import { useTranslation } from '#/i18n';
import { AppPressable } from '#components/atoms/AppPressable';
import { Text } from '#components/atoms/Text';
import { StyleSheet } from 'react-native-unistyles';
import {
  ThemedTextInput,
  OnPrimaryActivityIndicator as ThemedActivityIndicator,
} from '#components/atoms/themedComponents';
import { MembershipRole } from '#/graphql/generated/schemaTypes';
import { Icon } from '#/utils/iconUtils';
import { useIsEffectivelyOffline } from '#hooks/settings/useOfflineMode';
import { executeWithLoadingState } from '#/utils/finallyHelpers';
import { localizedErrorMessage } from '#/services/errorService';
import type { Translate } from '#/i18n/types';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { logValidationErrors } from '#utils/validation/common';
import {
  inviteUserSchema,
  type InviteUserFormValues,
} from './inviteUserFormConfig';

interface InviteUserModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (email: string, role: MembershipRole) => Promise<void> | void;
  title?: string;
  submitText?: string;
  cancelText?: string;
  allowedRoles?: MembershipRole[];
}

function buildRoleOptions(t: Translate) {
  return [
    {
      value: MembershipRole.Member,
      label: t('inviteUser.roleMemberLabel'),
      description: t('inviteUser.roleMemberDescription'),
      icon: 'person',
    },
    {
      value: MembershipRole.Admin,
      label: t('labels.admin'),
      description: t('inviteUser.roleAdminDescription'),
      icon: 'settings-outline',
    },
    {
      value: MembershipRole.Guest,
      label: t('labels.guest'),
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
            <Text role="bodyStrong" style={styles.roleOptionLabel}>
              {role.label}
            </Text>
          </View>
          <Text role="caption" style={styles.roleDescription}>
            {role.description}
          </Text>
          {!!role.warning && selected ? (
            <Text role="bodyStrong" style={styles.warningText}>
              {warningText}
            </Text>
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
  const resolvedTitle = title ?? t('labels.inviteMemberToHome');
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

  // `error` is the SUBMISSION failure (a server refusal, an offline attempt) —
  // the field's own message lives on the field, where it can be corrected.
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    control,
    handleSubmit: submitForm,
    reset,
    formState: { errors },
  } = useForm<InviteUserFormValues>({
    resolver: yupResolver(inviteUserSchema),
    defaultValues: { email: '', role: defaultRole },
  });

  const isOffline = useIsEffectivelyOffline();

  styles.useVariants({ hasError: !!error });

  // Reaching here means the schema passed, so only the submission can fail.
  const onValid = (values: InviteUserFormValues) => {
    if (isOffline) {
      setError(t('inviteUser.offlineError'));
      return;
    }

    setError('');

    executeWithLoadingState(
      async () => {
        await onSubmit(values.email.trim(), values.role);
        // Only close on success
        handleClose();
      },
      setIsSubmitting,
      (err: unknown) => {
        // Extract the actual error message from the API (localizedErrorMessage reads
        // Error.message / string and falls back to the localized default).
        setError(localizedErrorMessage(err, t('inviteUser.sendFailed')));
      },
    );
  };

  const handleSubmit = submitForm(onValid, logValidationErrors);

  const handleClose = () => {
    reset({ email: '', role: defaultRole });
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
            <Text role="bodyStrong" style={styles.title}>
              {resolvedTitle}
            </Text>

            {/* Email Input */}
            <Text role="bodyStrong" style={styles.label}>
              {t('inviteUser.emailLabel')}
            </Text>
            <Controller
              control={control}
              name="email"
              render={({ field: { value, onChange, onBlur } }) => (
                <ThemedTextInput
                  style={styles.input}
                  placeholder={t('inviteUser.emailPlaceholder')}
                  value={value}
                  onChangeText={text => {
                    onChange(text);
                    if (error) setError('');
                  }}
                  onBlur={onBlur}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isSubmitting}
                />
              )}
            />
            {/* On the field, not in the submission banner: this is the one the
                user can correct without dismissing anything. */}
            {errors.email ? (
              <Text role="caption" style={styles.errorText}>
                {errors.email.message}
              </Text>
            ) : null}

            {/* Role Selection */}
            <Text role="bodyStrong" style={styles.roleSectionLabel}>
              {t('labels.selectRole')}
            </Text>
            {availableRoleOptions.map(role => (
              <Controller
                key={role.value}
                control={control}
                name="role"
                render={({ field: { value, onChange } }) => (
                  <RoleOption
                    role={role}
                    selected={value === role.value}
                    onPress={() => onChange(role.value)}
                    disabled={isSubmitting}
                    warningText={t('inviteUser.ownerWarning')}
                  />
                )}
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
                <Text role="bodyStrong" style={styles.cancelButtonText}>
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
                  <Text role="bodyStrong" style={styles.submitButtonText}>
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
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
    color: theme.colors.textPrimary,
  },
  label: {
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  roleSectionLabel: {
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  input: {
    borderWidth: theme.borderWidth.hairline,
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
    padding: theme.spacing.base,
    ...theme.type.body,
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
    borderWidth: theme.borderWidth.medium,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    padding: theme.spacing.base,
    marginBottom: theme.spacing.base,
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
    borderWidth: theme.borderWidth.medium,
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
    color: theme.colors.textPrimary,
  },
  roleDescription: {
    color: theme.colors.textSecondary,
  },
  warningText: {
    marginTop: theme.spacing.xsPlus,
    color: theme.colors.warning,
  },
  errorText: {
    marginBottom: theme.spacing.base,
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
    padding: theme.spacing.basePlus,
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
    padding: theme.spacing.basePlus,
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
  cancelButtonText: {
    color: theme.colors.textPrimary,
  },
  submitButtonText: {
    color: theme.colors.onPrimary,
  },
}));
