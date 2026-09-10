import React, { useState, useLayoutEffect } from 'react';
import { View } from 'react-native';
import { AppPressable } from '#components/atoms/AppPressable';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#/utils/iconUtils';
import { commonStyles } from '#/styles/commonStyles';

import { Text } from '#components/atoms/Text';
import { motion } from '#/theme/foundations/motion';

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
  const [expanded, setExpanded] = useState(false);

  // Chevron rotation animation
  const chevronRotation = useSharedValue(0);

  useLayoutEffect(() => {
    chevronRotation.set(withSpring(expanded ? 180 : 0, motion.spring.EXPAND));
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
      <AppPressable
        style={styles.collapsedRow}
        onPress={() => setExpanded(prev => !prev)}
      >
        <Text style={commonStyles.bottomSheetSectionLabel}>{label}</Text>
        <View style={styles.collapsedRight}>
          {selectedLabel ? (
            <Text role="bodyStrong" tone="accent">
              {selectedLabel}
            </Text>
          ) : null}
          <Animated.View style={animatedChevronStyle}>
            <Icon name="chevron-down" size={20} tone="textSecondary" />
          </Animated.View>
        </View>
      </AppPressable>
      {/* Expanded chip grid */}
      {!!expanded && (
        <Animated.View
          entering={FadeIn.duration(motion.timing.STANDARD)}
          exiting={FadeOut.duration(motion.timing.FAST)}
          style={styles.expandedContainer}
        >
          <View style={commonStyles.bottomSheetOptionContainer}>
            {options.map(option => {
              const selected = option.value === selectedValue;
              return (
                <AppPressable
                  key={option.value}
                  style={[
                    commonStyles.bottomSheetOption,
                    selected && commonStyles.bottomSheetOptionSelected,
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
                    <Icon name="checkmark" size={16} tone="primary" />
                  ) : null}
                </AppPressable>
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
  expandedContainer: {
    marginTop: theme.spacing.sm,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
