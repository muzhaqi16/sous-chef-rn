# Token Refresh Cache Protection System

This system prevents cache updates during token refresh and provides smooth UI feedback to users during authentication renewal.

## 🎯 **Problem Solved**

- ✅ **No more double reloads** - Token refresh automatically retries all failed requests
- ✅ **No UI flashing** - Cache updates are blocked during token refresh
- ✅ **Better UX** - Users see smooth loading states instead of errors
- ✅ **Data consistency** - Prevents partial/inconsistent cache updates

## 🏗️ **Architecture**

### Core Components

1. **`tokenRefreshStateManager`** - Manages global token refresh state
2. **`SafeCacheOperations`** - Protected cache operations that respect refresh state
3. **`useTokenRefreshUI`** - React hooks for UI state management
4. **`TokenRefreshIndicator`** - UI components for visual feedback

### File Structure

```
src/storage/
├── tokenRefreshStateManager.ts  # Global state management
├── cacheProtection.ts          # Safe cache operations
└── README_TokenRefreshCacheProtection.md

src/hooks/auth/
└── useTokenRefreshUI.ts        # React hooks

src/components/auth/
└── TokenRefreshIndicator.tsx   # UI components

src/apollo/links/
├── refreshToken.ts            # Enhanced with state management
└── errorLink.ts              # Simplified debouncing
```

## 🚀 **Quick Start**

### 1. Basic Integration

Replace direct cache operations with protected ones:

```typescript
// ❌ Before (vulnerable to token refresh interruptions)
import { shoppingListStorage } from '#storage/shoppingListCache';

const updateItems = (items) => {
  shoppingListStorage.setShoppingListItems(listId, items);
  setLocalItems(items);
};

// ✅ After (protected from token refresh interruptions)
import { SafeCacheOperations } from '#storage/cacheProtection';
import { useProtectedCacheOperation } from '#hooks/auth/useTokenRefreshUI';

const executeProtected = useProtectedCacheOperation();

const updateItems = (items) => {
  const success = executeProtected(() =>
    SafeCacheOperations.setShoppingListItems(listId, items),
    'updateShoppingListItems'
  );

  if (success) {
    setLocalItems(items);
  }
};
```

### 2. Add UI Feedback

Add the token refresh indicator to your app:

```typescript
// In your main app component
import { TokenRefreshBanner } from '#components/auth/TokenRefreshIndicator';

export const App = () => {
  return (
    <View style={{ flex: 1 }}>
      <TokenRefreshBanner />
      {/* Your app content */}
    </View>
  );
};
```

### 3. Use in Data Hooks

Update your data hooks to use protected operations:

```typescript
import { useProtectedCacheOperation } from '#hooks/auth/useTokenRefreshUI';
import { SafeCacheOperations } from '#storage/cacheProtection';

export const useMyDataHook = () => {
  const executeProtected = useProtectedCacheOperation();

  const updateCache = useCallback((data) => {
    const success = executeProtected(() =>
      SafeCacheOperations.setShoppingLists(data),
      'updateShoppingLists'
    );

    if (success) {
      setLocalData(data);
    }
  }, [executeProtected]);

  // ... rest of hook
};
```

## 📋 **Available APIs**

### State Management

```typescript
import { tokenRefreshStateManager } from '#storage/tokenRefreshStateManager';

// Check if currently refreshing
const isRefreshing = tokenRefreshStateManager.isRefreshing();

// Get full state
const state = tokenRefreshStateManager.getState();

// Subscribe to changes
const unsubscribe = tokenRefreshStateManager.subscribe((state) => {
  console.log('Refresh state changed:', state);
});
```

### Safe Cache Operations

```typescript
import { SafeCacheOperations } from '#storage/cacheProtection';

// Shopping List Operations
SafeCacheOperations.setShoppingLists(lists, userId);
SafeCacheOperations.updateShoppingList(updatedList);
SafeCacheOperations.setShoppingListItems(listId, items);
SafeCacheOperations.updateShoppingListItem(listId, item);
SafeCacheOperations.markItemPurchased(listId, itemId, true);

// Pantry Operations
SafeCacheOperations.setPantryItems(pantryId, items);
SafeCacheOperations.updatePantryItem(pantryId, item);
SafeCacheOperations.removePantryItem(pantryId, itemId);

// Read Operations (always allowed)
SafeCacheOperations.getShoppingLists();
SafeCacheOperations.getShoppingListItems(listId);
SafeCacheOperations.getPantryItems(pantryId);

// Generic Protection
SafeCacheOperations.executeProtected(() => {
  // Your cache operation
}, 'operationName', 'context');
```

