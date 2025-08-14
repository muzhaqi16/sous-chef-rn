import React from 'react';
import {View} from 'react-native';
import {useStyles, createStyleSheet} from 'react-native-unistyles';
import {UserHeader, SearchBar} from '#components';
import {Header} from '../molecules/Header';
import {ItemList} from '../organisms/ItemList';
import {FAB} from '../base/Fab';

interface ListTemplateProps {
  title?: string;
  items: any[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onItemPress: (id: string) => void;
  onItemEdit?: (id: string) => void;
  onItemDelete?: (id: string) => void;
  onAddPress?: () => void;
  onRefresh?: () => Promise<void>;
  headerActions?: any[];
  emptyState?: any;
  showUserHeader?: boolean;
  onBack?: () => void;
}

export const ListTemplate: React.FC<ListTemplateProps> = ({
  title = '',
  items,
  searchQuery,
  onSearchChange,
  onItemPress,
  onItemEdit,
  onItemDelete,
  onAddPress,
  onRefresh,
  headerActions = [],
  emptyState,
  showUserHeader = true,
  onBack,
}) => {
  const {styles} = useStyles(stylesheet);

  return (
    <View style={styles.container}>
      {showUserHeader && <UserHeader />}
      {headerActions.length > 0 && (
        <Header title={title} onBack={onBack} actions={headerActions} />
      )}
      <SearchBar
        value={searchQuery}
        onChangeText={onSearchChange}
        placeholder={`Search ${title.toLowerCase()}...`}
        onPressList={() => {}}
        onPressAdd={onAddPress}
        listName={title}
        itemCount={items.length}
        completedCount={items.filter(item => item.completed).length}
      />
      <ItemList
        items={items}
        onItemPress={onItemPress}
        onItemEdit={onItemEdit}
        onItemDelete={onItemDelete}
        onRefresh={onRefresh}
        emptyState={emptyState}
      />
      {onAddPress && (
        <FAB onPress={onAddPress} position={{bottom: 20, right: 20}} />
      )}
    </View>
  );
};

const stylesheet = createStyleSheet(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
}));
