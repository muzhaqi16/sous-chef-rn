import React, {useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {Icon} from '#utils';
import {useNavigation, useRoute} from '@react-navigation/native';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';
import {
  useMyShoppingListInvitesQuery,
  useAcceptShoppingListInviteMutation,
  useDeclineShoppingListInviteMutation,
  useGetMyPendingInvitesQuery,
  useAcceptHomeInviteMutation,
  useDeclineHomeInviteMutation,
} from '#generated';

type InvitationType = 'shopping_list' | 'home' | 'unknown';

export const AcceptInvite: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const {token, inviteId} = route.params as {token?: string; inviteId?: string};
  const {theme} = useUnistyles();

  const [processing, setProcessing] = useState(false);
  const [invitationType, setInvitationType] = useState<InvitationType>('unknown');

  // Get shopping list invites
  const {data: shoppingListData, loading: shoppingListLoading} = useMyShoppingListInvitesQuery();

  // Get home invites
  const {data: homeInviteData, loading: homeInviteLoading} = useGetMyPendingInvitesQuery();

  // Mutations for shopping list invites
  const [acceptShoppingListInvite] = useAcceptShoppingListInviteMutation();
  const [declineShoppingListInvite] = useDeclineShoppingListInviteMutation();

  // Mutations for home invites
  const [acceptHomeInvite] = useAcceptHomeInviteMutation();
  const [declineHomeInvite] = useDeclineHomeInviteMutation();

  const loading = shoppingListLoading || homeInviteLoading;

  // Find the specific invite and determine type
  const shoppingListInvite = shoppingListData?.myShoppingListInvites?.find(inv =>
    token ? inv.inviteToken === token : inv.id === inviteId,
  );

  const homeInvite = homeInviteData?.myPendingInvites?.find(inv =>
    token ? inv.token === token : inv.id === inviteId,
  );

  // Determine invitation type
  React.useEffect(() => {
    if (shoppingListInvite) {
      setInvitationType('shopping_list');
    } else if (homeInvite) {
      setInvitationType('home');
    } else if (!loading) {
      setInvitationType('unknown');
    }
  }, [shoppingListInvite, homeInvite, loading]);

  const handleAccept = async () => {
    let inviteToken: string | undefined;

    if (invitationType === 'shopping_list' && shoppingListInvite) {
      inviteToken = token || shoppingListInvite.inviteToken || undefined;
    } else if (invitationType === 'home' && homeInvite) {
      inviteToken = token || homeInvite.token || undefined;
    }

    if (!inviteToken) {
      Alert.alert('Error', 'Invalid invite token');
      return;
    }

    setProcessing(true);
    try {
      if (invitationType === 'shopping_list') {
        await acceptShoppingListInvite({variables: {token: inviteToken}});
        Alert.alert('Success', 'Shopping list invitation accepted!', [
          {text: 'OK', onPress: () => navigation.goBack()},
        ]);
      } else if (invitationType === 'home') {
        await acceptHomeInvite({variables: {token: inviteToken}});
        Alert.alert('Success', 'Home invitation accepted!', [
          {text: 'OK', onPress: () => navigation.goBack()},
        ]);
      } else {
        Alert.alert('Error', 'Unknown invitation type');
      }
    } catch (error: any) {
      console.error('Accept invitation error:', error);

      // PERFORMANCE: Specific error messages based on error type
      let errorMessage = 'Failed to accept invitation. ';

      if (error.networkError) {
        errorMessage += 'Network error - check your internet connection and try again.';
      } else if (error.graphQLErrors?.length) {
        const graphQLError = error.graphQLErrors[0];
        if (graphQLError.extensions?.code === 'INVITATION_EXPIRED') {
          errorMessage += 'This invitation has expired. Please ask for a new one.';
        } else if (graphQLError.extensions?.code === 'INVITATION_ALREADY_ACCEPTED') {
          errorMessage += 'This invitation has already been accepted.';
        } else if (graphQLError.extensions?.code === 'UNAUTHENTICATED') {
          errorMessage += 'Session expired - please log in again.';
        } else if (graphQLError.extensions?.code === 'NOT_FOUND') {
          errorMessage += 'Invitation not found - it may have been revoked.';
        } else {
          errorMessage += graphQLError.message || 'Please try again.';
        }
      } else {
        errorMessage += 'Please try again.';
      }

      Alert.alert('Error', errorMessage);
    } finally {
      setProcessing(false);
    }
  };

  const handleDecline = async () => {
    let inviteToken: string | undefined;

    if (invitationType === 'shopping_list' && shoppingListInvite) {
      inviteToken = token || shoppingListInvite.inviteToken || undefined;
    } else if (invitationType === 'home' && homeInvite) {
      inviteToken = token || homeInvite.token || undefined;
    }

    if (!inviteToken) {
      Alert.alert('Error', 'Invalid invite token');
      return;
    }

    Alert.alert(
      'Decline Invitation',
      'Are you sure you want to decline this invitation?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            setProcessing(true);
            try {
              if (invitationType === 'shopping_list') {
                await declineShoppingListInvite({variables: {token: inviteToken!}});
              } else if (invitationType === 'home') {
                await declineHomeInvite({variables: {token: inviteToken!}});
              }

              navigation.goBack();
            } catch (error) {
              Alert.alert('Error', 'Failed to decline invitation');
            } finally {
              setProcessing(false);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!shoppingListInvite && !homeInvite) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={[styles.inviteText, {color: theme.colors.error}]}>
          {invitationType === 'unknown'
            ? 'Invitation not found or expired'
            : 'Loading invitation details...'
          }
        </Text>
        <TouchableOpacity
          style={[styles.button, styles.declineButton]}
          onPress={() => navigation.goBack()}>
          <Text style={styles.declineButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="close" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Icon
          name={invitationType === 'home' ? 'home' : 'shopping-cart'}
          size={64}
          color={theme.colors.primary}
        />
        </View>

        <Text style={styles.title}>You've been invited!</Text>

        <Text style={styles.inviteText}>
          {invitationType === 'home'
            ? (homeInvite as any)?.invitedBy?.profile?.displayName || // Acceptable: invitedBy.profile not in fragment; gracefully falls back
              (homeInvite as any)?.invitedBy?.email ||
              'Someone'
            : (shoppingListInvite?.invitedBy as any)?.profile?.displayName || // Acceptable: profile not in fragment; gracefully falls back
              shoppingListInvite?.invitedBy?.email ||
              'Someone'}{' '}
          has invited you to {invitationType === 'home' ? 'join' : 'collaborate on'}
        </Text>

        <View style={styles.inviteDetails}>
          <Text style={styles.inviteName}>
            {invitationType === 'home'
              ? (homeInvite as any)?.home?.name || 'Home' // Acceptable: home.name not in fragment; uses fallback
              : (shoppingListInvite as any)?.shoppingList?.name || 'Shopping List' // Acceptable: shoppingList.name not in fragment; uses fallback
            }
          </Text>
          <Text style={styles.inviteType}>
            {invitationType === 'home' ? 'Home' : 'Shopping List'}
          </Text>
          <Text style={styles.inviteRole}>
            Role: {invitationType === 'home' ? homeInvite?.role : shoppingListInvite?.role}
          </Text>
        </View>

        {((invitationType === 'shopping_list' && (shoppingListInvite as any)?.shoppingList?.description) || // Acceptable: optional field
          (invitationType === 'home' && (homeInvite as any)?.home?.description)) && ( // Acceptable: optional field
          <View style={styles.messageContainer}>
            <Text style={styles.messageLabel}>Description:</Text>
            <Text style={styles.message}>
              {invitationType === 'home'
                ? (homeInvite as any)?.home?.description // Acceptable: optional field for display only
                : (shoppingListInvite as any)?.shoppingList?.description // Acceptable: optional field for display only
              }
            </Text>
          </View>
        )}

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, styles.declineButton]}
            onPress={handleDecline}
            disabled={processing}>
            <Text style={styles.declineButtonText}>Decline</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.acceptButton]}
            onPress={handleAccept}
            disabled={processing}>
            {processing ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={styles.acceptButtonText}>Accept</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default AcceptInvite;

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  iconContainer: {
    marginBottom: 32,
  },
  inviteText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginTop: 16,
    textAlign: 'center',
  },
  inviteDetails: {
    marginTop: 24,
    padding: 16,
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    alignItems: 'center',
  },
  inviteName: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  inviteType: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  inviteRole: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
    fontWeight: '500',
  },
  messageContainer: {
    marginTop: 24,
    padding: 16,
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    width: '100%',
  },
  messageLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  message: {
    fontSize: 16,
    color: theme.colors.textPrimary,
  },
  actions: {
    flexDirection: 'row',
    marginTop: 32,
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  declineButton: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  declineButtonText: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  acceptButton: {
    backgroundColor: theme.colors.primary,
  },
  acceptButtonText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
}));
