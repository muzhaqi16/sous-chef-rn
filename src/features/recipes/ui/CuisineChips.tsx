import React, { useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { AppPressable } from '#components/atoms/AppPressable';
import { AnimatedChip } from '#components/molecules/AnimatedChip';
import { Text } from '#components/atoms/Text';
import { Icon } from '#components/atoms/Icon';
import type { Cuisine } from '#/graphql/generated/schemaTypes';
import { POPULAR_CUISINES, getAllCuisineOptions } from '#domain/cuisines';

interface CuisineChipsProps {
  selected: readonly Cuisine[];
  onToggle: (cuisine: Cuisine) => void;
}

/** The cuisine chip grid: the popular few, then every cuisine on request. */
export const CuisineChips: React.FC<CuisineChipsProps> = ({
  selected,
  onToggle,
}) => {
  const { t } = useTranslation();
  const [showAll, setShowAll] = useState(false);
  const cuisinesToShow = showAll ? getAllCuisineOptions() : POPULAR_CUISINES;

  return (
    <View style={styles.container}>
      <View style={styles.chipGrid}>
        {cuisinesToShow.map(cuisine => (
          <AnimatedChip
            key={cuisine.value}
            label={t(cuisine.labelKey)}
            selected={selected.includes(cuisine.value)}
            onPress={() => onToggle(cuisine.value)}
          />
        ))}
      </View>

      {/* Its own row: in the grid it read as one more cuisine. */}
      {!showAll && (
        <AppPressable
          style={styles.showMoreButton}
          onPress={() => setShowAll(true)}
          accessibilityRole="button"
        >
          <Icon name="add-circle-outline" size={18} tone="primary" />
          <Text role="bodyStrong" tone="accent" style={styles.showMoreText}>
            {t('cuisineSelector.showAll')}
          </Text>
        </AppPressable>
      )}

      {!!showAll && (
        <AppPressable
          style={styles.showMoreButton}
          onPress={() => setShowAll(false)}
          accessibilityRole="button"
        >
          <Icon name="remove-circle-outline" size={18} tone="textSecondary" />
          <Text role="body" style={styles.showMoreText}>
            {t('cuisineSelector.showLess')}
          </Text>
        </AppPressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    gap: theme.spacing.md,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    justifyContent: 'space-evenly',
  },
  showMoreButton: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.pill,
    borderCurve: 'continuous',
    borderWidth: theme.borderWidth.thin,
    borderStyle: 'dashed',
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  showMoreText: {
    marginLeft: theme.spacing.xs,
  },
}));
