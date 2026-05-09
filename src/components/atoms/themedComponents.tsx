import { ActivityIndicator, TextInput } from 'react-native';
import { Pressable as GHPressable } from 'react-native-gesture-handler';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { withUnistyles } from 'react-native-unistyles';

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
