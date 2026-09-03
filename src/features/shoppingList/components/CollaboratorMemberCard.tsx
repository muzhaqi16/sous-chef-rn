import React from 'react';
import { View } from 'react-native';
import { Pressable } from '#components/atoms/themedComponents';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { Text } from '#components/atoms/Text';
import { Icon } from '#/utils/iconUtils';
import { getCollaboratorDisplayName } from '#/utils/formatters/memberFormatters';
import { type ShoppingListCollaboratorFragment } from '#features/shoppingList/graphql/shoppingListFragments.generated';
import type { Translate } from '#/i18n/types';
import { formatShortDate } from '#/utils/formatters/date';

type StatusVariant = 'active' | 'pending' | 'declined' | 'expired' | 'owner';

const getStatusVariant = (status: string): StatusVariant => {
  switch (status?.toUpperCase()) {
    case 'ACCEPTED':
    case 'ACTIVE':
      return 'active';
    case 'PENDING':
      return 'pending';
    case 'DECLINED':
      return 'declined';
    case 'EXPIRED':
    default:
      return 'expired';
  }
};

const getFormatStatus = (t: Translate) => (status: string) => {
  switch (status?.toUpperCase()) {
    case 'ACCEPTED':
    case 'ACTIVE':
      return t('shoppingListScreens.statusActive');
    case 'PENDING':
      return t('shoppingListScreens.statusInvited');
    case 'DECLINED':
      return t('shoppingListScreens.statusDeclined');
    case 'EXPIRED':
      return t('shoppingListScreens.statusExpired');
    default:
      return status || t('labels.unknown');
  }
};

function StatusBadge({
  variant,
  text,
}: {
  variant: StatusVariant;
  text: string;
}) {
  styles.useVariants({ status: variant });
  return (
    <View style={styles.statusBadge}>
      <Text style={styles.statusText}>{text}</Text>
    </View>
  );
}

interface CollaboratorMemberCardProps {
  member: ShoppingListCollaboratorFragment;
  currentUserId: string | undefined;
  /** When true (home-linked list), the remove button is hidden. */
  isHomeLinked: boolean;
  /** When true, this member owns the list — shows an Owner tag, hides remove. */
  isOwner?: boolean;
  /** Open the permissions sheet for this member. */
  onPress: () => void;
  /** Remove this member from the list. */
  onRemove: () => void;
}

export const CollaboratorMemberCard: React.FC<CollaboratorMemberCardProps> = ({
  member,
  currentUserId,
  isHomeLinked,
  isOwner = false,
  onPress,
  onRemove,
}) => {
  const { t } = useTranslation();
  const formatStatus = getFormatStatus(t);

  const statusVariant = getStatusVariant(member.status);
  const statusText = formatStatus(member.status);
  const displayName = getCollaboratorDisplayName(member, currentUserId);
  const memberEmail = member.collaborator?.email ?? member.email ?? '';
  const showEmailRow = !!memberEmail && memberEmail !== displayName;

  // The owner can't be removed, and you leave the list via the dedicated Leave
  // button rather than removing your own row here.
  const isCurrentUser =
    !!currentUserId && member.collaboratorId === currentUserId;
  const canRemove = !isHomeLinked && !isOwner && !isCurrentUser;

  return (
    <AppPressable style={styles.memberCard} onPress={onPress}>
      <View style={styles.memberInfo}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {displayName[0]?.toUpperCase() || '?'}
          </Text>
        </View>
        <View style={styles.memberDetails}>
          <Text style={styles.memberName}>{displayName}</Text>
          {showEmailRow ? (
            <Text style={styles.memberEmail}>{memberEmail}</Text>
          ) : null}
          <View style={styles.statusContainer}>
            <StatusBadge variant={statusVariant} text={statusText} />
            {!!isOwner && (
              <StatusBadge
                variant="owner"
                text={t('shoppingListScreens.owner')}
              />
            )}
            {!!member.invitedAt && (
              <Text style={styles.invitedText}>
                {t('shoppingListScreens.invitedOn', {
                  date: formatShortDate(new Date(member.invitedAt)),
                })}
              </Text>
            )}
          </View>
        </View>
      </View>
      {!!canRemove && (
        <Pressable
          onPress={onRemove}
          style={({ pressed }) => pressed && styles.pressed}
          accessibilityLabel={t('shoppingListScreens.removeMemberA11y')}
        >
          <Icon name="close" size={20} tone="error" />
        </Pressable>
      )}
    </AppPressable>
  );
};

const styles = StyleSheet.create(theme => ({
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.base,
    backgroundColor: theme.colors.surface,
    marginBottom: theme.spacing.sm,
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  memberDetails: {
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.base,
  },
  avatarText: {
    color: theme.colors.onPrimary,
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.fonts.weight.semibold,
  },
  memberName: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
  },
  memberEmail: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.sm,
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.pill,
    borderCurve: 'continuous',
    borderWidth: theme.borderWidth.hairline,
    variants: {
      status: {
        active: {
          backgroundColor: theme.colors.success + '20',
          borderColor: theme.colors.success,
        },
        pending: {
          backgroundColor: theme.colors.warning + '20',
          borderColor: theme.colors.warning,
        },
        declined: {
          backgroundColor: theme.colors.error + '20',
          borderColor: theme.colors.error,
        },
        expired: {
          backgroundColor: theme.colors.textTertiary + '20',
          borderColor: theme.colors.textTertiary,
        },
        owner: {
          backgroundColor: theme.colors.primary + '20',
          borderColor: theme.colors.primary,
        },
      },
    },
  },
  statusText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.fonts.weight.semibold,
    variants: {
      status: {
        active: { color: theme.colors.success },
        pending: { color: theme.colors.warning },
        declined: { color: theme.colors.error },
        expired: { color: theme.colors.textTertiary },
        owner: { color: theme.colors.primary },
      },
    },
  },
  invitedText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
