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

// `bottomOffset` defaults to the theme's `spacing.md` — 16 at normal density,
// scaled with the user's density preference. The library's own default is 0,
// which lands a focused input flush against the keyboard. withUnistyles merges
// mapping props before call-site props, so an explicitly passed `bottomOffset`
// still wins — but only pass the prop when you mean it: an explicit
// `undefined` also overrides the mapping (the merge iterates keys, not
// defined values).
export const BottomSheetKeyboardAwareScrollView = withUnistyles(
  BottomSheetKeyboardAwareScrollViewBase,
  theme => ({
    bottomOffset: theme.spacing.md,
  }),
);
