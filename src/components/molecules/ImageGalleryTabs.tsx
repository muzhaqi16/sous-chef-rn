import React, { useState } from 'react';
import { View, ViewStyle } from 'react-native';
import { ThemedActivityIndicator } from '#components/atoms/themedComponents';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { CachedImage } from '#components/atoms/CachedImage';
import type { ItemImage } from '#/types/nutrition';
import {
  parseImages,
  groupImagesByPerspective,
  getBestImageUrl,
  getPrimaryImage,
  hasImages,
} from '#utils/imageUtils';

interface ImageGalleryTabsProps {
  /** Raw images JSON from API or parsed ItemImage array */
  images: unknown;
  /** Fallback image URL if no images array */
  fallbackImageUrl?: string | null;
  /** Image press handler (reserved for future use) */
  _onImagePress?: (image: ItemImage) => void;
  /** Container style */
  style?: ViewStyle;
  /** Image height (default: 200) */
  imageHeight?: number;
  /** How the image fills its band (default: 'contain') */
  resizeMode?: 'cover' | 'contain';
  /**
   * Float the perspective dots over the photo instead of rendering them
   * in-flow below it. Keeps the component's total height equal to
   * `imageHeight` — required when a parent (e.g. CollapsingHeroDetail's
   * content card) overlaps the bottom edge of the hero.
   */
  overlayDots?: boolean;
  /** Bottom offset of the floated dots (overlayDots only, default 8). */
  dotsBottomOffset?: number;
}

export const ImageGalleryTabs: React.FC<ImageGalleryTabsProps> = ({
  images: imagesRaw,
  fallbackImageUrl,
  style,
  imageHeight = 200,
  resizeMode = 'contain',
  overlayDots = false,
  dotsBottomOffset = 8,
}) => {
  const parsedImages = Array.isArray(imagesRaw)
    ? (imagesRaw as ItemImage[])
    : parseImages(imagesRaw);

  const tabs = groupImagesByPerspective(parsedImages);

  const [selectedTab, setSelectedTab] = useState<string>(
    tabs[0]?.key ?? 'front',
  );

  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Render-time reset: clear loading/error states when selected tab changes
  const [prevSelectedTab, setPrevSelectedTab] = useState(selectedTab);
  if (selectedTab !== prevSelectedTab) {
    setPrevSelectedTab(selectedTab);
    setImageLoading(false);
    setImageError(false);
  }

  // Get current image URL
  const currentImageUrl = (() => {
    if (!hasImages(parsedImages)) {
      return fallbackImageUrl ?? null;
    }

    const selectedTabData = tabs.find(t => t.key === selectedTab);
    if (selectedTabData && selectedTabData.images.length > 0) {
      return getBestImageUrl(selectedTabData.images[0], 'large');
    }

    // Fallback to primary image
    const primary = getPrimaryImage(parsedImages);
    return primary ? getBestImageUrl(primary, 'large') : fallbackImageUrl;
  })();

  const tabOptions = tabs.map(t => t.key);

  // If no images and no fallback, show placeholder
  if (!currentImageUrl) {
    return (
      <View style={[styles.container, style]}>
        <View style={[styles.placeholder, { height: imageHeight }]}>
          <Icon name="image-outline" size={48} tone="textTertiary" />
        </View>
      </View>
    );
  }

  // If only one tab or no tabs, just show the image without tabs
  const showTabs = tabs.length > 1;

  return (
    <View style={[styles.container, style]}>
      {/* Image display */}
      <View style={[styles.imageContainer, { height: imageHeight }]}>
        {!!imageLoading && (
          <View style={styles.loadingOverlay}>
            <ThemedActivityIndicator size="large" />
          </View>
        )}

        {imageError || !currentImageUrl ? (
          <View style={styles.errorContainer}>
            <Icon name="image-outline" size={48} tone="textTertiary" />
          </View>
        ) : (
          <CachedImage
            key={currentImageUrl}
            uri={currentImageUrl}
            style={styles.image}
            displaySize={imageHeight}
            resizeMode={resizeMode}
            onStart={() => {
              setImageLoading(true);
              setImageError(false);
            }}
            onCompletion={() => setImageLoading(false)}
            onFailure={() => {
              setImageLoading(false);
              setImageError(true);
            }}
          />
        )}
      </View>

      {/* Dot indicators: in-flow strip below the photo, or floated over its
          bottom edge (overlayDots) so the component stays imageHeight tall. */}
      {!!showTabs &&
        (overlayDots ? (
          <View
            style={[styles.dotsOverlay, { bottom: dotsBottomOffset }]}
            pointerEvents="box-none"
          >
            <View style={styles.dotsPill}>
              {tabOptions.map(key => (
                <DotItem
                  key={key}
                  isActive={selectedTab === key}
                  onPress={() => setSelectedTab(key)}
                />
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.dotsContainer}>
            {tabOptions.map(key => (
              <DotItem
                key={key}
                isActive={selectedTab === key}
                onPress={() => setSelectedTab(key)}
              />
            ))}
          </View>
        ))}
    </View>
  );
};

const DotItem: React.FC<{ isActive: boolean; onPress: () => void }> = ({
  isActive,
  onPress,
}) => {
  styles.useVariants({ active: isActive });
  return (
    <AppPressable onPress={onPress} style={styles.dotTouchable}>
      <View style={styles.dot} />
    </AppPressable>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    overflow: 'hidden',
    alignSelf: 'stretch',
  },
  imageContainer: {
    width: '100%',
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    width: '100%',
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
    zIndex: 1,
  },
  errorContainer: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  dotsOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  // Translucent backdrop keeps the dots legible over arbitrary photos.
  dotsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radii.full,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  dotTouchable: {
    padding: theme.spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.border,
    variants: {
      active: {
        true: {
          backgroundColor: theme.colors.primary,
          width: 10,
          height: 10,
          borderRadius: 5,
        },
      },
    },
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
