# API Improvements: Version Conflict Resolution

**Date:** December 15, 2025  
**Status:** Proposed  
**Priority:** High  
**Target Audience:** Backend Team

## Executive Summary

This document outlines proposed API improvements to eliminate version conflict errors that currently require complex client-side workarounds. The primary goal is to simplify client code, improve user experience, and reduce error rates in shopping list operations.

## Background

Our shopping list features use optimistic concurrency control with version fields to prevent conflicting updates. While this ensures data integrity, it creates poor user experience when version conflicts occur during common operations like:

1. Moving items to pantry
2. Toggling purchased status
3. Rapid successive toggles

The client currently implements complex workarounds (reading fresh versions from cache, conditional updates, ref tracking) to minimize these conflicts. These workarounds increase code complexity and maintenance burden.

## Current Problems

### Problem 1: Move to Pantry Requires Manual Cache Updates

**Current Flow:**

```
Client → moveShoppingItemToPantry(itemId, pantryId, removeFromList)
Server → Returns: { success: true, pantryItemId: "new-id" }
Client → Must manually:
  1. Add item to pantry cache
  2. Remove from shopping list OR update isPurchased=false
  3. Handle version increments
  4. Manage cache normalization
```

**Issues:**

- Client must duplicate server-side business logic
- Cache updates are error-prone (40+ lines of update logic)
- Difficult to maintain consistency across different screens
- Cache normalization complexity when same item exists in multiple lists

### Problem 2: Toggle Purchased Version Conflicts

**Scenario:**

```
Time 0ms:   User taps "Mark as Purchased"
            - Client sends: togglePurchased(itemId, version: 1)
            - Client optimistically shows item as purchased

Time 50ms:  User taps again to unmark (changed their mind)
            - Client sends: togglePurchased(itemId, version: 1) ← STALE
            - Server has version 2 from first toggle
            - Result: VERSION CONFLICT ERROR
```

**Current Client Workaround:**

```typescript
// Read fresh version from cache before every toggle
const cachedItem = client.readFragment({
  id: `ShoppingListItem:${itemId}`,
  fragment: ShoppingListItemFragmentDoc,
});
const currentVersion = cachedItem?.version || item.version;

await togglePurchased({
  variables: { input: { itemId, version: currentVersion } },
});
```

**Issues:**

- Requires cache fragment reads before every mutation
- Still fails if mutations overlap (network latency)
- Complex code for a simple toggle operation
- Poor user experience with error messages

### Problem 3: RemoveFromList Flag Requires Cache Coordination

**Current Flow:**

```typescript
// Must track flag in ref for cache update callback
const removeFromListRef = useRef(true);

await moveShoppingItemToPantry({
  variables: { input: { itemId, pantryId, removeFromList: true } },
  update: cache => {
    // Cache update runs AFTER mutation completes
    // Must check ref to know what to do
    if (removeFromListRef.current) {
      // Remove from shopping list
    } else {
      // Keep in list, mark unpurchased, increment version
    }
  },
});
```

**Issues:**

- Ref-based coordination between mutation and cache update
- Cache update logic must replicate server behavior
- Version management complexity
- Easy to introduce bugs when logic changes

### Problem 4: Toggle Purchased Version Conflicts

**Scenario: Rapid Toggle Operations**

```
Time 0ms:   User marks item as purchased (version 1)
            - Client sends: togglePurchased(itemId, isPurchased: true, version: 1)
            - Optimistic update shows purchased immediately
            - Server processes, increments to version 2

Time 50ms:  User changes mind, unmarks (while first request in flight)
            - Client sends: togglePurchased(itemId, isPurchased: false, version: 1) ← STALE
            - Server rejects: version conflict (expects version 2)
            - User sees error message
```

**Current Client Workaround:**

```typescript
// Read fresh version from Apollo cache before toggle
const cachedItem = client.readFragment({
  id: `ShoppingListItem:${itemId}`,
  fragment: ShoppingListItemFragmentDoc,
});
const currentVersion = cachedItem?.version || item.version;

await togglePurchased({
  variables: {
    input: {
      itemId,
      isPurchased: !currentItem.isPurchased,
      version: currentVersion,
    },
  },
});
```

**Issues:**

- Adds cache read overhead to every toggle operation
- Still fails if toggles happen faster than round-trip time
- Complex code for simple boolean toggle
- Toggle is the most frequent shopping list operation
- Poor UX when users get version conflict errors

## Proposed Solutions

### Solution 1: Return Complete State from Mutations

**Implementation:**

Update `moveShoppingItemToPantry` to return complete state:

```graphql
type MoveShoppingItemToPantryPayload {
  success: Boolean!
  pantryItem: PantryItem! # NEW: Full pantry item created
  shoppingListItem: ShoppingListItem # NEW: Updated shopping item (if kept)
  removedFromList: Boolean! # NEW: Whether item was removed
}
```

**Server Response Examples:**

When `removeFromList: true`:

```json
{
  "success": true,
  "pantryItem": {
    "id": "pantry-123",
    "name": "Tomatoes",
    "quantity": 2,
    "unit": "kg",
    "version": 1,
    "storageLocation": { "id": "fridge", "name": "Fridge" }
  },
  "shoppingListItem": null,
  "removedFromList": true
}
```

When `removeFromList: false`:

```json
{
  "success": true,
  "pantryItem": {
    /* ... */
  },
  "shoppingListItem": {
    "id": "item-456",
    "name": "Tomatoes",
    "isPurchased": false, // ← Server marks as unpurchased
    "version": 3, // ← Server increments version
    "quantity": 2
  },
  "removedFromList": false
}
```

**Client Code Simplification:**

Before (40+ lines):

```typescript
const [moveToPantry] = useMutation(MOVE_TO_PANTRY, {
  update: (cache, { data }) => {
    const pantryId = moveToPantryIdRef.current;
    const removeFromList = removeFromListRef.current;
    const item = selectedItemRef.current;

    // Add to pantry cache
    const pantryQueryId = cache.identify({
      __typename: 'Pantry',
      id: pantryId,
    });

    cache.modify({
      id: pantryQueryId,
      fields: {
        items(existingItems = []) {
          const newItemRef = cache.writeFragment({
            data: {
              __typename: 'PantryItem',
              id: data.moveShoppingItemToPantry.pantryItemId,
              name: item.name,
              quantity: item.quantity,
              unit: item.unit,
              version: 1,
              // ... 20 more fields
            },
            fragment: PantryItemFragmentDoc,
          });
          return [...existingItems, newItemRef];
        },
      },
    });

    // Handle shopping list
    if (removeFromList) {
      cache.evict({
        id: cache.identify({
          __typename: 'ShoppingListItem',
          id: item.id,
        }),
      });
    } else {
      cache.writeFragment({
        id: cache.identify({
          __typename: 'ShoppingListItem',
          id: item.id,
        }),
        fragment: ShoppingListItemFragmentDoc,
        data: {
          ...item,
          isPurchased: false,
          version: item.version + 1,
        },
      });
    }
  },
});
```

After (5 lines):

```typescript
const [moveToPantry] = useMutation(MOVE_TO_PANTRY);
// Apollo automatically updates cache with returned data
```

**Benefits:**

- Zero manual cache manipulation required
- Apollo's automatic cache update handles everything
- Eliminates 40+ lines of complex update logic
- Eliminates ref-based coordination
- Server is source of truth for version increments
- No risk of client/server state divergence

### Solution 2: Make Version Optional for Idempotent Operations

**Implementation:**

Update `toggleShoppingListItemPurchased` mutation:

```graphql
input ToggleShoppingListItemPurchasedInput {
  itemId: ID!
  version: Int # Optional - if omitted, server uses last-write-wins
}

type ShoppingListItem {
  id: ID!
  isPurchased: Boolean!
  version: Int!
  lastModified: DateTime! # NEW: For conflict detection
}
```

**Server Logic:**

```typescript
async togglePurchased(itemId: string, version?: number) {
  const item = await db.shoppingListItem.findUnique({
    where: { id: itemId }
  });

  if (version !== undefined && item.version !== version) {
    throw new VersionConflictError();
  }

  // Toggle is idempotent - just flip the boolean
  const updated = await db.shoppingListItem.update({
    where: { id: itemId },
    data: {
      isPurchased: !item.isPurchased,
      version: { increment: 1 },
      lastModified: new Date()
    }
  });

  return updated;
}
```

**Client Code Simplification:**

Before:

```typescript
const cachedItem = client.readFragment({
  id: `ShoppingListItem:${itemId}`,
  fragment: ShoppingListItemFragmentDoc,
});
const currentVersion = cachedItem?.version || item.version;

await togglePurchased({
  variables: { input: { itemId, version: currentVersion } },
});
```

After:

```typescript
await togglePurchased({
  variables: { input: { itemId } }, // No version needed
});
```

**Benefits:**

- Eliminates version conflicts for toggles
- Removes need to read from cache before mutation
- Toggle is naturally idempotent (last write wins is acceptable)
- Simpler client code
- Better user experience (no error messages)

**Trade-offs:**

- Loses strict conflict detection for toggles
- Acceptable because toggle is a simple boolean flip
- `lastModified` timestamp provides conflict detection if needed

### Solution 2A: Toggle Purchased Version Optional with State Validation

**Implementation Options:**

