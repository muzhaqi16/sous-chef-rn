import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native-unistyles';
import { NotificationCategory } from '../../graphql/generated/schemaTypes';
import { NOTIFICATION_CATEGORIES } from '#store/slices/notificationSlice';

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
        <Pressable
          style={({ pressed }) => [
            styles.filterPill,
            !selectedCategory && styles.filterPillActive,
            pressed && styles.pressed,
          ]}
          onPress={() => onCategoryChange(null)}
        >
          <Text
            style={[
              styles.filterText,
              !selectedCategory && styles.filterTextActive,
            ]}
          >
            All
          </Text>
        </Pressable>

        {NOTIFICATION_CATEGORIES.map(category => (
          <Pressable
            key={category}
            style={({ pressed }) => [
              styles.filterPill,
              selectedCategory === category && styles.filterPillActive,
              pressed && styles.pressed,
            ]}
            onPress={() => onCategoryChange(category)}
          >
            <Text
              style={[
                styles.filterText,
                selectedCategory === category && styles.filterTextActive,
              ]}
            >
              {category.replace('_', ' ')}
            </Text>
          </Pressable>
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
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
