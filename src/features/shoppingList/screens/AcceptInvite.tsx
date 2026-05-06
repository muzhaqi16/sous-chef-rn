import React, { useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { alertService } from '#/services/alertService';
import { Icon } from '#utils/iconUtils';
import { Header } from '#components/molecules/Header';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useMutation, useQuery } from '@apollo/client/react';
import {
  MyShoppingListInvitesDocument,
  AcceptShoppingListInviteDocument,
  DeclineShoppingListInviteDocument,
} from '#features/shoppingList/graphql/collaboration.generated';
import {
  GetMyPendingInvitesDocument,
  AcceptHomeInviteDocument,
  DeclineHomeInviteDocument,
} from '#operations/home/home.generated';
import { errorService, getErrorMessage } from '#/services/errorService';
import { executeWithLoadingState } from '#/utils/compilerSafeWrappers';
import { SousChefLoader } from '#/components/base/SousChefLoader';
import { Text } from '#components/atoms/Text';

type InvitationType = 'shopping_list' | 'home' | 'unknown';

export const AcceptInvite: React.FC = () => {
  const { goBack } = useNavigation();
  const route = useRoute();
  const { token, inviteId } = (route.params ?? {}) as {
    token?: string;
    inviteId?: string;
  };
  const { theme } = useUnistyles();

  const [processing, setProcessing] = useState(false);

  // Get shopping list invites
  const { data: shoppingListData, loading: shoppingListLoading } = useQuery(
    MyShoppingListInvitesDocument,
  );

  // Get home invites
  const { data: homeInviteData, loading: homeInviteLoading } = useQuery(
    GetMyPendingInvitesDocument,
  );

  // Mutations for shopping list invites
  const [acceptShoppingListInvite] = useMutation(
    AcceptShoppingListInviteDocument,
  );
  const [declineShoppingListInvite] = useMutation(
    DeclineShoppingListInviteDocument,
  );

  // Mutations for home invites
  const [acceptHomeInvite] = useMutation(AcceptHomeInviteDocument);
  const [declineHomeInvite] = useMutation(DeclineHomeInviteDocument);

  const loading = shoppingListLoading || homeInviteLoading;

  // Find the specific invite and determine type
  // Note: Tokens are no longer exposed in query responses for security.
  // When navigating via deep link, token comes from route params.
  // When navigating via in-app UI, inviteId is used to match.
  const shoppingListInvite =
    shoppingListData?.me?.pendingCollaborationInvites?.find(inv =>
      inviteId ? inv.id === inviteId : false,
    );

  const homeInvite = homeInviteData?.me?.pendingHomeInvites?.find(inv =>
    inviteId ? inv.id === inviteId : false,
  );

  const invitationType: InvitationType = shoppingListInvite
    ? 'shopping_list'
    : homeInvite
    ? 'home'
    : 'unknown';

  const resolveInviteToken = (): string | undefined => {
    if (invitationType === 'shopping_list' && shoppingListInvite) {
      return token || shoppingListInvite.id;
    }
    if (invitationType === 'home' && homeInvite) {
      return token || homeInvite.id;
    }
    return undefined;
  };

  const handleAccept = () => {
    const inviteToken = resolveInviteToken();

    if (!inviteToken) {
      alertService.alert('Error', 'Invalid invitation');
      return;
    }

    executeWithLoadingState(
      async () => {
        if (invitationType === 'shopping_list') {
          await acceptShoppingListInvite({ variables: { token: inviteToken } });
          alertService.alert('Success', 'Shopping list invitation accepted!', [
            { text: 'OK', onPress: () => goBack() },
          ]);
        } else if (invitationType === 'home') {
          await acceptHomeInvite({ variables: { token: inviteToken } });
          alertService.alert('Success', 'Home invitation accepted!', [
            { text: 'OK', onPress: () => goBack() },
          ]);
        } else {
          alertService.alert('Error', 'Unknown invitation type');
        }
      },
      setProcessing,
      (error: unknown) => {
        errorService.reportError(error, {
          operation: 'AcceptInvite.acceptInvitation',
        });
        alertService.alert('Error', getErrorMessage(error));
      },
    );
  };

  const handleDecline = async () => {
    const inviteToken = resolveInviteToken();

    if (!inviteToken) {
      alertService.alert('Error', 'Invalid invitation');
      return;
    }

    alertService.alert(
      'Decline Invitation',
      'Are you sure you want to decline this invitation?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: () => {
            executeWithLoadingState(
              async () => {
                if (invitationType === 'shopping_list') {
                  await declineShoppingListInvite({
                    variables: { token: inviteToken! },
                  });
                } else if (invitationType === 'home') {
                  await declineHomeInvite({
                    variables: { token: inviteToken! },
                  });
                }

                goBack();
              },
              setProcessing,
              () => {
                alertService.alert('Error', 'Failed to decline invitation');
              },
            );
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <SousChefLoader size="small" showBrand={false} message="Loading" />
      </View>
    );
  }

  if (!shoppingListInvite && !homeInvite) {
    return (
      <View style={styles.loadingContainer}>
        <Text
          size="md"
          align="center"
          style={[styles.inviteText, { color: theme.colors.error }]}
        >
          {invitationType === 'unknown'
            ? 'Invitation not found or expired'
            : 'Loading invitation details...'}
        </Text>
        <Pressable
          style={({ pressed }) => [
            styles.declineButton,
            pressed && { opacity: 0.7 },
          ]}
          onPress={() => goBack()}
        >
          <Text size="md" weight="semibold" style={styles.declineButtonText}>
            Go Back
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header onClose={() => goBack()} />

      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Icon
            name={invitationType === 'home' ? 'home' : 'shopping-cart'}
            size={64}
            tone="primary"
          />
        </View>

        <Text size="lg" weight="semibold" align="center" style={styles.title}>
          You've been invited!
        </Text>

        <Text
          size="md"
          tone="secondary"
          align="center"
          style={styles.inviteText}
        >
          {invitationType === 'home'
            ? (homeInvite as any)?.invitedBy?.profile?.displayName || // Acceptable: invitedBy.profile not in fragment; gracefully falls back
              (homeInvite as any)?.invitedBy?.email ||
              'Someone'
            : (shoppingListInvite?.invitedBy as any)?.profile?.displayName || // Acceptable: profile not in fragment; gracefully falls back
              shoppingListInvite?.invitedBy?.email ||
              'Someone'}{' '}
          has invited you to{' '}
          {invitationType === 'home' ? 'join' : 'collaborate on'}
        </Text>

        <View style={styles.inviteDetails}>
          <Text size="lg" weight="semibold">
            {
              invitationType === 'home'
                ? (homeInvite as any)?.home?.name || 'Home' // Acceptable: home.name not in fragment; uses fallback
                : (shoppingListInvite as any)?.shoppingList?.name ||
                  'Shopping List' // Acceptable: shoppingList.name not in fragment; uses fallback
            }
          </Text>
          <Text size="sm" tone="secondary" style={styles.inviteType}>
            {invitationType === 'home' ? 'Home' : 'Shopping List'}
          </Text>
          <Text
            size="xs"
            weight="medium"
            tone="secondary"
            style={styles.inviteRole}
          >
            Role:{' '}
            {invitationType === 'home'
              ? homeInvite?.role
              : shoppingListInvite?.role}
          </Text>
        </View>

        {!!(
          (invitationType === 'shopping_list' &&
            (shoppingListInvite as any)?.shoppingList?.description) || // Acceptable: optional field
          (invitationType === 'home' && (homeInvite as any)?.home?.description)
        ) && (
          <View style={styles.messageContainer}>
            <Text
              size="sm"
              weight="semibold"
              tone="secondary"
              style={styles.messageLabel}
            >
              Description:
            </Text>
            <Text size="md">
              {
                invitationType === 'home'
                  ? (homeInvite as any)?.home?.description // Acceptable: optional field for display only
                  : (shoppingListInvite as any)?.shoppingList?.description // Acceptable: optional field for display only
              }
            </Text>
          </View>
        )}

        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [
              styles.declineButton,
              pressed && { opacity: 0.7 },
            ]}
            onPress={handleDecline}
            disabled={processing}
          >
            <Text size="md" weight="semibold" style={styles.declineButtonText}>
              Decline
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.acceptButton,
              pressed && { opacity: 0.7 },
            ]}
            onPress={handleAccept}
            disabled={processing}
          >
            {processing ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text size="md" weight="semibold" style={styles.acceptButtonText}>
                Accept
              </Text>
            )}
          </Pressable>
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
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  title: {
    flex: 1,
  },
  iconContainer: {
    marginBottom: theme.spacing.xl,
  },
  inviteText: {
    marginTop: theme.spacing.md,
  },
  inviteDetails: {
    marginTop: theme.spacing.xl,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.sm,
    alignItems: 'center',
  },
  inviteType: {
    marginTop: theme.spacing.xs,
  },
  inviteRole: {
    marginTop: 2,
  },
  messageContainer: {
    marginTop: theme.spacing.xl,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.sm,
    width: '100%',
  },
  messageLabel: {
    marginBottom: theme.spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    marginTop: theme.spacing.xl,
    gap: theme.spacing['3'],
  },
  declineButton: {
    flex: 1,
    paddingVertical: theme.spacing.sm + 2,
    borderRadius: theme.radii.sm,
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  declineButtonText: {
    color: theme.colors.textPrimary,
  },
  acceptButton: {
    flex: 1,
    paddingVertical: theme.spacing.sm + 2,
    borderRadius: theme.radii.sm,
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
  },
  acceptButtonText: {
    color: theme.colors.white,
  },
}));
