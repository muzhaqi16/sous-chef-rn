import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { SPRING } from '#/constants/animations';
import type { SortableShoppingListItem } from '../organisms/SortableShoppingList/types';
import { SortableShoppingList } from '../organisms/SortableShoppingList/SortableList';

interface CollapsiblePurchasedSectionProps {
  purchasedItems: SortableShoppingListItem[];
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
  const { theme } = useUnistyles();
  // Auto-expand when all items are purchased (no unpurchased items)
  // This prevents the confusing "empty list" appearance when finishing shopping
  const [internalExpanded, setInternalExpanded] = useState(
    unpurchasedCount === 0,
  );
  const isControlled = typeof controlledIsExpanded === 'boolean';
  const expanded = isControlled
    ? (controlledIsExpanded as boolean)
    : internalExpanded;

  const setExpanded = useCallback(
    (next: boolean) => {
      if (isControlled) {
        onExpandedChange?.(next);
      } else {
        setInternalExpanded(next);
        onExpandedChange?.(next);
      }
    },
    [isControlled, onExpandedChange],
  );

  // Preserve expansion state and only auto-expand when completing all shopping
  // OPTIMIZATION: Use ref to detect threshold crossing, prevent effect on every count change
  const prevUnpurchasedRef = useRef(unpurchasedCount);
  useEffect(() => {
    // Only auto-expand when crossing the zero threshold (items remaining -> all done)
    // Don't trigger on every purchase, only when last item is marked purchased
    const crossedZeroThreshold =
      prevUnpurchasedRef.current > 0 && unpurchasedCount === 0;
    if (crossedZeroThreshold && purchasedItems.length > 0 && !expanded) {
      setExpanded(true);
    }
    prevUnpurchasedRef.current = unpurchasedCount;
    // Don't auto-collapse - preserve user's manual choice
  }, [unpurchasedCount, purchasedItems.length, expanded, setExpanded]);

  // Animated values for chevron rotation
  const chevronRotation = useSharedValue(expanded ? 180 : 0);

  // Update chevron rotation when expanded state changes
  useEffect(() => {
    chevronRotation.value = withSpring(expanded ? 180 : 0, SPRING.EXPAND);
  }, [expanded, chevronRotation]);

  const animatedChevronStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${chevronRotation.value}deg` }],
    };
  });

  if (purchasedItems.length === 0) {
    return null;
  }

  const handleClearAll = () => {
    Alert.alert(
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
        style={({pressed}) => [
          styles.header,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          },
          pressed && styles.pressed,
        ]}
        onPress={() => {
          console.log('Toggling purchased section:', !expanded);
          setExpanded(!expanded);
        }}
      >
        <View style={styles.headerLeft}>
          <Icon name="checkmark-circle" size={20} color={theme.colors.success} />
          <Text
            style={[styles.headerText, { color: theme.colors.textPrimary }]}
          >
            {purchasedItems.length} Purchased
          </Text>
        </View>

        <View style={styles.headerRight}>
          {onClearAll && (
            <Pressable
              style={({pressed}) => [
                styles.clearButton,
                { backgroundColor: theme.colors.error + '20' },
                pressed && styles.pressed,
              ]}
              onPress={e => {
                e.stopPropagation();
                handleClearAll();
              }}
            >
              <Text
                style={[styles.clearButtonText, { color: theme.colors.error }]}
              >
                Clear All
              </Text>
            </Pressable>
          )}
          <Animated.View style={animatedChevronStyle}>
            <Icon
              name="chevron-down"
              size={24}
              color={theme.colors.textSecondary}
            />
          </Animated.View>
        </View>
      </Pressable>

      {/* Expanded List */}
      {expanded && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
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
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  checkIcon: {
    marginRight: theme.spacing.sm,
  },
  headerText: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.fonts.weight.semibold,
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
  },
  clearButtonText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.fonts.weight.semibold,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
