import React from 'react';
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

interface ListTemplateProps {
  // Core list functionality — items are typed loosely because the template
  // passes them through to either ItemList or a custom list component,
  // each with its own item type.
  items?: { id: string }[];
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

  customListComponent?: React.ComponentType<any>;
  customListProps?: Record<string, unknown>;
}

export const ListTemplate: React.FC<ListTemplateProps> = ({
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
}) => {
  // Don't show loading state if custom component exists - let it handle its own loading
  const isLoading = loading && items.length === 0 && !CustomListComponent;

  // Show loading empty state when loading with no items
  const effectiveEmptyState = isLoading
    ? {
        icon: emptyState?.icon || 'cube-outline',
        title: 'Loading...',
        description: emptyState?.loadingDescription || 'Loading your items',
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
          items={items as Parameters<typeof ItemList>[0]['items']}
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
