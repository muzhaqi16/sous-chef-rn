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

// Detached sheets float this far above the screen bottom. The pinned footer takes
// NO `bottomInset` of its own — the detached container already lifts the whole
// sheet, and passing it twice leaves an empty band below the footer.
const BOTTOM_INSET = 30;

// GlobalBackdrop paints the dim instead.
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
      stackBehavior,
    },
    ref,
  ) => {
    const bottomSheetRef = useRef<BottomSheetModal>(null);
    const scrollRef = useRef<BottomSheetScrollViewMethods>(null);
    const [mounted, setMounted] = useState(false);
    const [viewportHeight, setViewportHeight] = useState(0);
    const [isSettledOpen, setIsSettledOpen] = useState(false);
    const { height } = useWindowDimensions();

    // Driven by the sheet's own `animatedIndex`, so the dim moves in lockstep on
    // the UI thread. The claim's LIFECYCLE is tied to `mounted`, a React state
    // transition, so effect cleanup releases it deterministically — releasing off
    // gorhom's close events is racy, since navigation can interrupt the close and
    // those events never fire, leaking the dim and the tab bar reading it.
    const { animatedIndex, backdropOpacity } = useSheetBackdropOpacity();
    const handleDismiss = () => {
      bottomSheetRef.current?.dismiss();
    };
    useBackdropClaim(mounted && enableBackdrop, {
      opacity: backdropOpacity,
      onPress: handleDismiss,
    });

    // gorhom has no built-in back handling, so hardware back is wired explicitly —
    // navigating away with the tray mounted strands its backdrop and the tab bar.
    useBottomSheetBackHandler(bottomSheetRef, mounted);

    // Two gorhom signals, each of which can fire without the other: `onChange(-1)`
    // is skipped when a close interrupts an open animation that never settled, and
    // `onDismiss` never fires on a minimize (stackBehavior 'switch').
    // `dismissHandledRef` dedupes them so cleanup runs exactly once.
    const dismissHandledRef = useRef(false);
    const handleClosed = () => {
      if (dismissHandledRef.current) return;
      dismissHandledRef.current = true;
      setMounted(false);
      onClose?.();
    };

    useEffect(() => {
      if (mounted) {
        dismissHandledRef.current = false;
        bottomSheetRef.current?.present();
      }
    }, [mounted]);

    // Covers navigation that doesn't go through a close, which would otherwise
    // strand the sheet and its backdrop. `NavigationContext` is read directly, not
    // via `useNavigation`, so ActionTray stays usable outside a navigator.
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
        setIsSettledOpen(true);
      }
    };

    useImperativeHandle(
      ref,
      () => {
        const dismiss = () => {
          bottomSheetRef.current?.dismiss();
        };
        // Reset on open, not in an effect: returning null below does not unmount
        // this component, so the flag would persist from the last presentation.
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

    // Rendered through gorhom's `handleComponent` slot so it stays pinned; its
    // measured height feeds the sheet's dynamic size. Returning null suppresses
    // gorhom's default grab handle rather than drawing an empty band.
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

    // gorhom's `footerComponent` slot; `enableFooterMarginAdjustment` on the
    // scrollview reserves matching space so the last row never hides behind it.
    const renderFooter =
      footer != null
        ? (props: BottomSheetFooterProps) => (
            <BottomSheetFooter {...props}>
              <View style={styles.footer}>{footer}</View>
            </BottomSheetFooter>
          )
        : undefined;

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
        stackBehavior={stackBehavior}
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
  // With a pinned footer the bottom gap is `footerGap` plus gorhom's height
  // reserve, so the content container adds no bottom pad of its own.
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
