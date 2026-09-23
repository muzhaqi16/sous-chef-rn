import React from 'react';
import {
  View,
  ScrollView,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { type ScrollHandlerProcessed } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import {
  PlainScrollRefreshControl,
  ThemedKeyboardAwareScrollView,
} from '#components/atoms/themedComponents';
import { Header } from '#components/organisms/Header';
import { TabScreenHeader } from '#components/molecules/TabScreenHeader';
import { DataStateView } from '#components/organisms/DataStateView';
import type { EmptyStateProps } from '#components/molecules/EmptyState';
import type { HeaderAction } from '#components/molecules/HeaderActionIcon';
import type { DataState } from '#hooks/data/useDataState';
import {
  KEYBOARD_DISMISS_MODE,
  KEYBOARD_PERSIST_TAPS,
} from '#components/templates/keyboardTaps';

const NO_AUTOMATIC_INSET: ScrollViewProps['contentInsetAdjustmentBehavior'] =
  'never';

export interface ScreenHeaderConfig {
  /**
   * `standard` is the titled bar with a back control; `tab` is a root tab's
   * bar; `none` is a screen with no chrome. A hero screen is
   * `CollapsingHeroDetail`, not a variant.
   */
  variant?: 'standard' | 'tab' | 'none';
  title?: string;
  /** `tab` only: the small label above the title. */
  label?: string;
  /** `tab` only: content in the action group, and the title's own affordances. */
  headerRight?: React.ReactNode;
  onTitlePress?: () => void;
  titleAccessory?: React.ReactNode;
  /** `tab` only: suppress the built-in offline pill when the screen sites it. */
  offlinePill?: boolean;
  actions?: HeaderAction[];
  /** Right-side content that is not an icon — a Save affordance, a text button. */
  rightElement?: React.ReactNode;
  /** A handler shows the back control; omit it for a root screen. */
  back?: () => void;
  /** A handler shows a close control instead of back — for a presented screen. */
  close?: () => void;
}

export interface ScreenRefresh {
  refreshing: boolean;
  onRefresh: () => void;
}

interface ScreenBaseProps {
  children: React.ReactNode;
  header?: ScreenHeaderConfig;
  /** Horizontal page inset. `none` is for a screen that bleeds to the edges. */
  gutter?: 'page' | 'none';
  /**
   * Loading, error, offline and empty all come from here, so a screen cannot
   * implement three of the four and leave a failed fetch reading "nothing yet".
   */
  state?: { value: DataState; onRetry: () => void; empty?: EmptyStateProps };
  /** Fixed below the scroll host; it takes the bottom inset instead of the content. */
  footer?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * `scroll`: `none` fixed, `scroll` a plain scroll view, `form` keyboard-aware,
 * `list` means THE CHILD IS THE SCROLLABLE — so `list` takes `refresh?: never`:
 * only a `createNativeWrapper` control takes RNGH's gesture, so it has to reach
 * the list, and a dropped `refresh` is otherwise silent.
 */
export type ScreenProps = ScreenBaseProps &
  (
    | {
        scroll?: 'scroll';
        refresh?: ScreenRefresh;
        /** Drives scroll-linked chrome; the host becomes an Animated.ScrollView. */
        onScroll?: ScrollHandlerProcessed<Record<string, unknown>>;
        scrollTestID?: string;
      }
    | { scroll: 'none' | 'form'; refresh?: ScreenRefresh }
    | { scroll: 'list'; refresh?: never }
  );

/**
 * The one screen scaffold. It NEVER applies the top inset — the navigator's
 * `screenLayout` already does, and applying it twice is what pushed six profile
 * screens down by a status bar. The bottom inset is applied to every mode as
 * padding, so the `scroll` host turns off iOS's automatic inset, which would
 * reserve it a second time.
 */
export const Screen: React.FC<ScreenProps> = props => {
  const {
    children,
    header,
    scroll = 'scroll',
    gutter = 'page',
    refresh,
    state,
    footer,
    style,
    testID,
  } = props;
  const onScroll =
    props.scroll === undefined || props.scroll === 'scroll'
      ? props.onScroll
      : undefined;
  const scrollTestID =
    props.scroll === undefined || props.scroll === 'scroll'
      ? props.scrollTestID
      : undefined;
  const insets = useSafeAreaInsets();
  // With a footer the footer clears the home indicator, so the content only
  // needs its own trailing space.
  const contentBottom = footer ? 0 : insets.bottom;
  const variant = header?.variant ?? (header ? 'standard' : 'none');
  styles.useVariants({ gutter, chrome: variant === 'tab' ? 'tab' : 'other' });

  const chrome =
    variant === 'standard' ? (
      <Header
        title={header?.title ?? ''}
        onBack={header?.back}
        onClose={header?.close}
        rightActions={header?.actions}
        rightElement={header?.rightElement}
        centerTitle
      />
    ) : variant === 'tab' ? (
      <TabScreenHeader
        label={header?.label ?? ''}
        title={header?.title ?? ''}
        headerRight={header?.headerRight}
        onTitlePress={header?.onTitlePress}
        titleAccessory={header?.titleAccessory}
        offlinePill={header?.offlinePill}
      />
    ) : null;

  const stateView = state ? (
    <DataStateView
      state={state.value}
      onRetry={state.onRetry}
      empty={state.empty}
    />
  ) : null;
  const showsState = Boolean(state && state.value !== 'ready');

  const body = showsState ? stateView : children;

  const plainRefresh = refresh ? (
    <PlainScrollRefreshControl
      refreshing={refresh.refreshing}
      onRefresh={refresh.onRefresh}
    />
  ) : undefined;

  const content = (() => {
    if (scroll === 'list') {
      // The list is the child; it takes the RNGH control because an RNGH
      // scrollable only routes its scroll gesture into a control from
      // `createNativeWrapper`.
      return <View style={styles.body}>{body}</View>;
    }
    if (scroll === 'form') {
      return (
        <ThemedKeyboardAwareScrollView
          contentContainerStyle={[
            styles.scrollContent,
            styles.contentBottom(contentBottom),
          ]}
          showsVerticalScrollIndicator={false}
          // Stated, not inherited: KeyboardAwareScrollView supplies no default
          // and RN's is `never`, which spends the first tap on dismissing the
          // keyboard instead of on the control the person aimed at.
          keyboardShouldPersistTaps={KEYBOARD_PERSIST_TAPS}
          keyboardDismissMode={KEYBOARD_DISMISS_MODE}
          refreshControl={plainRefresh}
        >
          {body}
        </ThemedKeyboardAwareScrollView>
      );
    }
    if (scroll === 'scroll') {
      const hostProps = {
        style: styles.body,
        contentContainerStyle: [
          styles.scrollContent,
          styles.contentBottom(contentBottom),
        ],
        contentInsetAdjustmentBehavior: NO_AUTOMATIC_INSET,
        showsVerticalScrollIndicator: false,
        keyboardShouldPersistTaps: KEYBOARD_PERSIST_TAPS,
        keyboardDismissMode: KEYBOARD_DISMISS_MODE,
        refreshControl: plainRefresh,
        testID: scrollTestID,
      };
      return onScroll ? (
        <Animated.ScrollView
          {...hostProps}
          onScroll={onScroll}
          scrollEventThrottle={16}
        >
          {body}
        </Animated.ScrollView>
      ) : (
        <ScrollView {...hostProps}>{body}</ScrollView>
      );
    }
    return (
      <View style={[styles.fixed, styles.contentBottom(contentBottom)]}>
        {body}
      </View>
    );
  })();

  return (
    <View style={[styles.container, style]} testID={testID}>
      <View style={styles.chromeInset}>{chrome}</View>
      {content}
      {footer ? (
        <View style={[styles.footer, styles.footerBottom(insets.bottom)]}>
          {footer}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    variants: {
      // The tab root sits below the status bar with its own small lead-in; a
      // pushed screen's header supplies its own.
      chrome: {
        tab: { paddingTop: theme.spacing.sm },
        other: {},
      },
    },
  },
  body: {
    flex: 1,
  },
  // Chrome sits outside the body, so the body's gutter never reaches it. A tab
  // header is page content and takes one; a pushed screen's header insets itself.
  chromeInset: {
    variants: {
      chrome: {
        tab: { paddingHorizontal: theme.layout.pageGutter },
        other: {},
      },
    },
  },
  fixed: {
    flex: 1,
    variants: {
      gutter: {
        page: { paddingHorizontal: theme.layout.pageGutter },
        none: {},
      },
    },
  },
  contentBottom: (bottomInset: number) => ({
    paddingBottom: bottomInset + theme.layout.pageBottom,
  }),
  // Fixed chrome, not content: it takes the gutter whatever the body does.
  footer: {
    paddingTop: theme.spacing.sm,
    paddingHorizontal: theme.layout.pageGutter,
  },
  footerBottom: (bottomInset: number) => ({
    paddingBottom: bottomInset + theme.spacing.sm,
  }),
  scrollContent: {
    flexGrow: 1,
    variants: {
      gutter: {
        page: { paddingHorizontal: theme.layout.pageGutter },
        none: {},
      },
    },
  },
}));
