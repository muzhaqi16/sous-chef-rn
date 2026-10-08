import React, { useState } from 'react';
import {
  View,
  FlatList,
  useWindowDimensions,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewStyle,
} from 'react-native';
import { useTranslation } from '#/i18n';
import { useFragment } from '@apollo/client/react';
import type { FragmentType } from '@apollo/client/masking';
import { StyleSheet } from 'react-native-unistyles';
import { Pressable } from '#components/atoms/themedComponents';
import { Text } from '#components/atoms/Text';
import { Icon } from '#utils/iconUtils';
import { CachedImage } from '#components/atoms/CachedImage';
import { ItemImageStatus } from '#/graphql/generated/schemaTypes';
import {
  galleryPhotos,
  photoDisplayUrl,
  getPerspectiveLabel,
} from '#utils/imageUtils';
import {
  ItemPhotoCarousel_ItemPhotoFragmentDoc,
  type ItemPhotoCarousel_ItemPhotoFragment,
} from '#features/catalog/ui/ItemPhotoCarousel.generated';
import { PhotoCredit } from '#features/catalog/ui/PhotoCredit';

// The current page's dot; the credit clears the pill it sets the height of.
const ACTIVE_DOT_SIZE = 10;

/**
 * A photo as a caller can hold it: the masked ref Apollo hands back at runtime,
 * or the materialized object — codegen inlines fragment spreads into the
 * screen-level types, so screens are typed as holding the latter.
 */
export type ItemPhotoRef =
  | FragmentType<typeof ItemPhotoCarousel_ItemPhotoFragmentDoc>
  | ItemPhotoCarousel_ItemPhotoFragment;

/**
 * A photo ref read through its fragment. An incomplete read falls back to the
 * ref's materialized form, or null for a bare masked ref: it carries no `url`,
 * so rendering it would put `undefined` into an <Image>.
 */
export const useItemPhoto = (
  ref: ItemPhotoRef,
): ItemPhotoCarousel_ItemPhotoFragment | null => {
  const result = useFragment({
    fragment: ItemPhotoCarousel_ItemPhotoFragmentDoc,
    fragmentName: 'ItemPhotoCarousel_itemPhoto',
    from: ref,
  });
  if (result.complete) return result.data;
  return 'url' in ref && typeof ref.url === 'string' ? ref : null;
};

interface ItemPhotoCarouselProps {
  /** `Item.photos`, in the server's gallery order. Capped at 6 for display. */
  photos: readonly ItemPhotoRef[] | null | undefined;
  /** Shown when the item has no photos yet (the single-asset `imageUrl`). */
  fallbackImageUrl?: string | null;
  /** Container style */
  style?: ViewStyle;
  /** Image height (default: 200) */
  imageHeight?: number;
  /** How the image fills its band (default: 'contain') */
  resizeMode?: 'cover' | 'contain';
  /**
   * Float the page dots over the photo instead of rendering them in-flow
   * below it. Keeps the component's total height equal to `imageHeight` —
   * required when a parent (e.g. CollapsingHeroDetail's content card)
   * overlaps the bottom edge of the hero.
   */
  overlayDots?: boolean;
  /** Bottom offset of the floated dots (overlayDots only, default 8). */
  dotsBottomOffset?: number;
  /** Opens the fullscreen viewer at the tapped page. */
  onPhotoPress?: (index: number) => void;
  /**
   * Fired when the gallery has nothing left to show — a lone photo whose image
   * failed, or a failing `fallbackImageUrl`. Lets a host collapse its hero band
   * instead of reserving 280pt for a placeholder icon. Deliberately not fired
   * for one bad photo among several: the rest of the gallery still renders.
   */
  onUnrenderable?: () => void;
}

/**
 * Horizontally paged gallery — one page per REAL photo, since `Item.photos`
 * groups size renditions under their source. The hero band crops, so label
 * photos are only readable in the zoomable viewer `onPhotoPress` opens.
 */
