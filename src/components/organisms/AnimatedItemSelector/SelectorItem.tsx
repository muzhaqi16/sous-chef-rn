import React from 'react';
import { Pressable, Text } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import Animated, { LinearTransition, FadeInUp } from 'react-native-reanimated';
import { Icon } from '#utils/iconUtils';
import type { SelectorItemProps, SelectableItem } from './types';

export const SelectorItem = <T extends SelectableItem>({
  item,
  index = 0,
  isSelected,
  onPress,
  displayProperty,
  renderCustomItem,
}: SelectorItemProps<T>) => {
  const { theme } = useUnistyles();

  if (renderCustomItem) {
    return (
      <Animated.View
        entering={FadeInUp.delay(index * 15).duration(150)}
        layout={LinearTransition}
      >
        {renderCustomItem(item, isSelected, onPress)}
      </Animated.View>
    );
  }

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 15).duration(150)}
      layout={LinearTransition}
    >
      <Pressable
        style={({pressed}) => [styles.item, isSelected && styles.selectedItem, pressed && styles.pressed]}
        onPress={onPress}
      >
        <Text style={[styles.itemText, isSelected && styles.selectedItemText]}>
          {String(item[displayProperty])}
        </Text>
        {!!isSelected && (
          <Animated.View
            entering={FadeInUp.duration(200).springify()}
            style={styles.checkIcon}
          >
            <Icon name="checkmark" size={18} color={theme.colors.primary} />
          </Animated.View>
        )}
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create(theme => ({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.sm,
  },
  selectedItem: {
    backgroundColor: theme.colors.primaryLight || '#E3F2FD',
    borderColor: theme.colors.primary,
  },
  itemText: {
    flex: 1,
    fontSize: theme.fonts.size.md,
    color: theme.colors.textPrimary,
    fontWeight: theme.fonts.weight.medium,
  },
  selectedItemText: {
    color: theme.colors.primary,
    fontWeight: theme.fonts.weight.semibold,
  },
  checkIcon: {
    marginLeft: theme.spacing.sm,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
