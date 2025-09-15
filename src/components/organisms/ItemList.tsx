import React from 'react';
import {ScrollView, RefreshControl} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {EmptyState} from '../molecules/EmptyState';
import {ItemCard} from './ItemCard';
import {IconName} from '#/utils/iconUtils';
interface Item {
  id: string;
  title: string;
  subtitle: string;
  badge?: {
    text: string;
    variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  };
  rightElement?: React.ReactNode;
  leftElement?: React.ReactNode; // Optional left element for image or icon
}

interface ItemListProps {
  items: Item[];
  onItemPress: (id: string) => void;
  onItemEdit?: (id: string) => void;
  onItemDelete?: (id: string) => void;
  onRefresh?: () => Promise<void>;
  emptyState?: {
    icon: IconName;
    title: string;
    description?: string;
    action?: {
      label: string;
      onPress: () => void;
    };
  };
}

export const ItemList: React.FC<ItemListProps> = ({
  items,
  onItemPress,
  onItemEdit,
  onItemDelete,
  onRefresh,
  emptyState,
}) => {
  const [refreshing, setRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    if (onRefresh) {
      setRefreshing(true);
      await onRefresh();
      setRefreshing(false);
    }
  };

  if (items.length === 0 && emptyState) {
    return <EmptyState {...emptyState} />;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        ) : undefined
      }>
      {items.map(item => (
        <ItemCard
          key={item.id}
          id={item.id}
          title={item.title}
          subtitle={item.subtitle}
          badge={item.badge}
          leftElement={item.leftElement}
          rightElement={item.rightElement}
          onPress={() => onItemPress(item.id)}
          onEdit={onItemEdit ? () => onItemEdit(item.id) : undefined}
          onDelete={onItemDelete ? () => onItemDelete(item.id) : undefined}
        />
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create(() => ({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 28, // Extra space for larger shadow at bottom
  },
}));