export const ItemPhotoCarousel: React.FC<ItemPhotoCarouselProps> = ({
  photos,
  fallbackImageUrl,
  style,
  imageHeight = 200,
  resizeMode = 'contain',
  overlayDots = false,
  dotsBottomOffset = 8,
  onPhotoPress,
  onUnrenderable,
}) => {
  const { width: windowWidth } = useWindowDimensions();
  const [pageWidth, setPageWidth] = useState(windowWidth);
  const [index, setIndex] = useState(0);

  const pages = galleryPhotos(photos);

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    if (width > 0 && width !== pageWidth) setPageWidth(width);
  };

  const handleMomentumEnd = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    if (pageWidth <= 0) return;
    const next = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
    if (next !== index) setIndex(next);
  };

  // No gallery yet: render the item's single resolved asset, so an item whose
  // photos have not been migrated still shows its picture.
  if (pages.length === 0) {
    return (
      <View style={[styles.container, style]} onLayout={handleLayout}>
        {fallbackImageUrl ? (
          <PhotoFrame
            uri={fallbackImageUrl}
            width={pageWidth}
            height={imageHeight}
            resizeMode={resizeMode}
            onFailed={onUnrenderable}
          />
        ) : (
          <View style={[styles.placeholder, { height: imageHeight }]}>
            <Icon name="image-outline" size={48} tone="textTertiary" />
          </View>
        )}
      </View>
    );
  }

  const showDots = pages.length > 1;
  // Floated dots lift a credit above them; dots below the photo leave it on the edge.
  const creditDotsOffset = overlayDots ? dotsBottomOffset : null;

  return (
    <View style={[styles.container, style]} onLayout={handleLayout}>
      <FlatList
        data={pages}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumEnd}
        // Six full-width decodes held at once is real memory on low-end
        // Android; keep only the neighbours of the visible page realized.
        initialNumToRender={1}
        windowSize={3}
        maxToRenderPerBatch={2}
        getItemLayout={(_, i) => ({
          length: pageWidth,
          offset: pageWidth * i,
          index: i,
        })}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item, index: pageIndex }) => (
          <PhotoPage
            photoRef={item}
            width={pageWidth}
            height={imageHeight}
            resizeMode={resizeMode}
            creditDotsOffset={creditDotsOffset}
            showDots={showDots}
            onPress={onPhotoPress ? () => onPhotoPress(pageIndex) : undefined}
            onFailed={pages.length === 1 ? onUnrenderable : undefined}
          />
        )}
      />

      {/* Page dots: in-flow strip below the photo, or floated over its bottom
          edge (overlayDots) so the component stays imageHeight tall. */}
      {!!showDots &&
        (overlayDots ? (
          <View
            style={[styles.dotsOverlay, { bottom: dotsBottomOffset }]}
            pointerEvents="none"
          >
            <View style={styles.dotsPill}>
              {pages.map((_, i) => (
                <Dot key={i} isActive={i === index} />
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.dotsContainer}>
            {pages.map((_, i) => (
              <Dot key={i} isActive={i === index} />
            ))}
          </View>
        ))}
    </View>
  );
};

/**
 * One page. Reads its own fragment (Pattern A) rather than the carousel reading
 * an array `from`, so one photo's change re-renders only its page.
 */
