# FlashList Optimization & Drag-to-Reorder Implementation

This document details all changes made to optimize the FlashList implementation and add drag-to-reorder functionality for the shopping list.

## Table of Contents
1. [Overview](#overview)
2. [Issues Found](#issues-found)
3. [Files Modified](#files-modified)
4. [Detailed Changes](#detailed-changes)
5. [How to Apply Changes](#how-to-apply-changes)

---

## Overview

### Goals
- Optimize FlashList following Shopify FlashList v2 best practices
- Add drag-to-reorder functionality for unpurchased shopping list items
- Fix ghost/empty items appearing when toggling purchase status
- Fix checkbox state management issues

### Key Features Added
- Long-press (200ms) to activate drag on any unpurchased item
- Scale animation (1.03x) when drag is activated
- Shadow interpolation during drag
- Haptic feedback on drag start and drop
- Items snap back with spring animation on drop

---

## Issues Found

### Issue 1: Ghost/Empty Items When Toggling Purchase Status
**Symptom:** Empty card items appeared in the list when marking items as purchased.

**Root Cause:** In `useShoppingListItemMutations.ts`, the `cache.readFragment()` call was returning `null` during optimistic updates. The code was falling back to `{ id: itemId }` which created incomplete cache references, resulting in ghost items.

**Fix:** Use the `items` array from the closure as the primary source for item data, with `cache.readFragment` as a fallback.

### Issue 2: Deprecated `runOnJS` API
**Symptom:** TypeScript warning about deprecated API.

**Root Cause:** `runOnJS` from react-native-reanimated is deprecated.

**Fix:** Replace with `scheduleOnRN` from `react-native-worklets`.

### Issue 3: React Hooks Rules Violation
**Symptom:** ESLint errors about hooks being called conditionally.

**Root Cause:** Early return guard for invalid items was placed BEFORE hooks were called, violating React's Rules of Hooks.

**Fix:** Move the early return AFTER all hooks are called.

### Issue 4: Type Mismatch in useItemReordering
**Symptom:** TypeScript error about missing `version` property.

**Root Cause:** `useItemReordering` hook expects items with `version` field (from GraphQL), but was receiving transformed items (without `version`).

**Fix:** Expose `rawUnpurchasedItems` from `useShoppingListScreen` and use it for the reordering hook.

### Issue 5: Wrong Import Path for HapticService
**Symptom:** Module not found error.

**Root Cause:** Import path was `#/services/haptics` (with 's') instead of `#/services/haptic`.

**Fix:** Correct the import path.

---

## Files Modified

| File | Changes |
|------|---------|
| `src/components/organisms/SortableShoppingList/SortableItem.tsx` | Added drag gesture, scaling, haptics, fixed hooks order |
| `src/components/organisms/SortableShoppingList/SortableList.tsx` | Added reorder handler, valid items filtering |
| `src/components/organisms/SortableShoppingList/SortableListActionsContext.tsx` | Added reorder actions and permissions |
| `src/components/organisms/SortableShoppingList/types.ts` | Added reorder props |
| `src/components/molecules/ListItem.tsx` | Added `dragHandleElement` prop |
| `src/hooks/shoppingList/useShoppingListItemMutations.ts` | Fixed ghost items issue |
| `src/hooks/shoppingList/useShoppingListTransform.ts` | Added filtering for invalid items |
| `src/hooks/shoppingList/useShoppingListScreen.ts` | Exposed `rawUnpurchasedItems` |
| `src/screens/shoppingList/ShoppingListMain.tsx` | Wired up reordering hook |
| `src/components/organisms/ShoppingListTabs/index.tsx` | Pass through reorder props |
| `src/components/organisms/ShoppingListTabs/ShoppingTab.tsx` | Pass through reorder props |

---

## Detailed Changes

### 1. SortableItem.tsx

#### Add Imports
```typescript
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import { HapticService } from '#/services/haptic';
```

#### Add Constants
```typescript
// Approximate item height for drag calculations (87px content + 16px margin)
const ITEM_HEIGHT = 103;

// Drag animation constants
const DRAG_SCALE = 1.03;
const DRAG_SHADOW_OPACITY = 0.25;
```

#### Add Drag State (inside component, after getting permissions)
```typescript
// Drag state for reordering
const isDragging = useSharedValue(false);
const translateY = useSharedValue(0);
const scale = useSharedValue(1);
```

#### Add Drag End Handler
```typescript
// Calculate new position and call reorder callback
const handleDragEnd = useCallback(
  (finalTranslateY: number) => {
    if (!onReorderByDelta) return;

    // Calculate how many positions to move based on drag offset
    const positionDelta = Math.round(finalTranslateY / ITEM_HEIGHT);
    if (positionDelta === 0) return; // No movement

    // Calculate new index, clamped to valid range
    const newIndex = Math.max(0, Math.min(totalItems - 1, index + positionDelta));
    if (newIndex === index) return; // Same position

    // Call the parent callback with the delta - it will convert to neighbor IDs
    HapticService.medium();
    onReorderByDelta(item.id, positionDelta);
  },
  [index, totalItems, item.id, onReorderByDelta],
);
```

#### Add Pan Gesture
```typescript
// Pan gesture for drag-to-reorder
const panGesture = useMemo(
  () =>
    Gesture.Pan()
      .enabled(!item.isPurchased && canReorderItems && !!onReorderByDelta)
      .activateAfterLongPress(200) // Long press to activate
      .onStart(() => {
        'worklet';
        isDragging.value = true;
        scale.value = withSpring(DRAG_SCALE, { damping: 15, stiffness: 400 });
        scheduleOnRN(HapticService.light);
      })
      .onUpdate((event) => {
        'worklet';
        translateY.value = event.translationY;
      })
      .onEnd((event) => {
        'worklet';
        isDragging.value = false;
        const finalY = event.translationY;
        translateY.value = withSpring(0, { damping: 20, stiffness: 300 });
        scale.value = withSpring(1, { damping: 15, stiffness: 400 });
        scheduleOnRN(() => handleDragEnd(finalY));
      })
      .onFinalize(() => {
        'worklet';
        isDragging.value = false;
        translateY.value = withSpring(0, { damping: 20, stiffness: 300 });
        scale.value = withSpring(1, { damping: 15, stiffness: 400 });
      }),
  [item.isPurchased, canReorderItems, onReorderByDelta, isDragging, translateY, scale, handleDragEnd],
);
```

#### Add Animated Style for Drag
```typescript
// Animated style for drag offset with scale and shadow
const dragAnimatedStyle = useAnimatedStyle(() => {
  const shadowOpacity = interpolate(
    scale.value,
    [1, DRAG_SCALE],
    [0.1, DRAG_SHADOW_OPACITY],
  );

  return {
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    zIndex: isDragging.value ? 999 : 0,
    shadowOpacity,
    elevation: isDragging.value ? 12 : 4,
  };
});
```

#### Add Drag Handle Element
```typescript
// Create drag handle element for reordering
// Only shown for unpurchased items when reordering is enabled
const dragHandleElement = React.useMemo(() => {
  if (item.isPurchased || !canReorderItems || !onReorderByDelta) return null;

  return (
    <View style={styles.dragHandle}>
      <Icon
        name="drag-indicator"
        size={20}
        color={themeColors?.textSecondary}
        library="MaterialIcons"
      />
    </View>
  );
}, [item.isPurchased, canReorderItems, onReorderByDelta, themeColors]);
```

#### Move Early Return AFTER All Hooks
```typescript
// Safety guard: skip rendering if item is invalid (prevents empty items)
// NOTE: This check must come AFTER all hooks to comply with Rules of Hooks
if (!item?.id || !item?.title) {
  if (__DEV__) {
    console.warn('⚠️ SortableItem: Invalid item data, skipping render');
  }
  return null;
}
```

#### Update JSX - Apply Drag Style and Wrap with GestureDetector
```typescript
// Determine if drag is enabled for this item
const isDragEnabled = !item.isPurchased && canReorderItems && !!onReorderByDelta;

// In Animated.View style array, add:
isDragEnabled && dragAnimatedStyle,

// Pass dragHandleElement to ListItem:
<ListItem
  // ... other props
  dragHandleElement={dragHandleElement}
/>

// Wrap with gesture detector if drag is enabled
if (isDragEnabled) {
  return (
    <GestureDetector gesture={panGesture}>
      {itemContent}
    </GestureDetector>
  );
}

return itemContent;
```

#### Add Drag Handle Style
```typescript
dragHandle: {
  paddingVertical: theme.spacing.sm,
  paddingHorizontal: theme.spacing.xs,
  justifyContent: 'center',
  alignItems: 'center',
},
```

---

### 2. SortableList.tsx

#### Add Ref for Valid Items
```typescript
// Keep valid items in ref for reorder callback to access current values
const validItemsRef = useRef<SortableShoppingListItem[]>([]);
```

#### Add Reorder Handler
```typescript
// Handle reorder by index delta - converts to neighbor IDs and calls onSortOrderUpdate
const handleReorderByDelta = useCallback(
  (itemId: string, indexDelta: number) => {
    if (!onSortOrderUpdate || indexDelta === 0) return;

    const currentItems = validItemsRef.current;
    const currentIndex = currentItems.findIndex(item => item.id === itemId);
    if (currentIndex === -1) return;

    // Calculate new index, clamped to valid range
    const newIndex = Math.max(0, Math.min(currentItems.length - 1, currentIndex + indexDelta));
    if (newIndex === currentIndex) return;

    // Calculate neighbor IDs for the new position
    let afterItemId: string | null = null;
    let beforeItemId: string | null = null;

    if (indexDelta > 0) {
      // Moving down
      afterItemId = currentItems[newIndex]?.id ?? null;
      beforeItemId = newIndex < currentItems.length - 1 ? currentItems[newIndex + 1]?.id ?? null : null;
    } else {
      // Moving up
      afterItemId = newIndex > 0 ? currentItems[newIndex - 1]?.id ?? null : null;
      beforeItemId = currentItems[newIndex]?.id ?? null;
    }

    console.log(`📦 Reorder: ${itemId} from ${currentIndex} to ${newIndex}, after=${afterItemId}, before=${beforeItemId}`);
    onSortOrderUpdate(itemId, afterItemId, beforeItemId);
  },
  [onSortOrderUpdate],
);
```

#### Add to Actions Object
```typescript
const actions = useMemo<SortableListActions>(
  () => ({
    // ... existing actions
    onSortOrderUpdate,
    onReorderByDelta: handleReorderByDelta,
  }),
  [/* ... existing deps */, onSortOrderUpdate, handleReorderByDelta],
);
```

#### Filter Invalid Items
```typescript
// Filter out invalid items to prevent empty card renders
const validItems = useMemo(
  () => items.filter(item => item?.id && item?.title),
  [items],
);

// Keep ref in sync for reorder callback
validItemsRef.current = validItems;
```

---

### 3. SortableListActionsContext.tsx

#### Add to SortableListActions Interface
```typescript
export interface SortableListActions {
  // ... existing actions
  onSortOrderUpdate?: (itemId: string, afterItemId: string | null, beforeItemId: string | null) => void;
  onReorderByDelta?: (itemId: string, indexDelta: number) => void;
}
```

#### Add to SortableListPermissions Interface
```typescript
export interface SortableListPermissions {
  // ... existing permissions
  canReorderItems?: boolean;
}
```

---

### 4. types.ts (SortableShoppingList)

#### Add Props
```typescript
export interface SortableShoppingListProps {
  // ... existing props
  onSortOrderUpdate?: (itemId: string, afterItemId: string | null, beforeItemId: string | null) => void;
  canReorderItems?: boolean;
}
```

---

### 5. ListItem.tsx

#### Add Prop
```typescript
interface ListItemProps {
  // ... existing props
  dragHandleElement?: React.ReactNode;
}
```

#### Render Drag Handle (before checkbox)
```typescript
const content = (
  <>
    {/* Optional drag handle element (for reordering) */}
    {dragHandleElement}
    {/* Optional checkbox element */}
    {checkboxElement && (
      <View style={styles.checkboxContainer}>{checkboxElement}</View>
    )}
    {/* ... rest of content */}
  </>
);
```

---

### 6. useShoppingListItemMutations.ts

#### Fix Ghost Items Issue (in toggleItem update function)
```typescript
// Get the full item data from the items array (closure) - this is more reliable than
// cache.readFragment which can return null during optimistic updates
const itemFromArray = items.find(i => i.id === itemId);

// Fallback to cache read if not found in array (edge case)
const fullItem = itemFromArray || cache.readFragment<ShoppingListItemDisplayFragment>({
  id: cache.identify({ __typename: 'ShoppingListItem', id: itemId }),
  fragment: ShoppingListItemDisplayFragmentDoc,
  fragmentName: 'ShoppingListItemDisplayFragment',
});

// Only proceed if we have valid item data to prevent ghost/empty items
if (!fullItem || !fullItem.itemName) {
  console.warn('⚠️ Toggle purchase: Item data missing, skipping aliased field update for', itemId);
  return;
}
```

---

### 7. useShoppingListTransform.ts

#### Add Filtering for Invalid Items
```typescript
const sortableItems = useMemo((): SortableShoppingListItem[] => {
  return items
    .filter((item) => {
      // Skip items without ID or name (invalid/corrupt data)
      if (!item.id || !item.itemName) {
        if (__DEV__) {
          console.warn('⚠️ Skipping invalid shopping list item:', item.id);
        }
        return false;
      }
      return true;
    })
    .map((item): SortableShoppingListItem => {
      // ... existing mapping logic
    });
}, [items, forcePurchasedState]);
```

---

### 8. useShoppingListScreen.ts

#### Expose Raw Unpurchased Items
```typescript
return {
  // ... existing returns
  // Raw items (for hooks that need GraphQL fragment fields like version)
  rawUnpurchasedItems,
};
```

---

### 9. ShoppingListMain.tsx

#### Destructure Raw Items
```typescript
const {
  // ... existing destructuring
  rawUnpurchasedItems,
} = useShoppingListScreen();
```

#### Use Raw Items for Reordering Hook
```typescript
// Use raw items (with version field) for reordering - transformed items don't have version
const { handleSortOrderUpdate: reorderItem } = useItemReordering({
  listId: currentListId,
  items: rawUnpurchasedItems, // Only unpurchased items can be reordered
  refetch: refetchItems,
});
```

#### Add Wrapper Callback
```typescript
// Wrapper to match the simpler callback signature used by the list component
const handleSortOrderUpdate = useCallback(
  (itemId: string, afterItemId: string | null, beforeItemId: string | null) => {
    reorderItem(itemId, afterItemId, beforeItemId, null, null);
  },
  [reorderItem],
);
```

#### Pass to List Component
```typescript
<ShoppingListTabs
  // ... other props
  onSortOrderUpdate={handleSortOrderUpdate}
  canReorderItems={permissions.canReorderItems}
/>
```

---

### 10. ShoppingListTabs/index.tsx & ShoppingTab.tsx

#### Pass Through Props
```typescript
// In index.tsx
<ShoppingTab
  // ... other props
  onSortOrderUpdate={onSortOrderUpdate}
  canReorderItems={canReorderItems}
/>

// In ShoppingTab.tsx - pass to SortableShoppingList
<SortableShoppingList
  // ... other props
  onSortOrderUpdate={onSortOrderUpdate}
  canReorderItems={canReorderItems}
/>
```

---

## How to Apply Changes

1. **Checkout your branch:**
   ```bash
   git checkout test-flashlist
   ```

2. **Apply changes in this order:**
   - Types first (`types.ts`, `SortableListActionsContext.tsx`)
   - Context/hooks (`useShoppingListScreen.ts`, `useShoppingListItemMutations.ts`, `useShoppingListTransform.ts`)
   - Components (`ListItem.tsx`, `SortableItem.tsx`, `SortableList.tsx`)
   - Screen (`ShoppingListMain.tsx`)
   - Tab components (`ShoppingListTabs/index.tsx`, `ShoppingTab.tsx`)

3. **Run verification:**
   ```bash
   npm run typecheck
   npm run lint
   ```

4. **Test the implementation:**
   - Long-press on an unpurchased item to activate drag
   - Drag up/down to reorder
   - Release to drop (should snap back with animation)
   - Toggle items between purchased/unpurchased (no ghost items should appear)

---

## Commits Reference

```
a9b2514 Fix linting and type errors in FlashList/drag implementation
e1806d5 Replace deprecated runOnJS with scheduleOnRN from react-native-worklets
4054659 Fix ghost/empty items when toggling purchase status
baab3ed Add drag scaling effect and fix empty items issue
1cb0000 Optimize FlashList and add drag-to-reorder for shopping list
```
