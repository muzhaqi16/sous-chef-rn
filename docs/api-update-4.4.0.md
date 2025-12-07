# Sous Chef API - Client Integration Guide

## Executive Summary

This document provides comprehensive guidance for client developers integrating with the Sous Chef API. It covers all new features including personalized item tracking, unit conversions, pantry analytics, and enhanced autocomplete.

---

## Table of Contents

1. [Personalized Item Frequency Tracking](#1-personalized-item-frequency-tracking)
2. [Unit Conversion System](#2-unit-conversion-system)
3. [Autocomplete with Personalization](#3-autocomplete-with-personalization)
4. [Pantry Analytics](#4-pantry-analytics)
5. [Item Catalog & Onboarding](#5-item-catalog--onboarding)
6. [Shopping List Operations](#6-shopping-list-operations)
7. [Shopping to Pantry Flow](#7-shopping-to-pantry-flow)
8. [Collaboration System](#8-collaboration-system)

---

## 1. PERSONALIZED ITEM FREQUENCY TRACKING

### Overview

The system automatically tracks how often each user adds items to pantry and shopping lists. This data powers personalized autocomplete suggestions.

### Responsibility Matrix

| Concern                | Server                              | Client                 |
| ---------------------- | ----------------------------------- | ---------------------- |
| Track frequency on add | Automatic - no client action needed | N/A                    |
| Store frequency data   | Handles persistence                 | N/A                    |
| Use for autocomplete   | Automatic personalization           | Just call autocomplete |
| View frequency data    | Not exposed (internal use)          | N/A                    |

### How It Works (Behind the Scenes)

**Automatic Tracking Triggers:**

1. When user adds item to **pantry** → Server increments `pantryAddCount`
2. When user adds item to **shopping list** → Server increments `shoppingAddCount`
3. When user restores deleted shopping item → Server increments count
4. When user re-adds existing item (quantity increment) → Server increments count

**Data Model (Server-side):**

```
UserItemFrequency {
  userId: String
  itemId: String
  pantryAddCount: Int (default 0)
  shoppingAddCount: Int (default 0)
  lastAddedToPantry: DateTime
  lastAddedToShopping: DateTime
}
```

### Client Actions

**No direct client integration required.** The system is fully automatic:

- Add items normally using existing mutations
- Call autocomplete as usual - results are personalized automatically

---

## 2. UNIT CONVERSION SYSTEM

### Overview

The API supports intelligent unit conversions with item-specific overrides (e.g., "1 cup flour = 120g").

### 2.1 Query Conversions

#### `convertQuantity` - Convert Between Units

```graphql
query ConvertQuantity(
  $itemId: ID
  $quantity: Float!
  $fromUnitId: ID!
  $toUnitId: ID!
) {
  convertQuantity(
    itemId: $itemId
    quantity: $quantity
    fromUnitId: $fromUnitId
    toUnitId: $toUnitId
  ) {
    value
    unit {
      id
      name
      symbol
      type
    }
    displayText
  }
}
```

**Responsibility Matrix:**
| Concern | Server | Client |
|---------|--------|--------|
| Standard conversions | Handles (g↔kg, ml↔L, etc.) | Send unit IDs |
| Item-specific conversions | Looks up ItemUnitConversion table | Pass itemId when available |
| Display formatting | Returns formatted `displayText` | Display as-is or format `value` |
| Conversion confidence | Internal tracking | N/A |

**Client Input:**

```json
{
  "itemId": "optional-item-id",
  "quantity": 2.5,
  "fromUnitId": "cup-unit-id",
  "toUnitId": "gram-unit-id"
}
```

**Server Response:**

```json
{
  "convertQuantity": {
    "value": 300.0,
    "unit": {
      "id": "gram-id",
      "name": "gram",
      "symbol": "g",
      "type": "WEIGHT"
    },
    "displayText": "300 g"
  }
}
```

---

#### `canConvert` - Check Conversion Availability

```graphql
query CanConvert($itemId: ID, $fromUnitId: ID!, $toUnitId: ID!) {
  canConvert(itemId: $itemId, fromUnitId: $fromUnitId, toUnitId: $toUnitId) {
    canConvert
    conversionPath
    confidence
    source
  }
}
```

**Use Case:** Before showing conversion UI, check if conversion is possible.

---

#### `getItemConversions` - Get All Conversions for Item

```graphql
query GetItemConversions($itemId: ID!, $includeStandard: Boolean) {
  getItemConversions(itemId: $itemId, includeStandard: $includeStandard) {
    id
    fromUnit {
      id
      symbol
      name
    }
    toUnit {
      id
      symbol
      name
    }
    conversionRatio
    confidence
    source
    isVerified
  }
}
```

**Use Case:** Show available unit options in a dropdown.

---

#### `getBestDisplayUnit` - Auto-Select Optimal Unit

```graphql
query GetBestDisplayUnit($quantity: Float!, $currentUnitId: ID!, $itemId: ID) {
  getBestDisplayUnit(
    quantity: $quantity
    currentUnitId: $currentUnitId
    itemId: $itemId
  ) {
    id
    name
    symbol
  }
}
```

**Use Case:** Auto-convert 1000ml → 1L for cleaner display.

**Responsibility Matrix:**
| Concern | Server | Client |
|---------|--------|--------|
| Determine thresholds | Uses `autoConvertThreshold` on Unit | Pass current quantity/unit |
| Apply conversion | Returns optimal unit | Update display with new unit |

---

#### `parseQuantityInput` - Parse Fraction Strings

```graphql
query ParseQuantity($input: String!, $unitId: ID!) {
  parseQuantityInput(input: $input, unitId: $unitId) {
    numericValue
    displayValue
    unit {
      id
      symbol
    }
  }
}
```

**Use Case:** User types "1 1/2" or "1/4" - server parses to decimal.

**Client Input Examples:**

- `"1/2"` → `0.5`
- `"1 1/4"` → `1.25`
- `"2.5"` → `2.5`

---

### 2.2 Mutation: Add/Update Conversions

#### `upsertItemUnitConversion`

```graphql
mutation UpsertConversion(
  $itemId: ID!
  $fromUnitId: ID!
  $toUnitId: ID!
  $conversionRatio: Float!
  $notes: String
) {
  upsertItemUnitConversion(
    itemId: $itemId
    fromUnitId: $fromUnitId
    toUnitId: $toUnitId
    conversionRatio: $conversionRatio
    notes: $notes
  ) {
    id
    conversionRatio
    source
    confidence
  }
}
```

**Use Case:** User discovers "1 cup of this flour = 125g" and wants to save it.

**Responsibility Matrix:**
| Concern | Server | Client |
|---------|--------|--------|
| Validate units exist | Validates IDs | Send valid unit IDs |
| Prevent duplicates | Upserts (creates or updates) | Just call mutation |
| Track source | Sets `source: USER_DEFINED` | N/A |
| Bi-directional | Creates reverse conversion automatically | N/A |

---

## 3. AUTOCOMPLETE WITH PERSONALIZATION

### Overview

Autocomplete now returns personalized results based on user's item usage patterns.

### Query

```graphql
query Autocomplete($input: AutocompleteInput!) {
  autocompleteItems(input: $input) {
    suggestions {
      id
      name
      imageUrl
      images
      defaultUnit {
        id
        name
        symbol
        type
        isDefault
        isPreferred
      }
      brand {
        id
        name
      }
      category {
        id
        name
        type
        isPrimary
      }
      netWeight
      displayUnit
    }
    totalCount
  }
}
```

### Input

```graphql
input AutocompleteInput {
  query: String! # Required - search term
  limit: Int = 10 # Optional - max results
  category: String # Optional - filter by category
  storeId: String # Optional - filter by store
}
```

### Ranking Priority (Server Handles)

| Priority | Source                | Description                                         |
| -------- | --------------------- | --------------------------------------------------- |
| 1st      | User's Private Items  | Items user created (PRIVATE visibility)             |
| 2nd      | User's Frequent Items | Items user adds most often (from UserItemFrequency) |
| 3rd      | Global Popularity     | Items with highest popularity score                 |

### Responsibility Matrix

| Concern                 | Server                            | Client                         |
| ----------------------- | --------------------------------- | ------------------------------ |
| Personalization ranking | Automatic based on logged-in user | Just call with query           |
| Frequency tracking      | Automatic on every add            | N/A                            |
| Fallback for new users  | Uses global popularity            | N/A                            |
| Debouncing              | N/A                               | Recommended: 300ms debounce    |
| Caching                 | N/A                               | Optional: cache recent queries |

### Example

```graphql
# Client sends:
query {
  autocompleteItems(input: { query: "milk", limit: 5 }) {
    suggestions { id name imageUrl }
    totalCount
  }
}

# Server returns (for user who frequently buys "Oat Milk"):
{
  "autocompleteItems": {
    "suggestions": [
      { "id": "1", "name": "Oat Milk", "imageUrl": "..." },      // User's frequent
      { "id": "2", "name": "Whole Milk", "imageUrl": "..." },    // Global popular
      { "id": "3", "name": "2% Milk", "imageUrl": "..." },       // Global popular
      { "id": "4", "name": "Almond Milk", "imageUrl": "..." },   // Global popular
      { "id": "5", "name": "Coconut Milk", "imageUrl": "..." }   // Global popular
    ],
    "totalCount": 5
  }
}
```

---

## 4. PANTRY ANALYTICS

### Overview

Comprehensive analytics for pantry usage, waste tracking, and inventory ledger.

### 4.1 Usage Analytics

```graphql
query UsageAnalytics($pantryId: ID!, $filter: AnalyticsFilterInput) {
  pantryUsageAnalytics(pantryId: $pantryId, filter: $filter) {
    totalUsageCount
    totalQuantityUsed
    averageUsagePerDay
    usageTrend {
      date
      value
      count
    }
    usageByPurpose {
      purpose
      totalQuantity
      count
      percentage
    }
    usageBySource {
      source
      totalQuantity
      count
      percentage
    }
    topUsedItems {
      itemId
      itemName
      totalQuantity
      count
      unitName
      imageUrl
    }
    periodStart
    periodEnd
  }
}
```

### 4.2 Waste Analytics

```graphql
query WasteAnalytics($pantryId: ID!, $filter: AnalyticsFilterInput) {
  pantryWasteAnalytics(pantryId: $pantryId, filter: $filter) {
    totalWasteCount
    totalWasteQuantity
    totalWasteValue
    wasteRate
    averageWastePerDay
    composted
    recycled
    wasteTrend {
      date
      value
      count
    }
    wasteByReason {
      reason
      totalQuantity
      count
      percentage
      estimatedValue
    }
    topWastedItems {
      itemId
      itemName
      totalQuantity
      count
      estimatedValue
      unitName
      imageUrl
    }
    periodStart
    periodEnd
  }
}
```

### 4.3 Ledger Analytics (Additions vs Consumption)

```graphql
query LedgerAnalytics(
  $pantryId: ID!
  $itemId: String
  $filter: AnalyticsFilterInput
  $granularity: PeriodGranularity
) {
  pantryLedgerAnalytics(
    pantryId: $pantryId
    itemId: $itemId
    filter: $filter
    granularity: $granularity
  ) {
    summary {
      totalAdded
      totalConsumed
      totalWasted
      netQuantity
      additionCount
      consumptionCount
      wasteCount
      unitName
      additionsByUnit {
        unitId
        unitName
        unitSymbol
        totalQuantity
        count
      }
      consumptionByUnit {
        unitId
        unitName
        unitSymbol
        totalQuantity
        count
      }
    }
    periodData {
      periodStart
      periodEnd
      periodLabel
      added
      consumed
      wasted
      net
      additionCost
    }
    costAnalytics {
      totalSpent
      averageCostPerUnit
      costByStore {
        storeId
        storeName
        totalSpent
        itemCount
        averageCostPerUnit
      }
    }
    topRestockedItems {
      itemId
      itemName
      totalQuantity
      count
      unitName
      imageUrl
    }
    periodStart
    periodEnd
    granularity
  }
}
```

### Filter Input

```graphql
input AnalyticsFilterInput {
  dateRange: DateRange # TODAY, YESTERDAY, LAST_WEEK, LAST_MONTH, LAST_QUARTER, LAST_YEAR
  customRange: DateRangeInput # { start: DateTime, end: DateTime }
  topItemsLimit: Int # Default: 10
}

enum PeriodGranularity {
  DAILY
  WEEKLY
  MONTHLY
}
```

### Responsibility Matrix

| Concern                | Server                                 | Client                            |
| ---------------------- | -------------------------------------- | --------------------------------- |
| Date range calculation | Handles predefined ranges              | Send `dateRange` or `customRange` |
| Period aggregation     | Groups by day/week/month               | Specify `granularity`             |
| Cost calculations      | Computes from purchase records         | N/A                               |
| Chart-ready data       | Returns `usageTrend[]`, `periodData[]` | Render charts directly            |
| Top items              | Returns limited, sorted list           | Display as-is                     |

---

## 5. ITEM CATALOG & ONBOARDING

### 5.1 Get Items with Filters

```graphql
query GetItems($filters: ItemFilters, $pagination: PaginationInput) {
  items(filters: $filters, pagination: $pagination) {
    items {
      id
      name
      imageUrl
      type
      popularity
      showInOnboarding
    }
    totalCount
    hasMore
  }
}
```

### 5.2 Onboarding Items (Special Filter)

```graphql
# Get items to show during user onboarding
query OnboardingItems {
  items(filters: { showInOnboarding: true, type: FOOD, limit: 20 }) {
    items {
      id
      name
      imageUrl
      type
    }
    totalCount
  }
}
```

**Important:** Default type is `FOOD`. To get other types, explicitly pass:

```graphql
# Get FOUNDATION type items for onboarding
items(filters: { showInOnboarding: true, type: FOUNDATION })

# Get multiple types
items(filters: { showInOnboarding: true, types: [FOOD, FOUNDATION] })
```

### 5.3 Popular/Trending Items

```graphql
# Popular items
items(filters: { isPopular: true, limit: 10 })

# Recently added items
items(filters: { isRecent: true, limit: 10 })
```

### 5.4 Item Mutations

```graphql
# Create item
mutation CreateItem($input: CreateItemInput!) {
  createItem(input: $input) {
    id
    name
    status
    visibility
  }
}

# Update item
mutation UpdateItem($id: ID!, $input: UpdateItemInput!) {
  updateItem(id: $id, input: $input) {
    id
    name
  }
}

# Delete item (soft delete)
mutation DeleteItem($id: ID!) {
  deleteItem(id: $id)
}

# Manually increment popularity
mutation IncrementPopularity($id: ID!) {
  incrementItemPopularity(id: $id) {
    id
    popularity
  }
}
```

### 5.5 Item Approval Workflow

```graphql
# Admin: Approve user-created item
mutation ApproveItem($itemId: ID!) {
  approveItem(itemId: $itemId) {
    id
    status
    visibility
  }
}

# Admin: Reject item
mutation RejectItem($input: RejectItemInput!) {
  rejectItem(input: $input)
}

# User: Flag item for review
mutation FlagItem($itemId: ID!, $reason: String) {
  flagItemForReview(itemId: $itemId, reason: $reason) {
    id
    needsApproval
  }
}
```

### Responsibility Matrix

| Concern             | Server                                   | Client                        |
| ------------------- | ---------------------------------------- | ----------------------------- |
| Item visibility     | Controls PUBLIC/PRIVATE based on creator | N/A                           |
| Approval workflow   | Manages status transitions               | Show pending indicator        |
| Popularity tracking | Automatic on add to pantry/shopping      | N/A (unless manual increment) |
| Type filtering      | Handles enum validation                  | Send valid ItemType           |
| Image handling      | Stores URL/metadata                      | Upload separately, send URL   |

---

## 6. SHOPPING LIST OPERATIONS

### 6.1 Add Item to Shopping List

```graphql
mutation AddItem($input: CreateShoppingListItemInput!) {
  addItemToShoppingList(input: $input) {
    id
    itemName
    quantity
    unitName
    isPurchased
    sortOrder
    version
  }
}

input CreateShoppingListItemInput {
  shoppingListId: ID!
  itemId: ID! # Catalog item ID
  quantity: Float = 1
  unitId: ID # Optional - uses item's default if omitted
  notes: String
  priority: Priority # LOW, MEDIUM, HIGH, URGENT
  category: String
  estimatedPrice: Float
  addedContext: AddedContext # MANUAL, RECIPE, PANTRY_LOW_STOCK, AI_SUGGESTED
}
```

### 6.2 Update Item

```graphql
mutation UpdateItem($id: ID!, $input: UpdateShoppingListItemInput!) {
  updateShoppingListItem(id: $id, input: $input) {
    id
    quantity
    unitName
    isPurchased
    version
  }
}
```

### 6.3 Toggle Purchased

```graphql
mutation TogglePurchased($id: ID!, $purchased: Boolean!) {
  markItemPurchased(id: $id, status: $purchased) {
    id
    isPurchased
    purchasedAt
    version
  }
}
```

### 6.4 Remove Item

```graphql
mutation RemoveItem($id: ID!) {
  removeItemFromShoppingList(id: $id)
}
```

### 6.5 Offline Sync Operations

```graphql
# Sync item created/modified offline
mutation SyncItem($clientId: ID!, $input: SyncShoppingListItemInput!) {
  syncShoppingListItem(clientId: $clientId, input: $input) {
    success
    item {
      id
    }
    clientId
    serverId
    version
    conflictType
    conflictData
  }
}

# Sync deletion
mutation SyncDelete($clientId: ID!, $version: Int) {
  syncDeleteShoppingListItem(clientId: $clientId, version: $version) {
    success
    clientId
    serverId
  }
}
```

### Responsibility Matrix

| Concern             | Server                        | Client                         |
| ------------------- | ----------------------------- | ------------------------------ |
| Duplicate handling  | Merges (increments quantity)  | Can always call add            |
| Soft delete         | Manages deletedAt             | Just call remove               |
| Restore deleted     | Auto-restores on re-add       | N/A                            |
| Temp ID handling    | Converts temp-\* IDs          | Use temp-\* prefix for offline |
| Version conflicts   | Reports via syncResult        | Handle conflicts UI            |
| Atomic operations   | Database-level atomicity      | N/A                            |
| Popularity tracking | Automatic on add              | N/A                            |
| Frequency tracking  | Automatic for personalization | N/A                            |

---

## 7. SHOPPING TO PANTRY FLOW

### 7.1 Move Single Item

```graphql
mutation MoveItemToPantry($input: MoveShoppingItemToPantryInput!) {
  moveShoppingItemToPantry(input: $input) {
    id
    itemName
    currentQuantity
    unitName
    expiresAt
    storageLocation {
      id
      name
    }
    acquisitionMethod
  }
}

input MoveShoppingItemToPantryInput {
  shoppingListItemId: ID!
  pantryId: ID!
  quantity: Float # Optional - uses shopping item quantity if omitted
  unitId: ID # Optional - uses shopping item unit if omitted
  storageLocationId: ID # Optional
  storageState: StorageState # AMBIENT, REFRIGERATED, FROZEN
  expiresAt: DateTime # Optional
  removeFromList: Boolean = true

  # Purchase details (captured if item was marked purchased)
  costPerUnit: Float
  totalCost: Float
  storeId: ID
  notes: String
}
```

### Server Automatic Actions

1. **Creates Purchase Record** (if item was purchased):

   - Captures cost, store, currency
   - Links to shopping list item
   - Stores UPC from external sources

2. **Creates Pantry Item**:

   - Sets `acquisitionMethod: SHOPPING_LIST`
   - Links `sourceShoppingListItemId` for traceability
   - Initializes quantities correctly

3. **Updates Shopping List Item**:

   - If `removeFromList=true`: Soft deletes from list
   - If `removeFromList=false`: Marks as purchased, keeps in list

4. **Increments Popularity**:
   - Updates pantry popularity counter
   - Updates user frequency for personalization

### Responsibility Matrix

| Concern         | Server                                    | Client                  |
| --------------- | ----------------------------------------- | ----------------------- |
| Purchase record | Auto-creates if purchased                 | Send cost/store details |
| Expiration date | Calculates from shelfLife if not provided | Optional override       |
| Unit conversion | Uses shopping item unit if not specified  | Optional override       |
| Source tracking | Links to shopping item ID                 | N/A                     |
| List cleanup    | Based on removeFromList flag              | Set preference          |

---

## 8. COLLABORATION SYSTEM

### 8.1 Invite Collaborator

```graphql
mutation InviteCollaborator($input: InviteToShoppingListInput!) {
  inviteToShoppingList(input: $input) {
    id
    email
    role
    status
    permissions {
      canEdit
      canAddItems
      canRemoveItems
      canEditItems
      canMarkPurchased
      canInviteOthers
    }
  }
}

input InviteToShoppingListInput {
  shoppingListId: ID!
  email: String!
  role: CollaboratorRole! # OWNER, EDITOR, VIEWER, SHOPPER, CONTRIBUTOR
  permissions: PermissionsInput # Optional - uses role defaults if omitted
}
```

### 8.2 Accept/Decline Invite

```graphql
# Accept invitation
mutation AcceptInvite($token: String!) {
  acceptShoppingListInvite(token: $token) {
    id
    status
    shoppingList {
      id
      name
    }
  }
}

# Decline invitation
mutation DeclineInvite($token: String!) {
  declineShoppingListInvite(token: $token)
}
```

### 8.3 Permission System

| Permission         | Description                     |
| ------------------ | ------------------------------- |
| `canEdit`          | Edit list metadata (name, etc.) |
| `canAddItems`      | Add items to list               |
| `canRemoveItems`   | Remove items from list          |
| `canEditItems`     | Update item details             |
| `canMarkPurchased` | Toggle purchase status          |
| `canInviteOthers`  | Invite new collaborators        |
| `canViewHistory`   | Access activity/change logs     |
| `canExport`        | Export list data                |

### 8.4 Role-Based Defaults

| Role        | Permissions                                                 |
| ----------- | ----------------------------------------------------------- |
| OWNER       | All permissions                                             |
| EDITOR      | All except canInviteOthers                                  |
| SHOPPER     | canAddItems, canRemoveItems, canEditItems, canMarkPurchased |
| VIEWER      | Read-only                                                   |
| CONTRIBUTOR | canAddItems, canEditItems                                   |

### Responsibility Matrix

| Concern                | Server                       | Client                      |
| ---------------------- | ---------------------------- | --------------------------- |
| Token generation       | Creates 32-byte hex token    | N/A                         |
| Token expiration       | 7 days default               | N/A                         |
| Email notification     | Sends invite email           | N/A                         |
| In-app notification    | Creates for existing users   | Display notification        |
| Permission enforcement | Validates on every operation | Disable UI for unauthorized |
| Activity logging       | Automatic on all actions     | N/A                         |

---

## 9. ENUMS REFERENCE

### ItemType

```graphql
enum ItemType {
  FOOD
  PRODUCT
  DRINK
  SUPPLEMENT
  HOUSEHOLD
  PERSONAL_CARE
  PET
  FOUNDATION
  OTHER
}
```

### StorageState

```graphql
enum StorageState {
  AMBIENT
  REFRIGERATED
  FROZEN
}
```

### UsagePurpose

```graphql
enum UsagePurpose {
  COOKING
  SNACK
  MEAL_PREP
  WASTE
  TRANSFER
  GIFT
  GENERAL
  RESTOCK
}
```

### WasteReason

```graphql
enum WasteReason {
  EXPIRED
  SPOILED
  DAMAGED
  OVERPRODUCTION
  QUALITY
  OTHER
}
```

### ConversionSource

```graphql
enum ConversionSource {
  USDA
  SPOONACULAR
  KROGER
  CALCULATED
  USER_DEFINED
  COMMUNITY
  ML_PREDICTED
}
```

### DateRange

```graphql
enum DateRange {
  TODAY
  YESTERDAY
  LAST_WEEK
  LAST_MONTH
  LAST_QUARTER
  LAST_YEAR
  CUSTOM
}
```

---

## 10. ERROR HANDLING

### Common Error Codes

| Error              | Cause                   | Client Action      |
| ------------------ | ----------------------- | ------------------ |
| `UNAUTHORIZED`     | Not authenticated       | Redirect to login  |
| `FORBIDDEN`        | Lacks permission        | Show access denied |
| `NOT_FOUND`        | Resource doesn't exist  | Handle gracefully  |
| `VERSION_CONFLICT` | Optimistic lock failure | Refetch and retry  |
| `VALIDATION_ERROR` | Invalid input           | Show field errors  |

### Version Conflict Handling

When `VERSION_CONFLICT` occurs:

1. Refetch the current resource
2. Show diff to user (optional)
3. Allow user to merge changes
4. Retry with new version

---

## 11. BEST PRACTICES

### Autocomplete

- Debounce input: 300ms recommended
- Minimum query length: 2 characters
- Cache recent queries client-side
- Show loading state during fetch

### Unit Conversions

- Always pass `itemId` when available for accurate conversions
- Use `canConvert` to check before showing conversion options
- Use `parseQuantityInput` for user-entered fractions

### Analytics

- Use predefined `dateRange` for common periods
- Use `customRange` only when user needs specific dates
- Cache analytics data (changes infrequently)

### Shopping Lists

- Use sync mutations for offline-first apps
- Prefix offline-created IDs with `temp-`
- Track version for optimistic updates
- Handle conflicts gracefully

### Performance

- Request only needed fields (GraphQL fragments)
- Use pagination for large lists
- Subscribe to real-time updates where available

---

## 12. CHANGELOG

| Version | Date     | Changes                                               |
| ------- | -------- | ----------------------------------------------------- |
| 4.4.0   | Current  | Added UserItemFrequency for personalized autocomplete |
| 4.3.0   | Previous | Added pantry analytics (usage, waste, ledger)         |
| 4.2.0   | Previous | Added item-specific unit conversions                  |
| 4.1.0   | Previous | Added onboarding items with type filtering            |
