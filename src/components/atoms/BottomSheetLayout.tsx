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
   * Content container variant:
   * - `'view'` (default): static `BottomSheetView`.
   * - `'form'`: keyboard-aware scroll view + `BottomSheetInput` context so
   *   `FormInput` / `FractionInput` / `FormTextArea` use the bottom-sheet input.
   *
   * Sheets that need a bespoke layout (header outside the scroll view, a raw
   * `BottomSheetScrollView`, multiple direct children of the modal, etc.) should
   * keep calling {@link useStandardBottomSheet} directly.
   */
  mode?: BottomSheetContentMode;
  /** Style for the content container; the standard bottom inset is appended automatically. */
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Outer style for the scroll container (`form` mode only). */
  style?: StyleProp<ViewStyle>;
  /** `form` mode only. Default `false`. */
  showsVerticalScrollIndicator?: boolean;
  /** `form` mode only — keyboard bottom offset. Default `16`. */
  bottomOffset?: number;
}

/**
 * Standard structural wrapper for a bottom sheet: calls
 * {@link useStandardBottomSheet}, renders the themed `BottomSheetModal`, and
 * places `children` inside the right content container for the chosen `mode`.
 *
 * Use this for the common "controlled by a `visible` boolean" sheet.
 *
 * ```tsx
 * <BottomSheetLayout
 *   visible={visible}
 *   onDismiss={onClose}
 *   snapPoints={['55%']}
 *   mode="form"
 *   style={styles.scrollView}
 *   contentContainerStyle={styles.content}
 * >
 *   <BottomSheetHeader title="…" onCancel={onClose} onConfirm={handleConfirm} />
 *   …
 * </BottomSheetLayout>
 * ```
 */
export const BottomSheetLayout: React.FC<BottomSheetLayoutProps> = ({
  children,
  mode = 'view',
  contentContainerStyle,
  style,
  showsVerticalScrollIndicator = false,
  bottomOffset = 16,
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
        bottomOffset={bottomOffset}
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
