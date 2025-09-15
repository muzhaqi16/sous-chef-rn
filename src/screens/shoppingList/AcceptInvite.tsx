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
} from '#generated';

export const AcceptInvite: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const {token, inviteId} = route.params as {token?: string; inviteId?: string};
  const {theme} = useUnistyles();

  const [processing, setProcessing] = useState(false);

  // Get user's invites to find the specific invite
  const {data, loading} = useMyShoppingListInvitesQuery();

  const [acceptInvite] = useAcceptShoppingListInviteMutation();
  const [declineInvite] = useDeclineShoppingListInviteMutation();

  // Find the specific invite
  const invite = data?.myShoppingListInvites?.find(inv =>
    token ? inv.inviteToken === token : inv.id === inviteId,
  );

  const handleAccept = async () => {
    if (!token && !invite?.inviteToken) {
      Alert.alert('Error', 'Invalid invite token');
      return;
    }

    setProcessing(true);
    try {
      const inviteToken = token || invite?.inviteToken;
      await acceptInvite({variables: {token: inviteToken!}});
      Alert.alert('Success', 'Invitation accepted!', [
        {text: 'OK', onPress: () => navigation.goBack()},
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to accept invitation');
    } finally {
      setProcessing(false);
    }
  };

  const handleDecline = async () => {
    if (!token && !invite?.inviteToken) {
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
              const inviteToken = token || invite?.inviteToken;
              await declineInvite({variables: {token: inviteToken!}});
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

  if (!invite) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={[styles.inviteText, {color: theme.colors.error}]}>
          Invitation not found or expired
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
          <Icon name="shopping-cart" size={64} color={theme.colors.primary} />
        </View>

        <Text style={styles.title}>You've been invited!</Text>

        <Text style={styles.inviteText}>
          {invite?.invitedBy?.profile?.displayName ||
            invite?.invitedBy?.email ||
            'Someone'}{' '}
          has invited you to collaborate on
        </Text>

        <View style={styles.inviteDetails}>
          <Text style={styles.inviteName}>{invite?.shoppingList?.name}</Text>
          <Text style={styles.inviteType}>Shopping List</Text>
          <Text style={styles.inviteRole}>Role: {invite?.role}</Text>
        </View>

        {invite?.shoppingList?.description && (
          <View style={styles.messageContainer}>
            <Text style={styles.messageLabel}>Description:</Text>
            <Text style={styles.message}>
              {invite.shoppingList.description}
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
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
}));
