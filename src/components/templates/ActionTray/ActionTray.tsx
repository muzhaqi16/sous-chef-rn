import React, {
  forwardRef,
  useImperativeHandle,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetFooter,
  type BottomSheetFooterProps,
  type BottomSheetScrollViewMethods,
} from '@gorhom/bottom-sheet';
import { StyleSheet as UnistylesStyleSheet } from 'react-native-unistyles';
import { AppPressable } from '#components/atoms/AppPressable';
import { Text } from '#components/atoms/Text';
import { Icon } from '#utils/iconUtils';
import { useBottomSheetBackdropClaim } from '#hooks/useBottomSheetBackdropClaim';
import { ActionTrayScrollContext } from './ActionTrayScrollContext';
import type { ActionTrayProps, ActionTrayRef } from './types';

// Detached sheets float this far above the screen bottom. The pinned footer
// does NOT take a `bottomInset` of its own: the detached container already
// lifts the whole sheet by this amount, so passing it to BottomSheetFooter too
// would double-count it and leave an empty band below the footer.
const BOTTOM_INSET = 30;

// Null backdrop component - we use GlobalBackdrop instead
const NullBackdrop = () => null;

export const ActionTray = forwardRef<ActionTrayRef, ActionTrayProps>(
  (
    {
      children,
      style,
      onClose,
      onOpen,
      title,
      headerRight,
      footer,
      showCloseButton = true,
      enableBackdrop = true,
    },
    ref,
  ) => {
    const bottomSheetRef = useRef<BottomSheetModal>(null);
    const scrollRef = useRef<BottomSheetScrollViewMethods>(null);
    const [mounted, setMounted] = useState(false);
    const [viewportHeight, setViewportHeight] = useState(0);
    const [isSettledOpen, setIsSettledOpen] = useState(false);
    const { height } = useWindowDimensions();

    // Backdrop driven by the sheet's `animatedIndex` so the dim ramps in and
    // out in lockstep with the sheet on the UI thread: on close it fades AS
    // the sheet slides down, rather than holding full opacity until the close
    // animation settles and only then fading. The claim happens at the start
    // of the open animation (via `onAnimate`) and is released on the
    // settled-closed `onChange(-1)`. Tap-to-dismiss is wired inside the hook
    // (it dismisses via `bottomSheetRef`).
    const {
      animatedIndex,
      onChange: handleBackdrop,
      onAnimate: handleBackdropAnimate,
    } = useBottomSheetBackdropClaim(bottomSheetRef);

    // `onClose` is the parent's "tray is closing — restore your UI" signal
    // (the floating tab bar un-hides off it). It's fired at the START of the
    // close animation (see `handleSheetAnimate`) so that UI animates back in
    // parallel with the slide-down instead of waiting for settled-closed.
    // `closeNotifiedRef` dedupes it to once per presentation cycle; the
    // settled-closed path calls it too as a fallback for closes that skip
    // `onAnimate(-1)`.
    const closeNotifiedRef = useRef(false);
    const notifyClose = () => {
      if (closeNotifiedRef.current) return;
      closeNotifiedRef.current = true;
      onClose?.();
    };

    // Settled-closed cleanup (unmount + backdrop release), reachable from two
    // gorhom signals that can each fire without the other:
    // - `onChange(-1)` — settled-closed. Gorhom SKIPS this when a close
    //   interrupts an open animation that never settled (its internal
    //   `animatedCurrentIndex` is still -1, so `nextIndex !==
    //   animatedCurrentIndex` is false and the callback is never scheduled —
    //   BottomSheet.tsx `animateToPositionCompleted`).
    // - `onDismiss` — fired from gorhom's `unmount()` in every modal
    //   dismissal path, but NOT on minimize (stackBehavior 'switch'), which
    //   only emits `onChange(-1)`.
    // `dismissHandledRef` dedupes the pair so the unmount + release runs once.
    const dismissHandledRef = useRef(false);
    const handleClosed = () => {
      if (dismissHandledRef.current) return;
      dismissHandledRef.current = true;
      // Idempotent backdrop release. Covers the path where gorhom's
      // `onDismiss` wins the race against `onChange(-1)` (which also releases
      // via `handleSheetChanges`); `releaseBackdrop` no-ops on a stale id.
      if (enableBackdrop) handleBackdrop(-1);
      notifyClose();
      setMounted(false);
    };

    // Present the sheet once mounted.
    useEffect(() => {
      if (mounted) {
        dismissHandledRef.current = false;
        closeNotifiedRef.current = false;
        bottomSheetRef.current?.present();
      }
    }, [mounted]);

    const handleSheetChanges = (index: number) => {
      // Drive the backdrop slot off gorhom's authoritative index: claim on
      // open (index ≥ 0, idempotent backstop to `onAnimate`), release on -1.
      if (enableBackdrop) handleBackdrop(index);
      if (index < 0) {
        handleClosed();
      } else {
        // Settled at an open detent — the scrollable is now unlocked.
        setIsSettledOpen(true);
      }
    };

    // gorhom fires `onAnimate` at the START of every position animation, before
    // it begins driving `animatedPosition`.
    const handleSheetAnimate = (fromIndex: number, toIndex: number) => {
      // Claim the backdrop at the start of the open animation so the dim ramps
      // in frame-synced with the sheet.
      if (enableBackdrop) handleBackdropAnimate(fromIndex, toIndex);
      if (toIndex < 0) {
        // Closing: restore the parent UI now so it animates back alongside the
        // slide-down rather than after the settled-closed signal.
        notifyClose();
      } else if (closeNotifiedRef.current) {
        // A started close reversed (pan-down snap-back / intermediate snap):
        // re-hide via `onOpen` and re-arm so the next real close notifies again.
        closeNotifiedRef.current = false;
        onOpen?.();
      }
    };

    useImperativeHandle(
      ref,
      () => {
        const dismiss = () => {
          bottomSheetRef.current?.dismiss();
        };
        // Reset the settled flag here (on open) rather than in an effect:
        // returning null below doesn't unmount this component, so the flag
        // would otherwise persist from the previous presentation.
        const open = () => {
          onOpen?.();
          setIsSettledOpen(false);
          setMounted(true);
        };
        return {
          open: () => {
            if (mounted) return;
            open();
          },
          close: dismiss,
          toggle: () => {
            if (mounted) {
              dismiss();
            } else {
              open();
            }
          },
          isActive: () => mounted,
        };
      },
      [mounted, onOpen],
    );

    const handleDismiss = () => {
      bottomSheetRef.current?.dismiss();
    };

    // Pinned header. Rendered through gorhom's `handleComponent` slot so it
    // stays fixed while the content scrolls. Its measured height feeds the
    // sheet's dynamic size (`contentHeight + handleHeight`), so the sheet still
    // hugs short content and caps long content at `maxDynamicContentSize`.
    // Returning null when there's nothing to show suppresses gorhom's default
    // grab handle and avoids drawing an empty padded band.
    const hasHeader = !!title || !!headerRight || showCloseButton;
    const renderHandle = () =>
      hasHeader ? (
        <View style={styles.header}>
          {title ? (
            <Text size="lg" weight="semibold" tone="primary">
              {title}
            </Text>
          ) : null}
          <View style={styles.fill} />
          {!!headerRight && headerRight}
          {showCloseButton ? (
            <AppPressable onPress={handleDismiss} style={styles.closeButton}>
              <Icon name="close" size={16} tone="textSecondary" />
            </AppPressable>
          ) : null}
        </View>
      ) : null;

    // Pinned footer (optional). Rendered through gorhom's `footerComponent` so
    // it floats above the scroll; `enableFooterMarginAdjustment` on the
    // scrollview reserves matching space so the last row never hides behind it.
    const renderFooter =
      footer != null
        ? (props: BottomSheetFooterProps) => (
            <BottomSheetFooter {...props}>
              <View style={styles.footer}>{footer}</View>
            </BottomSheetFooter>
          )
        : undefined;

    // Let content (e.g. selectors) bring the active row into view on open.
    const handleScrollLayout = (event: LayoutChangeEvent) => {
      setViewportHeight(event.nativeEvent.layout.height);
    };
    const scrollToContentOffset = (y: number, animated = false) => {
      scrollRef.current?.scrollTo({ y, animated });
    };
    const scrollContextValue = {
      scrollToContentOffset,
      viewportHeight,
      isReady: isSettledOpen,
    };

    if (!mounted) return null;

    return (
      <BottomSheetModal
        ref={bottomSheetRef}
        detached={true}
        bottomInset={BOTTOM_INSET}
        enableDynamicSizing={true}
        maxDynamicContentSize={height * 0.7}
        enablePanDownToClose={true}
        backdropComponent={NullBackdrop}
        handleComponent={renderHandle}
        footerComponent={renderFooter}
        animatedIndex={animatedIndex}
        onAnimate={handleSheetAnimate}
        onChange={handleSheetChanges}
        onDismiss={handleClosed}
        style={[styles.modal, style]}
        backgroundStyle={styles.background}
      >
        {/* `BottomSheetScrollView` is the single content-height source for
            dynamic sizing: short content hugs its height (no scroll), long
            content scrolls within `maxDynamicContentSize`. Never nest another
            scrollable in `children` — two content-height sources break dynamic
            sizing (the nested scroll view reports its full, unbounded content
            height and the sheet overflows). */}
        <BottomSheetScrollView
          ref={scrollRef}
          onLayout={handleScrollLayout}
          contentContainerStyle={
            footer != null ? styles.contentWithFooter : styles.content
          }
          showsVerticalScrollIndicator={false}
          enableFooterMarginAdjustment={footer != null}
        >
          <ActionTrayScrollContext.Provider value={scrollContextValue}>
            {children}
          </ActionTrayScrollContext.Provider>
          {/* Consistent gap between the content and the pinned footer (a real
              element, so it doesn't depend on gorhom reading the content
              container's padding). */}
          {footer != null ? <View style={styles.footerGap} /> : null}
        </BottomSheetScrollView>
      </BottomSheetModal>
    );
  },
);

ActionTray.displayName = 'ActionTray';

const styles = UnistylesStyleSheet.create(theme => ({
  modal: {
    marginHorizontal: '2.5%', // Creates 95% width centered
    borderRadius: theme.radii.xl,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    boxShadow: [
      {
        offsetX: 0,
        offsetY: -2,
        blurRadius: 8,
        spreadDistance: 0,
        color: `${theme.colors.textPrimary}1A`,
      },
    ],
  },
  background: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  fill: {
    flex: 1,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    paddingTop: 0,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
  },
  // With a pinned footer the bottom gap comes from `footerGap` + gorhom's
  // footer-height reserve, so the content container itself adds no bottom pad.
  contentWithFooter: {
    paddingTop: 0,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: 0,
  },
  footerGap: {
    height: theme.spacing.md,
  },
  footer: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
    borderBottomLeftRadius: theme.radii.xl,
    borderBottomRightRadius: theme.radii.xl,
  },
}));
