import React, { useState } from 'react';
import {
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
} from 'react-native';
import { OnBoardingWrapper } from '#components/templates';
import { Button } from '#components';
import { StyleSheet } from 'react-native-unistyles';
import {
  useInviteToHomeMutation,
  useAddCollaboratorMutation,
  CollaboratorRole,
  MembershipRole,
} from '#generated';
import { useAppStore } from '#store/useAppStore';
import { useOnboardingNavigation, useAuth } from '#hooks';

type InviteEntry = {
  id: string;
  email: string;
  type: 'home' | 'shopping' | 'both';
};

export const InviteMembersScreen = () => {
  const { navigateToNextStep } = useOnboardingNavigation();
  const { user } = useAuth();

  const selectedHomeId = useAppStore(state => state.selectedHomeId);
  const selectedShoppingListId = useAppStore(state => state.selectedShoppingListId);

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
      Alert.alert('Invalid Email', 'Please enter a valid email address');
      return;
    }

    if (invites.some(invite => invite.email === trimmedEmail)) {
      Alert.alert('Duplicate Email', 'This email has already been added');
      return;
    }

    if (trimmedEmail === user?.email?.toLowerCase()) {
      Alert.alert('Invalid Email', "You can't invite yourself");
      return;
    }

    setInvites([
      ...invites,
      {
        id: Date.now().toString(),
        email: trimmedEmail,
        type: 'both', // Default to inviting to both
      },
    ]);
    setCurrentEmail('');
  };

  const removeInvite = (id: string) => {
    setInvites(invites.filter(invite => invite.id !== id));
  };

  const toggleInviteType = (id: string) => {
    setInvites(
      invites.map(invite => {
        if (invite.id === id) {
          // Cycle through: both -> home -> shopping -> both
          let newType: 'home' | 'shopping' | 'both';
          if (invite.type === 'both') newType = 'home';
          else if (invite.type === 'home') newType = 'shopping';
          else newType = 'both';

          return { ...invite, type: newType };
        }
        return invite;
      }),
    );
  };

  const sendInvites = async () => {
    if (invites.length > 0) {
      setIsInviting(true);

      try {
        const invitePromises = [];

        for (const invite of invites) {
          // Invite to home
          if (
            (invite.type === 'home' || invite.type === 'both') &&
            selectedHomeId
          ) {
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
          }

          // Add as shopping list collaborator
          if (
            (invite.type === 'shopping' || invite.type === 'both') &&
            selectedShoppingListId
          ) {
            invitePromises.push(
              addCollaborator({
                variables: {
                  data: {
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
        // Add this line after successful completion
      } catch (error) {
        console.error('Error sending invites:', error);
        Alert.alert(
          'Partial Success',
          'Some invitations may have failed. You can invite more members later from settings.',
          [
            {
              text: 'Continue',
              onPress: () => navigateToNextStep('InviteMembers'),
            },
          ],
        );
      } finally {
        setIsInviting(false);
      }
    }
    navigateToNextStep('InviteMembers');
  };

  const getInviteTypeLabel = (type: 'home' | 'shopping' | 'both') => {
    switch (type) {
      case 'both':
        return '🏠 Home & 🛒 Shopping';
      case 'home':
        return '🏠 Home Only';
      case 'shopping':
        return '🛒 Shopping Only';
    }
  };

  return (
    <OnBoardingWrapper
      title="Invite family & friends"
      subtitle="Share your home and shopping lists with others (optional)"
      step={5}
      totalSteps={7}
      onSkip={() => navigateToNextStep('InviteMembers')}
    >
      <View style={styles.container}>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.emailInput}
            placeholder="Enter email address"
            value={currentEmail}
            onChangeText={setCurrentEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={addInvite}
          />
          <TouchableOpacity
            style={styles.addButton}
            onPress={addInvite}
            disabled={!currentEmail.trim()}
          >
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          style={styles.invitesList}
          data={invites}
          keyExtractor={(invite) => invite.id}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                No invitations added yet
              </Text>
              <Text style={styles.emptyStateSubtext}>
                Add email addresses above to invite members
              </Text>
            </View>
          }
          ListHeaderComponent={
            invites.length > 0 ? (
              <Text style={styles.listHeader}>
                Inviting {invites.length}{' '}
                {invites.length === 1 ? 'person' : 'people'}:
              </Text>
            ) : null
          }
          renderItem={({ item: invite }) => (
            <View style={styles.inviteItem}>
              <View style={styles.inviteInfo}>
                <Text style={styles.inviteEmail}>{invite.email}</Text>
                <TouchableOpacity
                  onPress={() => toggleInviteType(invite.id)}
                  style={styles.typeButton}
                >
                  <Text style={styles.typeText}>
                    {getInviteTypeLabel(invite.type)}
                  </Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                onPress={() => removeInvite(invite.id)}
                style={styles.removeButton}
              >
                <Text style={styles.removeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
          )}
        />

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
        btnStyle={styles.nextButton}
        txtStyle={styles.nextText}
        disabled={isInviting || invites.length === 0}
      />
    </OnBoardingWrapper>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    marginTop: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 10,
  },
  emailInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#c9d3db',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  addButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 20,
    justifyContent: 'center',
    borderRadius: 8,
  },
  addButtonText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  invitesList: {
    flex: 1,
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: theme.colors.textSecondary || '#666',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: theme.colors.textSecondary || '#999',
  },
  listHeader: {
    fontSize: 14,
    color: theme.colors.textSecondary || '#666',
    marginBottom: 12,
  },
  inviteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  inviteInfo: {
    flex: 1,
  },
  inviteEmail: {
    fontSize: 16,
    color: '#222',
    marginBottom: 4,
  },
  typeButton: {
    marginTop: 4,
  },
  typeText: {
    fontSize: 13,
    color: theme.colors.primary,
    fontWeight: '500',
  },
  removeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    fontSize: 20,
    color: '#999',
  },
  infoBox: {
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  infoText: {
    fontSize: 13,
    color: '#555',
    lineHeight: 18,
  },
  nextButton: {
    backgroundColor: theme.colors.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  nextText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
}));
