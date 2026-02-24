import React from 'react';
import { Text, Pressable, type StyleProp, type ViewStyle } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native-unistyles';

export interface ChipOption<T> {
  key: T;
  label: string;
}

interface ChipScrollRowProps<T> {
  options: ChipOption<T>[];
  selected: T;
  onSelect: (key: T) => void;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
}

export function ChipScrollRow<T>({
  options,
  selected,
  onSelect,
  style,
  contentContainerStyle,
}: ChipScrollRowProps<T>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.chipRow, contentContainerStyle]}
      style={style}
    >
      {options.map(opt => {
        const isActive = selected === opt.key;
        return (
          <Pressable
            key={opt.label}
            onPress={() => onSelect(opt.key)}
            style={[styles.chip, isActive && styles.chipActive]}
          >
            <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create(theme => ({
  chipRow: {
    gap: theme.spacing.sm,
  },
  chip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  chipText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  chipTextActive: {
    color: theme.colors.white,
    fontWeight: theme.fonts.weight.medium,
  },
}));
