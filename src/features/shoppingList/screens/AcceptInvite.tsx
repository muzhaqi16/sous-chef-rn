import React, { useState } from 'react';
import { View } from 'react-native';
import {
  Pressable,
  WhiteActivityIndicator,
} from '#components/atoms/themedComponents';
import { alertService } from '#/services/alertService';
import { useVerifiedEmailGate } from '#hooks/auth/useEmailVerification';
import { Icon } from '#utils/iconUtils';
import { Header } from '#components/molecules/Header';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StyleSheet } from 'react-native-unistyles';
import { useFragment, useMutation, useQuery } from '@apollo/client/react';
import {
  AcceptShoppingListInviteDocument,
  DeclineShoppingListInviteDocument,
} from '#features/shoppingList/graphql/collaboration.generated';
import {
  AcceptHomeInviteDocument,
  DeclineHomeInviteDocument,
} from '#operations/home/home.generated';
import {
  AcceptInvite_ShoppingListInviteFragmentDoc,
  AcceptInvite_HomeInviteFragmentDoc,
  GetHomeInviteByTokenDocument,
  GetShoppingListInviteByTokenDocument,
  type AcceptInvite_ShoppingListInviteFragment,
  type AcceptInvite_HomeInviteFragment,
} from './AcceptInvite.generated';
import { errorService, getErrorMessage } from '#/services/errorService';
import { executeWithLoadingState } from '#/utils/compilerSafeWrappers';
import { SousChefLoader } from '#/components/base/SousChefLoader';
import { Text } from '#components/atoms/Text';
import { useTranslation } from 'react-i18next';

type InvitationType = 'shopping_list' | 'home' | 'unknown';

