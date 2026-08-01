import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import { useMappingHelper } from '@shopify/flash-list';
import { useFragment } from '@apollo/client/react';
import { Icon } from '#utils/iconUtils';
import {
  MealTemplateDisplayFragmentDoc,
  type MealTemplateDisplayFragment,
} from '#features/mealPlan/graphql/mealPlanFragments.generated';
import { Text } from '#components/atoms/Text';

interface TemplateCardProps {
  template: MealTemplateDisplayFragment;
  onPress: (template: MealTemplateDisplayFragment) => void;
}

const TemplateCardComponent: React.FC<TemplateCardProps> = ({
  template: templateSource,
  onPress,
}) => {
  const { t } = useTranslation();
  // Per-entity cache subscription: re-renders only when this template's
  // MealTemplateDisplay fields change. Falls back to the source prop on cache
  // miss (e.g., entity evicted, or a test that doesn't seed the cache) so we
  // never blank out a list item.
  const fragmentResult = useFragment({
    fragment: MealTemplateDisplayFragmentDoc,
    fragmentName: 'MealTemplateDisplay',
    from: templateSource,
  });
  const template =
    fragmentResult.complete && fragmentResult.data
      ? fragmentResult.data
      : templateSource;

  const { getMappingKey } = useMappingHelper();
  return (
    <AppPressable onPress={() => onPress(template)} style={styles.card}>
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
            {t('templateCard.usedTimes', { count: template.usageCount })}
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
          <Icon name="calendar-outline" size={14} tone="textTertiary" />
          <Text size="sm" tone="secondary">
            {t('templateCard.durationDays', { count: template.durationDays })}
          </Text>
        </View>
        <View style={styles.metaItem}>
          <Icon name="people-outline" size={14} tone="textTertiary" />
          <Text size="sm" tone="secondary">
            {t('templateCard.servings', { count: template.defaultServings })}
          </Text>
        </View>
        {!!template.home?.name && (
          <View style={styles.homeBadge}>
            <Icon name="home-outline" size={12} tone="textSecondary" />
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
    </AppPressable>
  );
};

export const TemplateCard = TemplateCardComponent;

const styles = StyleSheet.create(theme => ({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
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
  homeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.surfaceVariant,
  },
  categoryBadge: {
    marginLeft: 'auto',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
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
    borderCurve: 'continuous',
    backgroundColor: theme.colors.surfaceVariant,
  },
  moreText: {
    alignSelf: 'center',
  },
}));
