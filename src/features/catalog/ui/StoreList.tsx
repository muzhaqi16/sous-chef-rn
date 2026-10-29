import React from 'react';
import { FlashList, type FlashListProps } from '@shopify/flash-list';
import { StyleSheet } from 'react-native-unistyles';
import { SwipeAwareScrollComponent } from '#components/atoms/SwipeAwareScrollComponent';
import { useScreenListInset } from '#components/templates/useScreenListInset';
import { FLASHLIST_DEFAULTS } from '#constants/flashListDefaults';
import type { StoreOption } from '#domain/stores';

// A pin moves a row to the top and an answer replaces the rows: anchoring the
// rows in view would scroll the first one away.
const MVCP_DISABLED = { disabled: true };

type StoreListProps<T extends StoreOption> = Pick<
  FlashListProps<T>,
  'data' | 'renderItem' | 'ListEmptyComponent' | 'ListFooterComponent'
>;

/** A screen's list of stores, filling the rest of it, under the page gutter. */
export function StoreList<T extends StoreOption>(props: StoreListProps<T>) {
  const listInset = useScreenListInset();
  return (
    <FlashList
      {...props}
      renderScrollComponent={SwipeAwareScrollComponent}
      style={styles.list}
      contentContainerStyle={[styles.content, listInset]}
      keyExtractor={option => option.key}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      maintainVisibleContentPosition={MVCP_DISABLED}
      {...FLASHLIST_DEFAULTS.fullScreen}
    />
  );
}

const styles = StyleSheet.create(theme => ({
  list: {
    flex: 1,
  },
  content: {
    paddingHorizontal: theme.layout.pageGutter,
    paddingTop: theme.spacing.md,
  },
}));
