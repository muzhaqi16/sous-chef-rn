import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
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
    <View style={styles.homeActions}>
      {!isDefault && (
        <AppPressable
          style={styles.actionButton}
          onPress={() => onSetDefault(homeId)}
        >
          <Icon name="star-outline" size={20} tone="textSecondary" />
          <Text size="sm" tone="secondary" style={styles.actionText}>
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
          <Text size="sm" tone="secondary" style={styles.actionText}>
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
          <Text size="sm" tone="error" style={styles.actionText}>
            {t('homeManagement.cardDelete')}
          </Text>
        </AppPressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  homeActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    paddingTop: theme.spacing['3'],
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing['3'],
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.surface,
  },
  actionText: {
    marginLeft: theme.spacing.xs + 2,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
