import React, { useEffect, useState } from 'react';
import {
  View,
  Modal,
  FlatList,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  GestureDetector,
  GestureHandlerRootView,
  Pressable,
  usePanGesture,
  usePinchGesture,
  useTapGesture,
  useExclusiveGestures,
  useSimultaneousGestures,
} from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useFragment } from '@apollo/client/react';
import { StyleSheet } from 'react-native-unistyles';
import { Text } from '#components/atoms/Text';
import { Icon } from '#utils/iconUtils';
import { CachedImage } from '#components/atoms/CachedImage';
import { ItemImageStatus } from '#/graphql/generated/schemaTypes';
import { photoDisplayUrl, getPerspectiveLabel } from '#utils/imageUtils';
import {
  ItemPhotoCarousel_ItemPhotoFragmentDoc,
  type ItemPhotoCarousel_ItemPhotoFragment,
} from '#components/molecules/ItemPhotoCarousel.generated';
import {
  materializedPhoto,
  type ItemPhotoRef,
} from '#components/molecules/ItemPhotoCarousel';
import { useMarkPrimaryItemImage } from '#hooks/items/useMarkPrimaryItemImage';

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
/**
 * Scale within this of 1x counts as fit-to-screen.
 *
 * A pinch settles on a continuous float, so two fingers drifting a hair apart
 * leave `savedScale` at e.g. 1.02 — visually identical to unzoomed, but a strict
 * `<= MIN_SCALE` test then reads "zoomed" and silently kills both paging and
 * tap-to-close. Snap to exactly MIN_SCALE inside this band.
 */
const ZOOM_EPSILON = 0.01;

/**
 * Keep a magnified photo's translation inside its own bounds.
 *
 * At scale s the content overflows the frame by `extent * (s - 1)`, half on each
 * side. Without this a continued drag walks the photo clean off screen and
 * `savedX/Y` persist that, leaving a black modal the user cannot recover from —
 * paging is disabled while zoomed, so there is nothing to swipe back to.
 */
function clampPan(value: number, extent: number, scaleValue: number): number {
  'worklet';
  const limit = Math.max(0, (extent * (scaleValue - 1)) / 2);
  return Math.min(Math.max(value, -limit), limit);
}

interface ItemPhotoViewerProps {
  visible: boolean;
  /** Same refs the carousel renders, in the same order. */
  photos: readonly ItemPhotoRef[];
  /** Page to open on — the photo the user tapped. */
  initialIndex: number;
  onClose: () => void;
  /**
   * The item's viewer-scoped `Item.canEdit`. Gates the "set as main photo"
   * action, which the server refuses for anyone but the item's creator or an
   * admin. Omitted means read-only — no affordance.
   */
  canEdit?: boolean;
}

/**
 * Fullscreen, pinch-zoomable photo viewer.
 *
 * This is the destination that makes multi-photo items worth having: the hero
 * band crops to 280pt, so a nutrition panel or ingredient list is only legible
 * once it can be opened and zoomed.
 *
 * Paging is disabled while a photo is zoomed in, so a pan on a magnified label
 * moves the image rather than flicking to the next photo.
 */
export const ItemPhotoViewer: React.FC<ItemPhotoViewerProps> = ({
  visible,
  photos,
  initialIndex,
  onClose,
  canEdit = false,
}) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(initialIndex);
  const [zoomed, setZoomed] = useState(false);

  // Adjusting state during render: a fresh open starts on the tapped photo.
  const [prevVisible, setPrevVisible] = useState(visible);
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible) {
      setIndex(initialIndex);
      setZoomed(false);
    }
  }

  const handleMomentumEnd = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    if (next !== index) setIndex(next);
  };

  const total = photos.length;

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={styles.root}>
        <FlatList
          data={photos}
          horizontal
          pagingEnabled
          scrollEnabled={!zoomed}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleMomentumEnd}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, i) => ({
            length: width,
            offset: width * i,
            index: i,
          })}
          keyExtractor={(_, i) => String(i)}
          renderItem={({ item, index: pageIndex }) => (
            <ZoomablePhoto
              photoRef={item}
              width={width}
              height={height}
              isActive={pageIndex === index}
              onZoomChange={setZoomed}
              onClose={onClose}
            />
          )}
        />

        <Pressable
          onPress={onClose}
          style={[styles.closeButton, { top: insets.top + 8 }]}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('labels.close')}
        >
          <Icon name="close" size={24} color="#fff" />
        </Pressable>

        {/* box-none so the photo keeps receiving the taps that close it, while
            the action button inside still gets its own. */}
        <View
          style={[styles.caption, { bottom: insets.bottom + 16 }]}
          pointerEvents="box-none"
        >
          {!!canEdit && !!photos[index] && (
            <SetPrimaryAction photoRef={photos[index]} />
          )}
          <View style={styles.captionStack} pointerEvents="none">
            {!!photos[index] && <PhotoCaption photoRef={photos[index]} />}
            {total > 1 && (
              <Text size="sm" style={styles.counter}>
                {t('itemPhotos.counter', { current: index + 1, total })}
              </Text>
            )}
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
};

