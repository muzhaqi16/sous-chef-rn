import React, { useState } from 'react';
import { errorService } from '#/services/errorService';
import { View } from 'react-native';
import { AppPressable } from '#components/atoms/AppPressable';
import { alertService } from '#/services/alertService';
import { handleMutationError } from '#/utils/errorHandlers';
import { OnBoardingWrapper } from '#components/templates/OnBoardingWrapper';
import { Button } from '#components/base/Button';
import { EmailInput } from '#components/atoms/EmailInput';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { useVerifiedEmailGate } from '#hooks/auth/useEmailVerification';
import { useMutation } from '@apollo/client/react';
import { InviteToHomeDocument } from '#operations/home/home.generated';
import { AddCollaboratorDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import {
  CollaboratorRole,
  MembershipRole,
} from '#/graphql/generated/schemaTypes';
import { useAppStore, useSelectedHomeId } from '#store/useAppStore';
import { useOnboardingNavigation } from '#hooks/navigation/useOnboardingNavigation';
import { useUser } from '#store/useAppStore';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { executeWithLoadingState } from '#/utils/compilerSafeWrappers';
import { Text } from '#components/atoms/Text';

type InviteEntry = {
  id: string;
  email: string;
};

export const InviteMemberScreen = () => {
  const { t } = useTranslation();
  useScreenTransition('InviteMemberScreen');
  const { navigateToNextStep } = useOnboardingNavigation();
  const user = useUser();

  const selectedHomeId = useSelectedHomeId();
  const selectedShoppingListId = useAppStore(
    state => state.selectedShoppingListId,
  );

  // Determine what resources the user has
  const hasHome = !!selectedHomeId;
  const hasShoppingList = !!selectedShoppingListId;
  const hasBoth = hasHome && hasShoppingList;
  const hasNeither = !hasHome && !hasShoppingList;

  const [invites, setInvites] = useState<InviteEntry[]>([]);
  const [currentEmail, setCurrentEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);

  const { requireVerifiedEmail } = useVerifiedEmailGate();
  const [inviteToHome] = useMutation(InviteToHomeDocument, {
    onError: error => {
      handleMutationError(error, { operation: 'Invite to Home' });
    },
  });

  const [addCollaborator] = useMutation(AddCollaboratorDocument, {
    onError: error => {
      handleMutationError(error, { operation: 'Add Collaborator' });
    },
  });

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const addInvite = () => {
    const trimmedEmail = currentEmail.trim().toLowerCase();

    if (!validateEmail(trimmedEmail)) {
      alertService.alert(
        t('inviteMembers.invalidEmailTitle'),
        t('inviteMembers.invalidEmailMessage'),
      );
      return;
    }

    if (invites.some(invite => invite.email === trimmedEmail)) {
      alertService.alert(
        t('inviteMembers.duplicateEmailTitle'),
        t('inviteMembers.duplicateEmailMessage'),
      );
      return;
    }

    if (trimmedEmail === user?.email?.toLowerCase()) {
      alertService.alert(
        t('inviteMembers.invalidEmailTitle'),
        t('inviteMembers.cantInviteSelf'),
      );
      return;
    }

    setInvites([
      ...invites,
      {
        id: Date.now().toString(),
        email: trimmedEmail,
      },
    ]);
    setCurrentEmail('');
  };

  const removeInvite = (id: string) => {
    setInvites(invites.filter(invite => invite.id !== id));
  };

  const sendInvites = () => {
    if (!requireVerifiedEmail()) return;

    if (invites.length > 0) {
      executeWithLoadingState(
        async () => {
          const invitePromises = [];

          for (const invite of invites) {
            if (selectedHomeId) {
              // Home membership covers home-linked shopping lists
              invitePromises.push(
                inviteToHome({
                  variables: {
                    input: {
                      homeId: selectedHomeId,
                      email: invite.email,
                      role: MembershipRole.Member,
                      message: t('inviteMembers.inviteHomeMessage', {
                        name: user?.email || t('labels.someone'),
                      }),
                    },
                  },
                }),
              );
            } else if (selectedShoppingListId) {
              // Standalone shopping list (not home-linked)
              invitePromises.push(
                addCollaborator({
                  variables: {
                    input: {
                      shoppingListId: selectedShoppingListId,
                      email: invite.email,
                      role: CollaboratorRole.Contributor,
                    },
                  },
                }),
              );
            }
          }

          await Promise.all(invitePromises);
          navigateToNextStep('InviteMembers');
        },
        setIsInviting,
        error => {
          errorService.reportError(error, { operation: 'sendInvites' });
          alertService.alert(
            t('inviteMembers.partialSuccessTitle'),
            t('inviteMembers.partialSuccessMessage'),
            [
              {
                text: t('labels.continue'),
                onPress: () => navigateToNextStep('InviteMembers'),
              },
            ],
          );
        },
      );
      return;
    }
    navigateToNextStep('InviteMembers');
  };

  const getSubtitle = () => {
    if (hasNeither) return t('inviteMembers.subtitleHasNeither');
    if (hasBoth) return t('inviteMembers.subtitleHasBoth');
    if (hasHome) return t('inviteMembers.subtitleHasHome');
    return t('inviteMembers.subtitleHasList');
  };

  // If user has neither home nor shopping list, show message and skip button
  if (hasNeither) {
    return (
      <OnBoardingWrapper
        title={t('inviteMembers.title')}
        subtitle={getSubtitle()}
        step={5}
        totalSteps={7}
        onSkip={() => navigateToNextStep('InviteMembers')}
      >
        <View style={styles.container}>
          <View style={styles.emptyState}>
            <Text size="md" tone="secondary" style={styles.emptyStateText}>
              {t('inviteMembers.nothingToShare')}
            </Text>
            <Text size="sm" tone="secondary">
              {t('inviteMembers.nothingToShareDesc')}
            </Text>
          </View>
        </View>

        <Button
          title={t('labels.continue')}
          onPress={() => navigateToNextStep('InviteMembers')}
          variant="primary"
        />
      </OnBoardingWrapper>
    );
  }

  return (
    <OnBoardingWrapper
      title={t('inviteMembers.title')}
      subtitle={getSubtitle()}
      step={5}
      totalSteps={7}
      onSkip={() => navigateToNextStep('InviteMembers')}
    >
      <View style={styles.container}>
        <View style={styles.inputContainer}>
          <EmailInput
            containerStyle={styles.emailInputContainer}
            value={currentEmail}
            onChangeText={setCurrentEmail}
            onSubmitEditing={addInvite}
          />
          <Button
            title={t('inviteMembers.addButton')}
            onPress={addInvite}
            disabled={!currentEmail.trim()}
            size="medium"
          />
        </View>

        <View style={styles.invitesList}>
          {invites.length === 0 ? (
            <View style={styles.emptyState}>
              <Text size="md" tone="secondary" style={styles.emptyStateText}>
                {t('inviteMembers.noInvitesYet')}
              </Text>
              <Text size="sm" tone="secondary">
                {t('inviteMembers.noInvitesYetDesc')}
              </Text>
            </View>
          ) : (
            <>
              <Text size="sm" tone="secondary" style={styles.listHeader}>
                {t(
                  invites.length === 1
                    ? 'inviteMembers.invitingPersonSingular'
                    : 'inviteMembers.invitingPersonPlural',
                  { count: invites.length },
                )}
              </Text>
              {invites.map(invite => (
                <View key={invite.id} style={styles.inviteItem}>
                  <Text size="md" style={styles.inviteEmail}>
                    {invite.email}
                  </Text>
                  <AppPressable
                    onPress={() => removeInvite(invite.id)}
                    style={styles.removeButton}
                  >
                    <Text size="xl" tone="tertiary">
                      ✕
                    </Text>
                  </AppPressable>
                </View>
              ))}
            </>
          )}
        </View>

        <View style={styles.infoBox}>
          <Text
            tone="secondary"
            lineHeight="tight"
            align="center"
            style={styles.infoText}
          >
            {t('inviteMembers.tip')}
          </Text>
        </View>
      </View>
      <Button
        title={
          isInviting
            ? t('inviteMembers.sending')
            : invites.length === 0
            ? t('inviteMembers.sendInviteZero')
            : t(
                invites.length === 1
                  ? 'inviteMembers.sendInviteSingular'
                  : 'inviteMembers.sendInvitePlural',
                { count: invites.length },
              )
        }
        onPress={sendInvites}
        variant="primary"
        disabled={isInviting || invites.length === 0}
      />
    </OnBoardingWrapper>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    marginTop: theme.spacing.lg,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  emailInputContainer: {
    flex: 1,
  },
  invitesList: {
    flex: 1,
    marginBottom: theme.spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: theme.spacing['2xl'],
  },
  emptyStateText: {
    marginBottom: theme.spacing.sm,
  },
  listHeader: {
    marginBottom: theme.spacing['3'],
  },
  inviteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
    padding: theme.spacing['3'],
    marginBottom: theme.spacing.sm,
  },
  inviteEmail: {
    flex: 1,
  },
  removeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoBox: {
    backgroundColor: theme.colors.info + '20',
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
    padding: theme.spacing['3'],
    marginBottom: theme.spacing.md,
  },
  infoText: {
    fontSize: theme.typography.fontSize.sm - 1,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
