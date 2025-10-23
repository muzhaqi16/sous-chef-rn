# Shopping List Optimization Plan

This document outlines future optimizations for cache management, offline updates, and sort order handling in the shopping list feature.

---

## 1. Add sortOrder-Aware Cache Merge Policy

### Problem
Currently `shoppingListItems` uses the generic `mergeArrayByIdIntelligent` function, which doesn't preserve sort order during optimistic updates. When the server returns items, they might be re-sorted by the server's `sortOrder`, potentially overwriting the client's optimistic order.

### Solution
Add a custom merge function specifically for `shoppingListItems` that:
- Preserves local `sortOrder` for items with optimistic updates (higher version)
- Only applies server `sortOrder` when version increments from server
- Maintains order stability during offline operations
- Respects both version-based conflict resolution AND sort order

### Implementation Location
**File:** `/src/apollo/cache.ts`

**Changes:**
```typescript
// Add new merge function
function mergeShoppingListItemsWithSortOrder(
  existing = [],
  incoming = [],
  { readField }
) {
  // 1. Use mergeArrayByIdIntelligent for version-based conflict resolution
  const merged = mergeArrayByIdIntelligent(existing, incoming, { readField });

  // 2. Sort by sortOrder (fractional indexing)
  return merged.sort((a, b) => {
    const aOrder = readField('sortOrder', a) || 'zzz';
    const bOrder = readField('sortOrder', b) || 'zzz';
    return aOrder.localeCompare(bOrder);
  });
}

// Update type policy
shoppingListItems: {
  keyArgs: ['shoppingListId'],
  merge(existing, incoming, { readField }) {
    return mergeShoppingListItemsWithSortOrder(existing, incoming, { readField });
  },
}
```

**Priority:** HIGH
**Estimated Effort:** 2 hours
**Dependencies:** None

---

## 2. Optimize Offline Queue for Move Operations (Mutation Coalescing)

### Problem
Multiple drag operations while offline create redundant mutations in the queue. For example:
- User drags Item A → position B (queued)
- User drags Item A → position C (queued)
- Result: 2 mutations in queue, but only final position matters

This creates unnecessary server load when coming back online.

### Solution
Implement mutation coalescing in the offline queue:
- Detect sequential `MoveShoppingListItem` mutations for the same `itemId`
- Merge them into a single mutation with the final position
- Keep only the most recent `afterItemId` and `beforeItemId`
- Reduces server load and network traffic when syncing

### Implementation Location
**File:** `/src/apollo/offlineQueue/queueStore.ts`

**Changes:**
```typescript
// Add to QueueStore class
addMutation(mutation: QueuedMutation): void {
  const queue = this.loadQueue();

  // Check for coalescing opportunity
  if (mutation.operationName === 'MoveShoppingListItem') {
    const itemId = mutation.variables.input.itemId;

    // Find existing move mutation for same item
    const existingIndex = queue.findIndex(
      m => m.operationName === 'MoveShoppingListItem' &&
           m.variables.input.itemId === itemId &&
           m.userId === mutation.userId
    );

    if (existingIndex !== -1) {
      // Replace existing mutation with new one (final position)
      console.log(`🔄 Coalescing move mutations for item ${itemId}`);
      queue[existingIndex] = mutation;
      this.saveQueue(queue);
      return;
    }
  }

  // Regular add logic
  if (queue.length >= 100) {
    console.warn('Queue size limit reached, removing oldest mutation');
    queue.shift();
  }

  queue.push(mutation);
  this.saveQueue(queue);
}
```

**Priority:** MEDIUM
**Estimated Effort:** 3 hours
**Dependencies:** None

---

## 3. Add Cache Eviction for Purchased Items (LRU Policy)

### Problem
Purchased items stay in the Apollo cache indefinitely, causing memory to grow over time. After marking 100+ items as purchased over weeks/months, the cache still holds all of them, consuming device memory unnecessarily.

### Solution
Implement a Least Recently Used (LRU) eviction policy specifically for purchased items:
- Keep only the last 50 purchased items in memory cache
- Evict older purchased items automatically when limit reached
- Optionally persist evicted items to MMKV for later retrieval if needed
- Only applies to purchased items (unpurchased items always kept)

### Implementation Location
**File:** `/src/apollo/cache.ts` or new `/src/apollo/cacheEviction.ts`

