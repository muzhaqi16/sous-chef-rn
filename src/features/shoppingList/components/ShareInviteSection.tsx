import React, { useState } from 'react';
import { View } from 'react-native';
import { Text } from '#components/atoms/Text';
import { WhiteActivityIndicator } from '#components/atoms/themedComponents';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@apollo/client/react';
import { Icon } from '#utils/iconUtils';
import { EmailInput } from '#components/atoms/EmailInput';
import { ChipScrollRow } from '#components/atoms/ChipScrollRow';
import { AddCollaboratorDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { CollaboratorRole } from '#/graphql/generated/schemaTypes';
import { createAddToParentConnectionUpdater } from '#/apollo/utils/cacheUpdaters';
import { ROLE_PERMISSIONS, INVITE_ROLES } from '#/constants/collaboratorRoles';
import { alertService } from '#/services/alertService';
import {
  executeWithLoadingState,
  unwrapPayload,
} from '#/utils/compilerSafeWrappers';

const addCollaboratorToCache = createAddToParentConnectionUpdater(
  'ShoppingList',
  'collaboratorsConnection',
  'ShoppingListCollaborator',
);

const ROLE_LABEL_KEYS: Record<CollaboratorRole, string> = {
  [CollaboratorRole.Viewer]: 'collaboratorRoles.viewer',
  [CollaboratorRole.Shopper]: 'collaboratorRoles.shopper',
  [CollaboratorRole.Contributor]: 'collaboratorRoles.contributor',
  [CollaboratorRole.Editor]: 'collaboratorRoles.editor',
  [CollaboratorRole.Admin]: 'collaboratorRoles.admin',
  [CollaboratorRole.Owner]: 'collaboratorRoles.owner',
};

type T = (key: string, opts?: Record<string, unknown>) => string;

const buildRoleOptions = (t: T) =>
  INVITE_ROLES.map(role => ({
    key: role,
    icon: ROLE_PERMISSIONS[role].icon,
    label: t(ROLE_LABEL_KEYS[role]),
  }));

interface ShareInviteSectionProps {
  listId: string;
}

/**
 * Invite-by-email section of the Share screen: owns the email/role/sending
 * state and the AddCollaborator mutation (inserting the new collaborator into
 * the cached collaboratorsConnection on success).
 */
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

  const [shareList] = useMutation(AddCollaboratorDocument);

  const handleShare = () => {
    if (!email.trim()) {
      alertService.alert(
        t('labels.error'),
        t('shoppingListScreens.pleaseEnterEmail'),
      );
      return;
    }

    executeWithLoadingState(
      async () => {
        const { data } = await shareList({
          variables: {
            input: {
              shoppingListId: listId,
              email: email.trim(),
              role: selectedRole,
            },
          },
          update(cache, { data: updateData }) {
            const invitePayload = updateData?.inviteToShoppingList;
            if (invitePayload?.__typename === 'InviteToShoppingListPayload') {
              addCollaboratorToCache(
                cache,
                listId,
                invitePayload.collaborator,
                {
                  position: 'end',
                },
              );
            }
          },
        });
        unwrapPayload(
          data?.inviteToShoppingList,
          'InviteToShoppingListPayload',
          t('shoppingListScreens.failedToSendInvitation'),
        );
        setEmail('');
        // No refetch needed: the update() callback above already inserts the
        // new collaborator into the cached collaboratorsConnection.
      },
      setSharing,
      error => {
        alertService.alert(
          t('labels.error'),
          error instanceof Error
            ? error.message
            : t('shoppingListScreens.failedToSendInvitation'),
        );
      },
    );
  };

  return (
    <View style={styles.inviteSection}>
      <Text style={styles.sectionTitle}>
        {t('shoppingListScreens.inviteMembers')}
      </Text>
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
      <Text style={styles.roleLabel}>{t('shoppingListScreens.role')}</Text>
      <ChipScrollRow
        options={roleOptions}
        selected={selectedRole}
        onSelect={setSelectedRole}
        size="md"
        style={styles.chipScroll}
        contentContainerStyle={styles.chipRowContent}
      />
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  inviteSection: {
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing['3'],
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emailInputContainer: {
    flex: 1,
  },
  sendButton: {
    marginLeft: theme.spacing['3'],
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
