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
 * - Wraps `BottomSheetKeyboardAwareScrollView` for keyboard-aware scrolling.
 * - Provides `BottomSheetInputContext = true` so `FormInput`, `FractionInput`,
 *   and `FormTextArea` automatically use `BottomSheetTextInput`.
 */
export const BottomSheetFormScrollView: React.FC<Props> = ({
  children,
  bottomOffset = 16,
  ...rest
}) => (
  <BottomSheetInputProvider value={true}>
    <BottomSheetKeyboardAwareScrollView bottomOffset={bottomOffset} {...rest}>
      {children}
    </BottomSheetKeyboardAwareScrollView>
  </BottomSheetInputProvider>
);
