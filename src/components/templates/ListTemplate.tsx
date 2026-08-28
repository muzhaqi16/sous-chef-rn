import type { SwipeAction } from '#components/molecules/SwipeableItem/types';
import React from 'react';
import { useTranslation } from '#/i18n';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { ItemList } from '../organisms/ItemList';

/** Shared empty-state configuration */
interface EmptyStateConfig {
  icon?: string;
  title: string;
  description?: string;
  loadingDescription?: string;
  action?: {
    label: string;
    onPress: () => void;
  };
}

interface ListTemplateProps<TItem extends { id: string } = { id: string }> {
  // Items flow through to either ItemList or a custom list component; the item
  // type `TItem` is inferred from `items`/`customListComponent` at the call site.
  items?: TItem[];
  onItemPress?: (id: string) => void;
  /** Swipe actions for one row — see `ItemListActions.itemSwipeActions`. */
  itemSwipeActions?: (id: string) => {
    left?: SwipeAction[];
    right?: SwipeAction[];
  };
  onRefresh?: () => Promise<void>;
  emptyState?: EmptyStateConfig;

  // List composition
  ListHeaderComponent?:
    | React.ComponentType<unknown>
    | React.ReactElement
    | null;
  ListFooterComponent?:
    | React.ComponentType<unknown>
    | React.ReactElement
    | null;

  // State management
  loading?: boolean;

  // Test IDs
  testIDPrefix?: string;

  customListComponent?: React.ComponentType<CustomListComponentProps<TItem>>;
  customListProps?: Record<string, unknown>;
}

/** Props the template injects into a `customListComponent`. */
interface CustomListComponentProps<
  TItem extends { id: string } = { id: string },
> {
  items: TItem[];
  onItemPress: (id: string) => void;
  itemSwipeActions?: (id: string) => {
    left?: SwipeAction[];
    right?: SwipeAction[];
  };
  onRefresh: () => Promise<void>;
  ListHeaderComponent?:
    | React.ComponentType<unknown>
    | React.ReactElement
    | null;
  ListFooterComponent?:
    | React.ComponentType<unknown>
    | React.ReactElement
    | null;
  testIDPrefix?: string;
  emptyState?: EmptyStateConfig;
}
/*
 * This prop set used to end in `[key: string]: unknown`, which let a custom
 * list component be typed against props the template never injects. Removing it
 * stops untyped props flowing through the typed slot — caller extras go in
 * `customListProps` — but it does NOT catch the defect that motivated it: a
 * component reading a renamed prop declares it OPTIONAL, and an unused optional
 * prop stays assignable either way. The guard for that is behavioural, in
 * `SortableItem.test.tsx` § "swipe actions reach the row", which asserts the
 * descriptors the screen supplies actually reach the row's swipe props.
 */

export const ListTemplate = <TItem extends { id: string } = { id: string }>({
  items = [],
  onItemPress = () => {},
  itemSwipeActions,
  onRefresh = async () => {},
  emptyState,

  ListHeaderComponent,
  ListFooterComponent,

  loading = false,

  testIDPrefix,

  customListComponent: CustomListComponent,
  customListProps = {},
}: ListTemplateProps<TItem>) => {
  const { t } = useTranslation();
  // Don't show loading state if custom component exists - let it handle its own loading
  const isLoading = loading && items.length === 0 && !CustomListComponent;

  // Show loading empty state when loading with no items.
  // The icon falls back to a neutral placeholder, not `cube-outline` — that is
  // a pantry-shaped box, and a generic template picking one feature's icon is
  // how the shopping list ended up flashing a pantry glyph while loading.
  const effectiveEmptyState = isLoading
    ? {
        icon: emptyState?.icon || 'ellipsis-horizontal',
        title: t('listTemplate.loading'),
        description:
          emptyState?.loadingDescription || t('listTemplate.loadingItems'),
      }
    : emptyState;

  return (
    <View style={styles.container}>
      {CustomListComponent ? (
        <CustomListComponent
          items={items || []}
          onItemPress={isLoading ? () => {} : onItemPress}
          itemSwipeActions={isLoading ? undefined : itemSwipeActions}
          onRefresh={onRefresh}
          ListHeaderComponent={ListHeaderComponent}
          ListFooterComponent={ListFooterComponent}
          testIDPrefix={testIDPrefix}
          emptyState={effectiveEmptyState}
          {...customListProps}
        />
      ) : (
        <ItemList
          // The template only guarantees `{ id: string }`; ItemList narrows to
          // its own item type for the default (non-custom) rendering path.
          items={
            items as { id: string }[] as Parameters<typeof ItemList>[0]['items']
          }
          onItemPress={isLoading ? () => {} : onItemPress}
          itemSwipeActions={isLoading ? undefined : itemSwipeActions}
          onRefresh={onRefresh}
          ListHeaderComponent={ListHeaderComponent}
          ListFooterComponent={ListFooterComponent}
          testIDPrefix={testIDPrefix}
          emptyState={
            effectiveEmptyState as Parameters<typeof ItemList>[0]['emptyState']
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create(() => ({
  container: {
    flex: 1,
  },
}));
