import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { View } from 'react-native';
import { BottomSheetScrollView, BottomSheetView } from '@gorhom/bottom-sheet';
import { StyleSheet } from 'react-native-unistyles';
import { Title } from '#components/atoms/Title';
import {
  BottomSheetModal,
  useStandardBottomSheet,
  type UseStandardBottomSheetOptions,
} from '#hooks/useStandardBottomSheet';
import { BottomSheetFormScrollView } from '#components/atoms/BottomSheetFormScrollView';

export type SheetMode = 'view' | 'form' | 'action';

export interface SheetProps extends UseStandardBottomSheetOptions {
  children: React.ReactNode;
  /**
   * `'view'` (default) is a static `BottomSheetView`; `'form'` is a
   * keyboard-aware scroll view plus the bottom-sheet input context; `'action'`
   * is a scrolling list of choices with an optional title row. A bespoke layout
   * calls {@link useStandardBottomSheet} directly instead.
   */
  mode?: SheetMode;
  /** Style for the content container; the standard bottom inset is appended automatically. */
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Outer style for the scroll container (`form` mode only). */
  style?: StyleProp<ViewStyle>;
  /** `form` mode only. Default `false`. */
  showsVerticalScrollIndicator?: boolean;
  /** `form` mode only — keyboard bottom offset override. Defaults to the
   *  density-scaled `theme.spacing.md` inside the scroll view. */
  bottomOffset?: number;
  /** `action` mode: the row above the choices. Omit when they name themselves. */
  title?: string;
  /** `action` mode: content beside the title. */
  headerRight?: React.ReactNode;
}

/**
 * Structural wrapper for the common `visible`-boolean bottom sheet: runs
 * {@link useStandardBottomSheet} and places `children` in the container for `mode`.
 */
export const Sheet: React.FC<SheetProps> = ({
  children,
  mode = 'view',
  contentContainerStyle,
  style,
  showsVerticalScrollIndicator = false,
  bottomOffset,
  title,
  headerRight,
  ...sheetOptions
}) => {
  const {
    ref,
    modalProps,
    contentContainerStyle: insetStyle,
  } = useStandardBottomSheet(sheetOptions);

  const titleRow =
    title || headerRight ? (
      <View style={styles.titleRow}>
        {!!title && <Title style={styles.title}>{title}</Title>}
        {headerRight}
      </View>
    ) : null;

  const content =
    mode === 'action' ? (
      <BottomSheetScrollView
        contentContainerStyle={[
          styles.actionContent,
          contentContainerStyle,
          insetStyle,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {titleRow}
        {children}
      </BottomSheetScrollView>
    ) : mode === 'view' ? (
      <BottomSheetView style={[contentContainerStyle, insetStyle]}>
        {titleRow}
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
        {titleRow}
        {children}
      </BottomSheetFormScrollView>
    );

  return (
    <BottomSheetModal ref={ref} {...modalProps}>
      {content}
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create(theme => ({
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  title: {
    flex: 1,
  },
  actionContent: {
    paddingHorizontal: theme.layout.pageGutter,
  },
}));