**Changes:**
```typescript
// Add eviction policy
function evictOldPurchasedItems(cache: ApolloCache, listId: string) {
  const PURCHASED_ITEMS_LIMIT = 50;

  cache.modify({
    fields: {
      shoppingListItems(existingRefs = [], { readField }) {
        const purchasedItems = existingRefs.filter(
          ref => readField('isPurchased', ref) === true
        );

        if (purchasedItems.length <= PURCHASED_ITEMS_LIMIT) {
          return existingRefs; // No eviction needed
        }

        // Sort by purchaseDate (oldest first)
        const sortedPurchased = [...purchasedItems].sort((a, b) => {
          const aDate = readField('purchaseDate', a) as string;
          const bDate = readField('purchaseDate', b) as string;
          return (aDate || '').localeCompare(bDate || '');
        });

        // Keep only recent items
        const toKeep = new Set(
          sortedPurchased.slice(-PURCHASED_ITEMS_LIMIT).map(ref => readField('id', ref))
        );

        // Evict old items
        const toEvict = sortedPurchased.slice(0, -PURCHASED_ITEMS_LIMIT);
        toEvict.forEach(ref => {
          const id = readField('id', ref);
          cache.evict({ id: cache.identify({ __typename: 'ShoppingListItem', id }) });
        });

        cache.gc(); // Garbage collect

        return existingRefs.filter(ref => {
          const id = readField('id', ref);
          return !readField('isPurchased', ref) || toKeep.has(id);
        });
      },
    },
  });
}

// Call after marking items as purchased
// Hook into markItemPurchased mutation's onCompleted callback
```

**Priority:** LOW (only if memory issues observed)
**Estimated Effort:** 4 hours
**Dependencies:** Monitoring to confirm memory issues exist

---

## 4. Implement Optimistic Sort Order Persistence

### Problem
User's local sort order from drag operations is lost on app restart if performed while offline. This creates a poor user experience:
1. User drags items while offline
2. User closes app
3. User reopens app
4. Items are back in old order (lost the drag changes)
5. When app comes online, queued mutations execute and restore order

### Solution
Persist optimistic `sortOrder` values to MMKV storage:
- When user drags item, save optimistic `sortOrder` to MMKV
- On app launch, check if there are queued move mutations
- If yes, restore optimistic `sortOrder` values from MMKV
- Clear persisted values after mutations successfully sync
- Tie persistence to mutation queue lifecycle

### Implementation Location
**Files:**
- `/src/apollo/offlineQueue/queueStore.ts` - Add persistence methods
- `/src/storage/mmkv.ts` - Storage key constants
- `/src/screens/shoppingList/ShoppingListMain.tsx` - Hook into mutation

**Changes:**
```typescript
// In queueStore.ts
const OPTIMISTIC_SORT_ORDER_KEY = 'apollo-optimistic-sort-orders';

class QueueStore {
  // Save optimistic sortOrder
  saveOptimisticSortOrder(itemId: string, sortOrder: string): void {
    try {
      const existing = storage.getString(OPTIMISTIC_SORT_ORDER_KEY);
      const data = existing ? JSON.parse(existing) : {};
      data[itemId] = sortOrder;
      storage.set(OPTIMISTIC_SORT_ORDER_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save optimistic sortOrder:', error);
    }
  }

  // Get all optimistic sortOrders
  getOptimisticSortOrders(): Record<string, string> {
    try {
      const data = storage.getString(OPTIMISTIC_SORT_ORDER_KEY);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error('Failed to load optimistic sortOrders:', error);
      return {};
    }
  }

  // Clear optimistic sortOrder after sync
  clearOptimisticSortOrder(itemId: string): void {
    try {
      const existing = storage.getString(OPTIMISTIC_SORT_ORDER_KEY);
      if (!existing) return;

      const data = JSON.parse(existing);
      delete data[itemId];
      storage.set(OPTIMISTIC_SORT_ORDER_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to clear optimistic sortOrder:', error);
    }
  }
}

// In ShoppingListMain.tsx - after move mutation
await moveItem({
  variables: { ... },
  optimisticResponse: { ... },
  onCompleted: () => {
    // Clear persisted sortOrder after successful sync
    queueStore.clearOptimisticSortOrder(itemId);
  }
});

// On app launch - restore optimistic sortOrders
useEffect(() => {
  const optimisticOrders = queueStore.getOptimisticSortOrders();
  if (Object.keys(optimisticOrders).length > 0) {
    // Apply to cache
    Object.entries(optimisticOrders).forEach(([itemId, sortOrder]) => {
      cache.modify({
        id: cache.identify({ __typename: 'ShoppingListItem', id: itemId }),
        fields: {
          sortOrder: () => sortOrder,
        },
      });
    });
  }
}, []);
```

**Priority:** HIGH
**Estimated Effort:** 5 hours
**Dependencies:** Offline queue must be working

---

## 5. Add Batch Move Support (Server-Dependent)

### Problem
Moving multiple items (e.g., multi-select and drag) requires multiple individual mutation calls. If a user selects 5 items and drags them to a new position, this results in 5 separate API calls.