/** One zoomable page. Owns its own transform state. */
const ZoomablePhoto: React.FC<{
  photoRef: ItemPhotoRef;
  width: number;
  height: number;
  isActive: boolean;
  onZoomChange: (zoomed: boolean) => void;
  onClose: () => void;
}> = ({ photoRef, width, height, isActive, onZoomChange, onClose }) => {
  const { t } = useTranslation();
  const result = useFragment({
    fragment: ItemPhotoCarousel_ItemPhotoFragmentDoc,
    fragmentName: 'ItemPhotoCarousel_itemPhoto',
    from: photoRef,
  });
  const photo: ItemPhotoCarousel_ItemPhotoFragment | null = result.complete
    ? result.data
    : materializedPhoto(photoRef);

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);
  /**
   * Drives `pan.enabled`. A disabled handler never activates, which is the only
   * way to keep it from stealing the drag: an `onUpdate` that early-returns
   * still activates, and activation alone cancels the enclosing pager's own pan
   * (RNGH calls requestDisallowInterceptTouchEvent on Android; on iOS the
   * recognizers race). With this false at fit-to-screen the swipe reaches the
   * FlatList and the photo actually pages.
   */
  const panEnabled = useSharedValue(false);

  // Leaving the page drops its magnification, so returning to it later starts
  // fit-to-screen rather than wherever the last pan happened to end.
  useEffect(() => {
    if (isActive) return;
    scale.set(1);
    savedScale.set(1);
    translateX.set(0);
    translateY.set(0);
    savedX.set(0);
    savedY.set(0);
    panEnabled.set(false);
  }, [
    isActive,
    scale,
    savedScale,
    translateX,
    translateY,
    savedX,
    savedY,
    panEnabled,
  ]);

  // Pre-defined in RN scope: `scheduleOnRN` cannot serialize a closure created
  // at the worklet call site, and function references do not survive the
  // worklet boundary.
  const markZoomed = () => onZoomChange(true);
  const markUnzoomed = () => onZoomChange(false);
  const closeFromTap = () => onClose();

  const pinch = usePinchGesture({
    onUpdate: event => {
      'worklet';
      // Allow a little overshoot below 1x so the pinch feels elastic; onDeactivate
      // settles it back to the clamped range.
      scale.set(
        Math.min(
          Math.max(savedScale.get() * event.scale, MIN_SCALE * 0.6),
          MAX_SCALE,
        ),
      );
    },
    onDeactivate: () => {
      'worklet';
      const settled = Math.min(Math.max(scale.get(), MIN_SCALE), MAX_SCALE);
      // Snap the near-1x band to exactly 1 so every later comparison is exact.
      const next = settled <= MIN_SCALE + ZOOM_EPSILON ? MIN_SCALE : settled;
      scale.set(withTiming(next));
      savedScale.set(next);
      if (next === MIN_SCALE) {
        translateX.set(withTiming(0));
        translateY.set(withTiming(0));
        savedX.set(0);
        savedY.set(0);
        panEnabled.set(false);
        scheduleOnRN(markUnzoomed);
      } else {
        // Zooming back out can leave the photo further off-centre than the new
        // scale allows; pull it back inside before the user notices a gap.
        const x = clampPan(translateX.get(), width, next);
        const y = clampPan(translateY.get(), height, next);
        translateX.set(withTiming(x));
        translateY.set(withTiming(y));
        savedX.set(x);
        savedY.set(y);
        panEnabled.set(true);
        scheduleOnRN(markZoomed);
      }
    },
  });

  const pan = usePanGesture({
    averageTouches: true,
    // Only a magnified photo pans; at fit-to-screen the drag belongs to the
    // pager, and only a disabled handler leaves it there.
    enabled: panEnabled,
    onUpdate: event => {
      'worklet';
      const current = savedScale.get();
      translateX.set(
        clampPan(savedX.get() + event.translationX, width, current),
      );
      translateY.set(
        clampPan(savedY.get() + event.translationY, height, current),
      );
    },
    onDeactivate: () => {
      'worklet';
      savedX.set(translateX.get());
      savedY.set(translateY.get());
    },
  });

  const doubleTap = useTapGesture({
    numberOfTaps: 2,
    onActivate: () => {
      'worklet';
      if (savedScale.get() > MIN_SCALE + ZOOM_EPSILON) {
        scale.set(withTiming(MIN_SCALE));
        translateX.set(withTiming(0));
        translateY.set(withTiming(0));
        savedScale.set(MIN_SCALE);
        savedX.set(0);
        savedY.set(0);
        panEnabled.set(false);
        scheduleOnRN(markUnzoomed);
      } else {
        scale.set(withTiming(DOUBLE_TAP_SCALE));
        savedScale.set(DOUBLE_TAP_SCALE);
        panEnabled.set(true);
        scheduleOnRN(markZoomed);
      }
    },
  });

  const singleTap = useTapGesture({
    numberOfTaps: 1,
    onActivate: () => {
      'worklet';
      // Tap-to-dismiss only at fit-to-screen: while zoomed a stray tap should
      // not throw away the position the user just worked to reach.
      if (savedScale.get() <= MIN_SCALE + ZOOM_EPSILON) {
        scheduleOnRN(closeFromTap);
      }
    },
  });

  const zoomAndPan = useSimultaneousGestures(pinch, pan);
  // Order is priority: a second tap must not be consumed by singleTap first.
  const composed = useExclusiveGestures(doubleTap, zoomAndPan, singleTap);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.get() },
      { translateY: translateY.get() },
      { scale: scale.get() },
    ],
  }));

  if (!photo) return <View style={{ width, height }} />;

  return (
    <GestureDetector gesture={composed}>
      <View style={[styles.page, { width, height }]}>
        <Animated.View style={animatedStyle}>
          <CachedImage
            /*
             * 'xlarge' is the one PreferredSize with no rendition mapping, so it
             * resolves to the original upload. Anything else here would hand the
             * zoom the 512px variant and a nutrition panel would still be
             * unreadable at 4x — which is the whole reason this viewer exists.
             */
            uri={photoDisplayUrl(photo, 'xlarge')}
            style={{ width, height }}
            /*
             * TurboImage decodes at 2x displaySize, so this yields ~4x the
             * screen width in pixels — enough to stay sharp at MAX_SCALE while
             * still bounding the bitmap.
             */
            displaySize={width * (MAX_SCALE / 2)}
            resizeMode="contain"
            accessibilityLabel={
              photo.perspective
                ? getPerspectiveLabel(photo.perspective, t)
                : undefined
            }
          />
        </Animated.View>
      </View>
    </GestureDetector>
  );
};