#### Option A: Make Version Optional + Idempotent Check (Recommended)

```graphql
input ToggleShoppingListItemPurchasedInput {
  itemId: ID!
  isPurchased: Boolean! # NEW: Client sends desired state
  version: Int # Optional
}
```

**Server Logic:**

```typescript
async togglePurchased(itemId: string, isPurchased: boolean, version?: number) {
  const item = await db.shoppingListItem.findUnique({
    where: { id: itemId }
  });

  // If already in desired state, return success (idempotent)
  if (item.isPurchased === isPurchased) {
    return item;
  }

  // If version provided and doesn't match, reject
  if (version !== undefined && item.version !== version) {
    throw new VersionConflictError();
  }

  // Update to desired state
  const updated = await db.shoppingListItem.update({
    where: { id: itemId },
    data: {
      isPurchased,
      version: { increment: 1 },
      lastModified: new Date()
    }
  });

  return updated;
}
```

**Client Code:**

```typescript
// Simple - no version needed
await togglePurchased({
  variables: {
    input: {
      itemId,
      isPurchased: !currentItem.isPurchased,
    },
  },
});
```

**Benefits:**

- Client sends desired state (explicit)
- Server handles idempotency (if already in that state, no-op)
- No version conflicts on rapid toggles
- Predictable behavior

#### Option B: Timestamp-Based Last-Write-Wins

```graphql
type ShoppingListItem {
  id: ID!
  isPurchased: Boolean!
  version: Int!
  lastModified: DateTime!
  purchasedAt: DateTime # NEW: When marked purchased
  unpurchasedAt: DateTime # NEW: When unmarked
}
```

**Server Logic:**

```typescript
async togglePurchased(itemId: string, isPurchased: boolean, clientTimestamp: Date) {
  const item = await db.shoppingListItem.findUnique({
    where: { id: itemId }
  });

  // Check if client's action is newer than last server update
  const lastUpdate = isPurchased ? item.unpurchasedAt : item.purchasedAt;
  if (lastUpdate && clientTimestamp < lastUpdate) {
    // Client's action is stale, return current state
    return item;
  }

  // Apply update
  const updated = await db.shoppingListItem.update({
    where: { id: itemId },
    data: {
      isPurchased,
      version: { increment: 1 },
      [isPurchased ? 'purchasedAt' : 'unpurchasedAt']: new Date()
    }
  });

  return updated;
}
```

**Benefits:**

- Handles out-of-order requests correctly
- No version conflicts
- Preserves user intent based on timing

**Trade-offs:**

- Relies on client/server clock sync
- More complex timestamp tracking

#### Option C: Server-Side Automatic Retry

```typescript
async togglePurchased(itemId: string, isPurchased: boolean, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const item = await db.shoppingListItem.findUnique({
        where: { id: itemId }
      });

      // Already in desired state? Success
      if (item.isPurchased === isPurchased) {
        return item;
      }

      // Try to update with current version
      const updated = await db.shoppingListItem.update({
        where: {
          id: itemId,
          version: item.version  // Optimistic locking
        },
        data: {
          isPurchased,
          version: { increment: 1 }
        }
      });

      return updated;
    } catch (error) {
      if (error.code === 'P2034' && attempt < maxRetries - 1) {
        // Version conflict, retry
        await sleep(50 * (attempt + 1));  // Exponential backoff
        continue;
      }
      throw error;
    }
  }
}
```

**Benefits:**

- Transparent to client (no changes needed)
- Handles version conflicts automatically
- Eventually consistent

**Trade-offs:**

- Server-side retry overhead
- Slightly higher latency on conflicts

**Recommendation:** Option A (version optional + idempotent check) provides the best balance of simplicity, performance, and predictability.

### Solution 3: Real-Time Subscriptions for Conflict Prevention

**Implementation:**

Add subscription for shopping list changes:

```graphql
type Subscription {
  shoppingListItemChanged(listId: ID!): ShoppingListItemChange!
}

type ShoppingListItemChange {
  item: ShoppingListItem!
  changeType: ChangeType!
  changedBy: User
}

enum ChangeType {
  UPDATED
  DELETED
  PURCHASED_TOGGLED
}
```

**Client Implementation:**

```typescript
// Subscribe to changes
useSubscription(SHOPPING_LIST_ITEM_CHANGED, {
  variables: { listId },
  onData: ({ data }) => {
    // Apollo automatically updates cache with latest version
    // Client always has current state before mutations
  },
});

// Mutations now always use fresh version
await togglePurchased({
  variables: {
    input: {
      itemId,
      version: item.version, // Always current via subscription
    },
  },
});
```

**Benefits:**

- Real-time updates from other users/devices
- Eliminates version conflicts through live sync
- Better collaborative experience
- Reduces need for polling/refetching

