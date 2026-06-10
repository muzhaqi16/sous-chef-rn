import React from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { ImageGalleryTabs } from '#components/molecules/ImageGalleryTabs';
import { CONTENT_OVERLAP } from './CollapsingHeroDetail';

interface GalleryHeroProps {
  /** Raw images JSON from API or parsed ItemImage array. */
  images: unknown;
  /** Fallback image URL if no images array. */
  fallbackImageUrl?: string | null;
  /** Hero height supplied by CollapsingHeroDetail's renderHero callback. */
  height: number;
}

/**
 * Standard hero renderer for CollapsingHeroDetail screens backed by an item
 * photo set. Owns the hero treatment in one place — cover resize, square
 * corners, and perspective dots floated above the content card's overlap so
 * they stay visible and tappable on multi-photo items.
 */
export const GalleryHero: React.FC<GalleryHeroProps> = ({
  images,
  fallbackImageUrl,
  height,
}) => (
  <ImageGalleryTabs
    images={images}
    fallbackImageUrl={fallbackImageUrl}
    imageHeight={height}
    resizeMode="cover"
    style={styles.heroInner}
    overlayDots
    dotsBottomOffset={CONTENT_OVERLAP + 8}
  />
);

const styles = StyleSheet.create({
  heroInner: {
    borderRadius: 0,
  },
});
