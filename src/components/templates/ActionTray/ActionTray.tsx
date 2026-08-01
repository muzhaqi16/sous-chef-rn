import React, {
  forwardRef,
  useContext,
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
import { NavigationContext } from '@react-navigation/native';
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
import { useBackdropClaim } from '#components/providers/OverlayBackdropProvider';
import { useBottomSheetBackHandler } from '#hooks/useBottomSheetBackHandler';
import { useSheetBackdropOpacity } from '#hooks/useSheetBackdropOpacity';
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

    // Backdrop driven by the sheet's own `animatedIndex` so the dim ramps in
    // and out in lockstep with the sheet on the UI thread (on close it fades AS
    // the sheet slides down). Crucially, the claim's LIFECYCLE is tied to
    // `mounted` — a React state transition — so `useBackdropClaim` releases the
    // slot deterministically via effect cleanup when the tray closes
    // (mounted → false) or the screen unmounts. Releasing off gorhom's close
    // events instead is racy: navigation can interrupt the close so those
    // events never fire, leaking the dim (and the tab bar that reads it).
    const { animatedIndex, backdropOpacity } = useSheetBackdropOpacity();
    // Shared dismiss for the backdrop tap and the header close button.
    const handleDismiss = () => {
      bottomSheetRef.current?.dismiss();
    };
    useBackdropClaim(mounted && enableBackdrop, {
      opacity: backdropOpacity,
      onPress: handleDismiss,
    });

    // Android hardware back dismisses the open tray instead of navigating away
    // with it still mounted (which would strand its backdrop + the tab bar that
    // reads it). gorhom has no built-in back handling, so wire it explicitly —
    // only while the tray is open.
    useBottomSheetBackHandler(bottomSheetRef, mounted);

    // Settled-closed cleanup (`onClose` + unmount), reachable from two gorhom
    // signals that can each fire without the other:
    // - `onChange(-1)` — settled-closed. Gorhom SKIPS this when a close
    //   interrupts an open animation that never settled (its internal
    //   `animatedCurrentIndex` is still -1, so `nextIndex !==
    //   animatedCurrentIndex` is false and the callback is never scheduled —
    //   BottomSheet.tsx `animateToPositionCompleted`).
    // - `onDismiss` — fired from gorhom's `unmount()` in every modal
    //   dismissal path, but NOT on minimize (stackBehavior 'switch'), which
    //   only emits `onChange(-1)`.
    // `dismissHandledRef` dedupes the pair so cleanup runs exactly once.
    const dismissHandledRef = useRef(false);
    const handleClosed = () => {
      if (dismissHandledRef.current) return;
      dismissHandledRef.current = true;
      setMounted(false);
      onClose?.();
    };

    // Present the sheet once mounted.
    useEffect(() => {
      if (mounted) {
        dismissHandledRef.current = false;
        bottomSheetRef.current?.present();
      }
    }, [mounted]);

    // Tear the tray down when its screen loses focus, so a programmatic
    // navigation while it's open can't strand the sheet (and its backdrop +
    // the tab bar that reads it). Hardware back is covered by the back handler
    // above; this covers navigation that doesn't go through a close.
    // `NavigationContext` is read directly (not `useNavigation`) so ActionTray
    // stays usable outside a navigator — the listener simply isn't wired then.
    // Subscribe only while open; the latest `handleClosed` is read via a ref so
    // the subscription doesn't churn every render.
    const navigation = useContext(NavigationContext);
    const handleClosedRef = useRef(handleClosed);
    useEffect(() => {
      handleClosedRef.current = handleClosed;
    });
    useEffect(() => {
      if (!navigation || !mounted) return;
      return navigation.addListener('blur', () => {
        handleClosedRef.current();
      });
    }, [navigation, mounted]);

    const handleSheetChanges = (index: number) => {
      if (index < 0) {
        handleClosed();
      } else {
        // Settled at an open detent — the scrollable is now unlocked.
        setIsSettledOpen(true);
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
    borderCurve: 'continuous',
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
    borderCurve: 'continuous',
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
