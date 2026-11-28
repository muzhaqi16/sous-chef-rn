import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import {
  formatQuantityAsFraction,
  unitLabel,
  type UnitLabelSource,
} from '#utils/formatQuantity';
import { Chip } from '#components/molecules/Chip';

interface FractionQuickSelectProps {
  /** Numeric fraction values, e.g. [0.25, 0.5, 0.75] */
  fractions: number[];
  onSelect: (value: number) => void;
  selectedValue?: number;
  /** The unit shown after each fraction, e.g. "cup" */
  unit?: UnitLabelSource;
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
  unit,
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
          const unitText = unitLabel(unit, {
            quantity: value,
            notation: displayAsFraction ? 'mixed' : 'decimal',
          });
          const chipLabel = unitText ? `${label} ${unitText}` : label;

          return (
            <Chip
              key={value}
              label={chipLabel}
              selected={isSelected}
              onPress={() => onSelect(value)}
            />
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
}));
