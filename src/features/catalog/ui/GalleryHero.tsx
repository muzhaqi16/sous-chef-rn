import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import {
  ItemPhotoCarousel,
  type ItemPhotoRef,
} from '#features/catalog/ui/ItemPhotoCarousel';
import {
  CONTENT_OVERLAP,
  HEADER_BAND_HEIGHT,
} from '#components/templates/CollapsingHeroDetail';

interface GalleryHeroProps {
  /** `Item.photos` fragment refs, in the server's gallery order. */
  photos: readonly ItemPhotoRef[] | null | undefined;
  /** Fallback image URL for items with no photo rows yet. */
  fallbackImageUrl?: string | null;
  /** A household's own photo, leading the item's (`entryGallery`). */
  leadImageUrl?: string | null;
  /** Hero height supplied by CollapsingHeroDetail's renderHero callback. */
  height: number;
  /** Opens the fullscreen viewer at the tapped page. */
  onPhotoPress?: (index: number) => void;
  /** Fired when the gallery has no renderable image — lets the host collapse. */
  onUnrenderable?: () => void;
}

/**
 * Standard hero renderer for CollapsingHeroDetail screens backed by an item
 * photo set. Owns the hero treatment in one place — cover resize, square
 * corners, page dots floated above the content card's overlap so they stay
 * visible on multi-photo items, and the pending badge below the status bar and
 * the floating buttons, which the hero runs under.
 */
export const GalleryHero: React.FC<GalleryHeroProps> = ({
  photos,
  fallbackImageUrl,
  leadImageUrl,
  height,
  onPhotoPress,
  onUnrenderable,
}) => {
  const insets = useSafeAreaInsets();
  return (
    <ItemPhotoCarousel
      photos={photos}
      fallbackImageUrl={fallbackImageUrl}
      leadImageUrl={leadImageUrl}
      imageHeight={height}
      resizeMode="cover"
      style={styles.heroInner}
      overlayDots
      dotsBottomOffset={CONTENT_OVERLAP + 8}
      topClearance={insets.top + HEADER_BAND_HEIGHT}
      onPhotoPress={onPhotoPress}
      onUnrenderable={onUnrenderable}
    />
  );
};

const styles = StyleSheet.create(theme => ({
  heroInner: {
    borderRadius: theme.radii.none,
    borderCurve: 'continuous',
  },
}));
