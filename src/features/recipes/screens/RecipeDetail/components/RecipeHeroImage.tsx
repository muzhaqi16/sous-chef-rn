import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import Animated from 'react-native-reanimated';
import TurboImage from 'react-native-turbo-image';

// Visible hero height below the status bar. The image is grown by the top inset
// so it fills edge-to-edge behind the status bar while keeping this much photo
// in the safe area.
export const HERO_IMAGE_HEIGHT = 300;

// TurboImage wrapped for Reanimated so `sharedTransitionTag` participates in the
// shared-element transition from the recipe list.
const AnimatedTurboImage = Animated.createAnimatedComponent(TurboImage);

interface RecipeHeroImageProps {
  imageUrl: string;
  externalId?: string;
  /** Override the image height (e.g. supplied by `CollapsingHeroDetail`). */
  height?: number;
}

/**
 * The recipe hero photo. Rendered as the first child of the detail ScrollView so
 * it scrolls away naturally; the action buttons live in the pinned action bar.
 */
export const RecipeHeroImage: React.FC<RecipeHeroImageProps> = ({
  imageUrl,
  externalId,
  height,
}) => {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.container}>
      <AnimatedTurboImage
        source={{ uri: imageUrl }}
        cachePolicy="dataCache"
        resizeMode="cover"
        style={[
          styles.image,
          { height: height ?? HERO_IMAGE_HEIGHT + insets.top },
        ]}
        sharedTransitionTag={
          externalId ? `recipe-image-${externalId}` : undefined
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  image: {
    width: '100%',
  },
});
