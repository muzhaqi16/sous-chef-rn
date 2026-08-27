import React from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { Pressable } from '#components/atoms/themedComponents';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import { CachedImage } from '#components/atoms/CachedImage';
import { Icon } from '#utils/iconUtils';
import { Text } from '#components/atoms/Text';
import { commonStyles } from '#/styles/commonStyles';

/** A trailing icon button on a recipe row. */
export interface RecipeCardAction {
  key: string;
  icon: React.ComponentProps<typeof Icon>['name'];
  tone: React.ComponentProps<typeof Icon>['tone'];
  /** i18n key for the accessibility label, resolved here. */
  labelKey: string;
  onPress: () => void;
}

interface RecipeCardViewProps {
  name: string;
  imageUrl?: string | null;
  servings: number;
  /** Total minutes, or null to omit the time entirely. */
  totalMinutes: number | null;
  onPress: () => void;
  actions?: RecipeCardAction[];
}

/**
 * The recipe row, with no knowledge of where its data came from.
 *
 * `MyRecipeCard` and `SavedRecipeCard` were the same 110 lines twice — same
 * JSX, same stylesheet, same comment — differing only in which fragment they
 * read and which trailing icons they showed. Both are now thin fragment
 * readers over this.
 */
export const RecipeCardView: React.FC<RecipeCardViewProps> = ({
  name,
  imageUrl,
  servings,
  totalMinutes,
  onPress,
  actions,
}) => {
  const { t } = useTranslation();

  return (
    <AppPressable
      onPress={onPress}
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={name}
    >
      {!!imageUrl && (
        <View style={commonStyles.listItemImageContainerCompact}>
          <CachedImage
            uri={imageUrl}
            style={commonStyles.listItemImageCompact}
            displaySize={48}
          />
        </View>
      )}
      <View style={styles.body}>
        <Text size="md" weight="medium" numberOfLines={1}>
          {name}
        </Text>
        <Text size="sm" tone="secondary" numberOfLines={1}>
          {t('recipes.servingsCount', { count: servings })}
          {totalMinutes != null
            ? ` • ${t('labels.min', { count: totalMinutes })}`
            : ''}
        </Text>
      </View>
      {!!actions?.length && (
        <View style={styles.actions}>
          {actions.map(action => (
            <Pressable
              key={action.key}
              onPress={action.onPress}
              hitSlop={8}
              style={({ pressed }) => pressed && styles.pressed}
              accessibilityLabel={t(action.labelKey)}
            >
              <Icon name={action.icon} size={20} tone={action.tone} />
            </Pressable>
          ))}
        </View>
      )}
    </AppPressable>
  );
};

const styles = StyleSheet.create(theme => ({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing['3'],
    // Match the search bar inset so rows line up with it instead of going
    // edge-to-edge — same floating-card treatment as BaseItemCard.
    marginHorizontal: theme.spacing['3'],
    marginBottom: theme.spacing['2.5'],
    borderRadius: theme.radii.xl,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: theme.colors.surface,
    ...theme.shadows.card,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
