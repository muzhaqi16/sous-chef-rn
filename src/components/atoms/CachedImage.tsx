/**
 * CachedImage - TurboImage wrapper with sensible caching defaults
 *
 * Replaces RN's <Image> for network images with native disk+memory caching
 * powered by Nuke (iOS) and Glide (Android). Uses dataCache policy by default
 * for aggressive caching.
 *
 * Shows a shimmer skeleton while loading, a placeholder icon when no URI,
 * and a fallback icon on error.
 */
import React from 'react';
import { View } from 'react-native';
import TurboImage from 'react-native-turbo-image';
import type {
  TurboImageProps,
  CachePolicy,
  Source,
} from 'react-native-turbo-image';
import type { StyleProp, ImageStyle, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useRecyclingState } from '@shopify/flash-list';
import { Icon } from '#utils/iconUtils';
import { SkeletonBase } from '#components/base/Skeleton/SkeletonBase';

export interface CachedImageProps
  extends Omit<TurboImageProps, 'source' | 'style'> {
  /** Image URI (string | null | undefined) */
  uri: string | null | undefined;
  /** Style applied to the image */
  style?: StyleProp<ImageStyle>;
  /** Cache policy (default: 'dataCache' for aggressive caching) */
  cachePolicy?: CachePolicy;
  /** Style for the placeholder/fallback container */
  containerStyle?: StyleProp<ViewStyle>;
  /**
   * Display size in logical pixels (e.g. 48 for a 48x48 container).
   * TurboImage will decode the image at 2x this size for Retina sharpness,
   * dramatically reducing decoded bitmap memory for large source images.
   */
  displaySize?: number;
}

type LoadState = 'idle' | 'loading' | 'success' | 'error';

// Module-level cache — tracks URIs that have loaded successfully.
// Survives component unmount/remount so scrolling back to a previously-loaded
// image skips the shimmer entirely.
const loadedUris = new Set<string>();
const MAX_LOADED_URIS = 500;

const HIDDEN: { display: 'none' } = { display: 'none' };

export const CachedImage = ({
  uri,
  style,
  cachePolicy = 'dataCache',
  resizeMode = 'cover',
  containerStyle,
  displaySize,
  ...rest
}: CachedImageProps) => {
  // useRecyclingState resets synchronously when `uri` changes (cell recycle).
  // If the URI was previously loaded, start in 'success' to skip shimmer.
  const [loadState, setLoadState] = useRecyclingState<LoadState>(
    () => (uri ? (loadedUris.has(uri) ? 'success' : 'loading') : 'idle'),
    [uri],
  );

  const handleSuccess = () => {
    if (uri) {
      loadedUris.add(uri);
      if (loadedUris.size > MAX_LOADED_URIS) {
        // Evict oldest half — Set iterates in insertion order, so
        // the first entries are the least recently added (oldest scroll positions).
        // Preserves recently-loaded URIs (currently visible + nearby items).
        const deleteCount = Math.floor(MAX_LOADED_URIS / 2);
        let i = 0;
        for (const key of loadedUris) {
          if (i >= deleteCount) break;
          loadedUris.delete(key);
          i++;
        }
      }
    }
    setLoadState('success', true);
  };

  const handleFailure = () => {
    setLoadState('error', true);
  };

  // No URI: show placeholder
  if (!uri) {
    return (
      <View
        style={[
          styles.placeholder,
          style as StyleProp<ViewStyle>,
          containerStyle,
        ]}
      >
        <Icon
          name="image-outline"
          size={24}
          color={styles.placeholderIcon.color}
        />
      </View>
    );
  }

  const source = { uri };

  const flat = StyleSheet.flatten(style as StyleProp<ViewStyle>);
  const borderRadius = (flat?.borderRadius as number) ?? 0;
  const innerRadius =
    borderRadius > 0 ? Math.max(borderRadius - (flat?.borderWidth ?? 0), 0) : 0;
  const radiusOverride: ViewStyle | undefined =
    innerRadius > 0
      ? { borderRadius: innerRadius, overflow: 'hidden' }
      : undefined;

  return (
    <View style={[style as StyleProp<ViewStyle>, containerStyle]}>
      <TurboImage
        fadeDuration={0}
        style={[styles.image, innerRadius > 0 && { borderRadius: innerRadius }]}
        source={source}
        cachePolicy={cachePolicy}
        resizeMode={resizeMode}
        resize={displaySize ? displaySize * 2 : undefined}
        onSuccess={handleSuccess}
        onFailure={handleFailure}
        {...rest}
      />
      {/* Loading overlay — fully declarative, resets via useRecyclingState */}
      <View
        style={[
          styles.overlay,
          radiusOverride,
          loadState !== 'loading' && HIDDEN,
        ]}
      >
        {loadState === 'loading' && (
          <SkeletonBase
            width="100%"
            height={9999}
            borderRadius={0}
            style={styles.skeleton}
          />
        )}
      </View>
      {/* Error overlay — fully declarative */}
      <View
        style={[
          styles.errorOverlay,
          radiusOverride,
          loadState !== 'error' && HIDDEN,
        ]}
      >
        <Icon
          name="image-outline"
          size={24}
          color={styles.placeholderIcon.color}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  image: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  skeleton: {
    flex: 1,
  },
  errorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.surfaceVariant,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholder: {
    backgroundColor: theme.colors.surfaceVariant,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderIcon: {
    color: theme.colors.textTertiary,
  },
}));

/**
 * Preload images into the disk cache.
 * Call before navigating to a screen to warm the cache.
 */
export function preloadImages(uris: string[]): void {
  const sources: Source[] = uris
    .filter(u => u && !loadedUris.has(u))
    .map(uri => ({ uri }));
  if (sources.length > 0) {
    TurboImage.prefetch(sources, 'dataCache');
  }
}
