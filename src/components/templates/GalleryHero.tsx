import React from 'react';
import { StyleSheet } from 'react-native-unistyles';
import {
  ItemPhotoCarousel,
  type ItemPhotoRef,
} from '#components/molecules/ItemPhotoCarousel';
import { CONTENT_OVERLAP } from './CollapsingHeroDetail';

interface GalleryHeroProps {
  /** `Item.photos` fragment refs, in the server's gallery order. */
  photos: readonly ItemPhotoRef[] | null | undefined;
  /** Fallback image URL for items with no photo rows yet. */
  fallbackImageUrl?: string | null;
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
 * corners, and page dots floated above the content card's overlap so they stay
 * visible on multi-photo items.
 */
export const GalleryHero: React.FC<GalleryHeroProps> = ({
  photos,
  fallbackImageUrl,
  height,
  onPhotoPress,
  onUnrenderable,
}) => (
  <ItemPhotoCarousel
    photos={photos}
    fallbackImageUrl={fallbackImageUrl}
    imageHeight={height}
    resizeMode="cover"
    style={styles.heroInner}
    overlayDots
    dotsBottomOffset={CONTENT_OVERLAP + 8}
    onPhotoPress={onPhotoPress}
    onUnrenderable={onUnrenderable}
  />
);

const styles = StyleSheet.create({
  heroInner: {
    borderRadius: 0,
    borderCurve: 'continuous',
  },
});
