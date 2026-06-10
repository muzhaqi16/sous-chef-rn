import React from 'react';
import { StyleSheet } from 'react-native-unistyles';
import Animated from 'react-native-reanimated';
import TurboImage from 'react-native-turbo-image';

// TurboImage wrapped for Reanimated so `sharedTransitionTag` participates in the
// shared-element transition from the recipe list.
const AnimatedTurboImage = Animated.createAnimatedComponent(TurboImage);

interface RecipeHeroImageProps {
  imageUrl: string;
  externalId?: string;
  /** Hero height supplied by `CollapsingHeroDetail`'s renderHero callback
   *  (already grown by the top inset). */
  height: number;
}

/**
 * The recipe hero photo. Rendered as the first child of the detail ScrollView so
 * it scrolls away naturally; the action buttons live in the pinned action bar.
 */
export const RecipeHeroImage: React.FC<RecipeHeroImageProps> = ({
  imageUrl,
  externalId,
  height,
}) => (
  <AnimatedTurboImage
    source={{ uri: imageUrl }}
    cachePolicy="dataCache"
    resizeMode="cover"
    style={[styles.image, { height }]}
    sharedTransitionTag={externalId ? `recipe-image-${externalId}` : undefined}
  />
);

const styles = StyleSheet.create({
  image: {
    width: '100%',
  },
});
