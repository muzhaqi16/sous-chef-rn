import React from 'react';
import type { ScrollViewProps, StyleProp, ViewStyle } from 'react-native';
import { View } from 'react-native';
import {
  BottomSheetScrollView,
  BottomSheetView,
  type BottomSheetModalProps,
} from '@gorhom/bottom-sheet';
import { StyleSheet } from 'react-native-unistyles';
import { Title } from '#components/atoms/Title';
import { BarActions, type BarAction } from '#components/molecules/BarActions';
import {
  BottomSheetModal,
  useStandardBottomSheet,
  type UseStandardBottomSheetOptions,
} from '#hooks/ui/useStandardBottomSheet';
import { BottomSheetFormScrollView } from '#components/atoms/BottomSheetFormScrollView';
import {
  SheetHeaderOutlet,
  SheetHeaderStoreProvider,
  useSheetHeaderStore,
} from './SheetHeaderSlot';
import { SheetCloseGuardProvider, useSheetCloseGuard } from './SheetCloseGuard';

export type SheetMode = 'view' | 'form' | 'action' | 'list';

/**
 * gorhom options a sheet sets beyond the standard ones: `push` to stack over a
 * host sheet, an Android keyboard that resizes. A key left out keeps the
 * standard value. Input its content holds is guarded by `useSheetUnsavedInput`.
 */
export type SheetModalOptions = Pick<
  BottomSheetModalProps,
  | 'stackBehavior'
  | 'android_keyboardInputMode'
  | 'keyboardBlurBehavior'
  | 'enableContentPanningGesture'
>;

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
  /**
   * The sheet's bar, `SheetHeader`, held above the content: a field scrolled
   * into view above the keyboard never carries it off. It sits outside
   * `contentContainerStyle`, so it takes no `contentPadding`.
   */
  header?: React.ReactNode;
  /**
   * The content renders its own bar through `SheetHeaderSlot`, held in the
   * same place as `header`: for a form whose state owns the bar's handlers.
   */
  headerFromContent?: boolean;
  /** The row above the content. Omit when the content names itself. */
  title?: string;
  /** Actions beside the title, icon or text. */
  actions?: BarAction[];
  modalOptions?: SheetModalOptions;
  /**
   * Who clears the home indicator in `list`: the container (default), or the
   * content, when each of its steps pads its own scroll content.
   */
  bottomInset?: 'container' | 'content';
  /**
   * The page gutter on the content, as `Screen`'s: `view` and `form` take it
   * unless they say `none`, and `action` always has it. A host pads only its
   * content's top and bottom.
   */
  gutter?: 'page' | 'none';
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
  header: headerProp,
  headerFromContent = false,
  title,
  actions,
  modalOptions,
  bottomInset = 'container',
  gutter = 'page',
  ...sheetOptions
}) => {
  const closeGuard = useSheetCloseGuard();
  const {
    ref,
    modalProps,
    contentContainerStyle: insetStyle,
  } = useStandardBottomSheet({ ...sheetOptions, discardGuard: closeGuard });
  const headerStore = useSheetHeaderStore();
  const header = headerFromContent ? (
    <SheetHeaderOutlet store={headerStore} />
  ) : (
    headerProp
  );

  const gutterStyle = gutter === 'page' ? styles.pageGutter : undefined;
  // The title sits on the gutter wherever the content has none of its own: a
  // list's rows inset themselves, and the bar above them would sit flush.
  const titleGutter =
    mode === 'list' || !gutterStyle ? styles.pageGutter : undefined;

  const body = (
    <>
      {title || actions?.length ? (
        <View style={[styles.titleRow, titleGutter]}>
          {!!title && <Title style={styles.title}>{title}</Title>}
          <BarActions actions={actions} placement="gutter" />
        </View>
      ) : null}
      {children}
    </>
  );

  const containerStyle = [gutterStyle, contentContainerStyle, insetStyle];

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

  // A scrollable sits in a `flex: 1` view under the header, which gorhom does
  // not count for a content-sized sheet; those are `view`, where it is counted.
  const underHeader = (scroll: React.ReactNode) =>
    header ? (
      <View style={styles.fill}>
        {header}
        {scroll}
      </View>
    ) : (
      scroll
    );

  const content = (() => {
    switch (mode) {
      case 'list':
        // A plain flex parent: `BottomSheetView` is absolutely positioned with
        // no height, so a scrollable inside it never scrolls. The inset keeps
        // the last row clear of the home indicator.
        return (
          <View
            style={[styles.fill, bottomInset === 'container' && insetStyle]}
          >
            {header}
            {body}
          </View>
        );
      case 'view':
        return header ? (
          <BottomSheetView style={insetStyle}>
            {header}
            <View style={[gutterStyle, contentContainerStyle]}>{body}</View>
          </BottomSheetView>
        ) : (
          <BottomSheetView style={containerStyle}>{body}</BottomSheetView>
        );
      case 'action':
        return underHeader(
          <BottomSheetScrollView
            {...scrollProps}
            contentContainerStyle={[styles.pageGutter, containerStyle]}
          >
            {body}
          </BottomSheetScrollView>,
        );
      case 'form':
        return underHeader(
          <BottomSheetFormScrollView
            {...scrollProps}
            contentContainerStyle={containerStyle}
            // Forwarded only when set: spreading `bottomOffset: undefined`
            // would override the scroll view's theme-mapped default.
            {...(bottomOffset !== undefined ? { bottomOffset } : {})}
          >
            {body}
          </BottomSheetFormScrollView>,
        );
    }
  })();

  return (
    <BottomSheetModal ref={ref} {...modalProps} {...modalOptions}>
      <SheetCloseGuardProvider value={closeGuard}>
        {headerFromContent ? (
          <SheetHeaderStoreProvider value={headerStore}>
            {content}
          </SheetHeaderStoreProvider>
        ) : (
          content
        )}
      </SheetCloseGuardProvider>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create(theme => ({
  fill: { flex: 1 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  title: {
    flex: 1,
  },
  pageGutter: {
    paddingHorizontal: theme.layout.pageGutter,
  },
}));
