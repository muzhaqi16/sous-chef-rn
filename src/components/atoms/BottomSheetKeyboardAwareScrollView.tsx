import type { FC, PropsWithChildren } from 'react';
import type { ScrollViewProps } from 'react-native';
import type { KeyboardAwareScrollViewProps } from 'react-native-keyboard-controller';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import {
  SCROLLABLE_TYPE,
  createBottomSheetScrollableComponent,
} from '@gorhom/bottom-sheet';
import Reanimated from 'react-native-reanimated';

const AnimatedScrollView =
  Reanimated.createAnimatedComponent(KeyboardAwareScrollView);

export const BottomSheetKeyboardAwareScrollView =
  createBottomSheetScrollableComponent(
    SCROLLABLE_TYPE.SCROLLVIEW,
    AnimatedScrollView,
  ) as FC<PropsWithChildren<ScrollViewProps & KeyboardAwareScrollViewProps>>;
