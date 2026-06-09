import React from 'react';
import { View, ScrollView, type StyleProp, type ViewStyle } from 'react-native';
import { Pressable } from '#components/atoms/themedComponents';
import { StyleSheet } from 'react-native-unistyles';
import { Text } from '#components/atoms/Text';
import { Icon, type IconName } from '#utils/iconUtils';

export interface ChipOption<T> {
  key: T;
  label: string;
  icon?: IconName;
}

interface ChipScrollRowProps<T> {
  options: ChipOption<T>[];
  selected: T;
  onSelect: (key: T) => void;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Per-chip style override — e.g. a fixed height to match form inputs. */
  chipStyle?: StyleProp<ViewStyle>;
}

export function ChipScrollRow<T>({
  options,
  selected,
  onSelect,
  size = 'sm',
  style,
  contentContainerStyle,
  chipStyle,
}: ChipScrollRowProps<T>) {
  styles.useVariants({ size });
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
          <Pressable key={opt.label} onPress={() => onSelect(opt.key)}>
            <View
              style={[styles.chip, isActive && styles.chipActive, chipStyle]}
            >
              {opt.icon ? (
                <Icon
                  name={opt.icon}
                  size={size === 'md' ? 18 : 16}
                  tone={isActive ? 'primary' : 'textSecondary'}
                />
              ) : null}
              <Text
                style={[styles.chipText, isActive && styles.chipTextActive]}
              >
                {opt.label}
              </Text>
            </View>
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
    flexDirection: 'row',
    gap: theme.spacing.xs,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    variants: {
      size: {
        sm: {
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.xs,
        },
        md: {
          paddingHorizontal: theme.spacing['5'],
          paddingVertical: theme.spacing.sm,
        },
      },
    },
  },
  chipActive: {
    borderColor: theme.colors.primary,
  },
  chipText: {
    color: theme.colors.textSecondary,
    includeFontPadding: false,
    textAlignVertical: 'center',
    variants: {
      size: {
        sm: {
          fontSize: theme.fonts.size.sm,
        },
        md: {
          fontSize: theme.fonts.size.md,
        },
      },
    },
  },
  chipTextActive: {
    color: theme.colors.primary,
    fontWeight: theme.fonts.weight.medium,
  },
}));
