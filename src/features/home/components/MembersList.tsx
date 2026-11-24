import React from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { StyleSheet } from 'react-native-unistyles';
import { useUser } from '#store/useAppStore';
import { formatRole } from '#/utils/formatters/roleFormatters';
import {
  formatInviteStatus,
  getInviteDisplayName,
  getInviteStatusKey,
} from '#features/home/utils/inviteFormatters';
import { INVITE_STATUS_TONE } from './inviteStatusTone';
import {
  getMemberDisplayName,
  type Member,
} from '#/utils/formatters/memberFormatters';
import { Text } from '#components/atoms/Text';
import { IconButton } from '#components/atoms/IconButton';
import type { MembershipRole } from '#/graphql/generated/schemaTypes';
import type { HomeCard_HomeFragment } from './HomeCard.generated';

type ListInvite =
  HomeCard_HomeFragment['invitesConnection']['edges'][number]['node'];

const InviteChip: React.FC<{ invite: ListInvite }> = ({ invite }) => {
  const { t } = useTranslation();
  const statusKey = getInviteStatusKey(invite.status);
  const displayName = getInviteDisplayName(invite, t);
  const tone = INVITE_STATUS_TONE[invite.status];
  const variantStyles = styles.useVariants({ status: statusKey });
  return (
    <View style={variantStyles.inviteChip}>
      <Text role="bodyStrong" tone={tone}>
        {displayName}
      </Text>
      <Text role="bodyStrong" tone={tone} align="center">
        {formatInviteStatus(invite.status, t)}
      </Text>
    </View>
  );
};

const MemberChip: React.FC<{
  displayName: string;
  role: MembershipRole;
  isCurrentUser: boolean;
}> = ({ displayName, role, isCurrentUser }) => {
  const { t } = useTranslation();
  const variantStyles2 = styles.useVariants({ currentUser: isCurrentUser });
  return (
    <View style={variantStyles2.memberChip}>
      <Text role="bodyStrong" style={variantStyles2.memberChipText}>
        {displayName}
      </Text>
      <Text role="caption" style={variantStyles2.memberRole}>
        {formatRole(role, t)}
      </Text>
    </View>
  );
};

interface MembersListProps {
  members: Member[];
  invites?: ListInvite[];
  /** Offered beside the heading when the viewer may invite. */
  onInvite?: () => void;
}

export const MembersList: React.FC<MembersListProps> = ({
  members,
  invites = [],
  onInvite,
}) => {
  const { t } = useTranslation();
  const currentUser = useUser();

  // The API returns only pending invites.
  const pendingInvites = invites;

  if (members.length === 0 && pendingInvites.length === 0 && !onInvite) {
    return null;
  }

  return (
    <View style={styles.membersSection}>
      <View style={styles.membersHeader}>
        <Text role="label" tone="secondary">
          {t('labels.members')}
        </Text>
        {onInvite ? (
          <IconButton
            name="person-add-outline"
            tone="primary"
            onPress={onInvite}
            accessibilityLabel={t('labels.inviteMemberToHome')}
            style={styles.inviteButton}
          />
        ) : null}
      </View>
      <View style={styles.membersList}>
        {members.map(member => {
          const displayName = getMemberDisplayName(member, t, currentUser?.id);
          const isCurrentUser = member.user?.id === currentUser?.id;
          return (
            <MemberChip
              key={member.id}
              displayName={displayName}
              role={member.role}
              isCurrentUser={isCurrentUser}
            />
          );
        })}

        {pendingInvites.map(invite => (
          <InviteChip key={invite.id} invite={invite} />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  membersSection: {
    paddingTop: theme.spacing.md,
    borderTopWidth: theme.borderWidth.hairline,
    borderTopColor: theme.colors.border,
    marginTop: theme.spacing.md,
  },
  membersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  // The full touch target, without growing the row past its label; the glyph
  // lines up with the card's chevron above it.
  inviteButton: {
    marginVertical: -(
      (theme.sizes.touchTarget.min - theme.type.label.lineHeight) /
      2
    ),
    marginRight: -((theme.sizes.touchTarget.min - theme.sizes.icon.md) / 2),
  },
  membersList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  memberChip: {
    paddingHorizontal: theme.spacing.base,
    paddingVertical: theme.spacing.xsPlus,
    borderRadius: theme.radii.xl,
    borderCurve: 'continuous',
    minWidth: theme.spacing['3xl'],
    alignItems: 'center',
    variants: {
      currentUser: {
        true: {
          backgroundColor: theme.colors.primary,
          borderWidth: theme.borderWidth.hairline,
          borderColor: theme.colors.primary,
        },
        false: {
          backgroundColor: theme.colors.primaryLight,
        },
      },
    },
  },
  memberChipText: {
    variants: {
      currentUser: {
        true: {
          color: theme.colors.onPrimary,
        },
        false: {
          color: theme.colors.onPrimaryLight,
        },
      },
    },
  },
  memberRole: {
    textAlign: 'center',
    variants: {
      currentUser: {
        true: { color: theme.colors.onPrimary },
        false: { color: theme.colors.textSecondary },
      },
    },
  },
  inviteChip: {
    backgroundColor: theme.colors.transparent,
    paddingHorizontal: theme.spacing.base,
    paddingVertical: theme.spacing.xsPlus,
    borderRadius: theme.radii.xl,
    borderCurve: 'continuous',
    borderWidth: theme.borderWidth.hairline,
    borderStyle: 'dashed',
    minWidth: theme.spacing['3xl'],
    alignItems: 'center',
    variants: {
      status: {
        pending: { borderColor: theme.colors.status.pending },
        accepted: { borderColor: theme.colors.status.accepted },
        declined: { borderColor: theme.colors.status.declined },
        expired: { borderColor: theme.colors.status.expired },
      },
    },
  },
}));
