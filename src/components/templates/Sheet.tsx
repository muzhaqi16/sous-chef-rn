import React from 'react';
import type { ScrollViewProps, StyleProp, ViewStyle } from 'react-native';
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

export type SheetMode = 'view' | 'form' | 'action' | 'list';

export interface SheetProps extends UseStandardBottomSheetOptions {
  children: React.ReactNode;
  /**
   * `view` a static `BottomSheetView`; `form` a keyboard-aware scroll view plus
   * the input context; `action` a scrolling list of choices; `list` the child
   * unwrapped, for content that scrolls itself and so needs the modal's height.
   * A bespoke layout calls {@link useStandardBottomSheet} directly.
   */
  mode?: SheetMode;
  /**
   * Style for the content container; the standard bottom inset is appended
   * automatically. Ignored by `list`, whose child owns its own container.
   */
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Outer style for the scroll container. Read by the scrolling modes. */
  style?: StyleProp<ViewStyle>;
  /** Read by the scrolling modes. Default `false`. */
  showsVerticalScrollIndicator?: boolean;
  /** Keyboard bottom offset override for `form`. Defaults to the
   *  density-scaled `theme.spacing.md` inside the scroll view. */
  bottomOffset?: number;
  /** The row above the content. Omit when the content names itself. */
  title?: string;
  /** Content beside the title. */
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

  const body = (
    <>
      {title || headerRight ? (
        <View style={styles.titleRow}>
          {!!title && <Title style={styles.title}>{title}</Title>}
          {headerRight}
        </View>
      ) : null}
      {children}
    </>
  );

  const containerStyle = [contentContainerStyle, insetStyle];

  // `keyboardShouldPersistTaps` is stated, not inherited: neither gorhom nor
  // the keyboard-aware view supplies one, and RN's default spends the first
  // tap on dismissing the keyboard rather than on the control it landed on.
  const scrollProps: Pick<
    ScrollViewProps,
    'style' | 'keyboardShouldPersistTaps' | 'showsVerticalScrollIndicator'
  > = {
    style,
    keyboardShouldPersistTaps: 'handled',
    showsVerticalScrollIndicator,
  };

  const content = (() => {
    switch (mode) {
      case 'list':
        // The modal bounds the child itself. `BottomSheetView` is absolutely
        // positioned with no height, so a scrollable inside it never scrolls.
        return body;
      case 'view':
        return <BottomSheetView style={containerStyle}>{body}</BottomSheetView>;
      case 'action':
        return (
          <BottomSheetScrollView
            {...scrollProps}
            contentContainerStyle={[styles.actionContent, containerStyle]}
          >
            {body}
          </BottomSheetScrollView>
        );
      case 'form':
        return (
          <BottomSheetFormScrollView
            {...scrollProps}
            contentContainerStyle={containerStyle}
            // Forwarded only when set: spreading `bottomOffset: undefined`
            // would override the scroll view's theme-mapped default.
            {...(bottomOffset !== undefined ? { bottomOffset } : {})}
          >
            {body}
          </BottomSheetFormScrollView>
        );
    }
  })();

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
