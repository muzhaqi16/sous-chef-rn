import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { View } from 'react-native';
import { Text } from '#components/atoms/Text';
import { OnPrimaryActivityIndicator } from '#components/atoms/themedComponents';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { Icon } from '#utils/iconUtils';
import { EmailInput } from '#components/molecules/EmailInput';
import { ChipScrollRow } from '#components/molecules/ChipScrollRow';
import { useInviteCollaborator } from '#features/shoppingList/hooks/useInviteCollaborator';
import { CollaboratorRole } from '#/graphql/generated/schemaTypes';
import {
  ROLE_PERMISSIONS,
  INVITE_ROLES,
} from '#features/shoppingList/constants/collaboratorRoles';
import { alertService } from '#/services/alertService';
import { localizedErrorMessage } from '#/services/errorService';
import { useVerifiedEmailGate } from '#hooks/auth/useEmailVerification';
import type { Translate } from '#/i18n/types';
import { executeWithLoadingState } from '#/utils/finallyHelpers';
import { unwrapPayload } from '#/utils/errors/mutationPayload';
import { SectionHeader } from '#components/atoms/SectionHeader';
import {
  shareInviteSchema,
  shareInviteDefaults,
  type ShareInviteFormValues,
} from './shareInviteFormConfig';

const buildRoleOptions = (t: Translate) =>
  INVITE_ROLES.map(role => ({
    key: role,
    icon: ROLE_PERMISSIONS[role].icon,
    label: t(ROLE_PERMISSIONS[role].labelKey),
  }));

interface ShareInviteSectionProps {
  listId: string;
}

/** Invite-by-email section of the Share screen. */
export const ShareInviteSection: React.FC<ShareInviteSectionProps> = ({
  listId,
}) => {
  const { t } = useTranslation();
  const roleOptions = buildRoleOptions(t);

  const { control, handleSubmit, resetField } = useForm<ShareInviteFormValues>({
    resolver: yupResolver(shareInviteSchema),
    defaultValues: shareInviteDefaults(),
  });
  const [selectedRole, setSelectedRole] = useState<CollaboratorRole>(
    CollaboratorRole.Contributor,
  );
  const [sharing, setSharing] = useState(false);

  const { requireVerifiedEmail } = useVerifiedEmailGate();
  const { inviteCollaborator } = useInviteCollaborator(listId);

  // A blank or malformed address renders under the input. Reaching the body
  // means it is neither; a SEND failure is not a field the user can edit, so it
  // stays an alert.
  const handleShare = handleSubmit(values => {
    if (!requireVerifiedEmail()) return;

    executeWithLoadingState(
      async () => {
        unwrapPayload(
          await inviteCollaborator(values.email.trim(), selectedRole),
          'InviteToShoppingListPayload',
          t('errors.sendInviteFailed'),
        );
        resetField('email');
      },
      setSharing,
      error => {
        alertService.alert(
          t('labels.error'),
          // Resolved from the error's CODE. `error.message` is the server's
          // English, which reaches an es/it/sq user verbatim.
          localizedErrorMessage(error, t('errors.sendInviteFailed')),
        );
      },
    );
  });

  return (
    <View style={styles.inviteSection}>
      <SectionHeader style={styles.sectionTitleSpacing}>
        {t('labels.inviteMembers')}
      </SectionHeader>
      <View style={styles.inputRow}>
        <Controller
          control={control}
          name="email"
          render={({ field, fieldState }) => (
            <EmailInput
              containerStyle={styles.emailInputContainer}
              value={field.value}
              onChangeText={field.onChange}
              errorMessage={fieldState.error?.message}
            />
          )}
        />
        <AppPressable
          style={styles.sendButton}
          onPress={handleShare}
          accessibilityLabel={t('labels.inviteMembers')}
          disabled={sharing}
        >
          {sharing ? (
            <OnPrimaryActivityIndicator size="small" />
          ) : (
            <Icon name="send" size={20} tone="onPrimary" />
          )}
        </AppPressable>
      </View>
      <Text role="bodyStrong" style={styles.roleLabel}>
        {t('labels.role')}
      </Text>
      <ChipScrollRow
        options={roleOptions}
        selected={selectedRole}
        onSelect={setSelectedRole}
        size="md"
        style={styles.chipScroll}
        contentContainerStyle={styles.chipRowContent}
        edgeFadeColor="background"
      />
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  inviteSection: {
    padding: theme.spacing.md,
    borderBottomWidth: theme.borderWidth.hairline,
    borderBottomColor: theme.colors.border,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emailInputContainer: {
    flex: 1,
  },
  sendButton: {
    marginLeft: theme.spacing.base,
    backgroundColor: theme.colors.primary,
    width: 44,
    height: 44,
    borderRadius: theme.radii.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleLabel: {
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  chipScroll: {
    marginHorizontal: -theme.spacing.md,
  },
  chipRowContent: {
    paddingHorizontal: theme.spacing.md,
  },
  sectionTitleSpacing: {
    marginBottom: theme.spacing.base,
  },
}));
