import type { FC, PropsWithChildren } from 'react';
import type { ScrollViewProps } from 'react-native';
import type { KeyboardAwareScrollViewProps } from 'react-native-keyboard-controller';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import {
  SCROLLABLE_TYPE,
  createBottomSheetScrollableComponent,
} from '@gorhom/bottom-sheet';
import Reanimated from 'react-native-reanimated';
import { withUnistyles } from 'react-native-unistyles';

const AnimatedScrollView = Reanimated.createAnimatedComponent(
  KeyboardAwareScrollView,
);

const BottomSheetKeyboardAwareScrollViewBase =
  createBottomSheetScrollableComponent(
    SCROLLABLE_TYPE.SCROLLVIEW,
    AnimatedScrollView,
  ) as FC<PropsWithChildren<ScrollViewProps & KeyboardAwareScrollViewProps>>;

// `bottomOffset` defaults to `theme.spacing.md`; the library's own default of 0
// lands a focused input flush against the keyboard. A call-site value wins — but
// so does an explicit `undefined`, since the merge iterates keys, not values.
export const BottomSheetKeyboardAwareScrollView = withUnistyles(
  BottomSheetKeyboardAwareScrollViewBase,
  theme => ({
    bottomOffset: theme.spacing.md,
  }),
);
