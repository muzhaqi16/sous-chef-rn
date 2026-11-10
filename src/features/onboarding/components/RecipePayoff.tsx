import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { AppPressable } from '#components/atoms/AppPressable';
import { Badge } from '#components/atoms/Badge';
import { RowCard } from '#components/atoms/RowCard';
import { RowThumbnail } from '#components/atoms/RowThumbnail';
import { Text } from '#components/atoms/Text';
import { commonStyles } from '#/styles/commonStyles';
import { rowType } from '#/theme/foundations/type';
import { toDisplayItems } from '#features/recipes/screens/recipeDisplayItems';
import { RestrictionsNote } from '#features/recipes/ui/RestrictionsNote';
import { useSelectedHomeId } from '#store/useAppStore';
import type { useRecipePayoff } from '#features/onboarding/hooks/useRecipePayoff';
import { onboardingTestIDs } from '#features/onboarding/testIDs';

type RecipePayoffProps = Pick<
  ReturnType<typeof useRecipePayoff>,
  'rows' | 'showCheckLabel'
> & {
  /** Finishes onboarding and opens the recipe once the app shows. */
  onOpen: (recipeId: string) => void;
};

/** What the pantry can already make; a tap opens the recipe over Today. */
export const RecipePayoff = ({
  rows,
  showCheckLabel,
  onOpen,
}: RecipePayoffProps) => {
  const { t } = useTranslation();
  const homeId = useSelectedHomeId();
  if (rows.length === 0) return null;

  return (
    <View style={styles.section} testID={onboardingTestIDs.payoff}>
      <Text role="bodyStrong">{t('recipes.basedOnPantry')}</Text>
      <RestrictionsNote homeId={homeId} />
      {toDisplayItems(rows, t).map(recipe => {
        const recipeId =
          'recipeId' in recipe.target ? recipe.target.recipeId : null;
        return (
          <RowCard key={recipe.id}>
            <AppPressable
              onPress={recipeId ? () => onOpen(recipeId) : undefined}
              accessibilityRole="button"
              style={[commonStyles.rowSurface, commonStyles.rowContent]}
              testID={onboardingTestIDs.payoffRecipe(recipe.id)}
            >
              <RowThumbnail uri={recipe.imageUrl} />
              <View style={styles.text}>
                <Text role={rowType.title}>{recipe.title}</Text>
                <Text role={rowType.subtitle} tone="secondary">
                  {recipe.subtitle}
                </Text>
                {recipe.badge ? (
                  <Badge variant="success" size="small">
                    {recipe.badge.text}
                  </Badge>
                ) : null}
              </View>
            </AppPressable>
          </RowCard>
        );
      })}
      {showCheckLabel ? (
        <Text role="caption" tone="secondary">
          {t('dietaryAlerts.checkLabel')}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  section: {
    alignSelf: 'stretch',
    gap: theme.spacing.sm,
  },
  text: {
    flex: 1,
    alignItems: 'flex-start',
    gap: theme.spacing.xs,
  },
}));
