import React, { useState } from 'react';
import { View } from 'react-native';
import { alertService } from '#/services/alertService';
import { toastService } from '#/services/toastService';
import { Badge } from '#components/atoms/Badge';
import { DetailTitleRow } from '#components/atoms/DetailTitleRow';
import { Divider } from '#components/atoms/Divider';
import { InfoRow } from '#components/atoms/InfoRow';
import { DetailSection } from '#components/molecules/DetailSection';
import { Button } from '#components/molecules/Button';
import { formatRoleDisplay } from '#features/shoppingList/utils/ownershipHelpers';
import { useRoute } from '@react-navigation/native';
import { StyleSheet } from 'react-native-unistyles';
import { useInviteByToken } from '#features/shoppingList/screens/useInviteByToken';
import { executeWithLoadingState } from '#/utils/finallyHelpers';
import { Text } from '#components/atoms/Text';
import { useTranslation } from '#/i18n';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { Screen } from '#components/templates/Screen';
import { firstNonBlank } from '#/utils/firstNonBlank';
import { personName } from '#/utils/formatters/memberFormatters';
import { destructiveConfirm } from '#/services/destructiveConfirm';

export const AcceptInvite: React.FC = () => {
  const { t } = useTranslation();
  const { goBack } = useAppNavigation();
  const route = useRoute();
  const { token } = (route.params ?? {}) as {
    token?: string;
  };

  const [processing, setProcessing] = useState(false);

  // The deep-link surface resolves the invite from the URL token, as a fresh
  // device's cached pending list may not hold it; in-app acceptance is
  // InvitationAcceptanceModal's.
  const {
    invitationType,
    inviteState,
    retry,
    inviteRole,
    shoppingListInviteDisplay,
    homeInviteDisplay,
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

    void executeWithLoadingState(async () => {
      if (!(await accept(inviteToken))) return;
      // Leaves at once: an answered invite reads as unavailable from its token.
      toastService.success(
        invitationType === 'home'
          ? t('invitationAcceptance.homeAccepted')
          : t('invitationAcceptance.shoppingListAccepted'),
      );
      goBack();
    }, setProcessing);
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
      destructiveConfirm(t('labels.decline'), () => {
        void executeWithLoadingState(async () => {
          if (await decline(inviteToken)) goBack();
        }, setProcessing);
      }),
    );
  };

  const isHome = invitationType === 'home';
  const invite = isHome
    ? {
        inviterName: homeInviteDisplay?.inviterName,
        inviter: homeInviteDisplay?.inviter,
      }
    : {
        inviterName: shoppingListInviteDisplay?.inviterName,
        inviter: shoppingListInviteDisplay?.invitedBy,
      };
  // An invite names its inviter itself: the invitee shares nothing with them
  // yet, so `User.displayName` gives only a name the inviter chose.
  const inviterName =
    firstNonBlank(invite.inviterName, personName(invite.inviter)) ??
    t('labels.someone');

  const entityName = isHome
    ? homeInviteDisplay?.home.name ?? t('labels.home')
    : shoppingListInviteDisplay?.shoppingList.name ?? t('labels.shoppingList');
  const description = isHome
    ? null
    : shoppingListInviteDisplay?.shoppingList.description;

  return (
    <Screen
      header={{ close: () => goBack() }}
      state={{
        value: inviteState,
        onRetry: retry,
        empty: {
          icon: 'mail-outline',
          title: t('invitationAcceptance.notFound'),
          description: t('errors.invitationUnavailable'),
          action: { label: t('labels.goBack'), onPress: () => goBack() },
        },
      }}
      footer={
        inviteState === 'ready' ? (
          <View style={styles.actions}>
            <Button
              variant="outline"
              onPress={handleDecline}
              disabled={processing}
              style={styles.action}
            >
              {t('labels.decline')}
            </Button>
            <Button
              onPress={handleAccept}
              loading={processing}
              style={styles.action}
            >
              {t('labels.accept')}
            </Button>
          </View>
        ) : undefined
      }
    >
      <View style={styles.intro}>
        <Text role="heading">{t('invitationAcceptance.invitedHeading')}</Text>
        <Text role="body" tone="secondary">
          {isHome
            ? t('invitationAcceptance.homeInviteText', {
                inviter: inviterName,
              })
            : t('invitationAcceptance.listInviteText', {
                inviter: inviterName,
              })}
        </Text>
      </View>

      <DetailSection>
        <DetailTitleRow
          title={entityName}
          flush
          trailing={
            <Badge variant="primary" icon={isHome ? 'home' : 'cart'}>
              {isHome ? t('labels.home') : t('labels.shoppingList')}
            </Badge>
          }
        />
        <Divider style={styles.divider} />
        <InfoRow
          label={t('labels.role')}
          value={formatRoleDisplay(inviteRole, t)}
          showColon={false}
          showBorder={false}
        />
      </DetailSection>

      {!!description && (
        <DetailSection title={t('labels.description')}>
          <Text role="body">{description}</Text>
        </DetailSection>
      )}
    </Screen>
  );
};

export default AcceptInvite;

const styles = StyleSheet.create(theme => ({
  intro: {
    gap: theme.spacing.xs,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
  },
  divider: {
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  action: {
    flex: 1,
  },
}));
