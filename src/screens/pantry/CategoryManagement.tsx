import React, {useMemo} from 'react';
import {View, Text, ScrollView, TouchableOpacity} from 'react-native';
import {Icon} from '#utils';
import {useNavigation} from '@react-navigation/native';
import {usePantryItems, useDefaultHome} from '#hooks';
import {useGetHomeQuery} from '#generated';
import {commonStyles} from '#styles';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';

export const CategoryManagement: React.FC = () => {
  const navigation = useNavigation();
  const {theme} = useUnistyles();

  const {selectedHomeId, getDefaultPantry} = useDefaultHome();
  const {data: homeData} = useGetHomeQuery({
    variables: {homeId: selectedHomeId ?? ''},
    skip: !selectedHomeId,
  });

  const pantry = getDefaultPantry(homeData);
  const {items} = usePantryItems(pantry?.id);

  const categorizedItems = useMemo(() => {
    if (!items) return {};

    const grouped: Record<string, any[]> = {};
    items.forEach(item => {
      const category = item.customCategory || 'Uncategorized';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(item);
    });

    return grouped;
  }, [items]);

  const categories = Object.keys(categorizedItems).sort();

  return (
    <View style={commonStyles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[commonStyles.title, styles.headerTitle]}>Categories</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}>
        {categories.map(category => (
          <TouchableOpacity
            key={category}
            style={[commonStyles.card, styles.categoryCard]}
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
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 24,
  },
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
}));
