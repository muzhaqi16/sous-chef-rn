import React from 'react';
import { View } from 'react-native';
import { useFragment } from '@apollo/client/react';
import type { FragmentType } from '@apollo/client/masking';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { Card } from '#components/atoms/Card';
import { Text } from '#components/atoms/Text';
import { formatRole } from '#utils/formatters/roleFormatters';
import { firstNonBlank } from '#/utils/firstNonBlank';
import { personName } from '#/utils/formatters/memberFormatters';
import { InviteCard_InviteFragmentDoc } from './InviteCard.generated';

/** A home invitation waiting for the new account, redeemed by its link. */
export const InviteCard: React.FC<{
  inviteRef: FragmentType<typeof InviteCard_InviteFragmentDoc>;
}> = ({ inviteRef }) => {
  const { t } = useTranslation();
  const { data: invite, complete } = useFragment({
    fragment: InviteCard_InviteFragmentDoc,
    fragmentName: 'InviteCard_invite',
    from: inviteRef,
  });

  if (!complete) return null;

  const inviterName =
    firstNonBlank(invite.inviterName, personName(invite.inviter)) ??
    t('labels.someone');

  return (
    <Card padding="none" style={styles.card}>
      <Text role="subheading" style={styles.homeName}>
        {invite.home.name}
      </Text>
      <View style={styles.details}>
        <Text role="caption">
          <Text role="bodyStrong" tone="secondary">
            {t('labels.from')}:{' '}
          </Text>
          <Text role="bodyStrong">{inviterName}</Text>
        </Text>
        <Text role="caption">
          <Text role="bodyStrong" tone="secondary">
            {t('labels.role')}:{' '}
          </Text>
          <Text role="bodyStrong" tone="accent">
            {formatRole(invite.role, t)}
          </Text>
        </Text>
      </View>
      <Text role="caption" tone="secondary">
        {t('onBoarding.inviteOpenFromNotifications')}
      </Text>
    </Card>
  );
};

const styles = StyleSheet.create(theme => ({
  card: {
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderWidth: theme.borderWidth.hairline,
    borderColor: theme.colors.border,
  },
  homeName: {
    marginBottom: theme.spacing.md,
  },
  details: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
}));
