import React from 'react';
import type { ScrollViewProps } from 'react-native';
import type { KeyboardAwareScrollViewProps } from 'react-native-keyboard-controller';
import { BottomSheetKeyboardAwareScrollView } from '#components/atoms/BottomSheetKeyboardAwareScrollView';

type Props = ScrollViewProps &
  KeyboardAwareScrollViewProps & { children: React.ReactNode };

/**
 * `BottomSheetScrollView` replacement for sheets containing inputs: scrolls the
 * focused input above the keyboard. The inputs find the sheet themselves.
 */
export const BottomSheetFormScrollView: React.FC<Props> = ({
  children,
  ...rest
}) => (
  <BottomSheetKeyboardAwareScrollView {...rest}>
    {children}
  </BottomSheetKeyboardAwareScrollView>
);
