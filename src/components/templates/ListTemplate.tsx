import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
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
  onRefresh?: () => Promise<void>;
  emptyState?: any;

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
  onRefresh = async () => {},
  emptyState,

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
}) => {
  // Determine the actual display state
  const isLoading = loading && items.length === 0;
  const shouldShowHeader = showHeader && !hasNoData;
  const shouldShowSearchBar = showSearchBar && !hasNoData && !isLoading;

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

      {shouldShowHeader && (
        <Header
          title={title}
          onBack={onBack}
          leftActions={headerActions?.left || []}
          rightActions={headerActions?.right || []}
        />
      )}

      {shouldShowSearchBar && (
        <SearchBar
          value={searchQuery || ''}
          onChangeText={onSearchChange}
          placeholder={
            searchPlaceholder || `Search ${subtitle.toLowerCase()}...`
          }
          leftActions={searchBarActions?.left || []}
          rightActions={searchBarActions?.right || []}
          listName={title}
          itemCount={items?.length || 0}
          completedCount={items?.filter(item => item.completed).length}
        />
      )}

      <ItemList
        items={items || []}
        onItemPress={isLoading ? () => {} : onItemPress}
        onItemEdit={isLoading ? () => {} : onItemEdit}
        onItemDelete={isLoading ? () => {} : onItemDelete}
        onRefresh={onRefresh}
        emptyState={effectiveEmptyState}
      />
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
}));
