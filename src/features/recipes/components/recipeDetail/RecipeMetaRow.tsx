import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation, type TranslateFn } from '#/i18n';
import { Icon, type IconName } from '#components/atoms/Icon';
import { Text } from '#components/atoms/Text';
import {
  Pressable,
  SuccessActivityIndicator,
} from '#components/atoms/themedComponents';
import type { RecipeDetailState } from '#features/recipes/screens/RecipeDetail/useRecipeDetail';
import { recipesTestIDs } from '#features/recipes/testIDs';
import { formatMonthDayYear } from '#/utils/formatters/date';

/** The cooking history in one line, or the offer to mark a first cook. */
function cookedSummary(
  count: number,
  lastCookedAt: string | null,
  t: TranslateFn,
): string {
  if (count === 0) return t('recipes.markCooked');
  if (!lastCookedAt) return t('recipes.cookedCount', { count });
  return t('recipes.cookedSummary', {
    count,
    date: formatMonthDayYear(new Date(lastCookedAt)),
  });
}

function MetaItem({ icon, children }: { icon: IconName; children: string }) {
  return (
    <View style={styles.item}>
      <Icon name={icon} size="2xsPlus" tone="textSecondary" />
      <Text role="caption" tone="secondary">
        {children}
      </Text>
    </View>
  );
}

interface RecipeMetaRowProps {
  recipe: NonNullable<RecipeDetailState['displayData']>;
  detail: RecipeDetailState;
}

/** Servings, time and health, and the cooking history that marks a cook. */
export const RecipeMetaRow: React.FC<RecipeMetaRowProps> = ({
  recipe,
  detail,
}) => {
  const { t } = useTranslation();
  const { recipeId, cookedCount, lastCookedAt, markingAsCooked } = detail;
  const cooked = cookedCount > 0;

  return (
    <View style={styles.row}>
      {recipe.servings != null && (
        <MetaItem icon="restaurant-outline">
          {t('labels.servingsCount', { count: recipe.servings })}
        </MetaItem>
      )}
      {!!recipe.readyInMinutes && (
        <MetaItem icon="time-outline">
          {t('labels.min', { count: recipe.readyInMinutes })}
        </MetaItem>
      )}
      {recipe.healthScore != null && !isNaN(recipe.healthScore) && (
        <MetaItem icon="leaf-outline">
          {t('recipes.percentHealthy', {
            percent: Math.round(recipe.healthScore),
          })}
        </MetaItem>
      )}
      {/* Any recipe can be cooked; only a saved one keeps a count. */}
      {!!recipeId && (
        <Pressable
          style={({ pressed }) => [styles.item, pressed && styles.pressed]}
          onPress={() => detail.setCookedModalVisible(true)}
          disabled={markingAsCooked}
          accessibilityRole="button"
          testID={recipesTestIDs.markCookedButton}
        >
          {markingAsCooked ? (
            <SuccessActivityIndicator size="small" />
          ) : (
            <>
              <Icon
                name={cooked ? 'checkmark-circle' : 'checkmark-circle-outline'}
                size="2xsPlus"
                tone={cooked ? 'success' : 'textSecondary'}
              />
              <Text role="caption" tone={cooked ? 'success' : 'secondary'}>
                {cookedSummary(cookedCount, lastCookedAt, t)}
              </Text>
            </>
          )}
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: theme.spacing.md,
    rowGap: theme.spacing.xs,
    marginBottom: theme.spacing.md,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  pressed: {
    opacity: 0.7,
  },
}));
