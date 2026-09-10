import React from 'react';
import type { ScrollViewProps } from 'react-native';
import type { KeyboardAwareScrollViewProps } from 'react-native-keyboard-controller';
import { BottomSheetKeyboardAwareScrollView } from '#components/atoms/BottomSheetKeyboardAwareScrollView';
import { BottomSheetInputProvider } from '#context/BottomSheetInputContext';

type Props = ScrollViewProps &
  KeyboardAwareScrollViewProps & { children: React.ReactNode };

/**
 * `BottomSheetScrollView` replacement for sheets containing inputs: adds
 * keyboard-aware scrolling and the context that makes `FormInput` /
 * `FractionInput` / `FormTextArea` resolve to `BottomSheetTextInput`.
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
