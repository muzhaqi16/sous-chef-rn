import React, { ReactNode } from 'react';
import { View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { UserHeader, SearchBar } from '#components';
import { Header, HeaderAction } from '../molecules/Header';
import { ItemList } from '../organisms/ItemList';
import { SearchBarAction } from '#components/molecules/SearchBar';

interface HeaderActions {
  left?: HeaderAction[];
  right?: HeaderAction[];
}

interface SearchBarActions {
  left?: SearchBarAction[];
  right?: SearchBarAction[];
  showSearchIcon?: boolean;
  innerRightIcon?: ReactNode;
}

interface ListTemplateProps {
  // Core list functionality
  title?: string;
  subtitle?: string;
  items?: any[];
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  onItemPress?: (id: string) => void;
  onItemEdit?: (id: string) => void;
  onItemDelete?: (id: string) => void;
  onItemConsume?: (id: string) => void;
  onItemWaste?: (id: string) => void;
  onItemRestock?: (id: string) => void;
  onRefresh?: () => Promise<void>;
  onSwipeableWillOpen?: (ref: any) => void;
  emptyState?: any;

  // Pagination
  onEndReached?: () => void;
  onEndReachedThreshold?: number;
  ListHeaderComponent?: React.ComponentType<any> | React.ReactElement | null;
  ListFooterComponent?: React.ComponentType<any> | React.ReactElement | null;

  // State management
  loading?: boolean; // Is data currently loading?
  hasNoData?: boolean; // No baseline data exists (e.g., no home selected)

  // Display controls
  showUserHeader?: boolean;
  showHeader?: boolean;
  showSearchBar?: boolean;

  // Actions
  headerActions?: HeaderActions;
  searchBarActions?: SearchBarActions;
  onBack?: () => void; // For header back button

  // Search bar specific props
  searchPlaceholder?: string;
  showTopSeparator?: boolean;
  listName?: string; // Override for SearchBar listName (defaults to title)
  completedCount?: number; // Override for SearchBar completedCount

  // Test IDs
  testIDPrefix?: string; // Prefix for item testIDs (e.g., 'pantry-item', 'shopping-list-item')

  // Custom list component
  customListComponent?: React.ComponentType<any>;
  customListProps?: any;
}

export const ListTemplate: React.FC<ListTemplateProps> = ({
  // Core props
  title = '',
  subtitle = '',
  items = [],
  searchQuery = '',
  onSearchChange = () => {},
  onItemPress = () => {},
  onItemEdit = () => {},
  onItemDelete = () => {},
  onItemConsume,
  onItemWaste,
  onItemRestock,
  onRefresh = async () => {},
  onSwipeableWillOpen,
  emptyState,

  // Pagination
  onEndReached,
  onEndReachedThreshold = 0.5,
  ListHeaderComponent,
  ListFooterComponent,

  // State management
  loading = false,
  hasNoData = false,

  // Display controls
  showUserHeader = true,
  showHeader = false,
  showSearchBar = false,

  // Actions
  headerActions,
  searchBarActions,
  onBack,

  // Search specific
  searchPlaceholder,
  showTopSeparator = false,
  listName,
  completedCount,

  // Test IDs
  testIDPrefix,

  // Custom list component
  customListComponent: CustomListComponent,
  customListProps = {},
}) => {
  const { theme } = useUnistyles();
  // Determine the actual display state
  // Don't show loading state if custom component exists - let it handle its own loading
  const isLoading = loading && items.length === 0 && !CustomListComponent;

  // Use appropriate empty state based on context
  const effectiveEmptyState = hasNoData
    ? emptyState
    : isLoading
    ? {
        icon: emptyState?.icon || 'inventory',
        title: 'Loading...',
        description: emptyState?.loadingDescription || 'Loading your items',
      }
    : emptyState;
  return (
    <View style={styles.container}>
      {showUserHeader && <UserHeader />}

      {showTopSeparator && (
        <View
          style={{
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.border,
            paddingVertical: theme.spacing.sm,
            marginBottom: theme.spacing.sm,
          }}
        />
      )}

      {showHeader && (
        <Header
          title={title}
          onBack={onBack}
          leftActions={headerActions?.left || []}
          rightActions={headerActions?.right || []}
        />
      )}

      {showSearchBar && (
        <SearchBar
          value={searchQuery || ''}
          onChangeText={onSearchChange}
          placeholder={
            searchPlaceholder || `Search ${subtitle.toLowerCase()}...`
          }
          leftActions={searchBarActions?.left || []}
          rightActions={searchBarActions?.right || []}
          showSearchIcon={searchBarActions?.showSearchIcon}
          innerRightIcon={searchBarActions?.innerRightIcon}
          listName={listName || title}
          itemCount={items?.length || 0}
          completedCount={
            completedCount !== undefined
              ? completedCount
              : items?.filter(item => item.completed).length
          }
        />
      )}

      {CustomListComponent ? (
        <CustomListComponent
          items={items || []}
          onItemPress={isLoading ? () => {} : onItemPress}
          onItemEdit={isLoading ? () => {} : onItemEdit}
          onItemDelete={isLoading ? () => {} : onItemDelete}
          onItemConsume={isLoading ? undefined : onItemConsume}
          onItemWaste={isLoading ? undefined : onItemWaste}
          onItemRestock={isLoading ? undefined : onItemRestock}
          onRefresh={onRefresh}
          onSwipeableWillOpen={onSwipeableWillOpen}
          onEndReached={onEndReached}
          onEndReachedThreshold={onEndReachedThreshold}
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
          onItemConsume={isLoading ? undefined : onItemConsume}
          onItemWaste={isLoading ? undefined : onItemWaste}
          onItemRestock={isLoading ? undefined : onItemRestock}
          onRefresh={onRefresh}
          onSwipeableWillOpen={onSwipeableWillOpen}
          onEndReached={onEndReached}
          onEndReachedThreshold={onEndReachedThreshold}
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
