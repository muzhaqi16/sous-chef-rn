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
  onItemEdit?: (id: string) => void;
  onItemDelete?: (id: string) => void;
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
  onItemEdit: (id: string) => void;
  onItemDelete: (id: string) => void;
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
  [key: string]: unknown;
}

export const ListTemplate = <TItem extends { id: string } = { id: string }>({
  items = [],
  onItemPress = () => {},
  onItemEdit = () => {},
  onItemDelete = () => {},
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

  // Show loading empty state when loading with no items
  const effectiveEmptyState = isLoading
    ? {
        icon: emptyState?.icon || 'cube-outline',
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
          onItemEdit={isLoading ? () => {} : onItemEdit}
          onItemDelete={isLoading ? () => {} : onItemDelete}
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
          onItemEdit={isLoading ? () => {} : onItemEdit}
          onItemDelete={isLoading ? () => {} : onItemDelete}
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
