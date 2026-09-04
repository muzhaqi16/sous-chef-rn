import React from 'react';
import { View } from 'react-native';
import { Pressable } from '#components/atoms/themedComponents';
import { StyleSheet } from 'react-native-unistyles';
import { formatQuantityAsFraction } from '#/utils/formatQuantity';
import { Text } from '#components/atoms/Text';

interface FractionQuickSelectProps {
  /** Numeric fraction values, e.g. [0.25, 0.5, 0.75] */
  fractions: number[];
  onSelect: (value: number) => void;
  selectedValue?: number;
  /** Unit symbol to display next to the fraction, e.g. "cup" */
  unitSymbol?: string;
  /** When true, format labels as fractions (1/4) instead of decimals (0.25) */
  displayAsFraction?: boolean;
}

const TOLERANCE = 0.001;

function formatLabel(value: number, displayAsFraction?: boolean): string {
  if (displayAsFraction) {
    return formatQuantityAsFraction(value);
  }
  return Number.isInteger(value)
    ? value.toString()
    : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

export const FractionQuickSelect: React.FC<FractionQuickSelectProps> = ({
  fractions,
  onSelect,
  selectedValue,
  unitSymbol,
  displayAsFraction,
}) => {
  if (fractions.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.chipRow}>
        {fractions.map(value => {
          const isSelected =
            selectedValue != null &&
            Math.abs(selectedValue - value) < TOLERANCE;
          const label = formatLabel(value, displayAsFraction);
          const chipLabel = unitSymbol ? `${label} ${unitSymbol}` : label;

          return (
            <Pressable
              key={value}
              style={({ pressed }) => [
                styles.chip,
                isSelected && styles.chipSelected,
                pressed && styles.chipPressed,
              ]}
              onPress={() => onSelect(value)}
            >
              <Text
                tone={isSelected ? 'accent' : 'secondary'}
                role={isSelected ? 'label' : 'caption'}
              >
                {chipLabel}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
  },
  chip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
    borderWidth: theme.borderWidth.hairline,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  chipSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.surfaceVariant,
  },
  chipPressed: {
    opacity: 0.7,
  },
}));
