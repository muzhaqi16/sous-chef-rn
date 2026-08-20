import React from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { AppPressable } from '#components/atoms/AppPressable';
import { Icon } from '#utils/iconUtils';
import { StyleSheet } from 'react-native-unistyles';
import { Text } from '#components/atoms/Text';

interface HomeActionsProps {
  homeId: string;
  isDefault: boolean;
  canInvite?: boolean;
  canDelete?: boolean;
  onSetDefault: (homeId: string) => void;
  onInvite: (homeId: string) => void;
  onDelete: (homeId: string) => void;
}

export const HomeActions: React.FC<HomeActionsProps> = ({
  homeId,
  isDefault,
  canInvite = true, // Default to true for backward compatibility
  canDelete = true, // Default to true for backward compatibility
  onSetDefault,
  onInvite,
  onDelete,
}) => {
  const { t } = useTranslation();
  const hasVisibleActions = !isDefault || canInvite || canDelete;
  if (!hasVisibleActions) return null;

  return (
    <View style={styles.homeActions} testID="home-actions">
      {!isDefault && (
        <AppPressable
          style={styles.actionButton}
          onPress={() => onSetDefault(homeId)}
        >
          <Icon name="star-outline" size={20} tone="textSecondary" />
          <Text
            size="sm"
            tone="secondary"
            numberOfLines={2}
            style={styles.actionText}
          >
            {t('homeManagement.cardSetDefault')}
          </Text>
        </AppPressable>
      )}
      {!!canInvite && (
        <AppPressable
          style={styles.actionButton}
          onPress={() => onInvite(homeId)}
        >
          <Icon name="person-add" size={20} tone="textSecondary" />
          <Text
            size="sm"
            tone="secondary"
            numberOfLines={2}
            style={styles.actionText}
          >
            {t('homeManagement.cardInvite')}
          </Text>
        </AppPressable>
      )}
      {!!canDelete && (
        <AppPressable
          style={styles.actionButton}
          onPress={() => onDelete(homeId)}
        >
          <Icon name="trash-outline" size={20} tone="error" />
          <Text
            size="sm"
            tone="error"
            numberOfLines={2}
            style={styles.actionText}
          >
            {t('homeManagement.cardDelete')}
          </Text>
        </AppPressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  // Horizontal grid: chips size to their labels, share the leftover space, and
  // wrap to the next row when they can't fit. Without `flexWrap` — and with
  // Yoga's `flexShrink` defaulting to 0, not 1 — the chips kept their intrinsic
  // width and ran off the screen edge in locales with long labels (sq "Vendos
  // si parazgjedhur" / es "Establecer Predeterminado" vs en "Set Default").
  // Same shape as AnimatedItemSelector/ActionButtons and MembersList below.
  homeActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    paddingTop: theme.spacing['3'],
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    // `flexBasis: 'auto'` makes Yoga break the line on CONTENT width, so
    // short-label locales keep their single tidy row; minWidth stops a wrapped
    // chip from collapsing to its icon.
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 'auto',
    minWidth: 88,
    gap: theme.spacing.xs + 2,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing['3'],
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.surface,
  },
  actionText: {
    flexShrink: 1,
  },
}));
