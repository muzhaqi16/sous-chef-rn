import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Label } from '#components/atoms/Label';

interface SegmentedControlProps<T extends string> {
  label?: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  formatLabel?: (value: T) => string;
  required?: boolean;
  testID?: string;
}

/**
 * SegmentedControl - Reusable segmented control for selecting from options
 * Generic component that works with any string enum or array of string values
 */
export const SegmentedControl = <T extends string>({
  label,
  options,
  value,
  onChange,
  formatLabel = v => v,
  required,
  testID,
}: SegmentedControlProps<T>) => {
  return (
    <View style={styles.container} testID={testID}>
      {label ? <Label required={required}>{label}</Label> : null}
      <View style={styles.segmentedControl}>
        {options.map(option => (
          <Pressable
            key={option}
            style={({pressed}) => [styles.segment, value === option && styles.segmentActive, pressed && styles.pressed]}
            onPress={() => onChange(option)}
          >
            <Text
              style={[
                styles.segmentText,
                value === option && styles.segmentTextActive,
              ]}
              numberOfLines={1}
            >
              {formatLabel(option)}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    marginBottom: theme.spacing.lg,
  },
  segmentedControl: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  segmentActive: {
    backgroundColor: theme.colors.primary,
  },
  segmentText: {
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
  },
  segmentTextActive: {
    color: theme.colors.white,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