### Solution (Conditional on Server Support)
**Step 1:** Check if server has `moveMultipleItems` or `reorderShoppingListItems` mutation
**Step 2:** If yes, implement client-side batching:
- Detect when multiple items are being moved
- Batch into single GraphQL mutation
- Update optimistic responses for all items at once

**Step 3:** If no, implement sequential optimization:
- Queue moves and execute in parallel (Promise.all)
- Use throttling/debouncing to reduce rapid-fire requests

### Implementation Location
**Files:**
- Check server schema: `/home/tani/Desktop/sous-chef-api/src/schema/`
- Client: `/src/screens/shoppingList/ShoppingListMain.tsx`

**Changes (if server supports batch):**
```typescript
// New mutation in GraphQL
mutation ReorderShoppingListItems($input: ReorderShoppingListItemsInput!) {
  reorderShoppingListItems(input: $input) {
    ...ShoppingListItemFragment
  }
}

// Client usage
const handleBatchMove = async (itemIds: string[], newPositions: Record<string, { afterId, beforeId }>) => {
  await reorderItems({
    variables: {
      input: {
        shoppingListId: listId,
        items: itemIds.map(id => ({
          itemId: id,
          afterItemId: newPositions[id].afterId,
          beforeItemId: newPositions[id].beforeId,
        })),
      },
    },
    optimisticResponse: {
      // Calculate optimistic sortOrders for all items
      ...
    },
  });
};
```

**Priority:** LOW (requires server changes first)
**Estimated Effort:** 8 hours (including server work)
**Dependencies:** Server must implement batch endpoint

---

## 6. Smart Cache Invalidation Review

### Problem
There may be remaining `refetch()` calls in the codebase that force re-fetching entire lists when unnecessary. With proper optimistic responses and `cache.modify`, most refetches can be eliminated.

### Solution
Audit codebase for unnecessary refetch calls:
- Search for all `refetch()` usage in shopping list code
- Verify each is truly needed or can be replaced with cache updates
- Remove unnecessary refetches to reduce network traffic
- Trust Apollo's normalized cache for updates

### Implementation Location
**Files to audit:**
- `/src/hooks/shoppingList/useShoppingListManagement.ts`
- `/src/screens/shoppingList/ShoppingListMain.tsx`
- Any other shopping list related components

**Search commands:**
```bash
grep -r "refetch" src/hooks/shoppingList/
grep -r "refetch" src/screens/shoppingList/
```

**Review checklist:**
- [ ] After adding item - Can use optimistic response instead?
- [ ] After removing item - Already using cache.modify ✓
- [ ] After updating item - Can use optimistic response instead?
- [ ] After moving item - Already using optimistic response ✓
- [ ] After marking purchased - Already using optimistic response ✓
- [ ] On error/retry - Refetch is appropriate ✓

**Priority:** MEDIUM
**Estimated Effort:** 2 hours
**Dependencies:** None

---

## Implementation Order (Recommended)

### Phase 1: High Priority Quick Wins (1 week)
1. **sortOrder-Aware Cache Merge** (2h) - Prevents re-sorting bugs
2. **Optimistic Sort Persistence** (5h) - Better offline UX
3. **Smart Cache Invalidation Review** (2h) - Reduce network calls

### Phase 2: Medium Priority Improvements (1 week)
4. **Mutation Coalescing** (3h) - Reduces server load
5. **Performance monitoring** - Measure impact of Phase 1

### Phase 3: Low Priority (Future)
6. **Cache Eviction** (4h) - Only if memory issues observed
7. **Batch Move Support** (8h) - Requires server changes first

---

## Testing Checklist

After implementing each optimization:

- [ ] Test online: Drag items, verify order persists
- [ ] Test offline: Drag items, go offline, verify optimistic UI
- [ ] Test offline + restart: Drag offline, close app, reopen, verify order restored
- [ ] Test conflict resolution: Two users reorder same list
- [ ] Test performance: Measure memory usage before/after
- [ ] Test queue: Verify mutations coalesce correctly
- [ ] Test cache: Verify no memory leaks from cache growth
- [ ] Test error cases: Server errors, network failures, etc.

---

## Metrics to Track

- **Cache hit rate** - % of queries served from cache
- **Network requests** - Count of API calls per session
- **Memory usage** - App memory footprint over time
- **Offline queue size** - Number of queued mutations
- **Time to sync** - How long to sync after coming online
- **User perceived latency** - Time from drag to visual update

---

## Notes

- All optimizations should be backwards compatible
- Use feature flags if rolling out incrementally
- Monitor error rates after each phase
- Consider A/B testing for cache eviction threshold
- Document any trade-offs made during implementation

---

**Last Updated:** 2025-10-23
**Status:** Planning Phase
**Owner:** TBD
