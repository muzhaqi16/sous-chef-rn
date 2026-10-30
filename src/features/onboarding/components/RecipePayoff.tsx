import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { Badge } from '#components/atoms/Badge';
import { RowCard } from '#components/atoms/RowCard';
import { RowThumbnail } from '#components/atoms/RowThumbnail';
import { Text } from '#components/atoms/Text';
import { commonStyles } from '#/styles/commonStyles';
import { rowType } from '#/theme/foundations/type';
import { toDisplayItems } from '#features/recipes/screens/recipeDisplayItems';
import type { useRecipePayoff } from '#features/onboarding/hooks/useRecipePayoff';
import { onboardingTestIDs } from '#features/onboarding/testIDs';

type RecipePayoffProps = Pick<
  ReturnType<typeof useRecipePayoff>,
  'rows' | 'showCheckLabel'
>;

/**
 * What the pantry can already make, shown, not opened: the app is not mounted
 * until onboarding completes, and Today previews the same suggestions.
 */
export const RecipePayoff = ({ rows, showCheckLabel }: RecipePayoffProps) => {
  const { t } = useTranslation();
  if (rows.length === 0) return null;

  return (
    <View style={styles.section} testID={onboardingTestIDs.payoff}>
      <Text role="bodyStrong">{t('recipes.basedOnPantry')}</Text>
      {toDisplayItems(rows, t).map(recipe => (
        <RowCard key={recipe.id}>
          <View style={[commonStyles.rowSurface, commonStyles.rowContent]}>
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
          </View>
        </RowCard>
      ))}
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
