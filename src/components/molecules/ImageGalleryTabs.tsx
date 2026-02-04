import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Image,
  ViewStyle,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
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

  const parsedImages = useMemo(
    () =>
      Array.isArray(imagesRaw)
        ? (imagesRaw as ItemImage[])
        : parseImages(imagesRaw),
    [imagesRaw],
  );

  const tabs = useMemo(
    () => groupImagesByPerspective(parsedImages),
    [parsedImages],
  );

  const [selectedTab, setSelectedTab] = useState<string>(
    tabs[0]?.key ?? 'front',
  );

  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Reset loading/error states when selected tab changes
  useEffect(() => {
    setImageLoading(false);
    setImageError(false);
  }, [selectedTab]);

  // Get current image URL
  const currentImageUrl = useMemo(() => {
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
  }, [parsedImages, tabs, selectedTab, fallbackImageUrl]);

  const tabOptions = useMemo(() => tabs.map(t => t.key), [tabs]);

  // If no images and no fallback, show placeholder
  if (!currentImageUrl) {
    return (
      <View style={[styles.container, style]}>
        <View style={[styles.placeholder, { height: imageHeight }]}>
          <Icon
            name="image-outline"
            size={48}
            color={theme.colors.textTertiary}
            library="Ionicons"
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
        {imageLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        )}

        {imageError || !currentImageUrl ? (
          <View style={styles.errorContainer}>
            <Icon
              name="image-not-supported"
              size={48}
              color={theme.colors.textTertiary}
              library="MaterialIcons"
            />
          </View>
        ) : (
          <Image
            key={currentImageUrl}
            source={{ uri: currentImageUrl }}
            style={styles.image}
            resizeMode="contain"
            onLoadStart={() => {
              setImageLoading(true);
              setImageError(false);
            }}
            onLoadEnd={() => setImageLoading(false)}
            onError={() => {
              setImageLoading(false);
              setImageError(true);
            }}
          />
        )}
      </View>

      {/* Dot indicators at bottom */}
      {showTabs && (
        <View style={styles.dotsContainer}>
          {tabOptions.map(key => (
            <TouchableOpacity
              key={key}
              onPress={() => setSelectedTab(key)}
              style={styles.dotTouchable}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.dot,
                  selectedTab === key && styles.dotActive,
                ]}
              />
            </TouchableOpacity>
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
    borderRadius: 4,
    backgroundColor: theme.colors.border,
  },
  dotActive: {
    backgroundColor: theme.colors.primary,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
}));
