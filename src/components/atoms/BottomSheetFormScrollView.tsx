import React from 'react';
import type { ScrollViewProps } from 'react-native';
import type { KeyboardAwareScrollViewProps } from 'react-native-keyboard-controller';
import { BottomSheetKeyboardAwareScrollView } from './BottomSheetKeyboardAwareScrollView';
import { BottomSheetInputProvider } from '#context/BottomSheetInputContext';

type Props = ScrollViewProps &
  KeyboardAwareScrollViewProps & { children: React.ReactNode };

/**
 * Drop-in replacement for `BottomSheetScrollView` in sheets that contain inputs.
 *
 * - Wraps `BottomSheetKeyboardAwareScrollView` for keyboard-aware scrolling
 *   (which defaults `bottomOffset` to the density-scaled `theme.spacing.md` —
 *   don't restate it here or at call sites).
 * - Provides `BottomSheetInputContext = true` so `FormInput`, `FractionInput`,
 *   and `FormTextArea` automatically use `BottomSheetTextInput`.
 */
export const BottomSheetFormScrollView: React.FC<Props> = ({
  children,
  ...rest
}) => (
  <BottomSheetInputProvider value={true}>
    <BottomSheetKeyboardAwareScrollView {...rest}>
      {children}
    </BottomSheetKeyboardAwareScrollView>
  </BottomSheetInputProvider>
);
