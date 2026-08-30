import { useRef, useEffect, useContext, useState } from 'react';
import {
  BottomSheetModal as GorhomBottomSheetModal,
  type BottomSheetModalProps,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { withUnistyles } from 'react-native-unistyles';
import { NavigationContext } from '@react-navigation/native';
import { useSharedBottomSheetConfigs } from '#hooks/useSharedBottomSheetConfigs';
import { useBottomSheetBackHandler } from '#hooks/useBottomSheetBackHandler';
import { useBottomSheetBackdropClaim } from '#hooks/useBottomSheetBackdropClaim';

/**
 * Theme-reactive `BottomSheetModal`: theme updates flow through the ShadowTree,
 * so callers never re-render for new colors. Re-exported under the gorhom name
 * so only the import source changes at a call site.
 */
const ThemedBottomSheetModal = withUnistyles(GorhomBottomSheetModal, theme => ({
  backgroundStyle: { backgroundColor: theme.colors.surface },
  handleIndicatorStyle: { backgroundColor: theme.colors.textSecondary },
}));

export { ThemedBottomSheetModal as BottomSheetModal };

/**
 * Ref type for callsites — the gorhom class, since the wrapped component's value
 * type is not a usable type position. `unknown` because gorhom 5.2.14 defaults
 * the `present(data)` payload generic to `never`.
 */
export type BottomSheetModalRef = GorhomBottomSheetModal<unknown>;

export interface UseStandardBottomSheetOptions {
  /** When provided, auto-manages present/dismiss. Omit to manage presentation manually via ref. */
  visible?: boolean;
  onDismiss: () => void;
  snapPoints: (string | number)[];
  keyboardBehavior?: 'extend' | 'fillParent' | 'interactive';
  enableDynamicSizing?: boolean;
  /** Wrapped, so the hook drives the backdrop slot off gorhom's index. */
  onChange?: (index: number, position: number, type: number) => void;
  /** Wrapped, so the hook claims the backdrop at the open-animation start. */
  onAnimate?: (
    fromIndex: number,
    toIndex: number,
    fromPosition: number,
    toPosition: number,
  ) => void;
}

// Gorhom expects the snap-point type literal even though we don't branch on it.
type SnapPointType = Parameters<
  NonNullable<BottomSheetModalProps['onChange']>
>[2];

/**
 * BottomSheetModal boilerplate: ref, insets, configs, back handler,
 * present/dismiss reconciliation, common props. `backdropComponent` is
 * deliberately ABSENT — the dim is the app-level `GlobalBackdrop`, claimed and
 * released here, decoupling the slot from the portal's mount.
 */
export function useStandardBottomSheet({
  visible,
  onDismiss,
  snapPoints,
  keyboardBehavior,
  enableDynamicSizing = false,
  onChange: userOnChange,
  onAnimate: userOnAnimate,
}: UseStandardBottomSheetOptions) {
  const insets = useSafeAreaInsets();
  const ref = useRef<GorhomBottomSheetModal<unknown>>(null);
  const animationConfigs = useSharedBottomSheetConfigs();

  const {
    animatedIndex,
    onChange: handleBackdrop,
    onAnimate: handleBackdropAnimate,
    release: releaseBackdrop,
  } = useBottomSheetBackdropClaim(ref);

  // 'interactive' lifts the sheet by the keyboard height measured from its
  // TALLEST snap point (`max(0, highestDetentPosition - keyboardHeight)`), so a
  // tall extra snap point drives that to 0 and the sheet goes full screen the
  // instant a field is focused. Declare only the snap points the sheet wants.
  const resolvedKeyboardBehavior = keyboardBehavior ?? 'interactive';

  // ONE effect reconciles `active = visible && isFocused` against
  // `isPresentedRef`. The blur-dismiss is REQUIRED: the modal portals ABOVE the
  // navigation container, so an open sheet obscures a newly-pushed screen.
  // `isPresentedRef` is the CURRENT state, not "ever presented", which dodges
  // gorhom 5.2.14's wedge: `dismiss()` on a never-presented modal flips it to
  // DISMISSING and every later `present()` is skipped.
  const navigation = useContext(NavigationContext);
  const [isFocused, setIsFocused] = useState(
    () => navigation?.isFocused() ?? true,
  );

  useEffect(() => {
    if (!navigation) return;
    const unsubFocus = navigation.addListener('focus', () =>
      setIsFocused(true),
    );
    const unsubBlur = navigation.addListener('blur', () => setIsFocused(false));
    return () => {
      unsubFocus();
      unsubBlur();
    };
  }, [navigation]);

  // Only while actually on screen: `visible` stays true across a navigation
  // away, so a handler gated on it alone stays subscribed on the pushed screen
  // and swallows back there.
  useBottomSheetBackHandler(ref, (visible ?? false) && isFocused);

  const isPresentedRef = useRef(false);
  // Marks a dismiss caused purely by blur, so `safeOnDismiss` does not notify
  // the consumer — clearing `visible` would stop the sheet re-presenting.
  const blurDismissRef = useRef(false);
  useEffect(() => {
    if (visible === undefined) return;
    const active = visible && isFocused;
    if (active && !isPresentedRef.current) {
      isPresentedRef.current = true;
      // A rapid blur → refocus interrupts the close, so gorhom never fires
      // onDismiss and a stale flag would swallow the next genuine one.
      blurDismissRef.current = false;
      ref.current?.present();
    } else if (!active && isPresentedRef.current) {
      isPresentedRef.current = false;
      // `!active` with `visible` still true means the screen blurred (not a
      // consumer close) — flag it so `safeOnDismiss` preserves `visible`.
      if (visible) {
        blurDismissRef.current = true;
      }
      ref.current?.dismiss();
      if (visible) {
        // Blur path only: a dismiss can unmount the portal before `onChange(-1)`
        // reaches JS, stranding the claim as an invisible tap blocker. The
        // incoming screen covers the dim, so an instant release is invisible.
        releaseBackdrop();
      }
    }
  }, [visible, isFocused, releaseBackdrop]);

  // The caller's onChange lives in a ref, so a changing identity does not churn
  // `handleChange` and force gorhom to rewire.
  const userOnChangeRef = useRef(userOnChange);
  useEffect(() => {
    userOnChangeRef.current = userOnChange;
  });

  const handleChange = (
    index: number,
    position: number,
    type: SnapPointType,
  ): void => {
    handleBackdrop(index);
    userOnChangeRef.current?.(index, position, type);
  };

  // Same for onAnimate, which is what fires the backdrop claim at the
  // open-animation start.
  const userOnAnimateRef = useRef(userOnAnimate);
  useEffect(() => {
    userOnAnimateRef.current = userOnAnimate;
  });

  const handleAnimate = (
    fromIndex: number,
    toIndex: number,
    fromPosition: number,
    toPosition: number,
  ): void => {
    handleBackdropAnimate(fromIndex, toIndex);
    userOnAnimateRef.current?.(fromIndex, toIndex, fromPosition, toPosition);
  };

  // Gorhom fires `onClose` and `onChange(-1)` from separate animated reactions;
  // if `onClose` wins it unmounts the portal first and the claim leaks, so the
  // release is repeated here (idempotent).
  const safeOnDismiss = () => {
    // BEFORE `onDismiss` runs and clears the parent's `visible`, so the effect
    // skips a redundant `dismiss()` that would wedge the next `present()`.
    isPresentedRef.current = false;
    handleBackdrop(-1);
    // A blur dismiss must NOT notify the consumer: `visible` staying true is
    // what lets the focus effect re-present the sheet with its typed state.
    if (blurDismissRef.current) {
      blurDismissRef.current = false;
      return;
    }
    onDismiss();
  };

  // Theme-derived `backgroundStyle` / `handleIndicatorStyle` come from the
  // wrapped `BottomSheetModal` above — no theme reads here.
  const modalProps: Partial<BottomSheetModalProps> = {
    snapPoints,
    enablePanDownToClose: true,
    enableDynamicSizing,
    topInset: insets.top,
    onDismiss: safeOnDismiss,
    onChange: handleChange,
    onAnimate: handleAnimate,
    animatedIndex,
    animationConfigs,
    keyboardBehavior: resolvedKeyboardBehavior,
    keyboardBlurBehavior: 'restore',
    android_keyboardInputMode: 'adjustPan',
  };

  const contentContainerStyle = { paddingBottom: insets.bottom + 16 };

  // For an event handler that must close the sheet directly; state-driven
  // control goes through the `visible` option instead.
  const present = () => ref.current?.present();
  const dismiss = () => ref.current?.dismiss();
  const close = () => ref.current?.close();
  const snapToIndex = (index: number) => ref.current?.snapToIndex(index);

  return {
    ref,
    modalProps,
    contentContainerStyle,
    insets,
    present,
    dismiss,
    close,
    snapToIndex,
  };
}
