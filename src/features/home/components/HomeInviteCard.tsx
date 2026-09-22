import React from 'react';
import { View } from 'react-native';
import { useFragment } from '@apollo/client/react';
import type { FragmentType } from '@apollo/client/masking';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import {
  formatInviteStatus,
  getInviteStatusKey,
  INVITE_STATUS_TONE,
  type InviteStatusKey,
} from '#features/home/utils/inviteFormatters';
import { Text, type TextTone } from '#components/atoms/Text';
import { InviteStatus } from '#/graphql/generated/schemaTypes';
import { HomeInviteCard_InviteFragmentDoc } from './HomeInviteCard.generated';
import { useTranslation } from '#/i18n';

interface HomeInviteCardProps {
  inviteRef: FragmentType<typeof HomeInviteCard_InviteFragmentDoc>;
  displayName: string;
  canRevoke?: boolean;
  onRevoke: () => void;
}

/**
 * The two `status`-variant surfaces, each owning its own `useVariants` call.
 * Extracted so `HomeInviteCard` keeps compiling: Unistyles' variant transform
 * bails the React Compiler out of the containing function, and this card
 * renders once per pending invite.
 */
const InviteSurface: React.FC<{
  status: InviteStatusKey;
  children: React.ReactNode;
}> = ({ status, children }) => {
  styles.useVariants({ status });
  return <View style={styles.inviteCard}>{children}</View>;
};

const InviteStatusBadge: React.FC<{
  status: InviteStatusKey;
  tone: TextTone;
  children: React.ReactNode;
}> = ({ status, tone, children }) => {
  styles.useVariants({ status });
  return (
    <View style={styles.inviteStatusBadge}>
      <Text role="label" tone={tone}>
        {children}
      </Text>
    </View>
  );
};

/**
 * Subscribes to its own HomeInvite cache entry via `useFragment`, so a status
 * change (a revoke, say) re-renders this card alone.
 */
export const HomeInviteCard: React.FC<HomeInviteCardProps> = ({
  inviteRef,
  displayName,
  canRevoke,
  onRevoke,
}) => {
  const { t } = useTranslation();
  const { data: invite, complete } = useFragment({
    fragment: HomeInviteCard_InviteFragmentDoc,
    fragmentName: 'HomeInviteCard_invite',
    from: inviteRef,
  });

  if (!complete) return null;

  const statusKey = getInviteStatusKey(invite.status);
  const statusText = formatInviteStatus(invite.status, t);

  return (
    <InviteSurface status={statusKey}>
      <View style={styles.inviteInfo}>
        <Text role="bodyStrong" style={styles.inviteName}>
          {displayName}
        </Text>
        <Text role="caption" tone="secondary">
          {invite.email}
        </Text>
      </View>
      <View style={styles.inviteActions}>
        <InviteStatusBadge
          status={statusKey}
          tone={INVITE_STATUS_TONE[invite.status]}
        >
          {statusText}
        </InviteStatusBadge>
        {!!canRevoke && invite.status === InviteStatus.Pending && (
          <AppPressable
            style={styles.revokeButton}
            onPress={onRevoke}
            accessibilityLabel={t('a11y.revokeInvite')}
          >
            <Icon name="close" size={20} />
          </AppPressable>
        )}
      </View>
    </InviteSurface>
  );
};

const styles = StyleSheet.create(theme => ({
  inviteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    padding: theme.spacing.md,
    marginVertical: theme.spacing.xs,
    borderWidth: theme.borderWidth.hairline,
    borderStyle: 'dashed',
    backgroundColor: theme.colors.surface,
    variants: {
      status: {
        pending: { borderColor: theme.colors.status.pending },
        accepted: { borderColor: theme.colors.status.accepted },
        declined: { borderColor: theme.colors.status.declined },
        expired: { borderColor: theme.colors.status.expired },
      },
    },
  },
  inviteInfo: {
    flex: 1,
  },
  inviteName: {
    marginBottom: theme.spacing['2xs'],
  },
  inviteActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  inviteStatusBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
    variants: {
      status: {
        pending: { backgroundColor: theme.colors.status.pending + '20' },
        accepted: { backgroundColor: theme.colors.status.accepted + '20' },
        declined: { backgroundColor: theme.colors.status.declined + '20' },
        expired: { backgroundColor: theme.colors.status.expired + '20' },
      },
    },
  },
  revokeButton: {
    padding: theme.spacing.xs,
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.validation.errorBg,
  },
}));
