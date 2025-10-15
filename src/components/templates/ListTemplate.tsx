import React from 'react';
import {View} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {UserHeader, SearchBar} from '#components';
import {Header, HeaderAction} from '../molecules/Header';
import {ItemList} from '../organisms/ItemList';
import {FAB} from '../base/Fab';
import {SearchBarAction} from '#components/molecules/SearchBar';

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
  showFAB?: boolean;

  // Actions
  headerActions?: HeaderActions;
  searchBarActions?: SearchBarActions;
  onFabPress?: () => void; // For FAB
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
  showFAB = true,

  // Actions
  headerActions,
  searchBarActions,
  onFabPress,
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

      {showFAB && showFAB && (
        <FAB
          icon="qr-code-scanner"
          onPress={onFabPress}
          position={{bottom: 20, right: 20}}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
}));
