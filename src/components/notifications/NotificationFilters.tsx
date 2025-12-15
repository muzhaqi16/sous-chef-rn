import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {NotificationCategory} from '#store/slices/notificationSlice';

interface NotificationFiltersProps {
  selectedCategory: NotificationCategory | null;
  onCategoryChange: (category: NotificationCategory | null) => void;
}

export const NotificationFilters: React.FC<NotificationFiltersProps> = ({
  selectedCategory,
  onCategoryChange,
}) => {
  return (
    <View style={styles.filterContainer}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterScroll}>
        <TouchableOpacity
          style={[
            styles.filterPill,
            !selectedCategory && styles.filterPillActive,
          ]}
          onPress={() => onCategoryChange(null)}>
          <Text
            style={[
              styles.filterText,
              !selectedCategory && styles.filterTextActive,
            ]}>
            All
          </Text>
        </TouchableOpacity>

        {Object.values(NotificationCategory).map(category => (
          <TouchableOpacity
            key={category}
            style={[
              styles.filterPill,
              selectedCategory === category && styles.filterPillActive,
            ]}
            onPress={() => onCategoryChange(category)}>
            <Text
              style={[
                styles.filterText,
                selectedCategory === category && styles.filterTextActive,
              ]}>
              {category.replace('_', ' ')}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  filterContainer: {
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  filterScroll: {
    padding: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  filterPill: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii['2xl'],
    backgroundColor: theme.colors.background,
    marginRight: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterPillActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filterText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    textTransform: 'capitalize',
  },
  filterTextActive: {
    color: theme.colors.white,
    fontWeight: 'bold',
  },
}));