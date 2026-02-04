import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
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
    if (selectedCuisines.includes(cuisine)) {
      onRemove(cuisine);
    } else {
      setIsAdding(true);
      const success = await onAdd(cuisine);
      setIsAdding(false);
      if (!success) {
        Alert.alert('Error', 'Failed to add cuisine');
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
        {cuisinesToShow.map((cuisine) => (
          <AnimatedChip
            key={cuisine.value}
            label={cuisine.label}
            selected={selectedCuisines.includes(cuisine.value)}
            onPress={() => handleToggleCuisine(cuisine.value)}
            disabled={isAdding}
          />
        ))}

        {/* Show More/Less Button */}
        {!showAllCuisines && (
          <TouchableOpacity
            style={styles.showMoreButton}
            onPress={() => setShowAllCuisines(true)}
            disabled={isAdding}
          >
            <Icon
              library="Feather"
              name="plus-circle"
              size={18}
              color={theme.colors.primary}
            />
            <Text style={styles.showMoreText}>Show All Cuisines</Text>
          </TouchableOpacity>
        )}

        {showAllCuisines && (
          <TouchableOpacity
            style={styles.showMoreButton}
            onPress={() => setShowAllCuisines(false)}
            disabled={isAdding}
          >
            <Icon
              library="Feather"
              name="minus-circle"
              size={18}
              color={theme.colors.textSecondary}
            />
            <Text style={styles.showMoreText}>Show Less</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
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
    gap: theme.spacing.xs,
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
    fontWeight: '600',
    color: theme.colors.primary,
    marginLeft: theme.spacing.xs,
  },
}));