const PhotoPage: React.FC<{
  photoRef: ItemPhotoRef;
  width: number;
  height: number;
  resizeMode: 'cover' | 'contain';
  creditDotsOffset: number | null;
  showDots: boolean;
  onPress?: () => void;
  onFailed?: () => void;
}> = ({
  photoRef,
  width,
  height,
  resizeMode,
  creditDotsOffset,
  showDots,
  onPress,
  onFailed,
}) => {
  const { t } = useTranslation();
  const photo = useItemPhoto(photoRef);

  if (!photo) return <View style={{ width, height }} />;

  const label = photo.perspective
    ? getPerspectiveLabel(photo.perspective, t)
    : undefined;

  const frame = (
    <PhotoFrame
      // The band spans the screen, and a rendition (512px at most) is soft at
      // that width on a 3x phone, so it shows the original.
      uri={photoDisplayUrl(photo, 'xlarge')}
      width={width}
      height={height}
      resizeMode={resizeMode}
      accessibilityLabel={label}
      onFailed={onFailed}
    />
  );

  return (
    <View style={{ width, height }}>
      {onPress ? (
        <Pressable
          onPress={onPress}
          accessibilityRole="imagebutton"
          accessibilityLabel={
            label
              ? t('itemPhotos.viewPhotoLabeled', { perspective: label })
              : t('itemPhotos.viewPhoto')
          }
        >
          {frame}
        </Pressable>
      ) : (
        frame
      )}

      {/* A photo on a catalog item the user cannot edit lands PENDING: the API
          returns it to its submitter alone, so it must not read as live. */}
      {photo.status === ItemImageStatus.Pending && (
        <View style={styles.pendingBadge} pointerEvents="none">
          <Icon name="time-outline" size={12} tone="onScrim" />
          <Text role="label" style={styles.pendingText}>
            {t('itemPhotos.pendingReview')}
          </Text>
        </View>
      )}

      {/* box-none: a tap beside the credit still opens the viewer. */}
      {photo.credit ? (
        <View
          style={styles.credit(creditDotsOffset, showDots)}
          pointerEvents="box-none"
        >
          <PhotoCredit credit={photo.credit} overPhoto />
        </View>
      ) : null}
    </View>
  );
};

/** The image band itself, with its own load/error states. */
const PhotoFrame: React.FC<{
  uri: string;
  width: number;
  height: number;
  resizeMode: 'cover' | 'contain';
  accessibilityLabel?: string;
  onFailed?: () => void;
}> = ({ uri, width, height, resizeMode, accessibilityLabel, onFailed }) => {
  const [failed, setFailed] = useState(false);

  // Render-time reset: a new uri gets a fresh error state.
  const [prevUri, setPrevUri] = useState(uri);
  if (uri !== prevUri) {
    setPrevUri(uri);
    setFailed(false);
  }

  if (failed) {
    return (
      <View style={[styles.errorContainer, { width, height }]}>
        <Icon name="image-outline" size={48} tone="textTertiary" />
      </View>
    );
  }

  return (
    <CachedImage
      uri={uri}
      style={{ width, height }}
      // The decode WIDTH: a band is wider than it is tall.
      displaySize={width}
      resizeMode={resizeMode}
      accessibilityLabel={accessibilityLabel}
      onError={() => {
        setFailed(true);
        onFailed?.();
      }}
    />
  );
};

const Dot: React.FC<{ isActive: boolean }> = ({ isActive }) => {
  styles.useVariants({ active: isActive });
  return <View style={styles.dot} />;
};

const styles = StyleSheet.create(theme => ({
  container: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    borderCurve: 'continuous',
    overflow: 'hidden',
    alignSelf: 'stretch',
  },
  placeholder: {
    width: '100%',
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  pendingBadge: {
    position: 'absolute',
    top: theme.spacing.sm,
    left: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing['2xs'],
    borderRadius: theme.radii.full,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.overlays.dark,
  },
  pendingText: {
    color: theme.colors.onScrim,
  },
  // On the photo's bottom edge, or above the floated dot pill: its active dot
  // and its padding above and below.
  credit: (dotsOffset: number | null, showDots: boolean) => ({
    position: 'absolute',
    left: theme.spacing.sm,
    right: theme.spacing.sm,
    alignItems: 'flex-end',
    bottom:
      dotsOffset === null
        ? theme.spacing.sm
        : dotsOffset +
          (showDots
            ? ACTIVE_DOT_SIZE + theme.spacing['2xs'] * 2 + theme.spacing.xs
            : 0),
  }),
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
    paddingVertical: theme.spacing['2xs'],
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.overlays.medium,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.border,
    variants: {
      active: {
        true: {
          backgroundColor: theme.colors.primary,
          width: ACTIVE_DOT_SIZE,
          height: ACTIVE_DOT_SIZE,
          borderRadius: theme.radii.full,
          borderCurve: 'continuous',
        },
      },
    },
  },
}));
