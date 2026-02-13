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
import React, { useState, useCallback } from 'react';
import { View } from 'react-native';
import TurboImage from 'react-native-turbo-image';
import type { TurboImageProps, CachePolicy, Source } from 'react-native-turbo-image';
import type { StyleProp, ImageStyle, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
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
}

type ImageStatus = 'idle' | 'loading' | 'success' | 'error';

export const CachedImage = React.memo<CachedImageProps>(
  ({ uri, style, cachePolicy = 'dataCache', resizeMode = 'cover', containerStyle, ...rest }) => {
    const [status, setStatus] = useState<ImageStatus>(uri ? 'loading' : 'idle');

    const handleSuccess = useCallback(() => {
      setStatus('success');
    }, []);

    const handleFailure = useCallback(() => {
      setStatus('error');
    }, []);

    // No URI: show placeholder
    if (!uri) {
      return (
        <View style={[styles.placeholder, style as StyleProp<ViewStyle>, containerStyle]}>
          <Icon
            library="Ionicons"
            name="image-outline"
            size={24}
            color={styles.placeholderIcon.color}
          />
        </View>
      );
    }

    const flat = StyleSheet.flatten(style as StyleProp<ViewStyle>);
    const borderRadius = (flat?.borderRadius as number) ?? 0;
    const innerRadius = borderRadius > 0
      ? Math.max(borderRadius - (flat?.borderWidth ?? 0), 0)
      : 0;

    return (
      <View style={[style as StyleProp<ViewStyle>, containerStyle]}>
        <TurboImage
          style={[styles.image, innerRadius > 0 && { borderRadius: innerRadius }]}
          source={{ uri: uri! }}
          cachePolicy={cachePolicy}
          resizeMode={resizeMode}
          onSuccess={handleSuccess}
          onFailure={handleFailure}
          {...rest}
        />
        {status === 'loading' && (
          <View style={[styles.overlay, innerRadius > 0 && { borderRadius: innerRadius, overflow: 'hidden' as const }]}>
            <SkeletonBase
              width="100%"
              height={9999}
              borderRadius={0}
              style={styles.skeleton}
            />
          </View>
        )}
        {status === 'error' && (
          <View style={[styles.overlay, styles.errorOverlay, innerRadius > 0 && { borderRadius: innerRadius, overflow: 'hidden' as const }]}>
            <Icon
              library="Ionicons"
              name="image-outline"
              size={24}
              color={styles.placeholderIcon.color}
            />
          </View>
        )}
      </View>
    );
  },
);

CachedImage.displayName = 'CachedImage';

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
export function preloadImages(uris: string[]) {
  const sources: Source[] = uris
    .filter(Boolean)
    .map(uri => ({ uri }));
  TurboImage.prefetch(sources, 'dataCache');
}
