import React, { useState, useLayoutEffect } from 'react';
import { View, Text } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#/utils/iconUtils';
import { commonStyles } from '#/styles/commonStyles';
import { SPRING, TIMING } from '#/constants/animations';

interface CollapsibleChipPickerProps<T extends string> {
  label: string;
  options: Array<{ label: string; value: T }>;
  selectedValue: T;
  onSelect: (value: T) => void;
}

export const CollapsibleChipPicker = <T extends string>({
  label,
  options,
  selectedValue,
  onSelect,
}: CollapsibleChipPickerProps<T>) => {
  const { theme } = useUnistyles();
  const [expanded, setExpanded] = useState(false);

  // Chevron rotation animation
  const chevronRotation = useSharedValue(0);

  useLayoutEffect(() => {
    chevronRotation.set(withSpring(expanded ? 180 : 0, SPRING.EXPAND));
  }, [expanded, chevronRotation]);

  const animatedChevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRotation.get()}deg` }],
  }));

  // Find selected option label for collapsed display
  const selectedLabel = options.find(o => o.value === selectedValue)?.label;

  // Auto-collapse after selecting a different option
  const handleSelect = (value: T) => {
    if (value !== selectedValue) {
      onSelect(value);
      setExpanded(false);
    }
  };

  return (
    <View style={commonStyles.bottomSheetSection}>
      {/* Collapsed header row */}
      <Pressable
        style={({ pressed }) => [
          styles.collapsedRow,
          pressed && styles.pressed,
        ]}
        onPress={() => setExpanded(prev => !prev)}
      >
        <Text style={commonStyles.bottomSheetSectionLabel}>{label}</Text>
        <View style={styles.collapsedRight}>
          {selectedLabel ? (
            <Text style={styles.selectedText}>{selectedLabel}</Text>
          ) : null}
          <Animated.View style={animatedChevronStyle}>
            <Icon
              name="chevron-down"
              size={20}
              color={theme.colors.textSecondary}
            />
          </Animated.View>
        </View>
      </Pressable>

      {/* Expanded chip grid */}
      {!!expanded && (
        <Animated.View
          entering={FadeIn.duration(TIMING.STANDARD)}
          exiting={FadeOut.duration(TIMING.FAST)}
          style={styles.expandedContainer}
        >
          <View style={commonStyles.bottomSheetOptionContainer}>
            {options.map(option => {
              const selected = option.value === selectedValue;
              return (
                <Pressable
                  key={option.value}
                  style={({ pressed }) => [
                    commonStyles.bottomSheetOption,
                    selected && commonStyles.bottomSheetOptionSelected,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => handleSelect(option.value)}
                >
                  <Text
                    style={[
                      commonStyles.bottomSheetOptionText,
                      selected && commonStyles.bottomSheetOptionTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                  {selected ? (
                    <Icon
                      name="checkmark"
                      size={16}
                      color={theme.colors.primary}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  collapsedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  collapsedRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  selectedText: {
    fontSize: theme.fonts.size.base,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.primary,
  },
  expandedContainer: {
    marginTop: theme.spacing.sm,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
