import { ActivityIndicator, RefreshControl, TextInput } from 'react-native';
import { Pressable as GHPressable } from 'react-native-gesture-handler';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { withUnistyles } from 'react-native-unistyles';

import { BackButton } from './BackButton';
import { IconButton } from './IconButton';
import { Icon } from '#utils/iconUtils';

// Shared withUnistyles wrappers for third-party components that take theme-
// derived props. Defining them at module scope (not inline in screens) keeps
// the per-screen code free of useUnistyles re-render subscriptions.

// RNGH's Pressable bypasses the standard RN style pipeline, so Unistyles' C++
// proxy bindings don't repaint it on theme change (unistyles#1109). Wrapping
// with `withUnistyles` re-runs style processing on every theme tick so the
// pressable's child View receives the fresh proxy values. Project convention:
// always import `Pressable` from this module (not directly from RNGH).
export const Pressable = withUnistyles(GHPressable);

/** Plain RN TextInput with a theme-reactive placeholder color. */
export const ThemedTextInput = withUnistyles(TextInput, theme => ({
  placeholderTextColor: theme.colors.textSecondary,
}));

/** TextInput inside a BottomSheet that needs a theme-reactive placeholder. */
export const ThemedBottomSheetTextInput = withUnistyles(
  BottomSheetTextInput,
  theme => ({
    placeholderTextColor: theme.colors.textSecondary,
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

/** RefreshControl with brand-primary spinner + tint. */
export const ThemedRefreshControl = withUnistyles(RefreshControl, theme => ({
  colors: [theme.colors.primary],
  tintColor: theme.colors.primary,
}));

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
