import React from 'react';
import { View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native-unistyles';
import { useMappingHelper } from '@shopify/flash-list';
import { Icon } from '#utils/iconUtils';
import { type MealTemplateDisplayFragment } from '#features/mealPlan/graphql/mealPlanFragments.generated';
import { Text } from '#components/atoms/Text';

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
        <Text
          size="base"
          weight="semibold"
          style={styles.name}
          numberOfLines={1}
        >
          {template.name}
        </Text>
        {template.usageCount > 0 && (
          <Text size="xs" tone="tertiary" style={styles.usageCount}>
            Used {template.usageCount}x
          </Text>
        )}
      </View>

      {!!template.description && (
        <Text
          size="sm"
          tone="secondary"
          style={styles.description}
          numberOfLines={2}
        >
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
          <Text size="sm" tone="secondary">
            {template.durationDays} days
          </Text>
        </View>
        <View style={styles.metaItem}>
          <Icon name="people-outline" size={14} color={styles.metaIcon.color} />
          <Text size="sm" tone="secondary">
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
            <Text size="xs" tone="secondary">
              {template.home.name}
            </Text>
          </View>
        )}
        <View style={styles.categoryBadge}>
          <Text size="xs" weight="medium" tone="accent">
            {template.category.charAt(0) +
              template.category.slice(1).toLowerCase()}
          </Text>
        </View>
      </View>

      {template.tags.length > 0 && (
        <View style={styles.tagRow}>
          {template.tags.slice(0, 3).map((tag, index) => (
            <View key={getMappingKey(tag, index)} style={styles.tag}>
              <Text size="xs" tone="secondary">
                {tag}
              </Text>
            </View>
          ))}
          {template.tags.length > 3 && (
            <Text size="xs" tone="tertiary" style={styles.moreText}>
              +{template.tags.length - 3}
            </Text>
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
  },
  usageCount: {
    marginLeft: theme.spacing.sm,
  },
  description: {
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
    color: theme.colors.textSecondary,
  },
  categoryBadge: {
    marginLeft: 'auto',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.primaryLight,
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
  moreText: {
    alignSelf: 'center',
  },
}));
