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

// Shared withUnistyles wrappers for third-party components taking theme-derived
// props. Module scope, so screens carry no useUnistyles re-render subscription.

// Import Pressable from here. It is RN's, auto-bound to the Unistyles ShadowTree
// by the babel plugin; `withUnistyles` over RNGH's drops StyleSheet.create proxy
// values inside `({pressed}) => [...]` callbacks (unistyles#1109). For gesture
// composition, import RNGH's Pressable at the call site.
export const Pressable = RNPressable;

// `inputPlaceholder` is the palette's placeholder tone (~3.6:1); a body-text tone
// here renders an empty field as dark as a filled one.

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

/** Keyboard-aware scroller for full-screen forms; `bottomOffset` defaults to
 *  `theme.spacing.md` (the library's 0 lands an input flush against the
 *  keyboard). Sheets use `BottomSheetFormScrollView`, same default. */
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

/** Brand-primary spinner; an alias of `ThemedActivityIndicator`. */
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

// RNGH's ScrollView injects its scroll gesture as
// `cloneElement(refreshControl, { block })`, and only a `createNativeWrapper`
// control routes `block` into `useNativeGesture` — RN's own drops it silently.
// The three color props are one set: Android arc, iOS spinner, and the disc the
// arc is drawn on, which defaults to white in every theme.
export const ThemedRefreshControl = withUnistyles(RefreshControl, theme => ({
  colors: [theme.colors.primary],
  tintColor: theme.colors.primary,
  progressBackgroundColor: theme.colors.surface,
}));

/** The same theming on RN's own control, for plain RN `ScrollView` hosts. RNGH's
 *  throws at render without an RNGH scrollable above it, so pick by host. */
export const PlainScrollRefreshControl = withUnistyles(
  RNRefreshControl,
  theme => ({
    colors: [theme.colors.primary],
    tintColor: theme.colors.primary,
    progressBackgroundColor: theme.colors.surface,
  }),
);

/** Theme-reactive Icon wrapper: re-renders so derived `tone`/`color` stay in sync. */
export const ThemedIcon = withUnistyles(Icon);

/** Theme-reactive IconButton wrapper. */
export const ThemedIconButton = withUnistyles(IconButton);

/** BackButton tinted with `theme.colors.textPrimary`. */
export const ThemedBackButton = withUnistyles(BackButton, theme => ({
  color: theme.colors.textPrimary,
}));

/** Theme-reactive SafeAreaView. safe-area-context's is third-party, so the babel
 * plugin does not bind it to the ShadowTree and a theme-derived background
 * passed to it resolves once and never updates. Use for any SafeAreaView whose
 * style reads theme values. */
export const ThemedSafeAreaView = withUnistyles(SafeAreaView);
