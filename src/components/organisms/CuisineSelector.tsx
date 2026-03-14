import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { alertService } from '#/services/alertService';
import { AnimatedChip } from '#/components/atoms/AnimatedChip';
import { POPULAR_CUISINES, getAllCuisineOptions } from '#/constants/cuisines';
import { Cuisine } from '#generated';
import { Icon } from '#/utils/iconUtils';
import { commonStyles } from '#/styles/commonStyles';

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
  const { theme } = useUnistyles();
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
        alertService.alert('Error', 'Failed to add cuisine');
      }
    }
  };

  // Get cuisines to display
  const cuisinesToShow = showAllCuisines
    ? getAllCuisineOptions()
    : POPULAR_CUISINES;

  return (
    <View style={styles.container}>
      <Text style={commonStyles.subtitle}>Preferred Cuisines</Text>
      <Text style={[commonStyles.bodySecondary, styles.subtitle]}>
        Select your favorite cuisines
      </Text>

      {/* Cuisine Chips Grid */}
      <View style={styles.chipGrid}>
        {cuisinesToShow.map(cuisine => (
          <AnimatedChip
            key={cuisine.value}
            label={cuisine.label}
            selected={selectedCuisines.includes(cuisine.value)}
            onPress={() => handleToggleCuisine(cuisine.value)}
          />
        ))}

        {/* Show More/Less Button */}
        {!showAllCuisines && (
          <Pressable
            style={({ pressed }) => [
              styles.showMoreButton,
              pressed && styles.pressed,
            ]}
            onPress={() => setShowAllCuisines(true)}
          >
            <Icon
              name="add-circle-outline"
              size={18}
              color={theme.colors.primary}
            />
            <Text style={styles.showMoreText}>Show All Cuisines</Text>
          </Pressable>
        )}

        {!!showAllCuisines && (
          <Pressable
            style={({ pressed }) => [
              styles.showMoreButton,
              pressed && styles.pressed,
            ]}
            onPress={() => setShowAllCuisines(false)}
          >
            <Icon
              name="remove-circle-outline"
              size={18}
              color={theme.colors.textSecondary}
            />
            <Text style={styles.showMoreText}>Show Less</Text>
          </Pressable>
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
    justifyContent: 'space-around',
  },
  showMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    margin: theme.spacing.xs,
    borderRadius: theme.radii.pill,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  showMoreText: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.primary,
    marginLeft: theme.spacing.xs,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