export const AcceptInvite: React.FC = () => {
  const { t } = useTranslation();
  const { goBack } = useNavigation();
  const route = useRoute();
  const { token } = (route.params ?? {}) as {
    token?: string;
  };

  const [processing, setProcessing] = useState(false);

  // This screen is the deep-link acceptance surface: the invite is resolved
  // straight from the URL token (accept-invitation?token=…) via the *ByToken
  // queries, since it may not be in the user's cached pending list on a fresh
  // device. In-app acceptance from a notification is handled separately by
  // InvitationAcceptanceModal.
  const { data: tokenHomeInviteData, loading: tokenHomeInviteLoading } =
    useQuery(GetHomeInviteByTokenDocument, {
      variables: { token: token ?? '' },
      skip: !token,
    });
  const { data: tokenListInviteData, loading: tokenListInviteLoading } =
    useQuery(GetShoppingListInviteByTokenDocument, {
      variables: { token: token ?? '' },
      skip: !token,
    });

  // Mutations for shopping list invites
  const { requireVerifiedEmail } = useVerifiedEmailGate();
  const [acceptShoppingListInvite] = useMutation(
    AcceptShoppingListInviteDocument,
  );
  const [declineShoppingListInvite] = useMutation(
    DeclineShoppingListInviteDocument,
  );

  // Mutations for home invites
  const [acceptHomeInvite] = useMutation(AcceptHomeInviteDocument);
  const [declineHomeInvite] = useMutation(DeclineHomeInviteDocument);

  const loading = tokenHomeInviteLoading || tokenListInviteLoading;

  const shoppingListInvite =
    tokenListInviteData?.shoppingListInviteByToken ?? null;
  const homeInvite = tokenHomeInviteData?.homeInviteByToken ?? null;

  // Unmask display fields via useFragment (pattern B — resilient fallback).
  // The queries already select these fields, so the cache has them;
  // useFragment reads from the normalized cache without needing a spread.
  const shoppingListFragmentResult = useFragment({
    fragment: AcceptInvite_ShoppingListInviteFragmentDoc,
    fragmentName: 'AcceptInvite_shoppingListInvite',
    from: shoppingListInvite ?? {
      __typename: 'ShoppingListCollaborator',
      id: '',
    },
  });
  const shoppingListInviteData: AcceptInvite_ShoppingListInviteFragment | null =
    shoppingListInvite && shoppingListFragmentResult.complete
      ? shoppingListFragmentResult.data
      : null;

  const homeFragmentResult = useFragment({
    fragment: AcceptInvite_HomeInviteFragmentDoc,
    fragmentName: 'AcceptInvite_homeInvite',
    from: homeInvite ?? { __typename: 'HomeInvite', id: '' },
  });
  const homeInviteDisplay: AcceptInvite_HomeInviteFragment | null =
    homeInvite && homeFragmentResult.complete ? homeFragmentResult.data : null;

  const invitationType: InvitationType = shoppingListInvite
    ? 'shopping_list'
    : homeInvite
    ? 'home'
    : 'unknown';

  // The invite only ever resolves from the route token, so that token is the
  // credential the accept/decline mutations need.
  const resolveInviteToken = (): string | undefined =>
    invitationType === 'unknown' ? undefined : token;

  const handleAccept = () => {
    // Accepting joins a shared home or list, so it sits behind the same gate as
    // joining by code. Declining stays open — an unverified account must always
    // be able to clear an invitation it can't act on.
    if (!requireVerifiedEmail()) return;

    const inviteToken = resolveInviteToken();

    if (!inviteToken) {
      alertService.alert(
        t('labels.error'),
        t('invitationAcceptance.invalidInvitation'),
      );
      return;
    }

    executeWithLoadingState(
      async () => {
        if (invitationType === 'shopping_list') {
          await acceptShoppingListInvite({
            variables: { input: { token: inviteToken } },
          });
          alertService.alert(
            t('invitationAcceptance.successTitle'),
            t('invitationAcceptance.shoppingListAccepted'),
            [{ text: t('labels.ok'), onPress: () => goBack() }],
          );
        } else if (invitationType === 'home') {
          await acceptHomeInvite({
            variables: { input: { token: inviteToken } },
          });
          alertService.alert(
            t('invitationAcceptance.successTitle'),
            t('invitationAcceptance.homeAccepted'),
            [{ text: t('labels.ok'), onPress: () => goBack() }],
          );
        } else {
          alertService.alert(
            t('labels.error'),
            t('invitationAcceptance.unknownType'),
          );
        }
      },
      setProcessing,
      (error: unknown) => {
        errorService.reportError(error, {
          operation: 'AcceptInvite.acceptInvitation',
        });
        alertService.alert(t('labels.error'), getErrorMessage(error));
      },
    );
  };

  const handleDecline = async () => {
    const inviteToken = resolveInviteToken();

    if (!inviteToken) {
      alertService.alert(
        t('labels.error'),
        t('invitationAcceptance.invalidInvitation'),
      );
      return;
    }

    alertService.alert(
      t('confirmations.declineInvitationTitle'),
      t('invitationAcceptance.declineConfirm'),
      [
        { text: t('labels.cancel'), style: 'cancel' },
        {
          text: t('labels.decline'),
          style: 'destructive',
          onPress: () => {
            executeWithLoadingState(
              async () => {
                if (invitationType === 'shopping_list') {
                  await declineShoppingListInvite({
                    variables: { input: { token: inviteToken! } },
                  });
                } else if (invitationType === 'home') {
                  await declineHomeInvite({
                    variables: { input: { token: inviteToken! } },
                  });
                }

                goBack();
              },
              setProcessing,
              () => {
                alertService.alert(
                  t('labels.error'),
                  t('invitationAcceptance.declineFailedShort'),
                );
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
        <SousChefLoader
          size="small"
          showBrand={false}
          message={t('invitationAcceptance.loadingMessage')}
        />
      </View>
    );
  }

  if (!shoppingListInvite && !homeInvite) {
    return (
      <View style={styles.loadingContainer}>
        <Text size="md" align="center" tone="error" style={styles.inviteText}>
          {invitationType === 'unknown'
            ? t('invitationAcceptance.notFound')
            : t('invitationAcceptance.loadingDetails')}
        </Text>
        <Pressable
          style={({ pressed }) => [
            styles.declineButton,
            pressed && { opacity: 0.7 },
          ]}
          onPress={() => goBack()}
        >
          <Text size="md" weight="semibold" style={styles.declineButtonText}>
            {t('labels.goBack')}
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
          {t('invitationAcceptance.invitedHeading')}
        </Text>

        <Text
          size="md"
          tone="secondary"
          align="center"
          style={styles.inviteText}
        >
          {invitationType === 'home'
            ? t('invitationAcceptance.homeInviteText', {
                inviter:
                  homeInviteDisplay?.inviter?.profile?.displayName ||
                  homeInviteDisplay?.inviter?.email ||
                  t('invitationAcceptance.someone'),
              })
            : t('invitationAcceptance.listInviteText', {
                inviter:
                  shoppingListInviteData?.invitedBy?.profile?.displayName ||
                  shoppingListInviteData?.invitedBy?.email ||
                  t('invitationAcceptance.someone'),
              })}
        </Text>

        <View style={styles.inviteDetails}>
          <Text size="lg" weight="semibold">
            {invitationType === 'home'
              ? homeInviteDisplay?.home?.name ||
                t('invitationAcceptance.resourceHome')
              : shoppingListInviteData?.shoppingList?.name ||
                t('invitationAcceptance.resourceList')}
          </Text>
          <Text size="sm" tone="secondary" style={styles.inviteType}>
            {invitationType === 'home'
              ? t('invitationAcceptance.resourceHome')
              : t('invitationAcceptance.resourceList')}
          </Text>
          <Text
            size="xs"
            weight="medium"
            tone="secondary"
            style={styles.inviteRole}
          >
            {t('invitationAcceptance.roleLabel', {
              role:
                (invitationType === 'home'
                  ? homeInvite?.role
                  : shoppingListInvite?.role) ?? '',
            })}
          </Text>
        </View>

        {!!(
          invitationType === 'shopping_list' &&
          shoppingListInviteData?.shoppingList?.description
        ) && (
          <View style={styles.messageContainer}>
            <Text
              size="sm"
              weight="semibold"
              tone="secondary"
              style={styles.messageLabel}
            >
              {t('invitationAcceptance.descriptionLabel')}
            </Text>
            <Text size="md">
              {shoppingListInviteData?.shoppingList?.description}
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
              {t('labels.decline')}
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
              <WhiteActivityIndicator size="small" />
            ) : (
              <Text size="md" weight="semibold" style={styles.acceptButtonText}>
                {t('labels.accept')}
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
    borderCurve: 'continuous',
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
    borderCurve: 'continuous',
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
    borderCurve: 'continuous',
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
    borderCurve: 'continuous',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
  },
  acceptButtonText: {
    color: theme.colors.white,
  },
}));
