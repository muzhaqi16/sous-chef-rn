import {
  ActivityIndicator,
  Platform,
  Pressable as RNPressable,
  RefreshControl as RNRefreshControl,
  TextInput,
  type TextInputInstance,
  type TextInputProps,
} from 'react-native';
// RNGH's, not RN's — see `ThemedRefreshControl` below.
import { RefreshControl } from 'react-native-gesture-handler';
import { useRef } from 'react';
import {
  ANIMATION_STATUS,
  BottomSheetTextInput,
  useBottomSheetInternal,
} from '@gorhom/bottom-sheet';
import { useAnimatedReaction, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useInBottomSheet } from '#hooks/ui/useInBottomSheet';
import { assignRef } from '#components/atoms/inputRef';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { StyleSheet, withUnistyles } from 'react-native-unistyles';

import type { Theme } from '#theme/themes';

import { Icon } from '#components/atoms/Icon';

// Shared withUnistyles wrappers for third-party components taking theme-derived
// props. Module scope, so screens carry no useUnistyles re-render subscription.

// RN's Pressable, which Unistyles binds to the ShadowTree; `withUnistyles` over
// RNGH's replaces a `({pressed}) => [...]` style with `{}`. For gesture
// composition, import RNGH's at the call site. A press target is a button to
// VoiceOver and TalkBack unless the caller names another role.
export const Pressable = ({
  accessibilityRole,
  role,
  ...props
}: React.ComponentProps<typeof RNPressable>) => (
  <RNPressable
    {...props}
    role={role}
    accessibilityRole={
      accessibilityRole ?? (!role && props.onPress ? 'button' : undefined)
    }
  />
);

// A body-text placeholder tone renders an empty field as dark as a filled one.
// `keyboardAppearance` reads `rt.themeName`: an explicit theme preference calls
// `setAdaptiveThemes(false)`, so `rt.colorScheme` is the OS's, not the app's.
const inputProps = (
  theme: Theme,
  themeName?: string,
): Pick<
  TextInputProps,
  | 'placeholderTextColor'
  | 'keyboardAppearance'
  | 'cursorColor'
  | 'maxFontSizeMultiplier'
> => ({
  placeholderTextColor: theme.colors.inputPlaceholder,
  keyboardAppearance: themeName === 'dark' ? 'dark' : 'light',
  cursorColor: theme.colors.primaryText,
  // The same ceiling `Text` takes: a field's text never outgrows its label.
  maxFontSizeMultiplier: theme.maxFontScaleMultiplier,
});

const UniTextInput = withUnistyles(TextInput, (theme, rt) =>
  inputProps(theme, rt.themeName),
);
// gorhom types its ref with RNGH's TextInput, which the strict React Native
// types read as a component, not an instance. What it hands back is RN's
// TextInput, so this is the one place the ref takes that type.
const SheetTextInput = BottomSheetTextInput as React.FC<
  TextInputProps & { ref?: React.Ref<TextInputInstance> }
>;
const UniBottomSheetTextInput = withUnistyles(SheetTextInput, (theme, rt) =>
  inputProps(theme, rt.themeName),
);

// The color is a base STYLE, not a mapping prop: `withUnistyles` replaces its
// mapped `style` with the caller's whenever one is passed, but flattens a style
// ARRAY left to right, so a base first still lets a call site override.
const inputStyles = StyleSheet.create(theme => ({
  base: { color: theme.colors.inputText },
}));

export type ThemedTextInputRef = TextInputInstance;

/** `withUnistyles` flattens once, so `[base, [a, b]]` leaves a, b unresolved. */
const withFieldStyle = (
  style: React.ComponentProps<typeof UniTextInput>['style'],
) => [inputStyles.base, style].flat();

/**
 * gorhom's input. `autoFocus` waits for the sheet to stop moving: a field
 * focused while the sheet slides in is measured below the keyboard, and the
 * keyboard-aware scroll carries it out of view.
 * Verified: #a-field-focused-while-its-sheet-opens-is-scrolled-out-of-view
 */
const SheetFieldInput = ({
  autoFocus = false,
  ref,
  ...rest
}: React.ComponentProps<typeof UniTextInput>) => {
  const { animatedAnimationState, animatedIndex } = useBottomSheetInternal();
  const input = useRef<TextInputInstance | null>(null);
  const focused = useSharedValue(false);
  const focus = () => input.current?.focus();

  useAnimatedReaction(
    () =>
      autoFocus &&
      animatedAnimationState.get().status === ANIMATION_STATUS.STOPPED &&
      animatedIndex.get() >= 0,
    arrived => {
      if (!arrived || focused.get()) return;
      focused.set(true);
      scheduleOnRN(focus);
    },
  );

  return (
    <UniBottomSheetTextInput
      {...rest}
      ref={node => {
        input.current = node;
        assignRef(ref, node);
      }}
    />
  );
};

/**
 * A TextInput carrying the theme's field color, placeholder and keyboard. Inside
 * a bottom sheet it is gorhom's, whose keyboard handling waits for its own
 * input's focus; the sheet is read from gorhom, so no caller says where it is.
 * Verified: #gorhom-keyboard-handling-requires-bottomsheettextinput
 */
export const ThemedTextInput = ({
  style,
  ...rest
}: React.ComponentProps<typeof UniTextInput>) =>
  useInBottomSheet() ? (
    <SheetFieldInput {...rest} style={withFieldStyle(style)} />
  ) : (
    <UniTextInput {...rest} style={withFieldStyle(style)} />
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
    color: theme.colors.primaryText,
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
    color: theme.colors.primaryText,
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

// Android draws the arc on a disc that defaults to white in every theme.
const refreshTheme = (theme: Theme) => ({
  colors: [theme.colors.primary],
  tintColor: theme.colors.primaryText,
  progressBackgroundColor: theme.colors.surface,
  progressViewOffset: REFRESH_SPINNER_OFFSET,
});

// RNGH's ScrollView clones `block` into its refreshControl, and only a
// `createNativeWrapper` control routes it to `useNativeGesture`; RN's drops it.
export const ThemedRefreshControl = withUnistyles(RefreshControl, refreshTheme);

/** The same theming on RN's own control, for plain RN `ScrollView` hosts. RNGH's
 *  throws at render without an RNGH scrollable above it, so pick by host. */
export const PlainScrollRefreshControl = withUnistyles(
  RNRefreshControl,
  refreshTheme,
);

/** Theme-reactive Icon wrapper: re-renders so derived `tone`/`color` stay in sync. */
export const ThemedIcon = withUnistyles(Icon);
