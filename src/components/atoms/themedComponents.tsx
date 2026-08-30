import {
  ActivityIndicator,
  Pressable as RNPressable,
  RefreshControl as RNRefreshControl,
  TextInput,
} from 'react-native';
// RNGH's, not RN's — see `ThemedRefreshControl` below.
import { RefreshControl } from 'react-native-gesture-handler';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { withUnistyles } from 'react-native-unistyles';

import { BackButton } from './BackButton';
import { IconButton } from './IconButton';
import { Icon } from '#utils/iconUtils';

// Shared withUnistyles wrappers for third-party components that take theme-
// derived props. Defining them at module scope (not inline in screens) keeps
// the per-screen code free of useUnistyles re-render subscriptions.

// Project convention: import Pressable from this module. Aliased to RN's
// Pressable — wrapping RNGH's Pressable with `withUnistyles` silently dropped
// StyleSheet.create proxy values inside function-style `({pressed}) => [...]`
// callbacks (unistyles#1109). RN's Pressable is auto-bound to the Unistyles
// ShadowTree by the babel plugin, so styles and theme switches work natively.
// For gesture composition (Swipeable, GestureDetector chains), import
// Pressable directly from 'react-native-gesture-handler' at the call site.
export const Pressable = RNPressable;

// `inputPlaceholder` is the palette's designated placeholder tone (neutral 500,
// ~3.6:1). `textSecondary` is a body-text tone (neutral 700, ~7.5:1) — using it
// here rendered placeholders as dark as real input, so an empty field read as
// filled. `BaseInput` already used `inputPlaceholder`; these now agree with it.

/** Plain RN TextInput with a theme-reactive placeholder color. */
export const ThemedTextInput = withUnistyles(TextInput, theme => ({
  placeholderTextColor: theme.colors.inputPlaceholder,
}));

/** TextInput inside a BottomSheet that needs a theme-reactive placeholder. */
export const ThemedBottomSheetTextInput = withUnistyles(
  BottomSheetTextInput,
  theme => ({
    placeholderTextColor: theme.colors.inputPlaceholder,
  }),
);

/** Keyboard-aware scroller for full-screen forms, with `bottomOffset`
 *  defaulting to the density-scaled `theme.spacing.md` (the library default is
 *  0, which lands a focused input flush against the keyboard). Sheets use
 *  `BottomSheetFormScrollView` instead, which carries the same default. An
 *  explicitly passed `bottomOffset` overrides the mapping. */
export const ThemedKeyboardAwareScrollView = withUnistyles(
  KeyboardAwareScrollView,
  theme => ({
    bottomOffset: theme.spacing.md,
  }),
);

/** Spinner colored by the brand primary. */
export const ThemedActivityIndicator = withUnistyles(
  ActivityIndicator,
  theme => ({
    color: theme.colors.primary,
  }),
);

/** Spinner colored by `onPrimary` — for use on primary-colored backgrounds. */
export const OnPrimaryActivityIndicator = withUnistyles(
  ActivityIndicator,
  theme => ({
    color: theme.colors.onPrimary,
  }),
);

/** Brand-primary spinner. Equivalent to `ThemedActivityIndicator`, kept under
 * a more semantic name so screens can choose intent over historical naming. */
export const PrimaryActivityIndicator = withUnistyles(
  ActivityIndicator,
  theme => ({
    color: theme.colors.primary,
  }),
);

/** Spinner colored white — for use on dark / colored backgrounds. */
export const WhiteActivityIndicator = withUnistyles(
  ActivityIndicator,
  theme => ({
    color: theme.colors.white,
  }),
);

/**
 * RefreshControl with brand-primary spinner + tint, built on RNGH's control.
 *
 * RNGH's ScrollView hands its scroll gesture to whatever refresh control it is
 * given, as `cloneElement(refreshControl, { block: scrollGesture })`. `block`
 * is in RNGH's `NativeWrapperProps`, so only a control from its
 * `createNativeWrapper` routes it into `useNativeGesture`; RN's own control
 * takes the prop and drops it, leaving the pull outside the arbitration with
 * nothing to warn you. The `withUnistyles` wrapper is transparent to it — the
 * injected gesture crosses by reference
 * (`scripts/probe-withunistyles-prop-passthrough.mjs`).
 */
// The three props are one set, not two plus an optional. `colors` is the
// Android arc, `tintColor` the iOS spinner, and `progressBackgroundColor` the
// DISC the Android arc is drawn on — which defaults to white and stays white
// under a dark theme, so leaving it out put a bright disc over the pantry
// header on every pull.
export const ThemedRefreshControl = withUnistyles(RefreshControl, theme => ({
  colors: [theme.colors.primary],
  tintColor: theme.colors.primary,
  progressBackgroundColor: theme.colors.surface,
}));

/**
 * The same theming on RN's own RefreshControl — for plain RN `ScrollView`
 * hosts. RNGH's control renders a `VirtualDetector` that throws at render
 * unless an RNGH scrollable provides the intercepting-detector context, so
 * pick by host: RNGH scrollable → `ThemedRefreshControl`, RN scrollable →
 * this one.
 */
export const PlainScrollRefreshControl = withUnistyles(
  RNRefreshControl,
  theme => ({
    colors: [theme.colors.primary],
    tintColor: theme.colors.primary,
    progressBackgroundColor: theme.colors.surface,
  }),
);

/** Theme-reactive Icon wrapper. Re-renders on theme change so `tone`/`color`
 * derived values stay in sync. Pass color/size/name as props at the call site. */
export const ThemedIcon = withUnistyles(Icon);

/** Theme-reactive IconButton wrapper. */
export const ThemedIconButton = withUnistyles(IconButton);

/** BackButton tinted with `theme.colors.textPrimary` — the standard back-button
 * color used in detail screens and modal headers. */
export const ThemedBackButton = withUnistyles(BackButton, theme => ({
  color: theme.colors.textPrimary,
}));

/** Theme-reactive SafeAreaView for screen containers. The safe-area-context
 * SafeAreaView is a third-party native component, so the Unistyles babel
 * plugin does not bind it to the ShadowTree — a `styles.container` background
 * passed to it resolves once at render and never receives native theme
 * updates (the screen keeps the old background after a light/dark switch
 * until something re-renders it). The `withUnistyles` wrapper re-renders on
 * theme change, re-resolving the style. Use this for any SafeAreaView whose
 * style reads theme values. */
export const ThemedSafeAreaView = withUnistyles(SafeAreaView);
