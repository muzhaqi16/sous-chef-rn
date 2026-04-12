import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { alertService } from '#/services/alertService';
import { OnBoardingWrapper } from '#components/templates/OnBoardingWrapper';
import { Button } from '#components/base/Button';
import { EmailInput } from '#components/atoms/EmailInput';
import { StyleSheet } from 'react-native-unistyles';
import {
  useInviteToHomeMutation,
  useAddCollaboratorMutation,
  CollaboratorRole,
  MembershipRole,
} from '#generated';
import { useAppStore } from '#store/useAppStore';
import { useOnboardingNavigation } from '#hooks/navigation/useOnboardingNavigation';
import { useUser } from '#store/useAppStore';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { executeWithLoadingState } from '#/utils/compilerSafeWrappers';

type InviteEntry = {
  id: string;
  email: string;
};

export const InviteMemberScreen = () => {
  useScreenTransition('InviteMemberScreen');
  const { navigateToNextStep } = useOnboardingNavigation();
  const user = useUser();

  const selectedHomeId = useAppStore(state => state.selectedHomeId);
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

  const [inviteToHome] = useInviteToHomeMutation({
    onError: error => {
      console.error('Failed to invite to home:', error);
    },
  });

  const [addCollaborator] = useAddCollaboratorMutation({
    onError: error => {
      console.error('Failed to add collaborator:', error);
    },
  });

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const addInvite = () => {
    const trimmedEmail = currentEmail.trim().toLowerCase();

    if (!validateEmail(trimmedEmail)) {
      alertService.alert('Invalid Email', 'Please enter a valid email address');
      return;
    }

    if (invites.some(invite => invite.email === trimmedEmail)) {
      alertService.alert(
        'Duplicate Email',
        'This email has already been added',
      );
      return;
    }

    if (trimmedEmail === user?.email?.toLowerCase()) {
      alertService.alert('Invalid Email', "You can't invite yourself");
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
                      message: `${
                        user?.email || 'A user'
                      } has invited you to join their home for managing pantry and shopping lists together!`,
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
          console.error('Error sending invites:', error);
          alertService.alert(
            'Partial Success',
            'Some invitations may have failed. You can invite more members later from settings.',
            [
              {
                text: 'Continue',
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
    if (hasNeither)
      return 'Create a home or shopping list first to invite others';
    if (hasBoth)
      return 'Invite others to your home and shopping lists (optional)';
    if (hasHome) return 'Invite others to your home (optional)';
    return 'Invite others to your shopping list (optional)';
  };

  // If user has neither home nor shopping list, show message and skip button
  if (hasNeither) {
    return (
      <OnBoardingWrapper
        title="Invite family & friends"
        subtitle={getSubtitle()}
        step={5}
        totalSteps={7}
        onSkip={() => navigateToNextStep('InviteMembers')}
      >
        <View style={styles.container}>
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>Nothing to share yet</Text>
            <Text style={styles.emptyStateSubtext}>
              You need to create a home or shopping list first to invite others.
              You can invite people later from settings.
            </Text>
          </View>
        </View>

        <Button
          title="Continue"
          onPress={() => navigateToNextStep('InviteMembers')}
          variant="primary"
        />
      </OnBoardingWrapper>
    );
  }

  return (
    <OnBoardingWrapper
      title="Invite family & friends"
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
            title="Add"
            onPress={addInvite}
            disabled={!currentEmail.trim()}
            size="medium"
          />
        </View>

        <View style={styles.invitesList}>
          {invites.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                No invitations added yet
              </Text>
              <Text style={styles.emptyStateSubtext}>
                Add email addresses above to invite members
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.listHeader}>
                Inviting {invites.length}{' '}
                {invites.length === 1 ? 'person' : 'people'}:
              </Text>
              {invites.map(invite => (
                <View key={invite.id} style={styles.inviteItem}>
                  <Text style={styles.inviteEmail}>{invite.email}</Text>
                  <Pressable
                    onPress={() => removeInvite(invite.id)}
                    style={({ pressed }) => [
                      styles.removeButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.removeButtonText}>✕</Text>
                  </Pressable>
                </View>
              ))}
            </>
          )}
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            💡 Tip: You can always invite more people later from your settings
          </Text>
        </View>
      </View>

      <Button
        title={
          isInviting
            ? 'Sending Invites...'
            : `Send ${invites.length > 0 ? invites.length : ''} Invite${
                invites.length === 1 ? '' : 's'
              }`
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
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  emptyStateSubtext: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  listHeader: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing['3'],
  },
  inviteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.sm,
    padding: theme.spacing['3'],
    marginBottom: theme.spacing.sm,
  },
  inviteEmail: {
    flex: 1,
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.textPrimary,
  },
  removeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    fontSize: theme.typography.fontSize.xl,
    color: theme.colors.textTertiary,
  },
  infoBox: {
    backgroundColor: theme.colors.info + '20',
    borderRadius: theme.radii.sm,
    padding: theme.spacing['3'],
    marginBottom: theme.spacing.md,
  },
  infoText: {
    fontSize: theme.typography.fontSize.sm - 1,
    color: theme.colors.textSecondary,
    lineHeight: theme.typography.lineHeight.tight,
    textAlign: 'center',
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
