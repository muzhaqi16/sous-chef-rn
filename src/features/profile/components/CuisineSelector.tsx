import React, { useState } from 'react';
import { useTranslation } from '#/i18n';
import { View } from 'react-native';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import { alertService } from '#/services/alertService';
import { AnimatedChip } from '#components/molecules/AnimatedChip';
import {
  POPULAR_CUISINES,
  getAllCuisineOptions,
} from '#features/profile/constants/cuisines';
import { Cuisine } from '#/graphql/generated/schemaTypes';
import { Icon } from '#/utils/iconUtils';
import { commonStyles } from '#/styles/commonStyles';
import { Text } from '#components/atoms/Text';

type CuisineSelectorProps = {
  selectedCuisines: Cuisine[];
  onAdd: (cuisine: Cuisine) => Promise<boolean>;
  onRemove: (cuisine: Cuisine) => void;
};

export const CuisineSelector: React.FC<CuisineSelectorProps> = ({
  selectedCuisines,
  onAdd,
  onRemove,
}) => {
  const { t } = useTranslation();
  const [showAllCuisines, setShowAllCuisines] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const handleToggleCuisine = async (cuisine: Cuisine) => {
    if (isAdding) return;
    if (selectedCuisines.includes(cuisine)) {
      onRemove(cuisine);
    } else {
      setIsAdding(true);
      const success = await onAdd(cuisine);
      setIsAdding(false);
      if (!success) {
        alertService.alert(t('labels.error'), t('cuisineSelector.addFailed'));
      }
    }
  };

  // Get cuisines to display
  const cuisinesToShow = showAllCuisines
    ? getAllCuisineOptions()
    : POPULAR_CUISINES;

  return (
    <View style={styles.container}>
      <Text style={commonStyles.subtitle}>{t('cuisineSelector.title')}</Text>
      <Text style={[commonStyles.bodySecondary, styles.subtitle]}>
        {t('cuisineSelector.subtitle')}
      </Text>
      {/* Cuisine Chips Grid */}
      <View style={styles.chipGrid}>
        {cuisinesToShow.map(cuisine => (
          <AnimatedChip
            key={cuisine.value}
            label={t(cuisine.labelKey)}
            selected={selectedCuisines.includes(cuisine.value)}
            onPress={() => handleToggleCuisine(cuisine.value)}
          />
        ))}

        {/* Show More/Less Button */}
        {!showAllCuisines && (
          <AppPressable
            style={styles.showMoreButton}
            onPress={() => setShowAllCuisines(true)}
          >
            <Icon name="add-circle-outline" size={18} tone="primary" />
            <Text role="bodyStrong" tone="accent" style={styles.showMoreText}>
              {t('cuisineSelector.showAll')}
            </Text>
          </AppPressable>
        )}

        {!!showAllCuisines && (
          <AppPressable
            style={styles.showMoreButton}
            onPress={() => setShowAllCuisines(false)}
          >
            <Icon name="remove-circle-outline" size={18} tone="textSecondary" />
            <Text style={styles.showMoreText}>
              {t('cuisineSelector.showLess')}
            </Text>
          </AppPressable>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    marginBottom: theme.spacing.lg,
  },
  subtitle: {
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.md,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    justifyContent: 'space-evenly',
  },
  showMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    margin: theme.spacing.xs,
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
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
