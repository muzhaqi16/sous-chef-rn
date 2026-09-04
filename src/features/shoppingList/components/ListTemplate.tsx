import type { SwipeAction } from '#components/organisms/SwipeableItem/types';
import React from 'react';
import { useTranslation } from '#/i18n';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { ItemList } from '#components/organisms/ItemList';

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
  // `TItem` is inferred from `items`/`customListComponent` at the call site.
  items?: TItem[];
  onItemPress?: (id: string) => void;
  /** Swipe actions for one row — see `ItemListActions.itemSwipeActions`. */
  itemSwipeActions?: (id: string) => {
    left?: SwipeAction[];
    right?: SwipeAction[];
  };
  onRefresh?: () => Promise<void>;
  emptyState?: EmptyStateConfig;

  ListHeaderComponent?:
    | React.ComponentType<unknown>
    | React.ReactElement
    | null;
  ListFooterComponent?:
    | React.ComponentType<unknown>
    | React.ReactElement
    | null;

  loading?: boolean;

  testIDPrefix?: string;

  customListComponent?: React.ComponentType<CustomListComponentProps<TItem>>;
  /**
   * Extra props for a `customListComponent`, spread BEFORE the template's own
   * injections so a caller cannot override the wiring this template guarantees.
   * The type refuses such a key by mapping the injected names to `never` — an
   * `Omit` over an index signature removes nothing and permits them all.
   */
  customListProps?: Record<string, unknown> &
    Partial<Record<keyof CustomListComponentProps<TItem>, never>>;
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
 * No index signature here, so untyped props cannot flow through the typed slot;
 * caller extras go in `customListProps`. That does NOT catch a component reading a
 * RENAMED prop — an unused optional prop stays assignable — so the guard for that
 * is behavioural, in `SortableItem.test.tsx` § "swipe actions reach the row".
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
  const isLoading = loading && items.length === 0 && !CustomListComponent;

  // The fallback icon is a NEUTRAL placeholder: `cube-outline` is pantry-shaped,
  // and a generic template must not flash one feature's glyph on another's list.
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
          {...customListProps}
          items={items || []}
          onItemPress={isLoading ? () => {} : onItemPress}
          itemSwipeActions={isLoading ? undefined : itemSwipeActions}
          onRefresh={onRefresh}
          ListHeaderComponent={ListHeaderComponent}
          ListFooterComponent={ListFooterComponent}
          testIDPrefix={testIDPrefix}
          emptyState={effectiveEmptyState}
        />
      ) : (
        <ItemList
          // The template guarantees only `{ id: string }`; ItemList narrows to its
          // own item type on the default rendering path.
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
