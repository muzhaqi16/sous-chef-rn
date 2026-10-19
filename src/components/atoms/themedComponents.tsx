import {
  ActivityIndicator,
  Modal as RNModal,
  type ModalProps,
  Platform,
  Pressable as RNPressable,
  RefreshControl as RNRefreshControl,
  TextInput,
  type TextInputProps,
} from 'react-native';
// RNGH's, not RN's — see `ThemedRefreshControl` below.
import { RefreshControl } from 'react-native-gesture-handler';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { StyleSheet, withUnistyles } from 'react-native-unistyles';

import type { Theme } from '#/theme/themes';

import { Icon } from '#components/atoms/Icon';
import { CurrentThemeScope } from '#components/atoms/CurrentThemeScope';

// Shared withUnistyles wrappers for third-party components taking theme-derived
// props. Module scope, so screens carry no useUnistyles re-render subscription.

// RN's Pressable, which the babel plugin binds to the ShadowTree; `withUnistyles`
// over RNGH's drops proxy values in a `({pressed}) => [...]` style. For gesture
// composition, import RNGH's at the call site.
export const Pressable = RNPressable;

// Import Modal from here. RN's mounts its children only while visible, so they
// sit in `CurrentThemeScope`.
export const Modal = ({ children, ...props }: ModalProps) => (
  <RNModal {...props}>
    <CurrentThemeScope>{children}</CurrentThemeScope>
  </RNModal>
);

// A body-text placeholder tone renders an empty field as dark as a filled one.
// `keyboardAppearance` reads `rt.themeName`: an explicit theme preference calls
// `setAdaptiveThemes(false)`, so `rt.colorScheme` is the OS's, not the app's.
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

/** Android starts the circle at `offset - diameter`, so at 0 it slides in clipped
 *  by the host's top edge; iOS shifts the control's frame and needs none. */
const REFRESH_SPINNER_OFFSET = Platform.OS === 'android' ? 40 : 0;

// RNGH's ScrollView clones `block` into its refreshControl, and only a
// `createNativeWrapper` control routes it to `useNativeGesture`; RN's drops it.
// Android draws the arc on a disc that defaults to white in every theme.
export const ThemedRefreshControl = withUnistyles(RefreshControl, theme => ({
  colors: [theme.colors.primary],
  tintColor: theme.colors.primary,
  progressBackgroundColor: theme.colors.surface,
  progressViewOffset: REFRESH_SPINNER_OFFSET,
}));

/** The same theming on RN's own control, for plain RN `ScrollView` hosts. RNGH's
 *  throws at render without an RNGH scrollable above it, so pick by host. */
export const PlainScrollRefreshControl = withUnistyles(
  RNRefreshControl,
  theme => ({
    colors: [theme.colors.primary],
    tintColor: theme.colors.primary,
    progressBackgroundColor: theme.colors.surface,
    progressViewOffset: REFRESH_SPINNER_OFFSET,
  }),
);

/** Theme-reactive Icon wrapper: re-renders so derived `tone`/`color` stay in sync. */
export const ThemedIcon = withUnistyles(Icon);
