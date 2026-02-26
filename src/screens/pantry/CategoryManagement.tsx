import React, {useCallback, useMemo} from 'react';
import {View, Text, Pressable} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import {Icon} from '#utils/iconUtils';
import {useNavigation} from '@react-navigation/native';
import {Header} from '#components/molecules/Header';
import {usePantryManagement} from '#hooks/home/pantry/usePantryManagement';
import {useCurrentPantry} from '#hooks/pantry/useCurrentPantry';
import {commonStyles} from '#/styles/commonStyles';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';

export const CategoryManagement: React.FC = () => {
  const navigation = useNavigation();
  const {theme} = useUnistyles();

  // Use cache-only hook for pantry resolution (no network requests)
  // This prevents query cascade when switching between pantry screens
  const {pantry} = useCurrentPantry();

  const {items} = usePantryManagement(pantry?.id);

  const categorizedItems = useMemo(() => {
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
  }, [items]);

  const categories = Object.keys(categorizedItems).sort();

  const renderCategoryItem = useCallback(
    ({ item: category }: { item: string }) => (
      <Pressable
        style={({pressed}) => [commonStyles.card, styles.categoryCard, pressed && styles.pressed]}
        onPress={() => {}}>
        <View style={styles.categoryInfo}>
          <Text style={styles.categoryName}>{category}</Text>
          <Text style={[commonStyles.caption, styles.categoryDetails]}>
            {categorizedItems[category].length} items
          </Text>
        </View>
        <Icon
          name="chevron-right"
          size={24}
          color={theme.colors.textSecondary}
        />
      </Pressable>
    ),
    [categorizedItems, theme.colors.textSecondary],
  );

  return (
    <View style={commonStyles.container}>
      <Header title="Categories" onBack={() => navigation.goBack()} centerTitle />

      <FlashList
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        data={categories}
        keyExtractor={(category) => category}
        renderItem={renderCategoryItem}
      />
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.md,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: theme.fonts.size.base,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
  },
  categoryDetails: {
    marginTop: theme.spacing.xs,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
