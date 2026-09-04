import {
  ActivityIndicator,
  Pressable as RNPressable,
  RefreshControl as RNRefreshControl,
  TextInput,
  type TextInputProps,
} from 'react-native';
// RNGH's, not RN's — see `ThemedRefreshControl` below.
import { RefreshControl } from 'react-native-gesture-handler';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import DateTimePicker, {
  type IOSNativeProps,
} from '@react-native-community/datetimepicker';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, withUnistyles } from 'react-native-unistyles';

import type { Theme } from '#/theme/themes';

import { Icon } from '#utils/iconUtils';

// Shared withUnistyles wrappers for third-party components taking theme-derived
// props. Module scope, so screens carry no useUnistyles re-render subscription.

// Import Pressable from here. It is RN's, auto-bound to the Unistyles ShadowTree
// by the babel plugin; `withUnistyles` over RNGH's drops StyleSheet.create proxy
// values inside `({pressed}) => [...]` callbacks (unistyles#1109). For gesture
// composition, import RNGH's Pressable at the call site.
export const Pressable = RNPressable;

// `inputPlaceholder` is the palette's placeholder tone (~3.6:1); a body-text tone
// here renders an empty field as dark as a filled one. `keyboardAppearance` reads
// `rt.themeName`, not `rt.colorScheme`: an explicit theme preference calls
// `setAdaptiveThemes(false)`, so the OS scheme is the wrong answer.
const inputProps = (
  theme: Theme,
  themeName?: string,
): Pick<
  TextInputProps,
  'placeholderTextColor' | 'keyboardAppearance' | 'cursorColor'
> => ({
  placeholderTextColor: theme.colors.inputPlaceholder,
  keyboardAppearance: themeName === 'dark' ? 'dark' : 'light',
  cursorColor: theme.colors.primary,
});

const UniTextInput = withUnistyles(TextInput, (theme, rt) =>
  inputProps(theme, rt.themeName),
);
const UniBottomSheetTextInput = withUnistyles(
  BottomSheetTextInput,
  (theme, rt) => inputProps(theme, rt.themeName),
);

// The color is a base STYLE, not a mapping prop: `withUnistyles` replaces its
// mapped `style` with the caller's whenever one is passed, but flattens a style
// ARRAY left to right, so a base first still lets a call site override.
const inputStyles = StyleSheet.create(theme => ({
  base: { color: theme.colors.inputText },
}));

export type ThemedTextInputRef = React.ComponentRef<typeof TextInput>;
export type ThemedBottomSheetTextInputRef = React.ComponentRef<
  typeof BottomSheetTextInput
>;

/** `withUnistyles` flattens once, so `[base, [a, b]]` leaves a, b unresolved. */
const withFieldStyle = (
  style: React.ComponentProps<typeof UniTextInput>['style'],
) =>
  Array.isArray(style)
    ? [inputStyles.base, ...style]
    : [inputStyles.base, style];

/** RN TextInput carrying the theme's field color, placeholder and keyboard. */
export const ThemedTextInput = ({
  style,
  ...rest
}: React.ComponentProps<typeof UniTextInput>) => (
  <UniTextInput {...rest} style={withFieldStyle(style)} />
);

/** The same, for a TextInput inside a BottomSheet. */
export const ThemedBottomSheetTextInput = ({
  style,
  ...rest
}: React.ComponentProps<typeof UniBottomSheetTextInput>) => (
  <UniBottomSheetTextInput {...rest} style={withFieldStyle(style)} />
);

/**
 * iOS renders the date picker in the OS appearance, which diverges from the app
 * theme whenever a preference is set (`setAdaptiveThemes(false)`). Android's is
 * an Activity-themed dialog and takes neither prop.
 */
const pickerProps = (
  theme: Theme,
  themeName?: string,
): Pick<IOSNativeProps, 'themeVariant' | 'accentColor'> => ({
  themeVariant: themeName === 'dark' ? 'dark' : 'light',
  accentColor: theme.colors.primary,
});

// The component's props are a platform union, and these two live only on the
// iOS member, so the wrapper is typed to it.
const IOSDateTimePicker = DateTimePicker as React.ComponentType<IOSNativeProps>;

export const ThemedDateTimePicker = withUnistyles(
  IOSDateTimePicker,
  (theme, rt) => pickerProps(theme, rt.themeName),
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

/** Spinner colored by `onError` — for use on error/danger-colored fills. */
export const OnErrorActivityIndicator = withUnistyles(
  ActivityIndicator,
  theme => ({
    color: theme.colors.onError,
  }),
);

/** Brand-primary spinner; an alias of `ThemedActivityIndicator`. */
export const PrimaryActivityIndicator = withUnistyles(
  ActivityIndicator,
  theme => ({
    color: theme.colors.primary,
  }),
);

/** Spinner colored by `textSecondary` — for a spinner beside secondary copy. */
export const MutedActivityIndicator = withUnistyles(
  ActivityIndicator,
  theme => ({
    color: theme.colors.textSecondary,
  }),
);

/** Spinner colored by `error` — for a failure state's own spinner. */
export const ErrorActivityIndicator = withUnistyles(
  ActivityIndicator,
  theme => ({
    color: theme.colors.error,
  }),
);

/** Spinner colored by `success` — for a confirmation in progress. */
export const SuccessActivityIndicator = withUnistyles(
  ActivityIndicator,
  theme => ({
    color: theme.colors.success,
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

/** Theme-reactive SafeAreaView. safe-area-context's is third-party, so the babel
 * plugin does not bind it to the ShadowTree and a theme-derived background
 * passed to it resolves once and never updates. Use for any SafeAreaView whose
 * style reads theme values. */
export const ThemedSafeAreaView = withUnistyles(SafeAreaView);
