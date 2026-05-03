import { Pressable } from 'react-native-gesture-handler';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import Animated, { LinearTransition, FadeInUp } from 'react-native-reanimated';
import { Icon } from '#utils/iconUtils';
import type { SelectorItemProps, SelectableItem } from './types';
import { Text } from '#components/atoms/Text';

const SelectorItemComponent = <T extends SelectableItem>({
  item,
  isSelected,
  onSelect,
  displayProperty,
  renderCustomItem,
}: SelectorItemProps<T>) => {
  const { theme } = useUnistyles();

  const handlePress = () => onSelect(item.id, item);

  if (renderCustomItem) {
    return (
      <Animated.View layout={LinearTransition}>
        {renderCustomItem(item, isSelected, handlePress)}
      </Animated.View>
    );
  }

  return (
    <Animated.View layout={LinearTransition}>
      <Pressable
        style={({ pressed }) => [
          styles.item,
          isSelected && styles.selectedItem,
          pressed && styles.pressed,
        ]}
        onPress={handlePress}
      >
        <Text
          size="md"
          weight={isSelected ? 'semibold' : 'medium'}
          style={[styles.itemText, isSelected && styles.selectedItemText]}
        >
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

export const SelectorItem = SelectorItemComponent;

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
  },
  selectedItemText: {
    color: theme.colors.primary,
  },
  checkIcon: {
    marginLeft: theme.spacing.sm,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