**Trade-offs:**

- Requires WebSocket infrastructure
- More complex server setup
- Higher server resource usage

## Implementation Priority

### Phase 1 (Week 1): Critical Fixes

1. **Solution 2A: Toggle Purchased Version Optional** ⭐ CRITICAL

   - Most frequent user operation
   - Highest user frustration when conflicts occur
   - Simple operation shouldn't require version management
   - Clear idempotent semantics
   - **Effort:** Low (2-3 hours)
   - **Impact:** High (eliminates most common version conflicts)

2. **Solution 2: Make Version Optional for Other Toggles**
   - Apply same pattern to other boolean toggles if any
   - **Effort:** Low (1 hour per toggle)
   - **Impact:** Medium

### Phase 2 (Week 2): State Management

3. **Solution 1: Return Complete State from moveShoppingItemToPantry**
   - Eliminates 40+ lines of client cache manipulation
   - Reduces maintenance burden
   - Prevents cache/server divergence
   - **Effort:** Medium (1 day)
   - **Impact:** High (code simplification + reliability)

### Phase 3 (Weeks 3-4): Real-Time Features

4. **Solution 3: Real-Time Subscriptions**
   - Enables collaborative features
   - Prevents conflicts proactively
   - Better multi-device experience
   - **Effort:** High (3-5 days)
   - **Impact:** High (UX improvement + future-proofing)

## Testing Scenarios

### Test Case 1: Rapid Toggle

```
Given: Item with version 1, isPurchased: false
When: User toggles purchased twice within 100ms
Then: Both toggles succeed, final state is isPurchased: true
```

### Test Case 2: Move to Pantry with Keep in List

```
Given: Shopping item "Tomatoes"
When: Move to pantry with removeFromList: false
Then:
  - Item exists in pantry
  - Item exists in shopping list with isPurchased: false
  - Versions are incremented correctly
  - Client cache reflects both states
```

### Test Case 3: Concurrent Updates from Multiple Devices

```
Given: Item synced across 2 devices
When: Both devices toggle purchased simultaneously
Then: Server handles gracefully, both devices sync to same final state
```

### Test Case 4: Network Latency Simulation

```
Given: 500ms artificial network delay
When: User performs 5 rapid toggles
Then: All toggles succeed, final state matches user's last action
```

## Migration Plan

1. **Backend Changes:**

   - Update mutation resolvers
   - Update GraphQL schema
   - Add tests for new behavior
   - Deploy to staging

2. **Client Changes:**

   - Remove cache manipulation code
   - Remove version tracking workarounds
   - Update mutation calls to use new schema
   - Test thoroughly on staging

3. **Rollout:**
   - Feature flag for new mutation behavior
   - Gradual rollout to 10% → 50% → 100% users
   - Monitor error rates and user feedback
   - Rollback plan if issues detected

## Success Metrics

- **Version Conflict Error Rate:** Reduce from current baseline to near-zero
- **Client Code Complexity:** Reduce mutation update logic by ~80%
- **User Experience:** Eliminate error messages for common operations
- **Development Velocity:** Faster feature implementation with simpler patterns

## Questions for Backend Team

1. Which solution should we prioritize first?
2. Are there other mutations with similar version conflict issues?
3. What's the timeline for WebSocket/subscription infrastructure?
4. Should we implement these changes behind feature flags?
5. Any concerns about breaking changes or backward compatibility?

## Appendix: Current Client Workarounds

### A. Version Reading from Cache

```typescript
const cachedItem = client.readFragment({
  id: `ShoppingListItem:${itemId}`,
  fragment: ShoppingListItemFragmentDoc,
});
const currentVersion = cachedItem?.version || item.version;
```

### B. Ref-Based Cache Coordination

```typescript
const removeFromListRef = useRef(true);
const moveToPantryIdRef = useRef<string | null>(null);

// Set refs before mutation
removeFromListRef.current = input.removeFromList;
moveToPantryIdRef.current = input.pantryId;

// Read refs in cache update callback
update: cache => {
  if (removeFromListRef.current) {
    // ...
  }
};
```

### C. Manual Cache Normalization

```typescript
cache.modify({
  id: cache.identify({ __typename: 'Pantry', id: pantryId }),
  fields: {
    items(existingItems = []) {
      const newItemRef = cache.writeFragment({
        data: {
          /* 20+ fields */
        },
        fragment: PantryItemFragmentDoc,
      });
      return [...existingItems, newItemRef];
    },
  },
});
```

These workarounds add complexity and maintenance burden that could be eliminated with the proposed API improvements.

---

**Document Version:** 1.0  
**Last Updated:** December 15, 2025  
**Next Review:** After backend team feedback
