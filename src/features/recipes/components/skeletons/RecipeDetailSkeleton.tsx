import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { SkeletonLine } from '#components/atoms/Skeleton/SkeletonLine';
import { type } from '#/theme/foundations/type';
import { recipesTestIDs } from '#features/recipes/testIDs';
import { IngredientTileSkeleton } from '#features/recipes/components/recipeDetail/IngredientTile';

// The bars stand in for the screen's own text, so they take the heights of the
// roles that text uses.
const TITLE = type.title.fontSize;
const HEADING = type.heading.fontSize;
const BODY = type.body.fontSize;
const META = type.caption.fontSize;
const INGREDIENT_PLACEHOLDERS = [0, 1, 2, 3];

/**
 * The recipe body while it loads: metadata, about, ingredients and steps.
 * `showTitle` stands in for the title too, when not even that is known yet.
 */
export const RecipeDetailSkeleton: React.FC<{ showTitle?: boolean }> = ({
  showTitle = false,
}) => (
  <View testID={recipesTestIDs.recipeDetailSkeleton}>
    {showTitle ? (
      <SkeletonLine width="70%" height={TITLE} style={styles.title} />
    ) : null}
    <View style={styles.metadata}>
      <SkeletonLine width={96} height={META} />
      <SkeletonLine width={72} height={META} />
    </View>

    <View style={styles.section}>
      <SkeletonLine width="30%" height={HEADING} style={styles.heading} />
      <SkeletonLine height={BODY} style={styles.line} />
      <SkeletonLine height={BODY} style={styles.line} />
      <SkeletonLine width="60%" height={BODY} />
    </View>

    <View style={styles.section}>
      <SkeletonLine width="40%" height={HEADING} style={styles.heading} />
      <View style={styles.tiles}>
        {INGREDIENT_PLACEHOLDERS.map(index => (
          <IngredientTileSkeleton key={index} />
        ))}
      </View>
    </View>

    <View style={styles.section}>
      <SkeletonLine width="35%" height={HEADING} style={styles.heading} />
      <SkeletonLine height={BODY} style={styles.line} />
      <SkeletonLine width="85%" height={BODY} style={styles.line} />
      <SkeletonLine width="70%" height={BODY} />
    </View>
  </View>
);

const styles = StyleSheet.create(theme => ({
  title: {
    marginBottom: theme.spacing.md,
  },
  metadata: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  heading: {
    marginBottom: theme.spacing.md,
  },
  line: {
    marginBottom: theme.spacing.sm,
  },
  // The rail's row, cut at the screen's edge as the rail is.
  tiles: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    overflow: 'hidden',
  },
}));
