import React from 'react';
import { View, Text } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native-unistyles';
import { useMappingHelper } from '@shopify/flash-list';
import { Icon } from '#utils/iconUtils';
import { type MealTemplateDisplayFragment } from '../../graphql/operations/mealPlan/mealPlanFragments.generated';

interface TemplateCardProps {
  template: MealTemplateDisplayFragment;
  onPress: (template: MealTemplateDisplayFragment) => void;
}

const TemplateCardComponent: React.FC<TemplateCardProps> = ({
  template,
  onPress,
}) => {
  const { getMappingKey } = useMappingHelper();
  return (
    <Pressable
      onPress={() => onPress(template)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.header}>
        <Text style={styles.name} numberOfLines={1}>
          {template.name}
        </Text>
        {template.usageCount > 0 && (
          <Text style={styles.usageCount}>Used {template.usageCount}x</Text>
        )}
      </View>

      {!!template.description && (
        <Text style={styles.description} numberOfLines={2}>
          {template.description}
        </Text>
      )}

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Icon
            name="calendar-outline"
            size={14}
            color={styles.metaIcon.color}
          />
          <Text style={styles.metaText}>{template.durationDays} days</Text>
        </View>
        <View style={styles.metaItem}>
          <Icon name="people-outline" size={14} color={styles.metaIcon.color} />
          <Text style={styles.metaText}>
            {template.defaultServings} servings
          </Text>
        </View>
        {!!template.home?.name && (
          <View style={styles.homeBadge}>
            <Icon
              name="home-outline"
              size={12}
              color={styles.homeBadgeText.color}
            />
            <Text style={styles.homeBadgeText}>{template.home.name}</Text>
          </View>
        )}
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>
            {template.category.charAt(0) +
              template.category.slice(1).toLowerCase()}
          </Text>
        </View>
      </View>

      {template.tags.length > 0 && (
        <View style={styles.tagRow}>
          {template.tags.slice(0, 3).map((tag, index) => (
            <View key={getMappingKey(tag, index)} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
          {template.tags.length > 3 && (
            <Text style={styles.moreText}>+{template.tags.length - 3}</Text>
          )}
        </View>
      )}
    </Pressable>
  );
};

export const TemplateCard = TemplateCardComponent;

const styles = StyleSheet.create(theme => ({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xs,
  },
  name: {
    flex: 1,
    fontSize: theme.fonts.size.base,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
  },
  usageCount: {
    fontSize: theme.fonts.size.xs,
    color: theme.colors.textTertiary,
    marginLeft: theme.spacing.sm,
  },
  description: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  metaIcon: {
    color: theme.colors.textTertiary,
  },
  metaText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
  },
  homeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.surfaceVariant,
  },
  homeBadgeText: {
    fontSize: theme.fonts.size.xs,
    color: theme.colors.textSecondary,
  },
  categoryBadge: {
    marginLeft: 'auto',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.primaryLight,
  },
  categoryText: {
    fontSize: theme.fonts.size.xs,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.primary,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.sm,
  },
  tag: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.surfaceVariant,
  },
  tagText: {
    fontSize: theme.fonts.size.xs,
    color: theme.colors.textSecondary,
  },
  moreText: {
    fontSize: theme.fonts.size.xs,
    color: theme.colors.textTertiary,
    alignSelf: 'center',
  },
}));
