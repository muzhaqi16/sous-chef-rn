import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { Text } from '#components/atoms/Text';

interface PantrySelectorProps {
  pantries: Array<{ id: string; name: string; isDefault: boolean }>;
  selectedPantryId: string | null;
  onSelect: (pantryId: string) => void;
}

/**
 * Required pantry picker for {@link MoveToPantryModal}. Renders nothing when no
 * pantries are available.
 */
export const PantrySelector: React.FC<PantrySelectorProps> = ({
  pantries,
  selectedPantryId,
  onSelect,
}) => {
  const { t } = useTranslation();

  if (pantries.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text size="md" weight="medium" style={styles.sectionLabel}>
        {t('moveToPantry.selectPantry')}
        <Text tone="error">{t('moveToPantry.requiredAsterisk')}</Text>
      </Text>
      <View style={styles.pantryList}>
        {pantries.map(pantry => (
          <AppPressable
            key={pantry.id}
            style={[
              styles.pantryOption,
              selectedPantryId === pantry.id && styles.pantryOptionActive,
            ]}
            onPress={() => onSelect(pantry.id)}
          >
            <Icon
              name="cube-outline"
              size={20}
              tone={selectedPantryId === pantry.id ? 'white' : 'textSecondary'}
            />
            <Text
              style={[
                styles.pantryOptionText,
                selectedPantryId === pantry.id && styles.pantryOptionTextActive,
              ]}
              numberOfLines={1}
            >
              {pantry.name}
            </Text>
            {!!pantry.isDefault && (
              <View
                style={[
                  styles.defaultBadge,
                  selectedPantryId === pantry.id && styles.defaultBadgeActive,
                ]}
              >
                <Text
                  style={[
                    styles.defaultBadgeText,
                    selectedPantryId === pantry.id &&
                      styles.defaultBadgeTextActive,
                  ]}
                >
                  {t('moveToPantry.defaultLabel')}
                </Text>
              </View>
            )}
          </AppPressable>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  section: {
    marginBottom: theme.spacing.lg,
  },
  sectionLabel: {
    marginBottom: theme.spacing.sm,
  },
  pantryList: {
    gap: theme.spacing.sm,
  },
  pantryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    gap: theme.spacing.sm,
  },
  pantryOptionActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  pantryOptionText: {
    flex: 1,
    fontSize: theme.fonts.size.base,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
  },
  pantryOptionTextActive: {
    color: theme.colors.white,
  },
  defaultBadge: {
    paddingVertical: theme.spacing.xs / 2,
    paddingHorizontal: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.radii.sm,
  },
  defaultBadgeActive: {
    backgroundColor: theme.colors.overlays.light,
  },
  defaultBadgeText: {
    fontSize: theme.fonts.size.xs,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textSecondary,
  },
  defaultBadgeTextActive: {
    color: theme.colors.white,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
