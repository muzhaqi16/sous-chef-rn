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
  return (
    <View style={styles.container}>
      {showUserHeader && <UserHeader />}

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
          listName={title}
          itemCount={items?.length || 0}
          completedCount={items?.filter(item => item.completed).length}
        />
      )}

      <ItemList
        items={items || []}
        onItemPress={onItemPress}
        onItemEdit={onItemEdit}
        onItemDelete={onItemDelete}
        onRefresh={onRefresh}
        emptyState={emptyState}
      />
    </View>
  );
};

const styles = StyleSheet.create(() => ({
  container: {
    flex: 1,
  },
}));
