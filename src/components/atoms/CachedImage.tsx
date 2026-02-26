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
import React, { useRef } from 'react';
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
  /**
   * Display size in logical pixels (e.g. 48 for a 48x48 container).
   * TurboImage will decode the image at 2x this size for Retina sharpness,
   * dramatically reducing decoded bitmap memory for large source images.
   */
  displaySize?: number;
}

type ImageStatus = 'idle' | 'loading' | 'success' | 'error';

export const CachedImage = ({ uri, style, cachePolicy = 'dataCache', resizeMode = 'cover', containerStyle, displaySize, ...rest }: CachedImageProps) => {
    // Derive initial visibility from URI. Success/error transitions are handled
    // imperatively via setNativeProps to avoid re-renders when many images load.
    const initialStatus: ImageStatus = uri ? 'loading' : 'idle';
    const loadingRef = useRef<View>(null);
    const errorRef = useRef<View>(null);

    // PERF: Memoize source object so TurboImage's internal memo isn't defeated
    const source = ({ uri: uri! });

    const handleSuccess = () => {
      loadingRef.current?.setNativeProps({ style: { display: 'none' } });
    };

    const handleFailure = () => {
      loadingRef.current?.setNativeProps({ style: { display: 'none' } });
      errorRef.current?.setNativeProps({ style: { display: 'flex' } });
    };

    // No URI: show placeholder
    if (!uri) {
      return (
        <View style={[styles.placeholder, style as StyleProp<ViewStyle>, containerStyle]}>
          <Icon
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
    const radiusOverride = innerRadius > 0
      ? { borderRadius: innerRadius, overflow: 'hidden' as const }
      : undefined;

    return (
      <View style={[style as StyleProp<ViewStyle>, containerStyle]}>
        <TurboImage
          style={[styles.image, innerRadius > 0 && { borderRadius: innerRadius }]}
          source={source}
          cachePolicy={cachePolicy}
          resizeMode={resizeMode}
          resize={displaySize ? displaySize * 2 : undefined}
          onSuccess={handleSuccess}
          onFailure={handleFailure}
          {...rest}
        />
        {/* Loading overlay — starts visible, hidden via ref on success/error */}
        <View
          ref={loadingRef}
          style={[styles.overlay, radiusOverride, initialStatus !== 'loading' && styles.hidden]}
        >
          <SkeletonBase
            width="100%"
            height={9999}
            borderRadius={0}
            style={styles.skeleton}
          />
        </View>
        {/* Error overlay — starts hidden, shown via ref on error */}
        <View
          ref={errorRef}
          style={[styles.overlay, styles.errorOverlay, radiusOverride, styles.hidden]}
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
    height: '100%' },
overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0 },
  hidden: {
    display: 'none' },
  skeleton: {
    flex: 1 },
  errorOverlay: {
    backgroundColor: theme.colors.surfaceVariant,
    justifyContent: 'center',
    alignItems: 'center' },
  placeholder: {
    backgroundColor: theme.colors.surfaceVariant,
    justifyContent: 'center',
    alignItems: 'center' },
  placeholderIcon: {
    color: theme.colors.textTertiary } }));

/**
 * Preload images into the disk cache.
 * Call before navigating to a screen to warm the cache.
 */
export function preloadImages(uris: string[]): void {
  const sources: Source[] = uris
    .filter(Boolean)
    .map(uri => ({ uri }));
  TurboImage.prefetch(sources, 'dataCache');
}
