import React from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { TEMPLATE_CATEGORY_LABEL_KEYS } from '#features/mealPlan/utils/mealPlanEnumLabels';
import { RowCard } from '#components/atoms/RowCard';
import { ListItem } from '#components/molecules/ListItem';
import { StyleSheet } from 'react-native-unistyles';
import { useFragment } from '@apollo/client/react';
import type { FragmentType } from '@apollo/client/masking';
import { Icon } from '#components/atoms/Icon';
import {
  MealTemplateDisplayFragmentDoc,
  type MealTemplateDisplayFragment,
} from '#features/mealPlan/graphql/mealPlanFragments.generated';
import { Text } from '#components/atoms/Text';

interface TemplateCardProps {
  template: FragmentType<typeof MealTemplateDisplayFragmentDoc>;
  onPress: (template: MealTemplateDisplayFragment) => void;
}

const TemplateCardComponent: React.FC<TemplateCardProps> = ({
  template: templateSource,
  onPress,
}) => {
  const { t } = useTranslation();
  const fragmentResult = useFragment({
    fragment: MealTemplateDisplayFragmentDoc,
    fragmentName: 'MealTemplateDisplay',
    from: templateSource,
  });
  if (!fragmentResult.complete) return null;
  const template = fragmentResult.data;

  const category = t(TEMPLATE_CATEGORY_LABEL_KEYS[template.category]);
  const days = t('labels.durationDays', { count: template.durationDays });
  const servings = t('labels.servingsCount', {
    count: template.defaultServings,
  });

  return (
    <RowCard>
      <ListItem
        title={template.name}
        titleNumberOfLines={1}
        badge={{ text: category, variant: 'primary' }}
        onPress={() => onPress(template)}
        accessibilityLabel={[template.name, category, days, servings]
          .filter(Boolean)
          .join(', ')}
        accessibilityHint=""
        subtitle={
          <View style={styles.details}>
            {!!template.description && (
              <Text role="caption" tone="secondary" numberOfLines={2}>
                {template.description}
              </Text>
            )}
            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Icon
                  name="calendar-outline"
                  size="2xsPlus"
                  tone="textTertiary"
                />
                <Text role="caption" tone="secondary">
                  {days}
                </Text>
              </View>
              <View style={styles.metaItem}>
                <Icon
                  name="people-outline"
                  size="2xsPlus"
                  tone="textTertiary"
                />
                <Text role="caption" tone="secondary">
                  {servings}
                </Text>
              </View>
              {!!template.home?.name && (
                <View style={styles.metaItem}>
                  <Icon
                    name="home-outline"
                    size="2xsPlus"
                    tone="textTertiary"
                  />
                  <Text role="caption" tone="secondary">
                    {template.home.name}
                  </Text>
                </View>
              )}
              {template.usageCount > 0 && (
                <Text role="caption" tone="tertiary">
                  {t('templateCard.usedTimes', { count: template.usageCount })}
                </Text>
              )}
            </View>
            {template.tags.length > 0 && (
              <Text role="caption" tone="tertiary" numberOfLines={1}>
                {template.tags.slice(0, 3).join(' · ')}
                {template.tags.length > 3
                  ? ` +${template.tags.length - 3}`
                  : ''}
              </Text>
            )}
          </View>
        }
      />
    </RowCard>
  );
};

export const TemplateCard = TemplateCardComponent;

const styles = StyleSheet.create(theme => ({
  details: {
    gap: theme.spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: theme.spacing.md,
    rowGap: theme.spacing['2xs'],
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
}));
