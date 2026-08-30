import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import {
  BottomSheetModal,
  useStandardBottomSheet,
  type UseStandardBottomSheetOptions,
} from '#hooks/useStandardBottomSheet';
import { BottomSheetFormScrollView } from './BottomSheetFormScrollView';

export type BottomSheetContentMode = 'view' | 'form';

export interface BottomSheetLayoutProps extends UseStandardBottomSheetOptions {
  children: React.ReactNode;
  /**
   * `'view'` (default) is a static `BottomSheetView`; `'form'` is a
   * keyboard-aware scroll view plus the bottom-sheet input context. A bespoke
   * layout calls {@link useStandardBottomSheet} directly instead.
   */
  mode?: BottomSheetContentMode;
  /** Style for the content container; the standard bottom inset is appended automatically. */
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Outer style for the scroll container (`form` mode only). */
  style?: StyleProp<ViewStyle>;
  /** `form` mode only. Default `false`. */
  showsVerticalScrollIndicator?: boolean;
  /** `form` mode only — keyboard bottom offset override. Defaults to the
   *  density-scaled `theme.spacing.md` inside the scroll view. */
  bottomOffset?: number;
}

/**
 * Structural wrapper for the common `visible`-boolean bottom sheet: runs
 * {@link useStandardBottomSheet} and places `children` in the container for `mode`.
 */
export const BottomSheetLayout: React.FC<BottomSheetLayoutProps> = ({
  children,
  mode = 'view',
  contentContainerStyle,
  style,
  showsVerticalScrollIndicator = false,
  bottomOffset,
  ...sheetOptions
}) => {
  const {
    ref,
    modalProps,
    contentContainerStyle: insetStyle,
  } = useStandardBottomSheet(sheetOptions);

  const content =
    mode === 'view' ? (
      <BottomSheetView style={[contentContainerStyle, insetStyle]}>
        {children}
      </BottomSheetView>
    ) : (
      <BottomSheetFormScrollView
        style={style}
        contentContainerStyle={[contentContainerStyle, insetStyle]}
        showsVerticalScrollIndicator={showsVerticalScrollIndicator}
        // Forwarded only when set: spreading `bottomOffset: undefined` would
        // override the scroll view's theme-mapped default with undefined.
        {...(bottomOffset !== undefined ? { bottomOffset } : {})}
      >
        {children}
      </BottomSheetFormScrollView>
    );

  return (
    <BottomSheetModal ref={ref} {...modalProps}>
      {content}
    </BottomSheetModal>
  );
};
