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
          accessibilityRole="button"
        >
          <Icon name="star-outline" size={22} tone="textSecondary" />
          <Text
            size="xs"
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
          accessibilityRole="button"
        >
          <Icon name="person-add" size={22} tone="textSecondary" />
          <Text
            size="xs"
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
          accessibilityRole="button"
        >
          <Icon name="trash-outline" size={22} tone="error" />
          <Text
            size="xs"
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
  homeActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    paddingTop: theme.spacing['3'],
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  actionButton: {
    // The label sits UNDER the icon, not beside it. Beside the icon a chip has
    // to be as wide as its longest word plus the glyph, and sq "Vendos si
    // parazgjedhur" / es "Establecer Predeterminado" then push the third chip
    // onto a second row on any phone. Stacked, each button is a fixed third of
    // the row and the label has the button's whole width to wrap into.
    flex: 1,
    minHeight: theme.sizes.touchTarget.min,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.surface,
  },
  actionText: {
    // Text defaults to variant="body", whose lineHeight of 24 survives the
    // size="xs" override — on a two-line label that alone adds 18dp of dead
    // height to the row.
    lineHeight: theme.fonts.size.xs * 1.25,
    textAlign: 'center',
  },
}));
