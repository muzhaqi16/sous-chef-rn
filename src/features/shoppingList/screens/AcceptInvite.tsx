import React, { useState } from 'react';
import { View } from 'react-native';
import {
  Pressable,
  OnPrimaryActivityIndicator,
} from '#components/atoms/themedComponents';
import { alertService } from '#/services/alertService';
import { Icon } from '#utils/iconUtils';
import { useRoute } from '@react-navigation/native';
import { StyleSheet } from 'react-native-unistyles';
import { useInviteByToken } from '#features/shoppingList/hooks/useInviteByToken';
import { errorService, localizedErrorMessage } from '#/services/errorService';
import { executeWithLoadingState } from '#/utils/finallyHelpers';
import { SousChefLoader } from '#components/atoms/SousChefLoader';
import { Text } from '#components/atoms/Text';
import { useTranslation } from '#/i18n';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { commonStyles } from '#/styles/commonStyles';
import { Screen } from '#components/templates/Screen';

export const AcceptInvite: React.FC = () => {
  const { t } = useTranslation();
  const { goBack } = useAppNavigation();
  const route = useRoute();
  const { token } = (route.params ?? {}) as {
    token?: string;
  };

  const [processing, setProcessing] = useState(false);

  // This screen is the deep-link acceptance surface: the invite is resolved
  // straight from the URL token (accept-invitation?token=…), since it may not be
  // in the user's cached pending list on a fresh device. In-app acceptance from
  // a notification is handled by InvitationAcceptanceModal.
  const {
    invitationType,
    hasInvite,
    inviteRole,
    shoppingListInviteDisplay,
    homeInviteDisplay,
    loading,
    accept,
    decline,
  } = useInviteByToken(token);

  // The invite only ever resolves from the route token, so that token is the
  // credential the accept/decline mutations need.
  const resolveInviteToken = (): string | undefined =>
    invitationType === 'unknown' ? undefined : token;

  const handleAccept = () => {
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
        if (invitationType === 'unknown') {
          alertService.alert(
            t('labels.error'),
            t('invitationAcceptance.unknownType'),
          );
          return;
        }
        await accept(inviteToken);
        alertService.alert(
          t('labels.success'),
          invitationType === 'home'
            ? t('invitationAcceptance.homeAccepted')
            : t('invitationAcceptance.shoppingListAccepted'),
          [{ text: t('labels.ok'), onPress: () => goBack() }],
        );
      },
      setProcessing,
      (error: unknown) => {
        errorService.reportError(error, {
          operation: 'AcceptInvite.acceptInvitation',
        });
        // Code-resolved copy: the server's message is unlocalizable English,
        // and the precise version is in the report above either way.
        alertService.alert(
          t('labels.error'),
          localizedErrorMessage(error, t('errors.acceptInviteFailed')),
        );
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
                await decline(inviteToken);
                goBack();
              },
              setProcessing,
              () => {
                alertService.alert(
                  t('labels.error'),
                  t('errors.declineInviteFailed'),
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
      <View style={commonStyles.loadingContainer}>
        <SousChefLoader
          size="small"
          showBrand={false}
          message={t('labels.loading')}
        />
      </View>
    );
  }

  if (!hasInvite) {
    return (
      <View style={commonStyles.loadingContainer}>
        <Text align="center" tone="error" style={styles.inviteText}>
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
          <Text role="bodyStrong" style={styles.declineButtonText}>
            {t('labels.goBack')}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <Screen header={{ close: () => goBack() }} scroll="list" gutter="none">
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Icon
            name={invitationType === 'home' ? 'home' : 'shopping-cart'}
            size={64}
            tone="primary"
          />
        </View>

        <Text role="heading" align="center" style={styles.title}>
          {t('invitationAcceptance.invitedHeading')}
        </Text>

        <Text tone="secondary" align="center" style={styles.inviteText}>
          {invitationType === 'home'
            ? t('invitationAcceptance.homeInviteText', {
                inviter:
                  homeInviteDisplay?.inviter?.profile?.displayName ||
                  homeInviteDisplay?.inviter?.email ||
                  t('labels.someone'),
              })
            : t('invitationAcceptance.listInviteText', {
                inviter:
                  shoppingListInviteDisplay?.invitedBy?.profile?.displayName ||
                  shoppingListInviteDisplay?.invitedBy?.email ||
                  t('labels.someone'),
              })}
        </Text>

        <View style={styles.inviteDetails}>
          <Text role="heading">
            {invitationType === 'home'
              ? homeInviteDisplay?.home?.name ||
                t('invitationAcceptance.resourceHome')
              : shoppingListInviteDisplay?.shoppingList?.name ||
                t('labels.shoppingList')}
          </Text>
          <Text role="caption" tone="secondary" style={styles.inviteType}>
            {invitationType === 'home'
              ? t('invitationAcceptance.resourceHome')
              : t('labels.shoppingList')}
          </Text>
          <Text role="label" tone="secondary" style={styles.inviteRole}>
            {t('invitationAcceptance.roleLabel', {
              role: inviteRole,
            })}
          </Text>
        </View>

        {!!(
          invitationType === 'shopping_list' &&
          shoppingListInviteDisplay?.shoppingList?.description
        ) && (
          <View style={styles.messageContainer}>
            <Text role="label" tone="secondary" style={styles.messageLabel}>
              {t('invitationAcceptance.descriptionLabel')}
            </Text>
            <Text>{shoppingListInviteDisplay?.shoppingList?.description}</Text>
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
            <Text role="bodyStrong" style={styles.declineButtonText}>
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
              <OnPrimaryActivityIndicator size="small" />
            ) : (
              <Text role="bodyStrong" style={styles.acceptButtonText}>
                {t('labels.accept')}
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </Screen>
  );
};

export default AcceptInvite;

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
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
    gap: theme.spacing.base,
  },
  declineButton: {
    flex: 1,
    paddingVertical: theme.spacing.smPlus,
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: theme.borderWidth.hairline,
    borderColor: theme.colors.border,
  },
  declineButtonText: {
    color: theme.colors.textPrimary,
  },
  acceptButton: {
    flex: 1,
    paddingVertical: theme.spacing.smPlus,
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
  },
  acceptButtonText: {
    color: theme.colors.onPrimary,
  },
}));
