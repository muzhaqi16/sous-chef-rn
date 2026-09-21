// TurboImage wrapper for network images: native disk+memory caching, a shimmer
// while loading, a placeholder icon with no URI, a fallback icon on error.
import React from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
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
import { logger } from '#/utils/environment';
import { SkeletonBase } from '#components/atoms/Skeleton/SkeletonBase';

// The load handlers end the shimmer, so a caller reacts through `onError`.
export interface CachedImageProps
  extends Omit<
    TurboImageProps,
    'source' | 'style' | 'onFailure' | 'onSuccess'
  > {
  uri: string | null | undefined;
  style?: StyleProp<ImageStyle>;
  cachePolicy?: CachePolicy;
  /** Style for the placeholder/fallback container. */
  containerStyle?: StyleProp<ViewStyle>;
  /** Display size in logical px; decoding happens at 2x it, capping bitmap memory. */
  displaySize?: number;
  /** Runs alongside the internal error overlay so a parent can react (e.g. collapse a hero). */
  onError?: () => void;
  /** Opts this image into a shared-element transition. Present means the
   *  Reanimated wrapper is rendered, so a recycled list cell never pays for it. */
  sharedTransitionTag?: string;
  /** What the picture shows. Omit ONLY with `accessible={false}`: an unnamed
   *  image is announced as "image" and nothing else. */
  accessibilityLabel?: string;
}

type LoadState = 'idle' | 'loading' | 'success' | 'error';

// Reanimated reads `sharedTransitionTag` off its own wrapper, so the tag needs
// the animated component. It costs a class instance and ref plumbing per image,
// which the list path does not pay: the plain TurboImage stays the default.
const AnimatedTurboImage = Animated.createAnimatedComponent(TurboImage);

// Module-level so it survives unmount: scrolling back to an already-decoded
// image skips the shimmer entirely.
const loadedUris = new Set<string>();
const MAX_LOADED_URIS = 500;

function rememberLoaded(uri: string): void {
  loadedUris.add(uri);
  if (loadedUris.size > MAX_LOADED_URIS) {
    // Set iterates in insertion order, so dropping the first half evicts the
    // oldest scroll positions and keeps what is on or near screen.
    const deleteCount = Math.floor(MAX_LOADED_URIS / 2);
    let i = 0;
    for (const key of loadedUris) {
      if (i >= deleteCount) break;
      loadedUris.delete(key);
      i++;
    }
  }
}

// First decode only; images already in `loadedUris` render instantly so the list
// doesn't flicker on recycle.
const IMAGE_FADE_MS = 200;

// `flatten` returns `undefined` for an absent style, which its type omits.
const flattenImageStyle = (
  style: StyleProp<ImageStyle>,
): ImageStyle | undefined => StyleSheet.flatten(style);

export const CachedImage = ({
  uri,
  style,
  cachePolicy = 'dataCache',
  resizeMode = 'cover',
  containerStyle,
  displaySize,
  onError,
  sharedTransitionTag,
  ...rest
}: CachedImageProps) => {
  // useRecyclingState resets synchronously on `uri` change (cell recycle); a URI
  // already in `loadedUris` starts in 'success' and skips the shimmer.
  const [loadState, setLoadState] = useRecyclingState<LoadState>(
    () => (uri ? (loadedUris.has(uri) ? 'success' : 'loading') : 'idle'),
    [uri],
  );

  const handleSuccess = () => {
    if (uri) rememberLoaded(uri);
    setLoadState('success', true);
  };

  const handleFailure = () => {
    onError?.();
    setLoadState('error', true);
  };

  if (!uri) {
    return (
      // `rest` carries the testID and the accessible name. Dropping them here
      // makes the component anonymous in exactly the state a placeholder is
      // shown, so a check targeting it finds nothing while the literal is
      // still in the source.
      <View {...rest} style={[styles.placeholder, style, containerStyle]}>
        <Icon name="image-outline" size={24} tone="textTertiary" />
      </View>
    );
  }

  const source = { uri };
  const isPreloaded = loadedUris.has(uri);

  const flat = flattenImageStyle(style);
  const borderRadius =
    typeof flat?.borderRadius === 'number' ? flat.borderRadius : 0;
  const innerRadius =
    borderRadius > 0 ? Math.max(borderRadius - (flat?.borderWidth ?? 0), 0) : 0;
  const radiusOverride: ViewStyle | undefined =
    innerRadius > 0
      ? { borderRadius: innerRadius, overflow: 'hidden' }
      : undefined;

  const ImageComponent = sharedTransitionTag ? AnimatedTurboImage : TurboImage;

  return (
    <View style={[style, containerStyle]}>
      <ImageComponent
        fadeDuration={isPreloaded ? 0 : IMAGE_FADE_MS}
        style={[styles.image, innerRadius > 0 && { borderRadius: innerRadius }]}
        source={source}
        cachePolicy={cachePolicy}
        resizeMode={resizeMode}
        resize={displaySize ? displaySize * 2 : undefined}
        sharedTransitionTag={sharedTransitionTag}
        {...rest}
        onSuccess={handleSuccess}
        onFailure={handleFailure}
      />
      {/* Both overlays are absolutely positioned, so mounting them only in their
          own state is layout-neutral and saves two views per settled row. */}
      {loadState === 'loading' && (
        <View style={[styles.overlay, radiusOverride]}>
          <SkeletonBase
            width="100%"
            height={9999}
            borderRadius={0}
            style={styles.skeleton}
          />
        </View>
      )}
      {loadState === 'error' && (
        <View style={[styles.errorOverlay, radiusOverride]}>
          <Icon name="image-outline" size={24} tone="textTertiary" />
        </View>
      )}
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
}));

export function preloadImages(uris: string[]): void {
  const sources: Source[] = uris
    .filter(u => u && !loadedUris.has(u))
    .map(uri => ({ uri }));
  if (sources.length > 0) {
    void TurboImage.prefetch(sources, 'dataCache').catch(error =>
      logger.warn('Image prefetch failed', error),
    );
  }
}

/**
 * Downloads one image before anything shows it, waiting at most `maxWaitMs`,
 * so a view that mounts next renders it with no loading shimmer. A slow or
 * failed download only ends the wait; the view then loads it as usual.
 */
export async function warmImage(uri: string, maxWaitMs: number): Promise<void> {
  if (loadedUris.has(uri)) return;
  const downloaded = TurboImage.prefetch([{ uri }], 'dataCache').then(
    ok => {
      if (ok) rememberLoaded(uri);
    },
    (error: unknown) => logger.warn('Image prefetch failed', error),
  );
  await Promise.race([
    downloaded,
    new Promise(resolve => setTimeout(resolve, maxWaitMs)),
  ]);
}
