import React, { useState, useLayoutEffect } from 'react';
import { View } from 'react-native';
import { Pressable } from '#components/atoms/themedComponents';
import { alertService } from '#/services/alertService';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { SPRING, TIMING } from '#/constants/animations';
import type { ShoppingListRowItem } from '#features/shoppingList/components/SortableShoppingList/types';
import { SortableShoppingList } from '#features/shoppingList/components/SortableShoppingList/SortableList';
import { Text } from '#components/atoms/Text';

interface CollapsiblePurchasedSectionProps {
  purchasedItems: ShoppingListRowItem[];
  unpurchasedCount?: number;
  onItemPress: (id: string) => void;
  onItemEdit?: (id: string) => void;
  onItemDelete?: (id: string) => void;
  onTogglePurchase?: (id: string) => void;
  onClearAll?: () => Promise<void>;
  disabled?: boolean;
  onSwipeableWillOpen?: (ref: any) => void;
  onSwipeableClose?: () => void;
  isExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}

export const CollapsiblePurchasedSection: React.FC<
  CollapsiblePurchasedSectionProps
> = ({
  purchasedItems,
  unpurchasedCount = 0,
  onItemPress,
  onItemEdit,
  onItemDelete,
  onTogglePurchase,
  onClearAll,
  disabled,
  onSwipeableWillOpen,
  onSwipeableClose,
  isExpanded: controlledIsExpanded,
  onExpandedChange,
}) => {
  // Auto-expand when all items are purchased (no unpurchased items)
  // This prevents the confusing "empty list" appearance when finishing shopping
  const [internalExpanded, setInternalExpanded] = useState(
    unpurchasedCount === 0,
  );
  const isControlled = typeof controlledIsExpanded === 'boolean';
  const expanded = isControlled
    ? (controlledIsExpanded as boolean)
    : internalExpanded;

  const setExpanded = (next: boolean) => {
    if (isControlled) {
      onExpandedChange?.(next);
    } else {
      setInternalExpanded(next);
      onExpandedChange?.(next);
    }
  };

  // Preserve expansion state and only auto-expand when completing all shopping
  // Render-time state update: detect zero threshold crossing
  const [prevUnpurchasedCount, setPrevUnpurchasedCount] =
    useState(unpurchasedCount);
  if (unpurchasedCount !== prevUnpurchasedCount) {
    const crossedZeroThreshold =
      prevUnpurchasedCount > 0 && unpurchasedCount === 0;
    setPrevUnpurchasedCount(unpurchasedCount);
    if (crossedZeroThreshold && purchasedItems.length > 0 && !expanded) {
      if (isControlled) {
        onExpandedChange?.(true);
      } else {
        setInternalExpanded(true);
        onExpandedChange?.(true);
      }
    }
    // Don't auto-collapse - preserve user's manual choice
  }

  // Animated values for chevron rotation
  const chevronRotation = useSharedValue(expanded ? 180 : 0);

  // Update chevron rotation when expanded state changes
  useLayoutEffect(() => {
    chevronRotation.set(withSpring(expanded ? 180 : 0, SPRING.EXPAND));
  }, [expanded, chevronRotation]);

  const animatedChevronStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${chevronRotation.get()}deg` }],
    };
  });

  if (purchasedItems.length === 0) {
    return null;
  }

  const handleClearAll = () => {
    alertService.alert(
      'Clear Purchased Items',
      `Delete all ${purchasedItems.length} purchased items? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (onClearAll) {
              await onClearAll();
            }
          },
        },
      ],
    );
  };

  return (
    <View key="collapsible-purchased-section" style={styles.container}>
      {/* Header */}
      <Pressable
        style={({ pressed }) => [styles.header, pressed && styles.pressed]}
        onPress={() => {
          console.log('Toggling purchased section:', !expanded);
          setExpanded(!expanded);
        }}
      >
        <View style={styles.headerLeft}>
          <Icon name="checkmark-circle" size={20} tone="success" />
          <Text size="md" weight="semibold" tone="primary">
            {purchasedItems.length} Purchased
          </Text>
        </View>

        <View style={styles.headerRight}>
          {!!onClearAll && (
            <Pressable
              style={({ pressed }) => [
                styles.clearButton,
                pressed && styles.pressed,
              ]}
              onPress={() => {
                handleClearAll();
              }}
            >
              <Text
                size="sm"
                weight="semibold"
                tone="error"
                style={styles.clearButtonText}
              >
                Clear All
              </Text>
            </Pressable>
          )}
          <Animated.View style={animatedChevronStyle}>
            <Icon name="chevron-down" size={24} tone="textSecondary" />
          </Animated.View>
        </View>
      </Pressable>

      {/* Expanded List */}
      {!!expanded && (
        <Animated.View
          entering={FadeIn.duration(TIMING.STANDARD)}
          exiting={FadeOut.duration(TIMING.FAST)}
        >
          <SortableShoppingList
            items={purchasedItems}
            onItemPress={onItemPress}
            onItemEdit={onItemEdit}
            onItemDelete={onItemDelete}
            onTogglePurchase={onTogglePurchase}
            disabled={disabled}
            showsVerticalScrollIndicator={false}
            onSwipeableWillOpen={onSwipeableWillOpen}
            onSwipeableClose={onSwipeableClose}
          />
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing['3'],
    borderTopWidth: 1,
    borderBottomWidth: 1,
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  checkIcon: {
    marginRight: theme.spacing.sm,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing['3'],
  },
  clearButton: {
    paddingHorizontal: theme.spacing['3'],
    paddingVertical: theme.spacing.xs + 2,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.error + '20',
  },
  clearButtonText: {
    // text color comes from tone="error" prop
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
