import React from 'react';
import { View, ScrollView, type StyleProp, type ViewStyle } from 'react-native';
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

export interface ScreenHeaderConfig {
  /**
   * `standard` is the titled bar with a back control; `tab` is a root tab's
   * bar; `collapsing` means the screen draws its own hero and the scaffold
   * stays out of the way; `none` is a screen with no chrome.
   */
  variant?: 'standard' | 'tab' | 'collapsing' | 'none';
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
  centerTitle?: boolean;
}

export interface ScreenProps {
  children: React.ReactNode;
  header?: ScreenHeaderConfig;
  /**
   * `none` is fixed content, `scroll` a plain scroll view, `form` the
   * keyboard-aware host, and `list` means THE CHILD IS THE SCROLLABLE — a
   * FlashList or a ScrollView the screen owns, so the scaffold adds no scroll
   * host and no bottom inset of its own.
   */
  scroll?: 'none' | 'scroll' | 'form' | 'list';
  /** Horizontal page inset. `none` is for a screen that bleeds to the edges. */
  gutter?: 'page' | 'none';
  /**
   * Pull-to-refresh for `scroll`, `form` and `none`. A `list` screen passes an
   * RNGH `ThemedRefreshControl` to its own FlashList instead — RNGH's scrollable
   * routes its scroll gesture only into a control from `createNativeWrapper`,
   * so the control has to reach the list, not this scaffold.
   */
  refresh?: { refreshing: boolean; onRefresh: () => void };
  /**
   * Loading, error, offline and empty all come from here, so a screen cannot
   * implement three of the four and leave a failed fetch reading "nothing yet".
   */
  state?: { value: DataState; onRetry: () => void; empty?: EmptyStateProps };
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * The one screen scaffold. It NEVER applies the top inset — the navigator's
 * `screenLayout` already does, and applying it twice is what pushed six profile
 * screens down by a status bar. The bottom inset is applied only for fixed
 * content, since a scroll view gets it from its own content inset.
 */
export const Screen: React.FC<ScreenProps> = ({
  children,
  header,
  scroll = 'scroll',
  gutter = 'page',
  refresh,
  state,
  style,
  testID,
}) => {
  const insets = useSafeAreaInsets();
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
        centerTitle={header?.centerTitle}
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
          contentContainerStyle={styles.scrollContent}
          refreshControl={plainRefresh}
        >
          {body}
        </ThemedKeyboardAwareScrollView>
      );
    }
    if (scroll === 'scroll') {
      return (
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.scrollContent}
          contentInsetAdjustmentBehavior="automatic"
          refreshControl={plainRefresh}
        >
          {body}
        </ScrollView>
      );
    }
    return (
      <View style={[styles.fixed, { paddingBottom: insets.bottom }]}>
        {body}
      </View>
    );
  })();

  return (
    <View style={[styles.container, style]} testID={testID}>
      {chrome}
      {content}
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
  fixed: {
    flex: 1,
    variants: {
      gutter: {
        page: { paddingHorizontal: theme.layout.pageGutter },
        none: {},
      },
    },
  },
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

export default Screen;
