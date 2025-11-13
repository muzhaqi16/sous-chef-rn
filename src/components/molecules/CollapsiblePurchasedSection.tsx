import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils';
import type { SortableShoppingListItem } from '../organisms/SortableShoppingList';
import { SortableShoppingList } from '../organisms/SortableShoppingList';

interface CollapsiblePurchasedSectionProps {
  purchasedItems: SortableShoppingListItem[];
  unpurchasedCount?: number;
  onItemPress: (id: string) => void;
  onItemEdit?: (id: string) => void;
  onItemDelete?: (id: string) => void;
  onTogglePurchase?: (id: string) => void;
  onSortOrderUpdate?: (
    itemId: string,
    afterItemId: string | null,
    beforeItemId: string | null,
  ) => Promise<void>;
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
  onSortOrderUpdate,
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
    const crossedZeroThreshold = prevUnpurchasedRef.current > 0 && unpurchasedCount === 0;
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
    chevronRotation.value = withSpring(expanded ? 180 : 0, {
      damping: 20,
      stiffness: 200,
    });
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
    <View style={styles.container}>
      {/* Header */}
      <TouchableOpacity
        style={[
          styles.header,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          },
        ]}
        onPress={() => {
          console.log('Toggling purchased section:', !expanded);
          setExpanded(!expanded);
        }}
        activeOpacity={0.7}
      >
        <View style={styles.headerLeft}>
          <Icon name="check-circle" size={20} color={theme.colors.success} />
          <Text
            style={[styles.headerText, { color: theme.colors.textPrimary }]}
          >
            {purchasedItems.length} Purchased
          </Text>
        </View>

        <View style={styles.headerRight}>
          {onClearAll && (
            <TouchableOpacity
              style={[
                styles.clearButton,
                { backgroundColor: theme.colors.error + '20' },
              ]}
              onPress={e => {
                e.stopPropagation();
                handleClearAll();
              }}
              activeOpacity={0.7}
            >
              <Text
                style={[styles.clearButtonText, { color: theme.colors.error }]}
              >
                Clear All
              </Text>
            </TouchableOpacity>
          )}
          <Animated.View style={animatedChevronStyle}>
            <Icon
              name="expand-more"
              size={24}
              color={theme.colors.textSecondary}
            />
          </Animated.View>
        </View>
      </TouchableOpacity>

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
            onSortOrderUpdate={onSortOrderUpdate}
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

const styles = StyleSheet.create(() => ({
  container: {
    marginTop: 8,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  checkIcon: {
    marginRight: 8,
  },
  headerText: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
}));
