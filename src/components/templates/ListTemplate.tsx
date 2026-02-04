import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { ItemList } from '../organisms/ItemList';

interface ListTemplateProps {
  // Core list functionality
  items?: any[];
  onItemPress?: (id: string) => void;
  onItemEdit?: (id: string) => void;
  onItemDelete?: (id: string) => void;
  onRefresh?: () => Promise<void>;
  emptyState?: any;

  // List composition
  ListHeaderComponent?: React.ComponentType<any> | React.ReactElement | null;
  ListFooterComponent?: React.ComponentType<any> | React.ReactElement | null;

  // State management
  loading?: boolean;

  // Test IDs
  testIDPrefix?: string;

  // Custom list component
  customListComponent?: React.ComponentType<any>;
  customListProps?: any;
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
        icon: emptyState?.icon || 'inventory',
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
          items={items || []}
          onItemPress={isLoading ? () => {} : onItemPress}
          onItemEdit={isLoading ? () => {} : onItemEdit}
          onItemDelete={isLoading ? () => {} : onItemDelete}
          onRefresh={onRefresh}
          ListHeaderComponent={ListHeaderComponent}
          ListFooterComponent={ListFooterComponent}
          testIDPrefix={testIDPrefix}
          emptyState={effectiveEmptyState}
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
