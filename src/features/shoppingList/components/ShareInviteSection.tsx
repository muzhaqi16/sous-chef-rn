import React, { useState } from 'react';
import { View } from 'react-native';
import { Text } from '#components/atoms/Text';
import { WhiteActivityIndicator } from '#components/atoms/themedComponents';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { Icon } from '#utils/iconUtils';
import { EmailInput } from '#components/atoms/EmailInput';
import { ChipScrollRow } from '#components/atoms/ChipScrollRow';
import { useInviteCollaborator } from '#features/shoppingList/hooks/useInviteCollaborator';
import { CollaboratorRole } from '#/graphql/generated/schemaTypes';
import { ROLE_PERMISSIONS, INVITE_ROLES } from '#/constants/collaboratorRoles';
import { alertService } from '#/services/alertService';
import { localizedErrorMessage } from '#/services/errorService';
import { useVerifiedEmailGate } from '#hooks/auth/useEmailVerification';
import type { Translate } from '#/i18n/types';
import { executeWithLoadingState } from '#/utils/finallyHelpers';
import { unwrapPayload } from '#/utils/errors/mutationPayload';

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

  const [email, setEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState<CollaboratorRole>(
    CollaboratorRole.Contributor,
  );
  const [sharing, setSharing] = useState(false);

  const { requireVerifiedEmail } = useVerifiedEmailGate();
  const { inviteCollaborator } = useInviteCollaborator(listId);

  const handleShare = () => {
    if (!requireVerifiedEmail()) return;

    if (!email.trim()) {
      alertService.alert(
        t('labels.error'),
        t('labels.pleaseEnterAnEmailAddress'),
      );
      return;
    }

    executeWithLoadingState(
      async () => {
        unwrapPayload(
          await inviteCollaborator(email.trim(), selectedRole),
          'InviteToShoppingListPayload',
          t('errors.sendInviteFailed'),
        );
        setEmail('');
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
  };

  return (
    <View style={styles.inviteSection}>
      <Text style={styles.sectionTitle}>{t('labels.inviteMembers')}</Text>
      <View style={styles.inputRow}>
        <EmailInput
          containerStyle={styles.emailInputContainer}
          value={email}
          onChangeText={setEmail}
        />
        <AppPressable
          style={styles.sendButton}
          onPress={handleShare}
          disabled={sharing}
        >
          {sharing ? (
            <WhiteActivityIndicator size="small" />
          ) : (
            <Icon name="send" size={20} tone="white" />
          )}
        </AppPressable>
      </View>
      <Text style={styles.roleLabel}>{t('labels.role')}</Text>
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
  sectionTitle: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.base,
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
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.fonts.weight.medium,
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
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
