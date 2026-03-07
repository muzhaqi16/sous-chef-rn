import React from 'react';
import {View, Text, Pressable} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import {Icon} from '#utils/iconUtils';
import {useAppNavigation} from '#hooks/navigation/useAppNavigation';
import {Header} from '#components/molecules/Header';
import {usePantryManagement} from '#hooks/home/pantry/usePantryManagement';
import {useCurrentPantry} from '#hooks/pantry/useCurrentPantry';
import {commonStyles} from '#/styles/commonStyles';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';
import {createPropsComparator} from '#utils/memoUtils';

interface CategoryItemData {
  name: string;
  count: number;
}

const keyExtractor = (item: CategoryItemData) => item.name;

const areCategoryItemPropsEqual = createPropsComparator<{ item: CategoryItemData }>({
  nestedComparisons: {
    item: ['name', 'count'],
  },
});

const CategoryItem = React.memo(({ item }: { item: CategoryItemData }) => {
  const {theme} = useUnistyles();

  return (
    <Pressable
      style={({pressed}) => [commonStyles.card, styles.categoryCard, pressed && styles.pressed]}
      onPress={() => {}}>
      <View style={styles.categoryInfo}>
        <Text style={styles.categoryName}>{item.name}</Text>
        <Text style={[commonStyles.caption, styles.categoryDetails]}>
          {item.count} items
        </Text>
      </View>
      <Icon
        name="chevron-right"
        size={24}
        color={theme.colors.textSecondary}
      />
    </Pressable>
  );
}, areCategoryItemPropsEqual);

CategoryItem.displayName = 'CategoryItem';

const renderItem = ({ item }: { item: CategoryItemData }) => <CategoryItem item={item} />;

export const CategoryManagement: React.FC = () => {
  const {goBack} = useAppNavigation();

  // Use cache-only hook for pantry resolution (no network requests)
  // This prevents query cascade when switching between pantry screens
  const {pantry} = useCurrentPantry();

  const {items} = usePantryManagement(pantry?.id);

  const categorizedItems = (() => {
    if (!items) return {};

    const grouped: Record<string, any[]> = {};
    items.forEach(item => {
      const category = item.item?.categories?.[0]?.category?.name || 'Uncategorized';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(item);
    });

    return grouped;
  })();

  const categoryData: CategoryItemData[] = Object.keys(categorizedItems)
    .sort()
    .map(name => ({ name, count: categorizedItems[name].length }));

  return (
    <View style={commonStyles.container}>
      <Header title="Categories" onBack={goBack} centerTitle />

      <FlashList
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        data={categoryData}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        drawDistance={200}
      />
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  scrollView: {
    flex: 1 },
  scrollContent: {
    padding: theme.spacing.md },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm },
  categoryInfo: {
    flex: 1 },
  categoryName: {
    fontSize: theme.fonts.size.base,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary },
  categoryDetails: {
    marginTop: theme.spacing.xs },
  pressed: {
    opacity: theme.opacity.pressed } }));
