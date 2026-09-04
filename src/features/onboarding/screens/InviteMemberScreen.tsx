import React, { useState } from 'react';
import { errorService } from '#/services/errorService';
import { View } from 'react-native';
import { AppPressable } from '#components/atoms/AppPressable';
import { alertService } from '#/services/alertService';
import { handleMutationError } from '#/utils/errorHandlers';
import { OnBoardingWrapper } from '#features/onboarding/components/OnBoardingWrapper';
import { Button } from '#components/molecules/Button';
import { EmailInput } from '#components/molecules/EmailInput';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import {
  inviteEmailSchema,
  normalizeInviteEmail,
  type InviteEmailFormValues,
} from './inviteMemberFormConfig';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { useVerifiedEmailGate } from '#hooks/auth/useEmailVerification';
import { useInviteToHome } from '#features/onboarding/hooks/useInviteToHome';
import { useAddCollaborator } from '#features/shoppingList/hooks/useAddCollaborator';
import {
  CollaboratorRole,
  MembershipRole,
} from '#/graphql/generated/schemaTypes';
import { useAppStore, useSelectedHomeId } from '#store/useAppStore';
import { useOnboardingNavigation } from '#features/onboarding/hooks/useOnboardingNavigation';
import { useUser } from '#store/useAppStore';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { executeWithLoadingState } from '#/utils/finallyHelpers';
import { Text } from '#components/atoms/Text';
import { EmptyState } from '#components/molecules/EmptyState';

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
  const [isInviting, setIsInviting] = useState(false);

  // The schema is rebuilt per render because two of its three rules read the
  // CURRENT list and the signed-in account.
  const { control, handleSubmit, reset } = useForm<InviteEmailFormValues>({
    resolver: yupResolver(
      inviteEmailSchema({
        existing: invites.map(invite => invite.email),
        ownEmail: user?.email,
      }),
    ),
    defaultValues: { email: '' },
  });
  // `useWatch`, never `watch()` — the React Compiler cannot memoize the
  // function `watch` returns, and the lint rule here is what says so.
  const email = useWatch({ control, name: 'email' });

  const { requireVerifiedEmail } = useVerifiedEmailGate();
  const { inviteToHome } = useInviteToHome(error => {
    handleMutationError(error, { operation: 'Invite to Home' });
  });

  const { addCollaborator } = useAddCollaborator(error => {
    handleMutationError(error, { operation: 'Add Collaborator' });
  });

  // Reaching here means the address is well-formed, new, and not the person's
  // own; each refusal renders under the input instead of in an alert the reader
  // has to dismiss before they can correct it.
  const addInvite = handleSubmit(values => {
    setInvites(current => [
      ...current,
      { id: Date.now().toString(), email: normalizeInviteEmail(values.email) },
    ]);
    reset({ email: '' });
  });

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
                  homeId: selectedHomeId,
                  email: invite.email,
                  role: MembershipRole.Member,
                  message: t('inviteMembers.inviteHomeMessage', {
                    name: user?.email || t('labels.someone'),
                  }),
                }),
              );
            } else if (selectedShoppingListId) {
              // Standalone shopping list (not home-linked)
              invitePromises.push(
                addCollaborator({
                  shoppingListId: selectedShoppingListId,
                  email: invite.email,
                  role: CollaboratorRole.Contributor,
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
          <EmptyState
            title={t('inviteMembers.nothingToShare')}
            description={t('inviteMembers.nothingToShareDesc')}
          />
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
          <Controller
            control={control}
            name="email"
            render={({ field, fieldState }) => (
              <EmailInput
                containerStyle={styles.emailInputContainer}
                value={field.value}
                onChangeText={field.onChange}
                errorMessage={fieldState.error?.message}
                onSubmitEditing={addInvite}
              />
            )}
          />
          <Button
            title={t('labels.add')}
            onPress={addInvite}
            disabled={!email.trim()}
            size="medium"
          />
        </View>

        <View style={styles.invitesList}>
          {invites.length === 0 ? (
            <EmptyState
              size="compact"
              title={t('inviteMembers.noInvitesYet')}
              description={t('inviteMembers.noInvitesYetDesc')}
            />
          ) : (
            <>
              <Text role="caption" tone="secondary" style={styles.listHeader}>
                {t(
                  invites.length === 1
                    ? 'inviteMembers.invitingPersonSingular'
                    : 'inviteMembers.invitingPersonPlural',
                  { count: invites.length },
                )}
              </Text>
              {invites.map(invite => (
                <View key={invite.id} style={styles.inviteItem}>
                  <Text style={styles.inviteEmail}>{invite.email}</Text>
                  <AppPressable
                    onPress={() => removeInvite(invite.id)}
                    style={styles.removeButton}
                  >
                    <Text role="subheading" tone="tertiary">
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
            role="caption"
            tone="secondary"
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
  listHeader: {
    marginBottom: theme.spacing.base,
  },
  inviteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: theme.borderWidth.hairline,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
    padding: theme.spacing.base,
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
    padding: theme.spacing.base,
    marginBottom: theme.spacing.md,
  },
  infoText: {},
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
