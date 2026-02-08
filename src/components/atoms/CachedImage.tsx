/**
 * CachedImage - TurboImage wrapper with sensible caching defaults
 *
 * Replaces RN's <Image> for network images with native disk+memory caching
 * powered by Nuke (iOS) and Glide (Android). Uses dataCache policy by default
 * for aggressive caching.
 */
import React from 'react';
import TurboImage from 'react-native-turbo-image';
import type { TurboImageProps, CachePolicy, Source } from 'react-native-turbo-image';
import type { StyleProp, ImageStyle } from 'react-native';

export interface CachedImageProps
  extends Omit<TurboImageProps, 'source' | 'style'> {
  /** Image URI (string | null | undefined) */
  uri: string | null | undefined;
  /** Style applied to the image */
  style?: StyleProp<ImageStyle>;
  /** Cache policy (default: 'dataCache' for aggressive caching) */
  cachePolicy?: CachePolicy;
}

export const CachedImage = React.memo<CachedImageProps>(
  ({ uri, style, cachePolicy = 'dataCache', resizeMode = 'cover', ...rest }) => {
    if (!uri) return null;

    return (
      <TurboImage
        style={style}
        source={{ uri }}
        cachePolicy={cachePolicy}
        resizeMode={resizeMode}
        {...rest}
      />
    );
  },
);

CachedImage.displayName = 'CachedImage';

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
