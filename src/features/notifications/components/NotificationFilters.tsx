import React from 'react';
import { View, ScrollView } from 'react-native';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import { NotificationCategory } from '#/graphql/generated/schemaTypes';
import { NOTIFICATION_CATEGORIES } from '#store/slices/notificationSlice';
import { Text } from '#components/atoms/Text';

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
        contentContainerStyle={styles.filterScroll}
      >
        <AppPressable
          style={[
            styles.filterPill,
            !selectedCategory && styles.filterPillActive,
          ]}
          onPress={() => onCategoryChange(null)}
        >
          <Text
            size="sm"
            style={[
              styles.filterText,
              !selectedCategory && styles.filterTextActive,
            ]}
          >
            All
          </Text>
        </AppPressable>

        {NOTIFICATION_CATEGORIES.map(category => (
          <AppPressable
            key={category}
            style={[
              styles.filterPill,
              selectedCategory === category && styles.filterPillActive,
            ]}
            onPress={() => onCategoryChange(category)}
          >
            <Text
              size="sm"
              style={[
                styles.filterText,
                selectedCategory === category && styles.filterTextActive,
              ]}
            >
              {category.replace('_', ' ')}
            </Text>
          </AppPressable>
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
    color: theme.colors.textSecondary,
    textTransform: 'capitalize',
  },
  filterTextActive: {
    color: theme.colors.white,
    fontWeight: theme.fonts.weight.bold,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
