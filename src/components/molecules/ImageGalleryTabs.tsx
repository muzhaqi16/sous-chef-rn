import React, { useState } from 'react';
import { View, ViewStyle, ActivityIndicator } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
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
}

export const ImageGalleryTabs: React.FC<ImageGalleryTabsProps> = ({
  images: imagesRaw,
  fallbackImageUrl,
  style,
  imageHeight = 200,
}) => {
  const { theme } = useUnistyles();

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
          <Icon
            name="image-outline"
            size={48}
            color={theme.colors.textTertiary}
          />
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
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        )}

        {imageError || !currentImageUrl ? (
          <View style={styles.errorContainer}>
            <Icon
              name="image-outline"
              size={48}
              color={theme.colors.textTertiary}
            />
          </View>
        ) : (
          <CachedImage
            key={currentImageUrl}
            uri={currentImageUrl}
            style={styles.image}
            displaySize={imageHeight}
            resizeMode="contain"
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

      {/* Dot indicators at bottom */}
      {!!showTabs && (
        <View style={styles.dotsContainer}>
          {tabOptions.map(key => (
            <Pressable
              key={key}
              onPress={() => setSelectedTab(key)}
              style={({ pressed }) => [
                styles.dotTouchable,
                pressed && styles.pressed,
              ]}
            >
              <View
                style={[styles.dot, selectedTab === key && styles.dotActive]}
              />
            </Pressable>
          ))}
        </View>
      )}
    </View>
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
  dotTouchable: {
    padding: theme.spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.border,
  },
  dotActive: {
    backgroundColor: theme.colors.primary,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