### React Hooks

```typescript
import {
  useTokenRefreshUI,
  useTokenRefreshAwareUI,
  useShouldPreventCacheUpdates,
  useProtectedCacheOperation
} from '#hooks/auth/useTokenRefreshUI';

// Basic UI state
const { isRefreshing, showRefreshIndicator } = useTokenRefreshUI();

// Advanced UI state with helpers
const {
  shouldShowLoadingSpinner,
  shouldDisableUserActions,
  getRefreshStatusMessage,
  queuedOperationsCount
} = useTokenRefreshAwareUI();

// Simple protection check
const shouldPrevent = useShouldPreventCacheUpdates();

// Protected operation executor
const executeProtected = useProtectedCacheOperation();
```

### UI Components

```typescript
import {
  TokenRefreshIndicator,
  TokenRefreshBanner,
  TokenRefreshOverlay
} from '#components/auth/TokenRefreshIndicator';

// Simple banner at top
<TokenRefreshBanner />

// Custom positioned indicator
<TokenRefreshIndicator
  position="bottom"
  showMessage={true}
  style={customStyles}
/>

// Full screen overlay (for critical operations)
<TokenRefreshOverlay />
```

## 🔧 **Configuration**

### Customizing Refresh Indicator Delay

Modify the delay before showing the refresh indicator:

```typescript
// In useTokenRefreshUI.ts, line ~25
// Show indicator after 300ms to avoid flashing for quick refreshes
refreshIndicatorTimeoutRef.current = setTimeout(() => {
  setShowRefreshIndicator(true);
}, 300); // ← Adjust this value
```

### Adding Custom Cache Operations

Extend `SafeCacheOperations` for your custom cache operations:

```typescript
// In cacheProtection.ts
static customOperation(data: any): boolean {
  if (this.shouldBlockOperation()) {
    this.logBlockedOperation('customOperation', 'custom context');
    return false;
  }

  // Your custom cache logic here
  yourCustomCacheStorage.set(data);
  return true;
}
```

## 🐛 **Debugging**

### Enable Debug Logs

The system provides comprehensive logging:

```
🔄 Auth error detected for GetShoppingList, attempting token refresh
🔄 Starting token refresh for GetShoppingList
⏳ Token refresh in progress, queuing GetUserProfile
🔄 Token refresh completed, notifying 2 waiting requests
🔄 Retrying queued operation GetUserProfile with new token
✅ Token refresh successful, retrying GetShoppingList
```

### Debug Information

Get debug info programmatically:

```typescript
// Token refresh state debug info
const debugInfo = tokenRefreshStateManager.getDebugInfo();
console.log('Token refresh debug:', debugInfo);

// Cache protection status
const protection = SafeCacheOperations.getProtectionStatus();
console.log('Cache protection:', protection);
```

### Common Issues

1. **"Cache operation blocked" messages** - This is normal during token refresh
2. **UI not updating during refresh** - Check if you're using protected cache operations
3. **Multiple refresh attempts** - Check that debouncing is properly removed from errorLink.ts

## 📊 **Performance Impact**

- **Minimal overhead** - State checks are O(1) operations
- **Memory efficient** - Subscriber pattern, cleanup on unmount
- **Network optimized** - Prevents duplicate requests during refresh
- **Storage efficient** - State persisted in MMKV with minimal data

## 🔄 **Migration Guide**

### From Direct Cache Operations

```typescript
// Before
shoppingListStorage.setShoppingListItems(listId, items);

// After
SafeCacheOperations.setShoppingListItems(listId, items);
```

### From useEffect Cache Updates

```typescript
// Before
useEffect(() => {
  if (data) {
    shoppingListStorage.setShoppingLists(data.lists);
    setLocalLists(data.lists);
  }
}, [data]);

// After
const executeProtected = useProtectedCacheOperation();

useEffect(() => {
  if (data) {
    const success = executeProtected(() =>
      SafeCacheOperations.setShoppingLists(data.lists),
      'setShoppingLists'
    );

    if (success) {
      setLocalLists(data.lists);
    }
  }
}, [data, executeProtected]);
```

## ✅ **Testing**

Test the system by:

1. **Triggering token expiration** (wait for 1-minute expiry in dev)
2. **Making multiple requests** while token is expired
3. **Observing logs** for proper queuing and retry behavior
4. **Checking UI** shows refresh indicator appropriately
5. **Verifying cache** doesn't update during refresh

## 🎉 **Result**

With this system in place:

- Users never need to reload twice for expired tokens
- UI remains smooth during authentication renewal
- Cache data stays consistent
- Better debugging and monitoring capabilities
- Improved user experience overall