import React from 'react';
import {View, Text, ScrollView, TouchableOpacity} from 'react-native';
import {createStyleSheet, useStyles} from 'react-native-unistyles';
import Chip from '../atoms/Chip';

type Category = {
  id: string;
  label: string;
};

type CategorySelectorProps = {
  categories: Category[];
  selectedCategoryId: string | null;
  onSelectCategory: (id: string) => void;
  onSeeAll?: () => void;
};

const stylesheet = createStyleSheet(theme => ({
  container: {
    marginVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.typography,
  },
  seeAll: {
    fontSize: 14,
    color: theme.colors.primary,
  },
  chipList: {
    flexDirection: 'row',
  },
}));

const CategorySelector: React.FC<CategorySelectorProps> = ({
  categories,
  selectedCategoryId,
  onSelectCategory,
  onSeeAll,
}) => {
  const {styles} = useStyles(stylesheet);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Category</Text>
        {onSeeAll && (
          <TouchableOpacity onPress={onSeeAll}>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        )}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipList}>
        {categories.map(category => (
          <Chip
            key={category.id}
            label={category.label}
            selected={category.id === selectedCategoryId}
            onPress={() => onSelectCategory(category.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
};

export default CategorySelector;