/**
 * "Set as main photo" for the photo currently on screen, or a static badge once
 * it is the hero.
 *
 * Rendered only when the item's `canEdit` is true, and only for an APPROVED
 * photo: the server refuses to promote a PENDING one, so offering it there
 * would be an affordance whose only outcome is a ValidationError.
 */
const SetPrimaryAction: React.FC<{ photoRef: ItemPhotoRef }> = ({
  photoRef,
}) => {
  const { t } = useTranslation();
  const { markPrimary, loading } = useMarkPrimaryItemImage();
  const result = useFragment({
    fragment: ItemPhotoCarousel_ItemPhotoFragmentDoc,
    fragmentName: 'ItemPhotoCarousel_itemPhoto',
    from: photoRef,
  });

  const photo: ItemPhotoCarousel_ItemPhotoFragment | null = result.complete
    ? result.data
    : materializedPhoto(photoRef);
  if (!photo || photo.status !== ItemImageStatus.Approved) return null;

  if (photo.isPrimary) {
    return (
      <View style={styles.primaryBadge}>
        <Icon name="star" size={14} tone="rating" />
        <Text size="sm" weight="medium" style={styles.captionText}>
          {t('itemPhotos.mainPhoto')}
        </Text>
      </View>
    );
  }

  return (
    <Pressable
      style={styles.primaryAction}
      onPress={() => {
        void markPrimary(photo.id);
      }}
      /* Deliberately not `disabled={loading}`: this is a one-shot promote, and
         a disabled button reads as a dead tap. The re-render that follows a
         success swaps this for the badge. */
      accessibilityRole="button"
      accessibilityState={{ busy: loading }}
      accessibilityLabel={t('itemPhotos.setAsMain')}
    >
      <Icon name="star-outline" size={14} color="#fff" />
      <Text size="sm" weight="medium" style={styles.captionText}>
        {t('itemPhotos.setAsMain')}
      </Text>
    </Pressable>
  );
};

/** Perspective label + pending state for the photo currently on screen. */
const PhotoCaption: React.FC<{ photoRef: ItemPhotoRef }> = ({ photoRef }) => {
  const { t } = useTranslation();
  const result = useFragment({
    fragment: ItemPhotoCarousel_ItemPhotoFragmentDoc,
    fragmentName: 'ItemPhotoCarousel_itemPhoto',
    from: photoRef,
  });

  const photo: ItemPhotoCarousel_ItemPhotoFragment | null = result.complete
    ? result.data
    : materializedPhoto(photoRef);
  if (!photo) return null;
  const label = photo.perspective
    ? getPerspectiveLabel(photo.perspective, t)
    : null;

  if (!label && photo.status !== ItemImageStatus.Pending) return null;

  return (
    <View style={styles.captionRow}>
      {!!label && (
        <Text size="md" weight="medium" style={styles.captionText}>
          {label}
        </Text>
      )}
      {photo.status === ItemImageStatus.Pending && (
        <View style={styles.pendingBadge}>
          <Icon name="time-outline" size={12} color="#fff" />
          <Text size="xs" weight="medium" style={styles.captionText}>
            {t('itemPhotos.pendingReview')}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  page: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  closeButton: {
    position: 'absolute',
    right: theme.spacing.md,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radii.full,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  caption: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  captionStack: {
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  primaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
    borderRadius: theme.radii.full,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  primaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
    borderRadius: theme.radii.full,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  captionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  captionText: {
    color: '#fff',
  },
  counter: {
    color: '#fff',
    opacity: 0.7,
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.radii.full,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
}));
