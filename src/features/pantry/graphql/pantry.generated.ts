// This file is auto-generated. Do not edit manually.
/* eslint-disable */
// @ts-nocheck
import type * as Types from '../../../graphql/generated/baseTypes';

import type {
  PantryItemDisplayFragment,
  PantryItemFragment,
  PantryItemBatchFragment,
  ExpirationNotificationFragment,
} from '../../../graphql/operations/fragments.generated';
import type { DocumentNode } from 'graphql';
import type * as ApolloReactCommon from '@apollo/client';
import * as ApolloReactHooks from '@apollo/client/react';
const defaultOptions = {} as const;
export type GetPantriesQueryVariables = Types.Exact<{
  homeId: Types.Scalars['ID']['input'];
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>;
  after?: Types.InputMaybe<Types.Scalars['String']['input']>;
}>;

export type GetPantriesQuery = {
  __typename: 'Query';
  pantries: {
    __typename: 'PantryConnection';
    edges: Array<{
      __typename: 'PantryEdge';
      node: {
        __typename: 'Pantry';
        id: string;
        homeId: string;
        name: string;
        isDefault: boolean;
        createdAt: string;
      };
    }>;
  };
};

export type GetPantryQueryVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
  itemsCursor?: Types.InputMaybe<Types.Scalars['String']['input']>;
  itemsFirst?: Types.InputMaybe<Types.Scalars['Int']['input']>;
  itemsFilter?: Types.InputMaybe<Types.PantryItemFilters>;
  itemsOrderBy?: Types.InputMaybe<Types.PantryItemOrderBy>;
  storageLocationsCursor?: Types.InputMaybe<Types.Scalars['String']['input']>;
  storageLocationsFirst?: Types.InputMaybe<Types.Scalars['Int']['input']>;
}>;

export type GetPantryQuery = {
  __typename: 'Query';
  pantry: {
    __typename: 'Pantry';
    id: string;
    homeId: string;
    name: string;
    description: string | null;
    isDefault: boolean;
    version: number;
    stats: {
      __typename: 'PantryStats';
      totalItems: number;
      expiringCount: number;
      lowStockCount: number;
      storageStateCounts: {
        __typename: 'StorageStateCounts';
        refrigerated: number;
        frozen: number;
        ambient: number;
      } | null;
      storageLocationCounts: Array<{
        __typename: 'StorageLocationCount';
        storageLocationId: string;
        name: string;
        type: Types.StorageType;
        itemCount: number;
      }>;
    };
    itemsConnection: {
      __typename: 'PantryItemConnection';
      totalCount: number | null;
      edges: Array<{
        __typename: 'PantryItemEdge';
        cursor: string;
        node: { __typename: 'PantryItem' } & PantryItemDisplayFragment;
      }>;
      pageInfo: {
        __typename: 'PageInfo';
        hasNextPage: boolean;
        endCursor: string | null;
      };
    };
    storageLocationsConnection: {
      __typename: 'StorageLocationConnection';
      totalCount: number | null;
      edges: Array<{
        __typename: 'StorageLocationEdge';
        cursor: string;
        node: {
          __typename: 'StorageLocation';
          id: string;
          name: string;
          type: Types.StorageType;
          icon: string | null;
          color: string | null;
          isDefault: boolean;
          currentItemCount: number;
          parentLocation: {
            __typename: 'StorageLocation';
            id: string;
            name: string;
          } | null;
        };
      }>;
      pageInfo: {
        __typename: 'PageInfo';
        hasNextPage: boolean;
        endCursor: string | null;
      };
    };
  } | null;
};

export type GetPantryItemQueryVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
}>;

export type GetPantryItemQuery = {
  __typename: 'Query';
  pantryItem: ({ __typename: 'PantryItem' } & PantryItemFragment) | null;
};

export type GetPantryItemSuggestionsQueryVariables = Types.Exact<{
  pantryId: Types.Scalars['ID']['input'];
  limit?: Types.InputMaybe<Types.Scalars['Int']['input']>;
}>;

export type GetPantryItemSuggestionsQuery = {
  __typename: 'Query';
  pantry: {
    __typename: 'Pantry';
    id: string;
    suggestions: Array<{
      __typename: 'PantryItemSuggestion';
      id: string;
      itemId: string;
      name: string;
      source: Types.PantrySuggestionSource;
      imageUrl: string | null;
      category: string | null;
      defaultUnitId: string | null;
      currentQuantity: number | null;
      minQuantity: number | null;
      restockQuantity: number | null;
      daysUntilExpiry: number | null;
      expiresAt: string | null;
      lastQuantity: number | null;
      lastUnitId: string | null;
      frequencyCount: number | null;
      popularityRank: number | null;
      pantryItemId: string | null;
      defaultUnit: {
        __typename: 'SuggestionUnit';
        id: string;
        name: string;
        symbol: string;
      } | null;
      item: {
        __typename: 'SuggestionItem';
        id: string;
        name: string;
        imageUrl: string | null;
      };
    }>;
  } | null;
};

export type GetPantryUsageAnalyticsQueryVariables = Types.Exact<{
  pantryId: Types.Scalars['ID']['input'];
  filter?: Types.InputMaybe<Types.AnalyticsFilters>;
}>;

export type GetPantryUsageAnalyticsQuery = {
  __typename: 'Query';
  pantry: {
    __typename: 'Pantry';
    id: string;
    usageAnalytics: {
      __typename: 'UsageAnalytics';
      totalUsageCount: number;
      totalQuantityUsed: number;
      averageUsagePerDay: number;
      periodStart: string;
      periodEnd: string;
      usageByPurpose: Array<{
        __typename: 'UsageByPurpose';
        purpose: Types.UsagePurpose;
        count: number;
        totalQuantity: number;
        percentage: number;
      }>;
      usageBySource: Array<{
        __typename: 'UsageBySource';
        source: Types.UsageSource;
        count: number;
        totalQuantity: number;
        percentage: number;
      }>;
      topUsedItems: Array<{
        __typename: 'UsageByItem';
        itemId: string;
        itemName: string;
        imageUrl: string | null;
        count: number;
        totalQuantity: number;
        unitName: string | null;
      }>;
      usageTrend: Array<{
        __typename: 'TimeSeriesDataPoint';
        date: string;
        value: number;
        count: number;
      }>;
    };
  } | null;
};

export type GetPantryWasteAnalyticsQueryVariables = Types.Exact<{
  pantryId: Types.Scalars['ID']['input'];
  filter?: Types.InputMaybe<Types.AnalyticsFilters>;
}>;

export type GetPantryWasteAnalyticsQuery = {
  __typename: 'Query';
  pantry: {
    __typename: 'Pantry';
    id: string;
    wasteAnalytics: {
      __typename: 'WasteAnalytics';
      totalWasteCount: number;
      totalWasteQuantity: number;
      totalWasteValue: number;
      averageWastePerDay: number;
      wasteRate: number;
      composted: number;
      recycled: number;
      periodStart: string;
      periodEnd: string;
      wasteByReason: Array<{
        __typename: 'WasteByReason';
        reason: Types.WasteReason;
        count: number;
        totalQuantity: number;
        percentage: number;
        estimatedValue: number | null;
      }>;
      topWastedItems: Array<{
        __typename: 'WasteByItem';
        itemId: string;
        itemName: string;
        imageUrl: string | null;
        count: number;
        totalQuantity: number;
        unitName: string | null;
        estimatedValue: number | null;
      }>;
      wasteTrend: Array<{
        __typename: 'TimeSeriesDataPoint';
        date: string;
        value: number;
        count: number;
      }>;
    };
  } | null;
};

export type GetPantryLedgerAnalyticsQueryVariables = Types.Exact<{
  pantryId: Types.Scalars['ID']['input'];
  filter?: Types.InputMaybe<Types.AnalyticsFilters>;
  granularity?: Types.InputMaybe<Types.PeriodGranularity>;
}>;

export type GetPantryLedgerAnalyticsQuery = {
  __typename: 'Query';
  pantry: {
    __typename: 'Pantry';
    id: string;
    ledgerAnalytics: {
      __typename: 'LedgerAnalytics';
      granularity: Types.PeriodGranularity;
      periodStart: string;
      periodEnd: string;
      summary: {
        __typename: 'LedgerSummary';
        totalAdded: number | null;
        totalConsumed: number | null;
        totalWasted: number | null;
        netQuantity: number | null;
        additionCount: number;
        consumptionCount: number;
        wasteCount: number;
        unitName: string | null;
        additionsByUnit: Array<{
          __typename: 'UsageByUnit';
          unitId: string;
          unitName: string;
          unitSymbol: string;
          totalQuantity: number;
          count: number;
        }>;
        consumptionByUnit: Array<{
          __typename: 'UsageByUnit';
          unitId: string;
          unitName: string;
          unitSymbol: string;
          totalQuantity: number;
          count: number;
        }>;
      };
      periodData: Array<{
        __typename: 'LedgerPeriodData';
        periodStart: string;
        periodEnd: string;
        periodLabel: string;
        added: number;
        consumed: number;
        wasted: number;
        net: number;
        additionCost: number | null;
      }>;
      costAnalytics: {
        __typename: 'AdditionCostAnalytics';
        totalSpent: number;
        averageCostPerUnit: number;
        costByStore: Array<{
          __typename: 'StoreCostBreakdown';
          storeId: string | null;
          storeName: string | null;
          totalSpent: number;
          itemCount: number;
          averageCostPerUnit: number;
        }>;
      } | null;
      topRestockedItems: Array<{
        __typename: 'UsageByItem';
        itemId: string;
        itemName: string;
        imageUrl: string | null;
        totalQuantity: number;
        unitName: string | null;
        count: number;
      }>;
    };
  } | null;
};

export type ConsumptionUnitsForItemQueryVariables = Types.Exact<{
  itemId: Types.Scalars['ID']['input'];
  trackingUnitId: Types.Scalars['ID']['input'];
  netWeightUnitId?: Types.InputMaybe<Types.Scalars['ID']['input']>;
}>;

export type ConsumptionUnitsForItemQuery = {
  __typename: 'Query';
  consumptionUnitsForItem: Array<{
    __typename: 'RankedUnit';
    rank: number;
    source: Types.UnitSource;
    defaultIncrement: number | null;
    commonFractions: Array<number> | null;
    isWholeContainer: boolean;
    unit: {
      __typename: 'Unit';
      id: string;
      name: string;
      symbol: string;
      type: Types.UnitType;
      unitRole: Types.UnitRole;
      commonFractions: any | null;
      displayAsFraction: boolean;
    };
  }>;
};

export type RestockUnitsForItemQueryVariables = Types.Exact<{
  pantryItemId: Types.Scalars['ID']['input'];
}>;

export type RestockUnitsForItemQuery = {
  __typename: 'Query';
  restockUnitsForItem: Array<{
    __typename: 'RankedUnit';
    rank: number;
    source: Types.UnitSource;
    defaultIncrement: number | null;
    commonFractions: Array<number> | null;
    isWholeContainer: boolean;
    unit: {
      __typename: 'Unit';
      id: string;
      name: string;
      symbol: string;
      type: Types.UnitType;
      unitRole: Types.UnitRole;
      commonFractions: any | null;
      displayAsFraction: boolean;
    };
  }>;
};

export type CreatePantryMutationVariables = Types.Exact<{
  input: Types.CreatePantryInput;
}>;

export type CreatePantryMutation = {
  __typename: 'Mutation';
  createPantry: {
    __typename: 'PantryPayload';
    success: boolean;
    message: string;
    code: string;
    pantry: {
      __typename: 'Pantry';
      id: string;
      homeId: string;
      name: string;
      description: string | null;
      isDefault: boolean;
      version: number;
      createdAt: string;
      updatedAt: string;
    } | null;
  };
};

export type UpdatePantryMutationVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
  input: Types.UpdatePantryInput;
}>;

export type UpdatePantryMutation = {
  __typename: 'Mutation';
  updatePantry: {
    __typename: 'PantryPayload';
    success: boolean;
    message: string;
    code: string;
    pantry: {
      __typename: 'Pantry';
      id: string;
      homeId: string;
      name: string;
      description: string | null;
      isDefault: boolean;
      version: number;
      createdAt: string;
      updatedAt: string;
    } | null;
  };
};

export type DeletePantryMutationVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
}>;

export type DeletePantryMutation = {
  __typename: 'Mutation';
  deletePantry: {
    __typename: 'PantryPayload';
    success: boolean;
    message: string;
    code: string;
    pantry: { __typename: 'Pantry'; id: string; name: string } | null;
  };
};

export type SetDefaultPantryMutationVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
}>;

export type SetDefaultPantryMutation = {
  __typename: 'Mutation';
  setDefaultPantry: {
    __typename: 'PantryPayload';
    success: boolean;
    message: string;
    code: string;
    pantry: {
      __typename: 'Pantry';
      id: string;
      name: string;
      isDefault: boolean;
      homeId: string;
    } | null;
  };
};

export type CreatePantryItemMutationVariables = Types.Exact<{
  input: Types.CreatePantryItemInput;
}>;

export type CreatePantryItemMutation = {
  __typename: 'Mutation';
  createPantryItem: {
    __typename: 'PantryItemPayload';
    success: boolean;
    message: string;
    code: string;
    pantryItem:
      | ({ __typename: 'PantryItem' } & PantryItemDisplayFragment)
      | null;
  };
};

export type UpdatePantryItemMutationVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
  input: Types.UpdatePantryItemInput;
}>;

export type UpdatePantryItemMutation = {
  __typename: 'Mutation';
  updatePantryItem: {
    __typename: 'PantryItemPayload';
    success: boolean;
    message: string;
    code: string;
    pantryItem:
      | ({ __typename: 'PantryItem' } & PantryItemDisplayFragment)
      | null;
  };
};

export type DeletePantryItemMutationVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
}>;

export type DeletePantryItemMutation = {
  __typename: 'Mutation';
  deletePantryItem: {
    __typename: 'PantryItemPayload';
    success: boolean;
    message: string;
    code: string;
    pantryItem: { __typename: 'PantryItem'; id: string } | null;
  };
};

export type CreatePantryItemUsageMutationVariables = Types.Exact<{
  input: Types.RecordPantryItemUsageInput;
}>;

export type CreatePantryItemUsageMutation = {
  __typename: 'Mutation';
  createPantryItemUsage: {
    __typename: 'PantryItemUsagePayload';
    success: boolean;
    message: string;
    code: string;
    validUnits: Array<string> | null;
    pantryItemUsage: {
      __typename: 'PantryItemUsage';
      id: string;
      quantityUsed: number;
      usageUnitId: string | null;
      usedAt: string;
      purpose: Types.UsagePurpose;
      notes: string | null;
      wasteReason: Types.WasteReason | null;
      isComposted: boolean | null;
      isRecycled: boolean | null;
      usageUnit: {
        __typename: 'Unit';
        id: string;
        name: string;
        symbol: string;
      } | null;
      pantryItem:
        | ({
            __typename: 'PantryItem';
            id: string;
            quantity: number;
          } & PantryItemDisplayFragment)
        | null;
      usedBy: { __typename: 'User'; id: string; email: string } | null;
    } | null;
  };
};

export type RestockPantryItemMutationVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
  input: Types.RestockPantryItemInput;
}>;

export type RestockPantryItemMutation = {
  __typename: 'Mutation';
  restockPantryItem: {
    __typename: 'PantryItemUsagePayload';
    success: boolean;
    message: string;
    code: string;
    validUnits: Array<string> | null;
    pantryItemUsage: {
      __typename: 'PantryItemUsage';
      id: string;
      quantityUsed: number;
      purpose: Types.UsagePurpose;
      costPerUnit: number | null;
      totalCost: number | null;
      pantryItem:
        | ({ __typename: 'PantryItem' } & PantryItemDisplayFragment)
        | null;
    } | null;
  };
};

export type UpdatePantryItemQuantityMutationVariables = Types.Exact<{
  pantryItemId: Types.Scalars['ID']['input'];
  quantity: Types.Scalars['String']['input'];
  unitId?: Types.InputMaybe<Types.Scalars['ID']['input']>;
  version?: Types.InputMaybe<Types.Scalars['Int']['input']>;
}>;

export type UpdatePantryItemQuantityMutation = {
  __typename: 'Mutation';
  updatePantryItemQuantity: {
    __typename: 'PantryItemPayload';
    success: boolean;
    message: string;
    code: string;
    pantryItem:
      | ({ __typename: 'PantryItem' } & PantryItemDisplayFragment)
      | null;
  };
};

export type AdjustPantryItemQuantityMutationVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
  input: Types.AdjustPantryItemQuantityInput;
}>;

export type AdjustPantryItemQuantityMutation = {
  __typename: 'Mutation';
  adjustPantryItemQuantity: {
    __typename: 'PantryItemPayload';
    success: boolean;
    message: string;
    code: string;
    pantryItem:
      | ({ __typename: 'PantryItem' } & PantryItemDisplayFragment)
      | null;
  };
};

export type CorrectPantryItemWeightMutationVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
  input: Types.CorrectPantryItemWeightInput;
}>;

export type CorrectPantryItemWeightMutation = {
  __typename: 'Mutation';
  correctPantryItemWeight: {
    __typename: 'PantryItemPayload';
    success: boolean;
    message: string;
    code: string;
    pantryItem:
      | ({ __typename: 'PantryItem' } & PantryItemDisplayFragment)
      | null;
  };
};

export type AddLowStockItemsToShoppingListMutationVariables = Types.Exact<{
  homeId: Types.Scalars['ID']['input'];
  shoppingListId?: Types.InputMaybe<Types.Scalars['ID']['input']>;
}>;

export type AddLowStockItemsToShoppingListMutation = {
  __typename: 'Mutation';
  addLowStockItemsToShoppingList: {
    __typename: 'LowStockToShoppingListResult';
    addedCount: number;
    skippedCount: number;
    addedItems: Array<{
      __typename: 'AddedLowStockItem';
      pantryItemId: string;
      shoppingListItemId: string;
      itemName: string;
      quantity: number;
    }>;
    skippedItems: Array<{
      __typename: 'SkippedLowStockItem';
      pantryItemId: string;
      itemName: string;
      reason: string;
    }>;
  };
};

export type MovePurchasedItemsToPantryMutationVariables = Types.Exact<{
  shoppingListId: Types.Scalars['ID']['input'];
}>;

export type MovePurchasedItemsToPantryMutation = {
  __typename: 'Mutation';
  movePurchasedItemsToPantry: {
    __typename: 'MovePurchasedItemsResult';
    movedCount: number;
    skippedCount: number;
    targetPantryId: string;
    targetPantryName: string;
    movedItems: Array<{
      __typename: 'MovedItemInfo';
      shoppingListItemId: string;
      pantryItemId: string;
      itemName: string;
      quantity: number;
    }>;
    skippedItems: Array<{
      __typename: 'SkippedItemInfo';
      shoppingListItemId: string;
      itemName: string;
      reason: string;
    }>;
  };
};

export type OpenPantryItemMutationVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
  version?: Types.InputMaybe<Types.Scalars['Int']['input']>;
}>;

export type OpenPantryItemMutation = {
  __typename: 'Mutation';
  openPantryItem: {
    __typename: 'PantryItemPayload';
    success: boolean;
    message: string;
    code: string;
    pantryItem:
      | ({ __typename: 'PantryItem' } & PantryItemDisplayFragment)
      | null;
  };
};

export type ConvertExpiredToWasteMutationVariables = Types.Exact<{
  pantryItemId: Types.Scalars['ID']['input'];
}>;

export type ConvertExpiredToWasteMutation = {
  __typename: 'Mutation';
  convertExpiredToWaste: {
    __typename: 'PantryItemPayload';
    success: boolean;
    message: string;
    code: string;
    pantryItem:
      | ({
          __typename: 'PantryItem';
          condition: Types.ItemCondition;
          wasteReason: Types.WasteReason | null;
        } & PantryItemDisplayFragment)
      | null;
  };
};

export type GetPantryItemBatchesQueryVariables = Types.Exact<{
  pantryItemId: Types.Scalars['ID']['input'];
  status?: Types.InputMaybe<Types.BatchStatus>;
}>;

export type GetPantryItemBatchesQuery = {
  __typename: 'Query';
  pantryItemBatches: Array<
    { __typename: 'PantryItemBatch' } & PantryItemBatchFragment
  >;
};

export type OpenPantryItemBatchMutationVariables = Types.Exact<{
  input: Types.OpenBatchInput;
}>;

export type OpenPantryItemBatchMutation = {
  __typename: 'Mutation';
  openPantryItemBatch: {
    __typename: 'PantryItemPayload';
    success: boolean;
    message: string;
    code: string;
    pantryItem:
      | ({
          __typename: 'PantryItem';
          batches: Array<
            { __typename: 'PantryItemBatch' } & PantryItemBatchFragment
          >;
        } & PantryItemDisplayFragment)
      | null;
  };
};

export type WastePantryItemBatchMutationVariables = Types.Exact<{
  input: Types.WasteBatchInput;
}>;

export type WastePantryItemBatchMutation = {
  __typename: 'Mutation';
  wastePantryItemBatch: {
    __typename: 'PantryItemPayload';
    success: boolean;
    message: string;
    code: string;
    pantryItem:
      | ({ __typename: 'PantryItem' } & PantryItemDisplayFragment)
      | null;
  };
};

export type ConvertExpiredBatchesToWasteMutationVariables = Types.Exact<{
  pantryItemId: Types.Scalars['ID']['input'];
}>;

export type ConvertExpiredBatchesToWasteMutation = {
  __typename: 'Mutation';
  convertExpiredBatchesToWaste: {
    __typename: 'PantryItemPayload';
    success: boolean;
    message: string;
    code: string;
    pantryItem:
      | ({ __typename: 'PantryItem' } & PantryItemDisplayFragment)
      | null;
  };
};

export type SyncPantryItemMutationVariables = Types.Exact<{
  clientId: Types.Scalars['ID']['input'];
  input: Types.SyncPantryItemInput;
}>;

export type SyncPantryItemMutation = {
  __typename: 'Mutation';
  syncPantryItem: {
    __typename: 'SyncPantryItemResult';
    clientId: string;
    serverId: string | null;
    operation: Types.SyncOperation;
    wasCreated: boolean;
    item: ({ __typename: 'PantryItem' } & PantryItemDisplayFragment) | null;
    conflict: {
      __typename: 'SyncConflictInfo';
      clientVersion: number;
      serverVersion: number;
      message: string;
      serverItem: {
        __typename: 'ShoppingListItem';
        id: string;
        version: number;
      };
    } | null;
  };
};

export type SyncDeletePantryItemMutationVariables = Types.Exact<{
  clientId: Types.Scalars['ID']['input'];
  version?: Types.InputMaybe<Types.Scalars['Int']['input']>;
}>;

export type SyncDeletePantryItemMutation = {
  __typename: 'Mutation';
  syncDeletePantryItem: {
    __typename: 'SyncPantryItemResult';
    clientId: string;
    serverId: string | null;
    operation: Types.SyncOperation;
    wasCreated: boolean;
    item: { __typename: 'PantryItem'; id: string; itemName: string } | null;
    conflict: {
      __typename: 'SyncConflictInfo';
      clientVersion: number;
      serverVersion: number;
      message: string;
    } | null;
  };
};

export type PantryChangesSubscriptionVariables = Types.Exact<{
  pantryId: Types.Scalars['ID']['input'];
}>;

export type PantryChangesSubscription = {
  __typename: 'Subscription';
  pantryChanged: {
    __typename: 'PantryChangeEvent';
    changeType: Types.PantryChangeType;
    mutation: Types.MutationType | null;
    updatedFields: Array<string> | null;
    timestamp: string;
    userId: string;
    pantryId: string;
    pantry: {
      __typename: 'Pantry';
      id: string;
      homeId: string;
      name: string;
      description: string | null;
      location: string | null;
      temperature: string | null;
      tags: Array<string>;
      metadata: any | null;
      version: number;
      updatedAt: string;
    } | null;
    pantryItem:
      | ({ __typename: 'PantryItem' } & PantryItemDisplayFragment)
      | null;
    usage: {
      __typename: 'PantryItemUsage';
      id: string;
      quantityUsed: number;
      usedAt: string;
      purpose: Types.UsagePurpose;
      notes: string | null;
      pantryItem: { __typename: 'PantryItem'; id: string } | null;
      usedBy: { __typename: 'User'; id: string } | null;
    } | null;
  };
};

export type PantryAlertsSubscriptionVariables = Types.Exact<{
  pantryId: Types.Scalars['ID']['input'];
}>;

export type PantryAlertsSubscription = {
  __typename: 'Subscription';
  pantryAlert: {
    __typename: 'PantryAlertEvent';
    alertType: Types.PantryAlertType;
    message: string | null;
    pantryId: string;
    timestamp: string;
    userId: string;
    pantryItem: {
      __typename: 'PantryItem';
      id: string;
      itemId: string;
      itemName: string;
      pantryId: string;
      quantity: number;
      unit: {
        __typename: 'Unit';
        id: string;
        name: string;
        symbol: string;
      } | null;
      item: {
        __typename: 'Item';
        id: string;
        name: string;
        imageUrl: string | null;
        images: Array<{
          __typename: 'ItemImage';
          url: string;
          kind: Types.ImageKind | null;
        }>;
      };
    } | null;
    items: Array<{
      __typename: 'PantryItem';
      id: string;
      itemId: string;
      itemName: string;
      item: {
        __typename: 'Item';
        id: string;
        name: string;
        imageUrl: string | null;
        images: Array<{
          __typename: 'ItemImage';
          url: string;
          kind: Types.ImageKind | null;
        }>;
      };
    }> | null;
  };
};

export type ExpirationNotificationChangedSubscriptionVariables = Types.Exact<{
  pantryId: Types.Scalars['ID']['input'];
}>;

export type ExpirationNotificationChangedSubscription = {
  __typename: 'Subscription';
  expirationNotificationChanged: {
    __typename: 'ExpirationNotificationChangeEvent';
    changeType: Types.ExpirationNotificationChangeType;
    pantryId: string;
    timestamp: string;
    notification: {
      __typename: 'ExpirationNotification';
    } & ExpirationNotificationFragment;
  };
};

export const GetPantriesDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'GetPantries' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'homeId' },
          },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'first' },
          },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'Int' } },
        },
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'after' },
          },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'pantries' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'homeId' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'homeId' },
                },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'first' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'first' },
                },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'after' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'after' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'edges' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'node' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'id' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'homeId' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'name' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'isDefault' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'createdAt' },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useGetPantriesQuery__
 *
 * To run a query within a React component, call `useGetPantriesQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetPantriesQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetPantriesQuery({
 *   variables: {
 *      homeId: // value for 'homeId'
 *      first: // value for 'first'
 *      after: // value for 'after'
 *   },
 * });
 */
export function useGetPantriesQuery(
  baseOptions: ApolloReactHooks.QueryHookOptions<
    GetPantriesQuery,
    GetPantriesQueryVariables
  > &
    (
      | { variables: GetPantriesQueryVariables; skip?: boolean }
      | { skip: boolean }
    ),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useQuery<GetPantriesQuery, GetPantriesQueryVariables>(
    GetPantriesDocument,
    options,
  );
}
export function useGetPantriesLazyQuery(
  baseOptions?: ApolloReactHooks.LazyQueryHookOptions<
    GetPantriesQuery,
    GetPantriesQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useLazyQuery<
    GetPantriesQuery,
    GetPantriesQueryVariables
  >(GetPantriesDocument, options);
}
// @ts-ignore
export function useGetPantriesSuspenseQuery(
  baseOptions?: ApolloReactHooks.SuspenseQueryHookOptions<
    GetPantriesQuery,
    GetPantriesQueryVariables
  >,
): ApolloReactHooks.UseSuspenseQueryResult<
  GetPantriesQuery,
  GetPantriesQueryVariables
>;
export function useGetPantriesSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<
        GetPantriesQuery,
        GetPantriesQueryVariables
      >,
): ApolloReactHooks.UseSuspenseQueryResult<
  GetPantriesQuery | undefined,
  GetPantriesQueryVariables
>;
export function useGetPantriesSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<
        GetPantriesQuery,
        GetPantriesQueryVariables
      >,
) {
  const options =
    baseOptions === ApolloReactHooks.skipToken
      ? baseOptions
      : { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useSuspenseQuery<
    GetPantriesQuery,
    GetPantriesQueryVariables
  >(GetPantriesDocument, options);
}
export type GetPantriesQueryHookResult = ReturnType<typeof useGetPantriesQuery>;
export type GetPantriesLazyQueryHookResult = ReturnType<
  typeof useGetPantriesLazyQuery
>;
export type GetPantriesSuspenseQueryHookResult = ReturnType<
  typeof useGetPantriesSuspenseQuery
>;
export type GetPantriesQueryResult = ApolloReactCommon.QueryResult<
  GetPantriesQuery,
  GetPantriesQueryVariables
>;
export const GetPantryDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'GetPantry' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'itemsCursor' },
          },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
        },
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'itemsFirst' },
          },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'Int' } },
          defaultValue: { kind: 'IntValue', value: '50' },
        },
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'itemsFilter' },
          },
          type: {
            kind: 'NamedType',
            name: { kind: 'Name', value: 'PantryItemFilters' },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'itemsOrderBy' },
          },
          type: {
            kind: 'NamedType',
            name: { kind: 'Name', value: 'PantryItemOrderBy' },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'storageLocationsCursor' },
          },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
        },
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'storageLocationsFirst' },
          },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'Int' } },
          defaultValue: { kind: 'IntValue', value: '20' },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'pantry' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'id' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'id' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'homeId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'description' } },
                { kind: 'Field', name: { kind: 'Name', value: 'isDefault' } },
                { kind: 'Field', name: { kind: 'Name', value: 'version' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'stats' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'totalItems' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'expiringCount' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'lowStockCount' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'storageStateCounts' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'refrigerated' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'frozen' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'ambient' },
                            },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'storageLocationCounts' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: {
                                kind: 'Name',
                                value: 'storageLocationId',
                              },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'name' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'type' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'itemCount' },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'itemsConnection' },
                  arguments: [
                    {
                      kind: 'Argument',
                      name: { kind: 'Name', value: 'first' },
                      value: {
                        kind: 'Variable',
                        name: { kind: 'Name', value: 'itemsFirst' },
                      },
                    },
                    {
                      kind: 'Argument',
                      name: { kind: 'Name', value: 'after' },
                      value: {
                        kind: 'Variable',
                        name: { kind: 'Name', value: 'itemsCursor' },
                      },
                    },
                    {
                      kind: 'Argument',
                      name: { kind: 'Name', value: 'filters' },
                      value: {
                        kind: 'Variable',
                        name: { kind: 'Name', value: 'itemsFilter' },
                      },
                    },
                    {
                      kind: 'Argument',
                      name: { kind: 'Name', value: 'orderBy' },
                      value: {
                        kind: 'Variable',
                        name: { kind: 'Name', value: 'itemsOrderBy' },
                      },
                    },
                  ],
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'edges' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'node' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  {
                                    kind: 'FragmentSpread',
                                    name: {
                                      kind: 'Name',
                                      value: 'PantryItemDisplay',
                                    },
                                  },
                                ],
                              },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'cursor' },
                            },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'pageInfo' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'hasNextPage' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'endCursor' },
                            },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'totalCount' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'storageLocationsConnection' },
                  arguments: [
                    {
                      kind: 'Argument',
                      name: { kind: 'Name', value: 'first' },
                      value: {
                        kind: 'Variable',
                        name: { kind: 'Name', value: 'storageLocationsFirst' },
                      },
                    },
                    {
                      kind: 'Argument',
                      name: { kind: 'Name', value: 'after' },
                      value: {
                        kind: 'Variable',
                        name: { kind: 'Name', value: 'storageLocationsCursor' },
                      },
                    },
                  ],
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'edges' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'node' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'id' },
                                  },
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'name' },
                                  },
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'type' },
                                  },
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'icon' },
                                  },
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'color' },
                                  },
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'isDefault' },
                                  },
                                  {
                                    kind: 'Field',
                                    name: {
                                      kind: 'Name',
                                      value: 'currentItemCount',
                                    },
                                  },
                                  {
                                    kind: 'Field',
                                    name: {
                                      kind: 'Name',
                                      value: 'parentLocation',
                                    },
                                    selectionSet: {
                                      kind: 'SelectionSet',
                                      selections: [
                                        {
                                          kind: 'Field',
                                          name: { kind: 'Name', value: 'id' },
                                        },
                                        {
                                          kind: 'Field',
                                          name: { kind: 'Name', value: 'name' },
                                        },
                                      ],
                                    },
                                  },
                                ],
                              },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'cursor' },
                            },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'pageInfo' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'hasNextPage' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'endCursor' },
                            },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'totalCount' },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PantryItemDisplay' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'PantryItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'FragmentSpread',
            name: { kind: 'Name', value: 'PantryItemCore' },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'item' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'imageUrl' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'images' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'url' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'kind' } },
                    ],
                  },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'unit' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'symbol' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'netWeightUnit' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'symbol' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'storageLocation' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'type' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'packageBreakdown' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'count' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'contentUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'perUnitNetWeight' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'perUnitNetWeightUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'totalNetWeight' },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'quantityBreakdown' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'fullPackages' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'looseContentUnits' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'contentUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'totalContentUnits' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'remainingWeight' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'remainingWeightUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PantryItemCore' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'PantryItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pantryId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'itemId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'itemName' } },
          { kind: 'Field', name: { kind: 'Name', value: 'quantity' } },
          { kind: 'Field', name: { kind: 'Name', value: 'version' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'storageState' } },
          { kind: 'Field', name: { kind: 'Name', value: 'expiresAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'lowStockAlert' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isLowStock' } },
          { kind: 'Field', name: { kind: 'Name', value: 'minQuantity' } },
          { kind: 'Field', name: { kind: 'Name', value: 'lastUsedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'netWeight' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'remainingNetWeight' },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'activeBatchCount' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'earliestBatchExpiration' },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useGetPantryQuery__
 *
 * To run a query within a React component, call `useGetPantryQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetPantryQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetPantryQuery({
 *   variables: {
 *      id: // value for 'id'
 *      itemsCursor: // value for 'itemsCursor'
 *      itemsFirst: // value for 'itemsFirst'
 *      itemsFilter: // value for 'itemsFilter'
 *      itemsOrderBy: // value for 'itemsOrderBy'
 *      storageLocationsCursor: // value for 'storageLocationsCursor'
 *      storageLocationsFirst: // value for 'storageLocationsFirst'
 *   },
 * });
 */
export function useGetPantryQuery(
  baseOptions: ApolloReactHooks.QueryHookOptions<
    GetPantryQuery,
    GetPantryQueryVariables
  > &
    (
      | { variables: GetPantryQueryVariables; skip?: boolean }
      | { skip: boolean }
    ),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useQuery<GetPantryQuery, GetPantryQueryVariables>(
    GetPantryDocument,
    options,
  );
}
export function useGetPantryLazyQuery(
  baseOptions?: ApolloReactHooks.LazyQueryHookOptions<
    GetPantryQuery,
    GetPantryQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useLazyQuery<GetPantryQuery, GetPantryQueryVariables>(
    GetPantryDocument,
    options,
  );
}
// @ts-ignore
export function useGetPantrySuspenseQuery(
  baseOptions?: ApolloReactHooks.SuspenseQueryHookOptions<
    GetPantryQuery,
    GetPantryQueryVariables
  >,
): ApolloReactHooks.UseSuspenseQueryResult<
  GetPantryQuery,
  GetPantryQueryVariables
>;
export function useGetPantrySuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<
        GetPantryQuery,
        GetPantryQueryVariables
      >,
): ApolloReactHooks.UseSuspenseQueryResult<
  GetPantryQuery | undefined,
  GetPantryQueryVariables
>;
export function useGetPantrySuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<
        GetPantryQuery,
        GetPantryQueryVariables
      >,
) {
  const options =
    baseOptions === ApolloReactHooks.skipToken
      ? baseOptions
      : { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useSuspenseQuery<
    GetPantryQuery,
    GetPantryQueryVariables
  >(GetPantryDocument, options);
}
export type GetPantryQueryHookResult = ReturnType<typeof useGetPantryQuery>;
export type GetPantryLazyQueryHookResult = ReturnType<
  typeof useGetPantryLazyQuery
>;
export type GetPantrySuspenseQueryHookResult = ReturnType<
  typeof useGetPantrySuspenseQuery
>;
export type GetPantryQueryResult = ApolloReactCommon.QueryResult<
  GetPantryQuery,
  GetPantryQueryVariables
>;
export const GetPantryItemDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'GetPantryItem' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'pantryItem' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'id' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'id' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'PantryItemFragment' },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PantryItemDisplay' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'PantryItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'FragmentSpread',
            name: { kind: 'Name', value: 'PantryItemCore' },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'item' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'imageUrl' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'images' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'url' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'kind' } },
                    ],
                  },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'unit' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'symbol' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'netWeightUnit' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'symbol' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'storageLocation' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'type' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'packageBreakdown' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'count' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'contentUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'perUnitNetWeight' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'perUnitNetWeightUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'totalNetWeight' },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'quantityBreakdown' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'fullPackages' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'looseContentUnits' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'contentUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'totalContentUnits' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'remainingWeight' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'remainingWeightUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PantryItemCore' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'PantryItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pantryId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'itemId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'itemName' } },
          { kind: 'Field', name: { kind: 'Name', value: 'quantity' } },
          { kind: 'Field', name: { kind: 'Name', value: 'version' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'storageState' } },
          { kind: 'Field', name: { kind: 'Name', value: 'expiresAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'lowStockAlert' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isLowStock' } },
          { kind: 'Field', name: { kind: 'Name', value: 'minQuantity' } },
          { kind: 'Field', name: { kind: 'Name', value: 'lastUsedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'netWeight' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'remainingNetWeight' },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'activeBatchCount' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'earliestBatchExpiration' },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PantryItemFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'PantryItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'FragmentSpread',
            name: { kind: 'Name', value: 'PantryItemDisplay' },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'item' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'shelfLifeDays' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'shelfLifeOpenedDays' },
                },
                { kind: 'Field', name: { kind: 'Name', value: 'nutritions' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'defaultConsumeIncrement' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'defaultConsumeUnitId' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'defaultConsumeUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                      { kind: 'Field', name: { kind: 'Name', value: 'type' } },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'displayUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'categories' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'isPrimary' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'category' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'id' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'name' },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'unitConversions' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'fromUnit' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'id' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'name' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'symbol' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'type' },
                            },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'toUnit' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'id' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'name' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'symbol' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'type' },
                            },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'conversionRatio' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'confidence' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'source' },
                      },
                    ],
                  },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'unit' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'type' } },
                { kind: 'Field', name: { kind: 'Name', value: 'isMetric' } },
                { kind: 'Field', name: { kind: 'Name', value: 'baseUnitId' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'conversionFactor' },
                },
                { kind: 'Field', name: { kind: 'Name', value: 'isCommon' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'displayAsFraction' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'minPrecision' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'autoConvertThreshold' },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'brand' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'tags' } },
          { kind: 'Field', name: { kind: 'Name', value: 'storageNotes' } },
          { kind: 'Field', name: { kind: 'Name', value: 'createdAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'restockQuantity' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'store' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'condition' } },
          { kind: 'Field', name: { kind: 'Name', value: 'acquisitionMethod' } },
          { kind: 'Field', name: { kind: 'Name', value: 'costPerUnit' } },
          { kind: 'Field', name: { kind: 'Name', value: 'totalCost' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'purchase' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'purchaseDate' },
                },
                { kind: 'Field', name: { kind: 'Name', value: 'unitPrice' } },
                { kind: 'Field', name: { kind: 'Name', value: 'totalPrice' } },
                { kind: 'Field', name: { kind: 'Name', value: 'quantity' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'usageRecords' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'first' },
                value: { kind: 'IntValue', value: '5' },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'edges' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'node' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'id' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'quantityUsed' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'usageUnit' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'symbol' },
                                  },
                                ],
                              },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'usedAt' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'purpose' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'adjustmentReason' },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'batches' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'PantryItemBatchFragment' },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PantryItemBatchFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'PantryItemBatch' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'batchNumber' } },
          { kind: 'Field', name: { kind: 'Name', value: 'quantity' } },
          { kind: 'Field', name: { kind: 'Name', value: 'status' } },
          { kind: 'Field', name: { kind: 'Name', value: 'expiresAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'expiresAtIsManual' } },
          { kind: 'Field', name: { kind: 'Name', value: 'costPerUnit' } },
          { kind: 'Field', name: { kind: 'Name', value: 'totalCost' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'store' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'notes' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isOpened' } },
          { kind: 'Field', name: { kind: 'Name', value: 'openedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'depletedAt' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'remainingNetWeight' },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'createdAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'wasteReason' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pantryItemId' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useGetPantryItemQuery__
 *
 * To run a query within a React component, call `useGetPantryItemQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetPantryItemQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetPantryItemQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useGetPantryItemQuery(
  baseOptions: ApolloReactHooks.QueryHookOptions<
    GetPantryItemQuery,
    GetPantryItemQueryVariables
  > &
    (
      | { variables: GetPantryItemQueryVariables; skip?: boolean }
      | { skip: boolean }
    ),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useQuery<
    GetPantryItemQuery,
    GetPantryItemQueryVariables
  >(GetPantryItemDocument, options);
}
export function useGetPantryItemLazyQuery(
  baseOptions?: ApolloReactHooks.LazyQueryHookOptions<
    GetPantryItemQuery,
    GetPantryItemQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useLazyQuery<
    GetPantryItemQuery,
    GetPantryItemQueryVariables
  >(GetPantryItemDocument, options);
}
// @ts-ignore
export function useGetPantryItemSuspenseQuery(
  baseOptions?: ApolloReactHooks.SuspenseQueryHookOptions<
    GetPantryItemQuery,
    GetPantryItemQueryVariables
  >,
): ApolloReactHooks.UseSuspenseQueryResult<
  GetPantryItemQuery,
  GetPantryItemQueryVariables
>;
export function useGetPantryItemSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<
        GetPantryItemQuery,
        GetPantryItemQueryVariables
      >,
): ApolloReactHooks.UseSuspenseQueryResult<
  GetPantryItemQuery | undefined,
  GetPantryItemQueryVariables
>;
export function useGetPantryItemSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<
        GetPantryItemQuery,
        GetPantryItemQueryVariables
      >,
) {
  const options =
    baseOptions === ApolloReactHooks.skipToken
      ? baseOptions
      : { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useSuspenseQuery<
    GetPantryItemQuery,
    GetPantryItemQueryVariables
  >(GetPantryItemDocument, options);
}
export type GetPantryItemQueryHookResult = ReturnType<
  typeof useGetPantryItemQuery
>;
export type GetPantryItemLazyQueryHookResult = ReturnType<
  typeof useGetPantryItemLazyQuery
>;
export type GetPantryItemSuspenseQueryHookResult = ReturnType<
  typeof useGetPantryItemSuspenseQuery
>;
export type GetPantryItemQueryResult = ApolloReactCommon.QueryResult<
  GetPantryItemQuery,
  GetPantryItemQueryVariables
>;
export const GetPantryItemSuggestionsDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'GetPantryItemSuggestions' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'pantryId' },
          },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'limit' },
          },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'Int' } },
          defaultValue: { kind: 'IntValue', value: '10' },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'pantry' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'id' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'pantryId' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'suggestions' },
                  arguments: [
                    {
                      kind: 'Argument',
                      name: { kind: 'Name', value: 'limit' },
                      value: {
                        kind: 'Variable',
                        name: { kind: 'Name', value: 'limit' },
                      },
                    },
                  ],
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'itemId' },
                      },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'source' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'imageUrl' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'category' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'defaultUnitId' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'defaultUnit' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'id' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'name' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'symbol' },
                            },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'item' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'id' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'name' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'imageUrl' },
                            },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'currentQuantity' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'minQuantity' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'restockQuantity' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'daysUntilExpiry' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'expiresAt' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'lastQuantity' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'lastUnitId' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'frequencyCount' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'popularityRank' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'pantryItemId' },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useGetPantryItemSuggestionsQuery__
 *
 * To run a query within a React component, call `useGetPantryItemSuggestionsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetPantryItemSuggestionsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetPantryItemSuggestionsQuery({
 *   variables: {
 *      pantryId: // value for 'pantryId'
 *      limit: // value for 'limit'
 *   },
 * });
 */
export function useGetPantryItemSuggestionsQuery(
  baseOptions: ApolloReactHooks.QueryHookOptions<
    GetPantryItemSuggestionsQuery,
    GetPantryItemSuggestionsQueryVariables
  > &
    (
      | { variables: GetPantryItemSuggestionsQueryVariables; skip?: boolean }
      | { skip: boolean }
    ),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useQuery<
    GetPantryItemSuggestionsQuery,
    GetPantryItemSuggestionsQueryVariables
  >(GetPantryItemSuggestionsDocument, options);
}
export function useGetPantryItemSuggestionsLazyQuery(
  baseOptions?: ApolloReactHooks.LazyQueryHookOptions<
    GetPantryItemSuggestionsQuery,
    GetPantryItemSuggestionsQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useLazyQuery<
    GetPantryItemSuggestionsQuery,
    GetPantryItemSuggestionsQueryVariables
  >(GetPantryItemSuggestionsDocument, options);
}
// @ts-ignore
export function useGetPantryItemSuggestionsSuspenseQuery(
  baseOptions?: ApolloReactHooks.SuspenseQueryHookOptions<
    GetPantryItemSuggestionsQuery,
    GetPantryItemSuggestionsQueryVariables
  >,
): ApolloReactHooks.UseSuspenseQueryResult<
  GetPantryItemSuggestionsQuery,
  GetPantryItemSuggestionsQueryVariables
>;
export function useGetPantryItemSuggestionsSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<
        GetPantryItemSuggestionsQuery,
        GetPantryItemSuggestionsQueryVariables
      >,
): ApolloReactHooks.UseSuspenseQueryResult<
  GetPantryItemSuggestionsQuery | undefined,
  GetPantryItemSuggestionsQueryVariables
>;
export function useGetPantryItemSuggestionsSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<
        GetPantryItemSuggestionsQuery,
        GetPantryItemSuggestionsQueryVariables
      >,
) {
  const options =
    baseOptions === ApolloReactHooks.skipToken
      ? baseOptions
      : { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useSuspenseQuery<
    GetPantryItemSuggestionsQuery,
    GetPantryItemSuggestionsQueryVariables
  >(GetPantryItemSuggestionsDocument, options);
}
export type GetPantryItemSuggestionsQueryHookResult = ReturnType<
  typeof useGetPantryItemSuggestionsQuery
>;
export type GetPantryItemSuggestionsLazyQueryHookResult = ReturnType<
  typeof useGetPantryItemSuggestionsLazyQuery
>;
export type GetPantryItemSuggestionsSuspenseQueryHookResult = ReturnType<
  typeof useGetPantryItemSuggestionsSuspenseQuery
>;
export type GetPantryItemSuggestionsQueryResult = ApolloReactCommon.QueryResult<
  GetPantryItemSuggestionsQuery,
  GetPantryItemSuggestionsQueryVariables
>;
export const GetPantryUsageAnalyticsDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'GetPantryUsageAnalytics' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'pantryId' },
          },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'filter' },
          },
          type: {
            kind: 'NamedType',
            name: { kind: 'Name', value: 'AnalyticsFilters' },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'pantry' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'id' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'pantryId' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'usageAnalytics' },
                  arguments: [
                    {
                      kind: 'Argument',
                      name: { kind: 'Name', value: 'filter' },
                      value: {
                        kind: 'Variable',
                        name: { kind: 'Name', value: 'filter' },
                      },
                    },
                  ],
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'totalUsageCount' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'totalQuantityUsed' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'averageUsagePerDay' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'periodStart' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'periodEnd' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'usageByPurpose' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'purpose' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'count' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'totalQuantity' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'percentage' },
                            },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'usageBySource' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'source' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'count' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'totalQuantity' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'percentage' },
                            },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'topUsedItems' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'itemId' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'itemName' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'imageUrl' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'count' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'totalQuantity' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'unitName' },
                            },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'usageTrend' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'date' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'value' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'count' },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useGetPantryUsageAnalyticsQuery__
 *
 * To run a query within a React component, call `useGetPantryUsageAnalyticsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetPantryUsageAnalyticsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetPantryUsageAnalyticsQuery({
 *   variables: {
 *      pantryId: // value for 'pantryId'
 *      filter: // value for 'filter'
 *   },
 * });
 */
export function useGetPantryUsageAnalyticsQuery(
  baseOptions: ApolloReactHooks.QueryHookOptions<
    GetPantryUsageAnalyticsQuery,
    GetPantryUsageAnalyticsQueryVariables
  > &
    (
      | { variables: GetPantryUsageAnalyticsQueryVariables; skip?: boolean }
      | { skip: boolean }
    ),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useQuery<
    GetPantryUsageAnalyticsQuery,
    GetPantryUsageAnalyticsQueryVariables
  >(GetPantryUsageAnalyticsDocument, options);
}
export function useGetPantryUsageAnalyticsLazyQuery(
  baseOptions?: ApolloReactHooks.LazyQueryHookOptions<
    GetPantryUsageAnalyticsQuery,
    GetPantryUsageAnalyticsQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useLazyQuery<
    GetPantryUsageAnalyticsQuery,
    GetPantryUsageAnalyticsQueryVariables
  >(GetPantryUsageAnalyticsDocument, options);
}
// @ts-ignore
export function useGetPantryUsageAnalyticsSuspenseQuery(
  baseOptions?: ApolloReactHooks.SuspenseQueryHookOptions<
    GetPantryUsageAnalyticsQuery,
    GetPantryUsageAnalyticsQueryVariables
  >,
): ApolloReactHooks.UseSuspenseQueryResult<
  GetPantryUsageAnalyticsQuery,
  GetPantryUsageAnalyticsQueryVariables
>;
export function useGetPantryUsageAnalyticsSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<
        GetPantryUsageAnalyticsQuery,
        GetPantryUsageAnalyticsQueryVariables
      >,
): ApolloReactHooks.UseSuspenseQueryResult<
  GetPantryUsageAnalyticsQuery | undefined,
  GetPantryUsageAnalyticsQueryVariables
>;
export function useGetPantryUsageAnalyticsSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<
        GetPantryUsageAnalyticsQuery,
        GetPantryUsageAnalyticsQueryVariables
      >,
) {
  const options =
    baseOptions === ApolloReactHooks.skipToken
      ? baseOptions
      : { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useSuspenseQuery<
    GetPantryUsageAnalyticsQuery,
    GetPantryUsageAnalyticsQueryVariables
  >(GetPantryUsageAnalyticsDocument, options);
}
export type GetPantryUsageAnalyticsQueryHookResult = ReturnType<
  typeof useGetPantryUsageAnalyticsQuery
>;
export type GetPantryUsageAnalyticsLazyQueryHookResult = ReturnType<
  typeof useGetPantryUsageAnalyticsLazyQuery
>;
export type GetPantryUsageAnalyticsSuspenseQueryHookResult = ReturnType<
  typeof useGetPantryUsageAnalyticsSuspenseQuery
>;
export type GetPantryUsageAnalyticsQueryResult = ApolloReactCommon.QueryResult<
  GetPantryUsageAnalyticsQuery,
  GetPantryUsageAnalyticsQueryVariables
>;
export const GetPantryWasteAnalyticsDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'GetPantryWasteAnalytics' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'pantryId' },
          },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'filter' },
          },
          type: {
            kind: 'NamedType',
            name: { kind: 'Name', value: 'AnalyticsFilters' },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'pantry' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'id' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'pantryId' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'wasteAnalytics' },
                  arguments: [
                    {
                      kind: 'Argument',
                      name: { kind: 'Name', value: 'filter' },
                      value: {
                        kind: 'Variable',
                        name: { kind: 'Name', value: 'filter' },
                      },
                    },
                  ],
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'totalWasteCount' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'totalWasteQuantity' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'totalWasteValue' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'averageWastePerDay' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'wasteRate' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'composted' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'recycled' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'periodStart' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'periodEnd' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'wasteByReason' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'reason' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'count' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'totalQuantity' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'percentage' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'estimatedValue' },
                            },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'topWastedItems' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'itemId' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'itemName' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'imageUrl' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'count' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'totalQuantity' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'unitName' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'estimatedValue' },
                            },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'wasteTrend' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'date' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'value' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'count' },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useGetPantryWasteAnalyticsQuery__
 *
 * To run a query within a React component, call `useGetPantryWasteAnalyticsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetPantryWasteAnalyticsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetPantryWasteAnalyticsQuery({
 *   variables: {
 *      pantryId: // value for 'pantryId'
 *      filter: // value for 'filter'
 *   },
 * });
 */
export function useGetPantryWasteAnalyticsQuery(
  baseOptions: ApolloReactHooks.QueryHookOptions<
    GetPantryWasteAnalyticsQuery,
    GetPantryWasteAnalyticsQueryVariables
  > &
    (
      | { variables: GetPantryWasteAnalyticsQueryVariables; skip?: boolean }
      | { skip: boolean }
    ),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useQuery<
    GetPantryWasteAnalyticsQuery,
    GetPantryWasteAnalyticsQueryVariables
  >(GetPantryWasteAnalyticsDocument, options);
}
export function useGetPantryWasteAnalyticsLazyQuery(
  baseOptions?: ApolloReactHooks.LazyQueryHookOptions<
    GetPantryWasteAnalyticsQuery,
    GetPantryWasteAnalyticsQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useLazyQuery<
    GetPantryWasteAnalyticsQuery,
    GetPantryWasteAnalyticsQueryVariables
  >(GetPantryWasteAnalyticsDocument, options);
}
// @ts-ignore
export function useGetPantryWasteAnalyticsSuspenseQuery(
  baseOptions?: ApolloReactHooks.SuspenseQueryHookOptions<
    GetPantryWasteAnalyticsQuery,
    GetPantryWasteAnalyticsQueryVariables
  >,
): ApolloReactHooks.UseSuspenseQueryResult<
  GetPantryWasteAnalyticsQuery,
  GetPantryWasteAnalyticsQueryVariables
>;
export function useGetPantryWasteAnalyticsSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<
        GetPantryWasteAnalyticsQuery,
        GetPantryWasteAnalyticsQueryVariables
      >,
): ApolloReactHooks.UseSuspenseQueryResult<
  GetPantryWasteAnalyticsQuery | undefined,
  GetPantryWasteAnalyticsQueryVariables
>;
export function useGetPantryWasteAnalyticsSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<
        GetPantryWasteAnalyticsQuery,
        GetPantryWasteAnalyticsQueryVariables
      >,
) {
  const options =
    baseOptions === ApolloReactHooks.skipToken
      ? baseOptions
      : { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useSuspenseQuery<
    GetPantryWasteAnalyticsQuery,
    GetPantryWasteAnalyticsQueryVariables
  >(GetPantryWasteAnalyticsDocument, options);
}
export type GetPantryWasteAnalyticsQueryHookResult = ReturnType<
  typeof useGetPantryWasteAnalyticsQuery
>;
export type GetPantryWasteAnalyticsLazyQueryHookResult = ReturnType<
  typeof useGetPantryWasteAnalyticsLazyQuery
>;
export type GetPantryWasteAnalyticsSuspenseQueryHookResult = ReturnType<
  typeof useGetPantryWasteAnalyticsSuspenseQuery
>;
export type GetPantryWasteAnalyticsQueryResult = ApolloReactCommon.QueryResult<
  GetPantryWasteAnalyticsQuery,
  GetPantryWasteAnalyticsQueryVariables
>;
export const GetPantryLedgerAnalyticsDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'GetPantryLedgerAnalytics' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'pantryId' },
          },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'filter' },
          },
          type: {
            kind: 'NamedType',
            name: { kind: 'Name', value: 'AnalyticsFilters' },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'granularity' },
          },
          type: {
            kind: 'NamedType',
            name: { kind: 'Name', value: 'PeriodGranularity' },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'pantry' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'id' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'pantryId' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'ledgerAnalytics' },
                  arguments: [
                    {
                      kind: 'Argument',
                      name: { kind: 'Name', value: 'filter' },
                      value: {
                        kind: 'Variable',
                        name: { kind: 'Name', value: 'filter' },
                      },
                    },
                    {
                      kind: 'Argument',
                      name: { kind: 'Name', value: 'granularity' },
                      value: {
                        kind: 'Variable',
                        name: { kind: 'Name', value: 'granularity' },
                      },
                    },
                  ],
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'granularity' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'periodStart' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'periodEnd' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'summary' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'totalAdded' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'totalConsumed' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'totalWasted' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'netQuantity' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'additionCount' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'consumptionCount' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'wasteCount' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'unitName' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'additionsByUnit' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'unitId' },
                                  },
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'unitName' },
                                  },
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'unitSymbol' },
                                  },
                                  {
                                    kind: 'Field',
                                    name: {
                                      kind: 'Name',
                                      value: 'totalQuantity',
                                    },
                                  },
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'count' },
                                  },
                                ],
                              },
                            },
                            {
                              kind: 'Field',
                              name: {
                                kind: 'Name',
                                value: 'consumptionByUnit',
                              },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'unitId' },
                                  },
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'unitName' },
                                  },
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'unitSymbol' },
                                  },
                                  {
                                    kind: 'Field',
                                    name: {
                                      kind: 'Name',
                                      value: 'totalQuantity',
                                    },
                                  },
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'count' },
                                  },
                                ],
                              },
                            },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'periodData' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'periodStart' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'periodEnd' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'periodLabel' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'added' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'consumed' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'wasted' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'net' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'additionCost' },
                            },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'costAnalytics' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'totalSpent' },
                            },
                            {
                              kind: 'Field',
                              name: {
                                kind: 'Name',
                                value: 'averageCostPerUnit',
                              },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'costByStore' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'storeId' },
                                  },
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'storeName' },
                                  },
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'totalSpent' },
                                  },
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'itemCount' },
                                  },
                                  {
                                    kind: 'Field',
                                    name: {
                                      kind: 'Name',
                                      value: 'averageCostPerUnit',
                                    },
                                  },
                                ],
                              },
                            },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'topRestockedItems' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'itemId' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'itemName' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'imageUrl' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'totalQuantity' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'unitName' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'count' },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useGetPantryLedgerAnalyticsQuery__
 *
 * To run a query within a React component, call `useGetPantryLedgerAnalyticsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetPantryLedgerAnalyticsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetPantryLedgerAnalyticsQuery({
 *   variables: {
 *      pantryId: // value for 'pantryId'
 *      filter: // value for 'filter'
 *      granularity: // value for 'granularity'
 *   },
 * });
 */
export function useGetPantryLedgerAnalyticsQuery(
  baseOptions: ApolloReactHooks.QueryHookOptions<
    GetPantryLedgerAnalyticsQuery,
    GetPantryLedgerAnalyticsQueryVariables
  > &
    (
      | { variables: GetPantryLedgerAnalyticsQueryVariables; skip?: boolean }
      | { skip: boolean }
    ),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useQuery<
    GetPantryLedgerAnalyticsQuery,
    GetPantryLedgerAnalyticsQueryVariables
  >(GetPantryLedgerAnalyticsDocument, options);
}
export function useGetPantryLedgerAnalyticsLazyQuery(
  baseOptions?: ApolloReactHooks.LazyQueryHookOptions<
    GetPantryLedgerAnalyticsQuery,
    GetPantryLedgerAnalyticsQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useLazyQuery<
    GetPantryLedgerAnalyticsQuery,
    GetPantryLedgerAnalyticsQueryVariables
  >(GetPantryLedgerAnalyticsDocument, options);
}
// @ts-ignore
export function useGetPantryLedgerAnalyticsSuspenseQuery(
  baseOptions?: ApolloReactHooks.SuspenseQueryHookOptions<
    GetPantryLedgerAnalyticsQuery,
    GetPantryLedgerAnalyticsQueryVariables
  >,
): ApolloReactHooks.UseSuspenseQueryResult<
  GetPantryLedgerAnalyticsQuery,
  GetPantryLedgerAnalyticsQueryVariables
>;
export function useGetPantryLedgerAnalyticsSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<
        GetPantryLedgerAnalyticsQuery,
        GetPantryLedgerAnalyticsQueryVariables
      >,
): ApolloReactHooks.UseSuspenseQueryResult<
  GetPantryLedgerAnalyticsQuery | undefined,
  GetPantryLedgerAnalyticsQueryVariables
>;
export function useGetPantryLedgerAnalyticsSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<
        GetPantryLedgerAnalyticsQuery,
        GetPantryLedgerAnalyticsQueryVariables
      >,
) {
  const options =
    baseOptions === ApolloReactHooks.skipToken
      ? baseOptions
      : { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useSuspenseQuery<
    GetPantryLedgerAnalyticsQuery,
    GetPantryLedgerAnalyticsQueryVariables
  >(GetPantryLedgerAnalyticsDocument, options);
}
export type GetPantryLedgerAnalyticsQueryHookResult = ReturnType<
  typeof useGetPantryLedgerAnalyticsQuery
>;
export type GetPantryLedgerAnalyticsLazyQueryHookResult = ReturnType<
  typeof useGetPantryLedgerAnalyticsLazyQuery
>;
export type GetPantryLedgerAnalyticsSuspenseQueryHookResult = ReturnType<
  typeof useGetPantryLedgerAnalyticsSuspenseQuery
>;
export type GetPantryLedgerAnalyticsQueryResult = ApolloReactCommon.QueryResult<
  GetPantryLedgerAnalyticsQuery,
  GetPantryLedgerAnalyticsQueryVariables
>;
export const ConsumptionUnitsForItemDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'ConsumptionUnitsForItem' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'itemId' },
          },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'trackingUnitId' },
          },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'netWeightUnitId' },
          },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'consumptionUnitsForItem' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'itemId' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'itemId' },
                },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'trackingUnitId' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'trackingUnitId' },
                },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'netWeightUnitId' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'netWeightUnitId' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'unit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                      { kind: 'Field', name: { kind: 'Name', value: 'type' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'unitRole' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'commonFractions' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'displayAsFraction' },
                      },
                    ],
                  },
                },
                { kind: 'Field', name: { kind: 'Name', value: 'rank' } },
                { kind: 'Field', name: { kind: 'Name', value: 'source' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'defaultIncrement' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'commonFractions' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'isWholeContainer' },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useConsumptionUnitsForItemQuery__
 *
 * To run a query within a React component, call `useConsumptionUnitsForItemQuery` and pass it any options that fit your needs.
 * When your component renders, `useConsumptionUnitsForItemQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useConsumptionUnitsForItemQuery({
 *   variables: {
 *      itemId: // value for 'itemId'
 *      trackingUnitId: // value for 'trackingUnitId'
 *      netWeightUnitId: // value for 'netWeightUnitId'
 *   },
 * });
 */
export function useConsumptionUnitsForItemQuery(
  baseOptions: ApolloReactHooks.QueryHookOptions<
    ConsumptionUnitsForItemQuery,
    ConsumptionUnitsForItemQueryVariables
  > &
    (
      | { variables: ConsumptionUnitsForItemQueryVariables; skip?: boolean }
      | { skip: boolean }
    ),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useQuery<
    ConsumptionUnitsForItemQuery,
    ConsumptionUnitsForItemQueryVariables
  >(ConsumptionUnitsForItemDocument, options);
}
export function useConsumptionUnitsForItemLazyQuery(
  baseOptions?: ApolloReactHooks.LazyQueryHookOptions<
    ConsumptionUnitsForItemQuery,
    ConsumptionUnitsForItemQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useLazyQuery<
    ConsumptionUnitsForItemQuery,
    ConsumptionUnitsForItemQueryVariables
  >(ConsumptionUnitsForItemDocument, options);
}
// @ts-ignore
export function useConsumptionUnitsForItemSuspenseQuery(
  baseOptions?: ApolloReactHooks.SuspenseQueryHookOptions<
    ConsumptionUnitsForItemQuery,
    ConsumptionUnitsForItemQueryVariables
  >,
): ApolloReactHooks.UseSuspenseQueryResult<
  ConsumptionUnitsForItemQuery,
  ConsumptionUnitsForItemQueryVariables
>;
export function useConsumptionUnitsForItemSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<
        ConsumptionUnitsForItemQuery,
        ConsumptionUnitsForItemQueryVariables
      >,
): ApolloReactHooks.UseSuspenseQueryResult<
  ConsumptionUnitsForItemQuery | undefined,
  ConsumptionUnitsForItemQueryVariables
>;
export function useConsumptionUnitsForItemSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<
        ConsumptionUnitsForItemQuery,
        ConsumptionUnitsForItemQueryVariables
      >,
) {
  const options =
    baseOptions === ApolloReactHooks.skipToken
      ? baseOptions
      : { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useSuspenseQuery<
    ConsumptionUnitsForItemQuery,
    ConsumptionUnitsForItemQueryVariables
  >(ConsumptionUnitsForItemDocument, options);
}
export type ConsumptionUnitsForItemQueryHookResult = ReturnType<
  typeof useConsumptionUnitsForItemQuery
>;
export type ConsumptionUnitsForItemLazyQueryHookResult = ReturnType<
  typeof useConsumptionUnitsForItemLazyQuery
>;
export type ConsumptionUnitsForItemSuspenseQueryHookResult = ReturnType<
  typeof useConsumptionUnitsForItemSuspenseQuery
>;
export type ConsumptionUnitsForItemQueryResult = ApolloReactCommon.QueryResult<
  ConsumptionUnitsForItemQuery,
  ConsumptionUnitsForItemQueryVariables
>;
export const RestockUnitsForItemDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'RestockUnitsForItem' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'pantryItemId' },
          },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'restockUnitsForItem' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'pantryItemId' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'pantryItemId' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'unit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                      { kind: 'Field', name: { kind: 'Name', value: 'type' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'unitRole' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'commonFractions' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'displayAsFraction' },
                      },
                    ],
                  },
                },
                { kind: 'Field', name: { kind: 'Name', value: 'rank' } },
                { kind: 'Field', name: { kind: 'Name', value: 'source' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'defaultIncrement' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'commonFractions' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'isWholeContainer' },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useRestockUnitsForItemQuery__
 *
 * To run a query within a React component, call `useRestockUnitsForItemQuery` and pass it any options that fit your needs.
 * When your component renders, `useRestockUnitsForItemQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useRestockUnitsForItemQuery({
 *   variables: {
 *      pantryItemId: // value for 'pantryItemId'
 *   },
 * });
 */
export function useRestockUnitsForItemQuery(
  baseOptions: ApolloReactHooks.QueryHookOptions<
    RestockUnitsForItemQuery,
    RestockUnitsForItemQueryVariables
  > &
    (
      | { variables: RestockUnitsForItemQueryVariables; skip?: boolean }
      | { skip: boolean }
    ),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useQuery<
    RestockUnitsForItemQuery,
    RestockUnitsForItemQueryVariables
  >(RestockUnitsForItemDocument, options);
}
export function useRestockUnitsForItemLazyQuery(
  baseOptions?: ApolloReactHooks.LazyQueryHookOptions<
    RestockUnitsForItemQuery,
    RestockUnitsForItemQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useLazyQuery<
    RestockUnitsForItemQuery,
    RestockUnitsForItemQueryVariables
  >(RestockUnitsForItemDocument, options);
}
// @ts-ignore
export function useRestockUnitsForItemSuspenseQuery(
  baseOptions?: ApolloReactHooks.SuspenseQueryHookOptions<
    RestockUnitsForItemQuery,
    RestockUnitsForItemQueryVariables
  >,
): ApolloReactHooks.UseSuspenseQueryResult<
  RestockUnitsForItemQuery,
  RestockUnitsForItemQueryVariables
>;
export function useRestockUnitsForItemSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<
        RestockUnitsForItemQuery,
        RestockUnitsForItemQueryVariables
      >,
): ApolloReactHooks.UseSuspenseQueryResult<
  RestockUnitsForItemQuery | undefined,
  RestockUnitsForItemQueryVariables
>;
export function useRestockUnitsForItemSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<
        RestockUnitsForItemQuery,
        RestockUnitsForItemQueryVariables
      >,
) {
  const options =
    baseOptions === ApolloReactHooks.skipToken
      ? baseOptions
      : { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useSuspenseQuery<
    RestockUnitsForItemQuery,
    RestockUnitsForItemQueryVariables
  >(RestockUnitsForItemDocument, options);
}
export type RestockUnitsForItemQueryHookResult = ReturnType<
  typeof useRestockUnitsForItemQuery
>;
export type RestockUnitsForItemLazyQueryHookResult = ReturnType<
  typeof useRestockUnitsForItemLazyQuery
>;
export type RestockUnitsForItemSuspenseQueryHookResult = ReturnType<
  typeof useRestockUnitsForItemSuspenseQuery
>;
export type RestockUnitsForItemQueryResult = ApolloReactCommon.QueryResult<
  RestockUnitsForItemQuery,
  RestockUnitsForItemQueryVariables
>;
export const CreatePantryDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'CreatePantry' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'input' },
          },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'NamedType',
              name: { kind: 'Name', value: 'CreatePantryInput' },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'createPantry' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'input' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'input' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'success' } },
                { kind: 'Field', name: { kind: 'Name', value: 'message' } },
                { kind: 'Field', name: { kind: 'Name', value: 'code' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'pantry' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'homeId' },
                      },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'description' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'isDefault' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'version' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'createdAt' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'updatedAt' },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useCreatePantryMutation__
 *
 * To run a mutation, you first call `useCreatePantryMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useCreatePantryMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [createPantryMutation, { data, loading, error }] = useCreatePantryMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useCreatePantryMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    CreatePantryMutation,
    CreatePantryMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<
    CreatePantryMutation,
    CreatePantryMutationVariables
  >(CreatePantryDocument, options);
}
export type CreatePantryMutationHookResult = ReturnType<
  typeof useCreatePantryMutation
>;
export type CreatePantryMutationResult =
  ApolloReactCommon.MutationResult<CreatePantryMutation>;
export type CreatePantryMutationOptions = ApolloReactCommon.BaseMutationOptions<
  CreatePantryMutation,
  CreatePantryMutationVariables
>;
export const UpdatePantryDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'UpdatePantry' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'input' },
          },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'NamedType',
              name: { kind: 'Name', value: 'UpdatePantryInput' },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'updatePantry' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'id' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'id' },
                },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'input' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'input' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'success' } },
                { kind: 'Field', name: { kind: 'Name', value: 'message' } },
                { kind: 'Field', name: { kind: 'Name', value: 'code' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'pantry' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'homeId' },
                      },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'description' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'isDefault' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'version' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'createdAt' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'updatedAt' },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useUpdatePantryMutation__
 *
 * To run a mutation, you first call `useUpdatePantryMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdatePantryMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updatePantryMutation, { data, loading, error }] = useUpdatePantryMutation({
 *   variables: {
 *      id: // value for 'id'
 *      input: // value for 'input'
 *   },
 * });
 */
export function useUpdatePantryMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    UpdatePantryMutation,
    UpdatePantryMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<
    UpdatePantryMutation,
    UpdatePantryMutationVariables
  >(UpdatePantryDocument, options);
}
export type UpdatePantryMutationHookResult = ReturnType<
  typeof useUpdatePantryMutation
>;
export type UpdatePantryMutationResult =
  ApolloReactCommon.MutationResult<UpdatePantryMutation>;
export type UpdatePantryMutationOptions = ApolloReactCommon.BaseMutationOptions<
  UpdatePantryMutation,
  UpdatePantryMutationVariables
>;
export const DeletePantryDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'DeletePantry' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'deletePantry' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'id' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'id' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'success' } },
                { kind: 'Field', name: { kind: 'Name', value: 'message' } },
                { kind: 'Field', name: { kind: 'Name', value: 'code' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'pantry' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useDeletePantryMutation__
 *
 * To run a mutation, you first call `useDeletePantryMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useDeletePantryMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [deletePantryMutation, { data, loading, error }] = useDeletePantryMutation({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useDeletePantryMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    DeletePantryMutation,
    DeletePantryMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<
    DeletePantryMutation,
    DeletePantryMutationVariables
  >(DeletePantryDocument, options);
}
export type DeletePantryMutationHookResult = ReturnType<
  typeof useDeletePantryMutation
>;
export type DeletePantryMutationResult =
  ApolloReactCommon.MutationResult<DeletePantryMutation>;
export type DeletePantryMutationOptions = ApolloReactCommon.BaseMutationOptions<
  DeletePantryMutation,
  DeletePantryMutationVariables
>;
export const SetDefaultPantryDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'SetDefaultPantry' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'setDefaultPantry' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'id' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'id' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'success' } },
                { kind: 'Field', name: { kind: 'Name', value: 'message' } },
                { kind: 'Field', name: { kind: 'Name', value: 'code' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'pantry' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'isDefault' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'homeId' },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useSetDefaultPantryMutation__
 *
 * To run a mutation, you first call `useSetDefaultPantryMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useSetDefaultPantryMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [setDefaultPantryMutation, { data, loading, error }] = useSetDefaultPantryMutation({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useSetDefaultPantryMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    SetDefaultPantryMutation,
    SetDefaultPantryMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<
    SetDefaultPantryMutation,
    SetDefaultPantryMutationVariables
  >(SetDefaultPantryDocument, options);
}
export type SetDefaultPantryMutationHookResult = ReturnType<
  typeof useSetDefaultPantryMutation
>;
export type SetDefaultPantryMutationResult =
  ApolloReactCommon.MutationResult<SetDefaultPantryMutation>;
export type SetDefaultPantryMutationOptions =
  ApolloReactCommon.BaseMutationOptions<
    SetDefaultPantryMutation,
    SetDefaultPantryMutationVariables
  >;
export const CreatePantryItemDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'CreatePantryItem' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'input' },
          },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'NamedType',
              name: { kind: 'Name', value: 'CreatePantryItemInput' },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'createPantryItem' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'input' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'input' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'success' } },
                { kind: 'Field', name: { kind: 'Name', value: 'message' } },
                { kind: 'Field', name: { kind: 'Name', value: 'code' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'pantryItem' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: { kind: 'Name', value: 'PantryItemDisplay' },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PantryItemDisplay' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'PantryItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'FragmentSpread',
            name: { kind: 'Name', value: 'PantryItemCore' },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'item' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'imageUrl' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'images' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'url' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'kind' } },
                    ],
                  },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'unit' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'symbol' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'netWeightUnit' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'symbol' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'storageLocation' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'type' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'packageBreakdown' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'count' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'contentUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'perUnitNetWeight' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'perUnitNetWeightUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'totalNetWeight' },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'quantityBreakdown' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'fullPackages' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'looseContentUnits' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'contentUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'totalContentUnits' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'remainingWeight' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'remainingWeightUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PantryItemCore' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'PantryItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pantryId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'itemId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'itemName' } },
          { kind: 'Field', name: { kind: 'Name', value: 'quantity' } },
          { kind: 'Field', name: { kind: 'Name', value: 'version' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'storageState' } },
          { kind: 'Field', name: { kind: 'Name', value: 'expiresAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'lowStockAlert' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isLowStock' } },
          { kind: 'Field', name: { kind: 'Name', value: 'minQuantity' } },
          { kind: 'Field', name: { kind: 'Name', value: 'lastUsedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'netWeight' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'remainingNetWeight' },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'activeBatchCount' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'earliestBatchExpiration' },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useCreatePantryItemMutation__
 *
 * To run a mutation, you first call `useCreatePantryItemMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useCreatePantryItemMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [createPantryItemMutation, { data, loading, error }] = useCreatePantryItemMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useCreatePantryItemMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    CreatePantryItemMutation,
    CreatePantryItemMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<
    CreatePantryItemMutation,
    CreatePantryItemMutationVariables
  >(CreatePantryItemDocument, options);
}
export type CreatePantryItemMutationHookResult = ReturnType<
  typeof useCreatePantryItemMutation
>;
export type CreatePantryItemMutationResult =
  ApolloReactCommon.MutationResult<CreatePantryItemMutation>;
export type CreatePantryItemMutationOptions =
  ApolloReactCommon.BaseMutationOptions<
    CreatePantryItemMutation,
    CreatePantryItemMutationVariables
  >;
export const UpdatePantryItemDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'UpdatePantryItem' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'input' },
          },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'NamedType',
              name: { kind: 'Name', value: 'UpdatePantryItemInput' },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'updatePantryItem' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'id' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'id' },
                },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'input' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'input' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'success' } },
                { kind: 'Field', name: { kind: 'Name', value: 'message' } },
                { kind: 'Field', name: { kind: 'Name', value: 'code' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'pantryItem' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: { kind: 'Name', value: 'PantryItemDisplay' },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PantryItemDisplay' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'PantryItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'FragmentSpread',
            name: { kind: 'Name', value: 'PantryItemCore' },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'item' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'imageUrl' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'images' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'url' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'kind' } },
                    ],
                  },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'unit' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'symbol' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'netWeightUnit' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'symbol' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'storageLocation' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'type' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'packageBreakdown' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'count' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'contentUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'perUnitNetWeight' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'perUnitNetWeightUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'totalNetWeight' },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'quantityBreakdown' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'fullPackages' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'looseContentUnits' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'contentUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'totalContentUnits' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'remainingWeight' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'remainingWeightUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PantryItemCore' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'PantryItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pantryId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'itemId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'itemName' } },
          { kind: 'Field', name: { kind: 'Name', value: 'quantity' } },
          { kind: 'Field', name: { kind: 'Name', value: 'version' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'storageState' } },
          { kind: 'Field', name: { kind: 'Name', value: 'expiresAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'lowStockAlert' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isLowStock' } },
          { kind: 'Field', name: { kind: 'Name', value: 'minQuantity' } },
          { kind: 'Field', name: { kind: 'Name', value: 'lastUsedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'netWeight' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'remainingNetWeight' },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'activeBatchCount' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'earliestBatchExpiration' },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useUpdatePantryItemMutation__
 *
 * To run a mutation, you first call `useUpdatePantryItemMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdatePantryItemMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updatePantryItemMutation, { data, loading, error }] = useUpdatePantryItemMutation({
 *   variables: {
 *      id: // value for 'id'
 *      input: // value for 'input'
 *   },
 * });
 */
export function useUpdatePantryItemMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    UpdatePantryItemMutation,
    UpdatePantryItemMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<
    UpdatePantryItemMutation,
    UpdatePantryItemMutationVariables
  >(UpdatePantryItemDocument, options);
}
export type UpdatePantryItemMutationHookResult = ReturnType<
  typeof useUpdatePantryItemMutation
>;
export type UpdatePantryItemMutationResult =
  ApolloReactCommon.MutationResult<UpdatePantryItemMutation>;
export type UpdatePantryItemMutationOptions =
  ApolloReactCommon.BaseMutationOptions<
    UpdatePantryItemMutation,
    UpdatePantryItemMutationVariables
  >;
export const DeletePantryItemDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'DeletePantryItem' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'deletePantryItem' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'id' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'id' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'success' } },
                { kind: 'Field', name: { kind: 'Name', value: 'message' } },
                { kind: 'Field', name: { kind: 'Name', value: 'code' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'pantryItem' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useDeletePantryItemMutation__
 *
 * To run a mutation, you first call `useDeletePantryItemMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useDeletePantryItemMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [deletePantryItemMutation, { data, loading, error }] = useDeletePantryItemMutation({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useDeletePantryItemMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    DeletePantryItemMutation,
    DeletePantryItemMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<
    DeletePantryItemMutation,
    DeletePantryItemMutationVariables
  >(DeletePantryItemDocument, options);
}
export type DeletePantryItemMutationHookResult = ReturnType<
  typeof useDeletePantryItemMutation
>;
export type DeletePantryItemMutationResult =
  ApolloReactCommon.MutationResult<DeletePantryItemMutation>;
export type DeletePantryItemMutationOptions =
  ApolloReactCommon.BaseMutationOptions<
    DeletePantryItemMutation,
    DeletePantryItemMutationVariables
  >;
export const CreatePantryItemUsageDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'CreatePantryItemUsage' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'input' },
          },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'NamedType',
              name: { kind: 'Name', value: 'RecordPantryItemUsageInput' },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'createPantryItemUsage' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'input' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'input' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'success' } },
                { kind: 'Field', name: { kind: 'Name', value: 'message' } },
                { kind: 'Field', name: { kind: 'Name', value: 'code' } },
                { kind: 'Field', name: { kind: 'Name', value: 'validUnits' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'pantryItemUsage' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'quantityUsed' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'usageUnitId' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'usageUnit' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'id' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'name' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'symbol' },
                            },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'usedAt' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'purpose' },
                      },
                      { kind: 'Field', name: { kind: 'Name', value: 'notes' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'wasteReason' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'isComposted' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'isRecycled' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'pantryItem' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'id' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'quantity' },
                            },
                            {
                              kind: 'FragmentSpread',
                              name: {
                                kind: 'Name',
                                value: 'PantryItemDisplay',
                              },
                            },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'usedBy' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'id' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'email' },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PantryItemDisplay' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'PantryItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'FragmentSpread',
            name: { kind: 'Name', value: 'PantryItemCore' },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'item' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'imageUrl' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'images' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'url' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'kind' } },
                    ],
                  },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'unit' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'symbol' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'netWeightUnit' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'symbol' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'storageLocation' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'type' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'packageBreakdown' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'count' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'contentUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'perUnitNetWeight' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'perUnitNetWeightUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'totalNetWeight' },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'quantityBreakdown' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'fullPackages' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'looseContentUnits' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'contentUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'totalContentUnits' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'remainingWeight' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'remainingWeightUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PantryItemCore' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'PantryItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pantryId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'itemId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'itemName' } },
          { kind: 'Field', name: { kind: 'Name', value: 'quantity' } },
          { kind: 'Field', name: { kind: 'Name', value: 'version' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'storageState' } },
          { kind: 'Field', name: { kind: 'Name', value: 'expiresAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'lowStockAlert' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isLowStock' } },
          { kind: 'Field', name: { kind: 'Name', value: 'minQuantity' } },
          { kind: 'Field', name: { kind: 'Name', value: 'lastUsedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'netWeight' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'remainingNetWeight' },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'activeBatchCount' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'earliestBatchExpiration' },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useCreatePantryItemUsageMutation__
 *
 * To run a mutation, you first call `useCreatePantryItemUsageMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useCreatePantryItemUsageMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [createPantryItemUsageMutation, { data, loading, error }] = useCreatePantryItemUsageMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useCreatePantryItemUsageMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    CreatePantryItemUsageMutation,
    CreatePantryItemUsageMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<
    CreatePantryItemUsageMutation,
    CreatePantryItemUsageMutationVariables
  >(CreatePantryItemUsageDocument, options);
}
export type CreatePantryItemUsageMutationHookResult = ReturnType<
  typeof useCreatePantryItemUsageMutation
>;
export type CreatePantryItemUsageMutationResult =
  ApolloReactCommon.MutationResult<CreatePantryItemUsageMutation>;
export type CreatePantryItemUsageMutationOptions =
  ApolloReactCommon.BaseMutationOptions<
    CreatePantryItemUsageMutation,
    CreatePantryItemUsageMutationVariables
  >;
export const RestockPantryItemDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'RestockPantryItem' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'input' },
          },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'NamedType',
              name: { kind: 'Name', value: 'RestockPantryItemInput' },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'restockPantryItem' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'id' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'id' },
                },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'input' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'input' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'success' } },
                { kind: 'Field', name: { kind: 'Name', value: 'message' } },
                { kind: 'Field', name: { kind: 'Name', value: 'code' } },
                { kind: 'Field', name: { kind: 'Name', value: 'validUnits' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'pantryItemUsage' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'quantityUsed' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'purpose' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'costPerUnit' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'totalCost' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'pantryItem' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'FragmentSpread',
                              name: {
                                kind: 'Name',
                                value: 'PantryItemDisplay',
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PantryItemDisplay' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'PantryItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'FragmentSpread',
            name: { kind: 'Name', value: 'PantryItemCore' },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'item' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'imageUrl' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'images' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'url' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'kind' } },
                    ],
                  },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'unit' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'symbol' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'netWeightUnit' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'symbol' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'storageLocation' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'type' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'packageBreakdown' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'count' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'contentUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'perUnitNetWeight' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'perUnitNetWeightUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'totalNetWeight' },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'quantityBreakdown' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'fullPackages' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'looseContentUnits' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'contentUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'totalContentUnits' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'remainingWeight' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'remainingWeightUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PantryItemCore' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'PantryItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pantryId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'itemId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'itemName' } },
          { kind: 'Field', name: { kind: 'Name', value: 'quantity' } },
          { kind: 'Field', name: { kind: 'Name', value: 'version' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'storageState' } },
          { kind: 'Field', name: { kind: 'Name', value: 'expiresAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'lowStockAlert' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isLowStock' } },
          { kind: 'Field', name: { kind: 'Name', value: 'minQuantity' } },
          { kind: 'Field', name: { kind: 'Name', value: 'lastUsedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'netWeight' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'remainingNetWeight' },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'activeBatchCount' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'earliestBatchExpiration' },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useRestockPantryItemMutation__
 *
 * To run a mutation, you first call `useRestockPantryItemMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useRestockPantryItemMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [restockPantryItemMutation, { data, loading, error }] = useRestockPantryItemMutation({
 *   variables: {
 *      id: // value for 'id'
 *      input: // value for 'input'
 *   },
 * });
 */
export function useRestockPantryItemMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    RestockPantryItemMutation,
    RestockPantryItemMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<
    RestockPantryItemMutation,
    RestockPantryItemMutationVariables
  >(RestockPantryItemDocument, options);
}
export type RestockPantryItemMutationHookResult = ReturnType<
  typeof useRestockPantryItemMutation
>;
export type RestockPantryItemMutationResult =
  ApolloReactCommon.MutationResult<RestockPantryItemMutation>;
export type RestockPantryItemMutationOptions =
  ApolloReactCommon.BaseMutationOptions<
    RestockPantryItemMutation,
    RestockPantryItemMutationVariables
  >;
export const UpdatePantryItemQuantityDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'UpdatePantryItemQuantity' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'pantryItemId' },
          },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'quantity' },
          },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'NamedType',
              name: { kind: 'Name', value: 'String' },
            },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'unitId' },
          },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
        },
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'version' },
          },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'Int' } },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'updatePantryItemQuantity' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'pantryItemId' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'pantryItemId' },
                },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'quantity' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'quantity' },
                },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'unitId' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'unitId' },
                },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'version' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'version' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'success' } },
                { kind: 'Field', name: { kind: 'Name', value: 'message' } },
                { kind: 'Field', name: { kind: 'Name', value: 'code' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'pantryItem' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: { kind: 'Name', value: 'PantryItemDisplay' },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PantryItemDisplay' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'PantryItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'FragmentSpread',
            name: { kind: 'Name', value: 'PantryItemCore' },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'item' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'imageUrl' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'images' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'url' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'kind' } },
                    ],
                  },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'unit' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'symbol' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'netWeightUnit' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'symbol' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'storageLocation' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'type' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'packageBreakdown' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'count' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'contentUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'perUnitNetWeight' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'perUnitNetWeightUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'totalNetWeight' },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'quantityBreakdown' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'fullPackages' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'looseContentUnits' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'contentUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'totalContentUnits' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'remainingWeight' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'remainingWeightUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PantryItemCore' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'PantryItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pantryId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'itemId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'itemName' } },
          { kind: 'Field', name: { kind: 'Name', value: 'quantity' } },
          { kind: 'Field', name: { kind: 'Name', value: 'version' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'storageState' } },
          { kind: 'Field', name: { kind: 'Name', value: 'expiresAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'lowStockAlert' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isLowStock' } },
          { kind: 'Field', name: { kind: 'Name', value: 'minQuantity' } },
          { kind: 'Field', name: { kind: 'Name', value: 'lastUsedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'netWeight' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'remainingNetWeight' },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'activeBatchCount' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'earliestBatchExpiration' },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useUpdatePantryItemQuantityMutation__
 *
 * To run a mutation, you first call `useUpdatePantryItemQuantityMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdatePantryItemQuantityMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updatePantryItemQuantityMutation, { data, loading, error }] = useUpdatePantryItemQuantityMutation({
 *   variables: {
 *      pantryItemId: // value for 'pantryItemId'
 *      quantity: // value for 'quantity'
 *      unitId: // value for 'unitId'
 *      version: // value for 'version'
 *   },
 * });
 */
export function useUpdatePantryItemQuantityMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    UpdatePantryItemQuantityMutation,
    UpdatePantryItemQuantityMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<
    UpdatePantryItemQuantityMutation,
    UpdatePantryItemQuantityMutationVariables
  >(UpdatePantryItemQuantityDocument, options);
}
export type UpdatePantryItemQuantityMutationHookResult = ReturnType<
  typeof useUpdatePantryItemQuantityMutation
>;
export type UpdatePantryItemQuantityMutationResult =
  ApolloReactCommon.MutationResult<UpdatePantryItemQuantityMutation>;
export type UpdatePantryItemQuantityMutationOptions =
  ApolloReactCommon.BaseMutationOptions<
    UpdatePantryItemQuantityMutation,
    UpdatePantryItemQuantityMutationVariables
  >;
export const AdjustPantryItemQuantityDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'AdjustPantryItemQuantity' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'input' },
          },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'NamedType',
              name: { kind: 'Name', value: 'AdjustPantryItemQuantityInput' },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'adjustPantryItemQuantity' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'id' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'id' },
                },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'input' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'input' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'success' } },
                { kind: 'Field', name: { kind: 'Name', value: 'message' } },
                { kind: 'Field', name: { kind: 'Name', value: 'code' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'pantryItem' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: { kind: 'Name', value: 'PantryItemDisplay' },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PantryItemDisplay' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'PantryItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'FragmentSpread',
            name: { kind: 'Name', value: 'PantryItemCore' },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'item' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'imageUrl' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'images' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'url' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'kind' } },
                    ],
                  },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'unit' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'symbol' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'netWeightUnit' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'symbol' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'storageLocation' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'type' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'packageBreakdown' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'count' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'contentUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'perUnitNetWeight' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'perUnitNetWeightUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'totalNetWeight' },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'quantityBreakdown' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'fullPackages' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'looseContentUnits' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'contentUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'totalContentUnits' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'remainingWeight' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'remainingWeightUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PantryItemCore' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'PantryItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pantryId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'itemId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'itemName' } },
          { kind: 'Field', name: { kind: 'Name', value: 'quantity' } },
          { kind: 'Field', name: { kind: 'Name', value: 'version' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'storageState' } },
          { kind: 'Field', name: { kind: 'Name', value: 'expiresAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'lowStockAlert' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isLowStock' } },
          { kind: 'Field', name: { kind: 'Name', value: 'minQuantity' } },
          { kind: 'Field', name: { kind: 'Name', value: 'lastUsedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'netWeight' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'remainingNetWeight' },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'activeBatchCount' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'earliestBatchExpiration' },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useAdjustPantryItemQuantityMutation__
 *
 * To run a mutation, you first call `useAdjustPantryItemQuantityMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useAdjustPantryItemQuantityMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [adjustPantryItemQuantityMutation, { data, loading, error }] = useAdjustPantryItemQuantityMutation({
 *   variables: {
 *      id: // value for 'id'
 *      input: // value for 'input'
 *   },
 * });
 */
export function useAdjustPantryItemQuantityMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    AdjustPantryItemQuantityMutation,
    AdjustPantryItemQuantityMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<
    AdjustPantryItemQuantityMutation,
    AdjustPantryItemQuantityMutationVariables
  >(AdjustPantryItemQuantityDocument, options);
}
export type AdjustPantryItemQuantityMutationHookResult = ReturnType<
  typeof useAdjustPantryItemQuantityMutation
>;
export type AdjustPantryItemQuantityMutationResult =
  ApolloReactCommon.MutationResult<AdjustPantryItemQuantityMutation>;
export type AdjustPantryItemQuantityMutationOptions =
  ApolloReactCommon.BaseMutationOptions<
    AdjustPantryItemQuantityMutation,
    AdjustPantryItemQuantityMutationVariables
  >;
export const CorrectPantryItemWeightDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'CorrectPantryItemWeight' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'input' },
          },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'NamedType',
              name: { kind: 'Name', value: 'CorrectPantryItemWeightInput' },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'correctPantryItemWeight' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'id' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'id' },
                },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'input' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'input' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'success' } },
                { kind: 'Field', name: { kind: 'Name', value: 'message' } },
                { kind: 'Field', name: { kind: 'Name', value: 'code' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'pantryItem' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: { kind: 'Name', value: 'PantryItemDisplay' },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PantryItemDisplay' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'PantryItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'FragmentSpread',
            name: { kind: 'Name', value: 'PantryItemCore' },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'item' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'imageUrl' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'images' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'url' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'kind' } },
                    ],
                  },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'unit' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'symbol' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'netWeightUnit' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'symbol' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'storageLocation' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'type' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'packageBreakdown' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'count' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'contentUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'perUnitNetWeight' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'perUnitNetWeightUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'totalNetWeight' },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'quantityBreakdown' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'fullPackages' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'looseContentUnits' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'contentUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'totalContentUnits' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'remainingWeight' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'remainingWeightUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PantryItemCore' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'PantryItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pantryId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'itemId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'itemName' } },
          { kind: 'Field', name: { kind: 'Name', value: 'quantity' } },
          { kind: 'Field', name: { kind: 'Name', value: 'version' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'storageState' } },
          { kind: 'Field', name: { kind: 'Name', value: 'expiresAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'lowStockAlert' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isLowStock' } },
          { kind: 'Field', name: { kind: 'Name', value: 'minQuantity' } },
          { kind: 'Field', name: { kind: 'Name', value: 'lastUsedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'netWeight' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'remainingNetWeight' },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'activeBatchCount' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'earliestBatchExpiration' },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useCorrectPantryItemWeightMutation__
 *
 * To run a mutation, you first call `useCorrectPantryItemWeightMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useCorrectPantryItemWeightMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [correctPantryItemWeightMutation, { data, loading, error }] = useCorrectPantryItemWeightMutation({
 *   variables: {
 *      id: // value for 'id'
 *      input: // value for 'input'
 *   },
 * });
 */
export function useCorrectPantryItemWeightMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    CorrectPantryItemWeightMutation,
    CorrectPantryItemWeightMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<
    CorrectPantryItemWeightMutation,
    CorrectPantryItemWeightMutationVariables
  >(CorrectPantryItemWeightDocument, options);
}
export type CorrectPantryItemWeightMutationHookResult = ReturnType<
  typeof useCorrectPantryItemWeightMutation
>;
export type CorrectPantryItemWeightMutationResult =
  ApolloReactCommon.MutationResult<CorrectPantryItemWeightMutation>;
export type CorrectPantryItemWeightMutationOptions =
  ApolloReactCommon.BaseMutationOptions<
    CorrectPantryItemWeightMutation,
    CorrectPantryItemWeightMutationVariables
  >;
export const AddLowStockItemsToShoppingListDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'AddLowStockItemsToShoppingList' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'homeId' },
          },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'shoppingListId' },
          },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'addLowStockItemsToShoppingList' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'homeId' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'homeId' },
                },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'shoppingListId' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'shoppingListId' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'addedCount' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'addedItems' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'pantryItemId' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'shoppingListItemId' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'itemName' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'quantity' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'skippedCount' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'skippedItems' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'pantryItemId' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'itemName' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'reason' },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useAddLowStockItemsToShoppingListMutation__
 *
 * To run a mutation, you first call `useAddLowStockItemsToShoppingListMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useAddLowStockItemsToShoppingListMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [addLowStockItemsToShoppingListMutation, { data, loading, error }] = useAddLowStockItemsToShoppingListMutation({
 *   variables: {
 *      homeId: // value for 'homeId'
 *      shoppingListId: // value for 'shoppingListId'
 *   },
 * });
 */
export function useAddLowStockItemsToShoppingListMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    AddLowStockItemsToShoppingListMutation,
    AddLowStockItemsToShoppingListMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<
    AddLowStockItemsToShoppingListMutation,
    AddLowStockItemsToShoppingListMutationVariables
  >(AddLowStockItemsToShoppingListDocument, options);
}
export type AddLowStockItemsToShoppingListMutationHookResult = ReturnType<
  typeof useAddLowStockItemsToShoppingListMutation
>;
export type AddLowStockItemsToShoppingListMutationResult =
  ApolloReactCommon.MutationResult<AddLowStockItemsToShoppingListMutation>;
export type AddLowStockItemsToShoppingListMutationOptions =
  ApolloReactCommon.BaseMutationOptions<
    AddLowStockItemsToShoppingListMutation,
    AddLowStockItemsToShoppingListMutationVariables
  >;
export const MovePurchasedItemsToPantryDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'MovePurchasedItemsToPantry' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'shoppingListId' },
          },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'movePurchasedItemsToPantry' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'shoppingListId' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'shoppingListId' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'movedCount' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'movedItems' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'shoppingListItemId' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'pantryItemId' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'itemName' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'quantity' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'skippedCount' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'skippedItems' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'shoppingListItemId' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'itemName' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'reason' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'targetPantryId' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'targetPantryName' },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useMovePurchasedItemsToPantryMutation__
 *
 * To run a mutation, you first call `useMovePurchasedItemsToPantryMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useMovePurchasedItemsToPantryMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [movePurchasedItemsToPantryMutation, { data, loading, error }] = useMovePurchasedItemsToPantryMutation({
 *   variables: {
 *      shoppingListId: // value for 'shoppingListId'
 *   },
 * });
 */
export function useMovePurchasedItemsToPantryMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    MovePurchasedItemsToPantryMutation,
    MovePurchasedItemsToPantryMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<
    MovePurchasedItemsToPantryMutation,
    MovePurchasedItemsToPantryMutationVariables
  >(MovePurchasedItemsToPantryDocument, options);
}
export type MovePurchasedItemsToPantryMutationHookResult = ReturnType<
  typeof useMovePurchasedItemsToPantryMutation
>;
export type MovePurchasedItemsToPantryMutationResult =
  ApolloReactCommon.MutationResult<MovePurchasedItemsToPantryMutation>;
export type MovePurchasedItemsToPantryMutationOptions =
  ApolloReactCommon.BaseMutationOptions<
    MovePurchasedItemsToPantryMutation,
    MovePurchasedItemsToPantryMutationVariables
  >;
export const OpenPantryItemDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'OpenPantryItem' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'version' },
          },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'Int' } },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'openPantryItem' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'id' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'id' },
                },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'version' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'version' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'success' } },
                { kind: 'Field', name: { kind: 'Name', value: 'message' } },
                { kind: 'Field', name: { kind: 'Name', value: 'code' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'pantryItem' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: { kind: 'Name', value: 'PantryItemDisplay' },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PantryItemDisplay' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'PantryItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'FragmentSpread',
            name: { kind: 'Name', value: 'PantryItemCore' },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'item' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'imageUrl' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'images' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'url' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'kind' } },
                    ],
                  },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'unit' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'symbol' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'netWeightUnit' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'symbol' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'storageLocation' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'type' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'packageBreakdown' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'count' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'contentUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'perUnitNetWeight' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'perUnitNetWeightUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'totalNetWeight' },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'quantityBreakdown' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'fullPackages' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'looseContentUnits' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'contentUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'totalContentUnits' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'remainingWeight' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'remainingWeightUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PantryItemCore' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'PantryItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pantryId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'itemId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'itemName' } },
          { kind: 'Field', name: { kind: 'Name', value: 'quantity' } },
          { kind: 'Field', name: { kind: 'Name', value: 'version' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'storageState' } },
          { kind: 'Field', name: { kind: 'Name', value: 'expiresAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'lowStockAlert' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isLowStock' } },
          { kind: 'Field', name: { kind: 'Name', value: 'minQuantity' } },
          { kind: 'Field', name: { kind: 'Name', value: 'lastUsedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'netWeight' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'remainingNetWeight' },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'activeBatchCount' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'earliestBatchExpiration' },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useOpenPantryItemMutation__
 *
 * To run a mutation, you first call `useOpenPantryItemMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useOpenPantryItemMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [openPantryItemMutation, { data, loading, error }] = useOpenPantryItemMutation({
 *   variables: {
 *      id: // value for 'id'
 *      version: // value for 'version'
 *   },
 * });
 */
export function useOpenPantryItemMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    OpenPantryItemMutation,
    OpenPantryItemMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<
    OpenPantryItemMutation,
    OpenPantryItemMutationVariables
  >(OpenPantryItemDocument, options);
}
export type OpenPantryItemMutationHookResult = ReturnType<
  typeof useOpenPantryItemMutation
>;
export type OpenPantryItemMutationResult =
  ApolloReactCommon.MutationResult<OpenPantryItemMutation>;
export type OpenPantryItemMutationOptions =
  ApolloReactCommon.BaseMutationOptions<
    OpenPantryItemMutation,
    OpenPantryItemMutationVariables
  >;
export const ConvertExpiredToWasteDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'ConvertExpiredToWaste' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'pantryItemId' },
          },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'convertExpiredToWaste' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'pantryItemId' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'pantryItemId' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'success' } },
                { kind: 'Field', name: { kind: 'Name', value: 'message' } },
                { kind: 'Field', name: { kind: 'Name', value: 'code' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'pantryItem' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: { kind: 'Name', value: 'PantryItemDisplay' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'condition' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'wasteReason' },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PantryItemDisplay' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'PantryItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'FragmentSpread',
            name: { kind: 'Name', value: 'PantryItemCore' },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'item' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'imageUrl' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'images' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'url' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'kind' } },
                    ],
                  },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'unit' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'symbol' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'netWeightUnit' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'symbol' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'storageLocation' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'type' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'packageBreakdown' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'count' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'contentUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'perUnitNetWeight' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'perUnitNetWeightUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'totalNetWeight' },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'quantityBreakdown' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'fullPackages' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'looseContentUnits' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'contentUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'totalContentUnits' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'remainingWeight' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'remainingWeightUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PantryItemCore' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'PantryItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pantryId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'itemId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'itemName' } },
          { kind: 'Field', name: { kind: 'Name', value: 'quantity' } },
          { kind: 'Field', name: { kind: 'Name', value: 'version' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'storageState' } },
          { kind: 'Field', name: { kind: 'Name', value: 'expiresAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'lowStockAlert' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isLowStock' } },
          { kind: 'Field', name: { kind: 'Name', value: 'minQuantity' } },
          { kind: 'Field', name: { kind: 'Name', value: 'lastUsedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'netWeight' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'remainingNetWeight' },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'activeBatchCount' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'earliestBatchExpiration' },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useConvertExpiredToWasteMutation__
 *
 * To run a mutation, you first call `useConvertExpiredToWasteMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useConvertExpiredToWasteMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [convertExpiredToWasteMutation, { data, loading, error }] = useConvertExpiredToWasteMutation({
 *   variables: {
 *      pantryItemId: // value for 'pantryItemId'
 *   },
 * });
 */
export function useConvertExpiredToWasteMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    ConvertExpiredToWasteMutation,
    ConvertExpiredToWasteMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<
    ConvertExpiredToWasteMutation,
    ConvertExpiredToWasteMutationVariables
  >(ConvertExpiredToWasteDocument, options);
}
export type ConvertExpiredToWasteMutationHookResult = ReturnType<
  typeof useConvertExpiredToWasteMutation
>;
export type ConvertExpiredToWasteMutationResult =
  ApolloReactCommon.MutationResult<ConvertExpiredToWasteMutation>;
export type ConvertExpiredToWasteMutationOptions =
  ApolloReactCommon.BaseMutationOptions<
    ConvertExpiredToWasteMutation,
    ConvertExpiredToWasteMutationVariables
  >;
export const GetPantryItemBatchesDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'GetPantryItemBatches' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'pantryItemId' },
          },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'status' },
          },
          type: {
            kind: 'NamedType',
            name: { kind: 'Name', value: 'BatchStatus' },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'pantryItemBatches' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'pantryItemId' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'pantryItemId' },
                },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'status' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'status' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'PantryItemBatchFragment' },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PantryItemBatchFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'PantryItemBatch' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'batchNumber' } },
          { kind: 'Field', name: { kind: 'Name', value: 'quantity' } },
          { kind: 'Field', name: { kind: 'Name', value: 'status' } },
          { kind: 'Field', name: { kind: 'Name', value: 'expiresAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'expiresAtIsManual' } },
          { kind: 'Field', name: { kind: 'Name', value: 'costPerUnit' } },
          { kind: 'Field', name: { kind: 'Name', value: 'totalCost' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'store' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'notes' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isOpened' } },
          { kind: 'Field', name: { kind: 'Name', value: 'openedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'depletedAt' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'remainingNetWeight' },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'createdAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'wasteReason' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pantryItemId' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useGetPantryItemBatchesQuery__
 *
 * To run a query within a React component, call `useGetPantryItemBatchesQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetPantryItemBatchesQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetPantryItemBatchesQuery({
 *   variables: {
 *      pantryItemId: // value for 'pantryItemId'
 *      status: // value for 'status'
 *   },
 * });
 */
export function useGetPantryItemBatchesQuery(
  baseOptions: ApolloReactHooks.QueryHookOptions<
    GetPantryItemBatchesQuery,
    GetPantryItemBatchesQueryVariables
  > &
    (
      | { variables: GetPantryItemBatchesQueryVariables; skip?: boolean }
      | { skip: boolean }
    ),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useQuery<
    GetPantryItemBatchesQuery,
    GetPantryItemBatchesQueryVariables
  >(GetPantryItemBatchesDocument, options);
}
export function useGetPantryItemBatchesLazyQuery(
  baseOptions?: ApolloReactHooks.LazyQueryHookOptions<
    GetPantryItemBatchesQuery,
    GetPantryItemBatchesQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useLazyQuery<
    GetPantryItemBatchesQuery,
    GetPantryItemBatchesQueryVariables
  >(GetPantryItemBatchesDocument, options);
}
// @ts-ignore
export function useGetPantryItemBatchesSuspenseQuery(
  baseOptions?: ApolloReactHooks.SuspenseQueryHookOptions<
    GetPantryItemBatchesQuery,
    GetPantryItemBatchesQueryVariables
  >,
): ApolloReactHooks.UseSuspenseQueryResult<
  GetPantryItemBatchesQuery,
  GetPantryItemBatchesQueryVariables
>;
export function useGetPantryItemBatchesSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<
        GetPantryItemBatchesQuery,
        GetPantryItemBatchesQueryVariables
      >,
): ApolloReactHooks.UseSuspenseQueryResult<
  GetPantryItemBatchesQuery | undefined,
  GetPantryItemBatchesQueryVariables
>;
export function useGetPantryItemBatchesSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<
        GetPantryItemBatchesQuery,
        GetPantryItemBatchesQueryVariables
      >,
) {
  const options =
    baseOptions === ApolloReactHooks.skipToken
      ? baseOptions
      : { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useSuspenseQuery<
    GetPantryItemBatchesQuery,
    GetPantryItemBatchesQueryVariables
  >(GetPantryItemBatchesDocument, options);
}
export type GetPantryItemBatchesQueryHookResult = ReturnType<
  typeof useGetPantryItemBatchesQuery
>;
export type GetPantryItemBatchesLazyQueryHookResult = ReturnType<
  typeof useGetPantryItemBatchesLazyQuery
>;
export type GetPantryItemBatchesSuspenseQueryHookResult = ReturnType<
  typeof useGetPantryItemBatchesSuspenseQuery
>;
export type GetPantryItemBatchesQueryResult = ApolloReactCommon.QueryResult<
  GetPantryItemBatchesQuery,
  GetPantryItemBatchesQueryVariables
>;
export const OpenPantryItemBatchDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'OpenPantryItemBatch' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'input' },
          },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'NamedType',
              name: { kind: 'Name', value: 'OpenBatchInput' },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'openPantryItemBatch' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'input' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'input' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'success' } },
                { kind: 'Field', name: { kind: 'Name', value: 'message' } },
                { kind: 'Field', name: { kind: 'Name', value: 'code' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'pantryItem' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: { kind: 'Name', value: 'PantryItemDisplay' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'batches' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'FragmentSpread',
                              name: {
                                kind: 'Name',
                                value: 'PantryItemBatchFragment',
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PantryItemDisplay' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'PantryItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'FragmentSpread',
            name: { kind: 'Name', value: 'PantryItemCore' },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'item' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'imageUrl' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'images' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'url' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'kind' } },
                    ],
                  },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'unit' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'symbol' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'netWeightUnit' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'symbol' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'storageLocation' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'type' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'packageBreakdown' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'count' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'contentUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'perUnitNetWeight' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'perUnitNetWeightUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'totalNetWeight' },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'quantityBreakdown' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'fullPackages' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'looseContentUnits' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'contentUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'totalContentUnits' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'remainingWeight' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'remainingWeightUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PantryItemCore' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'PantryItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pantryId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'itemId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'itemName' } },
          { kind: 'Field', name: { kind: 'Name', value: 'quantity' } },
          { kind: 'Field', name: { kind: 'Name', value: 'version' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'storageState' } },
          { kind: 'Field', name: { kind: 'Name', value: 'expiresAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'lowStockAlert' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isLowStock' } },
          { kind: 'Field', name: { kind: 'Name', value: 'minQuantity' } },
          { kind: 'Field', name: { kind: 'Name', value: 'lastUsedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'netWeight' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'remainingNetWeight' },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'activeBatchCount' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'earliestBatchExpiration' },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PantryItemBatchFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'PantryItemBatch' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'batchNumber' } },
          { kind: 'Field', name: { kind: 'Name', value: 'quantity' } },
          { kind: 'Field', name: { kind: 'Name', value: 'status' } },
          { kind: 'Field', name: { kind: 'Name', value: 'expiresAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'expiresAtIsManual' } },
          { kind: 'Field', name: { kind: 'Name', value: 'costPerUnit' } },
          { kind: 'Field', name: { kind: 'Name', value: 'totalCost' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'store' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'notes' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isOpened' } },
          { kind: 'Field', name: { kind: 'Name', value: 'openedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'depletedAt' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'remainingNetWeight' },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'createdAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'wasteReason' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pantryItemId' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useOpenPantryItemBatchMutation__
 *
 * To run a mutation, you first call `useOpenPantryItemBatchMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useOpenPantryItemBatchMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [openPantryItemBatchMutation, { data, loading, error }] = useOpenPantryItemBatchMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useOpenPantryItemBatchMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    OpenPantryItemBatchMutation,
    OpenPantryItemBatchMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<
    OpenPantryItemBatchMutation,
    OpenPantryItemBatchMutationVariables
  >(OpenPantryItemBatchDocument, options);
}
export type OpenPantryItemBatchMutationHookResult = ReturnType<
  typeof useOpenPantryItemBatchMutation
>;
export type OpenPantryItemBatchMutationResult =
  ApolloReactCommon.MutationResult<OpenPantryItemBatchMutation>;
export type OpenPantryItemBatchMutationOptions =
  ApolloReactCommon.BaseMutationOptions<
    OpenPantryItemBatchMutation,
    OpenPantryItemBatchMutationVariables
  >;
export const WastePantryItemBatchDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'WastePantryItemBatch' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'input' },
          },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'NamedType',
              name: { kind: 'Name', value: 'WasteBatchInput' },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'wastePantryItemBatch' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'input' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'input' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'success' } },
                { kind: 'Field', name: { kind: 'Name', value: 'message' } },
                { kind: 'Field', name: { kind: 'Name', value: 'code' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'pantryItem' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: { kind: 'Name', value: 'PantryItemDisplay' },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PantryItemDisplay' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'PantryItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'FragmentSpread',
            name: { kind: 'Name', value: 'PantryItemCore' },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'item' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'imageUrl' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'images' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'url' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'kind' } },
                    ],
                  },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'unit' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'symbol' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'netWeightUnit' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'symbol' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'storageLocation' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'type' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'packageBreakdown' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'count' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'contentUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'perUnitNetWeight' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'perUnitNetWeightUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'totalNetWeight' },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'quantityBreakdown' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'fullPackages' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'looseContentUnits' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'contentUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'totalContentUnits' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'remainingWeight' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'remainingWeightUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PantryItemCore' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'PantryItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pantryId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'itemId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'itemName' } },
          { kind: 'Field', name: { kind: 'Name', value: 'quantity' } },
          { kind: 'Field', name: { kind: 'Name', value: 'version' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'storageState' } },
          { kind: 'Field', name: { kind: 'Name', value: 'expiresAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'lowStockAlert' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isLowStock' } },
          { kind: 'Field', name: { kind: 'Name', value: 'minQuantity' } },
          { kind: 'Field', name: { kind: 'Name', value: 'lastUsedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'netWeight' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'remainingNetWeight' },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'activeBatchCount' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'earliestBatchExpiration' },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useWastePantryItemBatchMutation__
 *
 * To run a mutation, you first call `useWastePantryItemBatchMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useWastePantryItemBatchMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [wastePantryItemBatchMutation, { data, loading, error }] = useWastePantryItemBatchMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useWastePantryItemBatchMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    WastePantryItemBatchMutation,
    WastePantryItemBatchMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<
    WastePantryItemBatchMutation,
    WastePantryItemBatchMutationVariables
  >(WastePantryItemBatchDocument, options);
}
export type WastePantryItemBatchMutationHookResult = ReturnType<
  typeof useWastePantryItemBatchMutation
>;
export type WastePantryItemBatchMutationResult =
  ApolloReactCommon.MutationResult<WastePantryItemBatchMutation>;
export type WastePantryItemBatchMutationOptions =
  ApolloReactCommon.BaseMutationOptions<
    WastePantryItemBatchMutation,
    WastePantryItemBatchMutationVariables
  >;
export const ConvertExpiredBatchesToWasteDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'ConvertExpiredBatchesToWaste' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'pantryItemId' },
          },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'convertExpiredBatchesToWaste' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'pantryItemId' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'pantryItemId' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'success' } },
                { kind: 'Field', name: { kind: 'Name', value: 'message' } },
                { kind: 'Field', name: { kind: 'Name', value: 'code' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'pantryItem' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: { kind: 'Name', value: 'PantryItemDisplay' },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PantryItemDisplay' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'PantryItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'FragmentSpread',
            name: { kind: 'Name', value: 'PantryItemCore' },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'item' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'imageUrl' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'images' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'url' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'kind' } },
                    ],
                  },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'unit' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'symbol' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'netWeightUnit' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'symbol' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'storageLocation' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'type' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'packageBreakdown' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'count' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'contentUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'perUnitNetWeight' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'perUnitNetWeightUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'totalNetWeight' },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'quantityBreakdown' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'fullPackages' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'looseContentUnits' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'contentUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'totalContentUnits' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'remainingWeight' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'remainingWeightUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PantryItemCore' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'PantryItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pantryId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'itemId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'itemName' } },
          { kind: 'Field', name: { kind: 'Name', value: 'quantity' } },
          { kind: 'Field', name: { kind: 'Name', value: 'version' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'storageState' } },
          { kind: 'Field', name: { kind: 'Name', value: 'expiresAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'lowStockAlert' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isLowStock' } },
          { kind: 'Field', name: { kind: 'Name', value: 'minQuantity' } },
          { kind: 'Field', name: { kind: 'Name', value: 'lastUsedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'netWeight' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'remainingNetWeight' },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'activeBatchCount' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'earliestBatchExpiration' },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useConvertExpiredBatchesToWasteMutation__
 *
 * To run a mutation, you first call `useConvertExpiredBatchesToWasteMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useConvertExpiredBatchesToWasteMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [convertExpiredBatchesToWasteMutation, { data, loading, error }] = useConvertExpiredBatchesToWasteMutation({
 *   variables: {
 *      pantryItemId: // value for 'pantryItemId'
 *   },
 * });
 */
export function useConvertExpiredBatchesToWasteMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    ConvertExpiredBatchesToWasteMutation,
    ConvertExpiredBatchesToWasteMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<
    ConvertExpiredBatchesToWasteMutation,
    ConvertExpiredBatchesToWasteMutationVariables
  >(ConvertExpiredBatchesToWasteDocument, options);
}
export type ConvertExpiredBatchesToWasteMutationHookResult = ReturnType<
  typeof useConvertExpiredBatchesToWasteMutation
>;
export type ConvertExpiredBatchesToWasteMutationResult =
  ApolloReactCommon.MutationResult<ConvertExpiredBatchesToWasteMutation>;
export type ConvertExpiredBatchesToWasteMutationOptions =
  ApolloReactCommon.BaseMutationOptions<
    ConvertExpiredBatchesToWasteMutation,
    ConvertExpiredBatchesToWasteMutationVariables
  >;
export const SyncPantryItemDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'SyncPantryItem' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'clientId' },
          },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'input' },
          },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'NamedType',
              name: { kind: 'Name', value: 'SyncPantryItemInput' },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'syncPantryItem' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'clientId' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'clientId' },
                },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'input' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'input' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'clientId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'serverId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'operation' } },
                { kind: 'Field', name: { kind: 'Name', value: 'wasCreated' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'item' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: { kind: 'Name', value: 'PantryItemDisplay' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'conflict' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'clientVersion' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'serverVersion' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'message' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'serverItem' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'id' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'version' },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PantryItemDisplay' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'PantryItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'FragmentSpread',
            name: { kind: 'Name', value: 'PantryItemCore' },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'item' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'imageUrl' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'images' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'url' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'kind' } },
                    ],
                  },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'unit' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'symbol' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'netWeightUnit' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'symbol' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'storageLocation' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'type' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'packageBreakdown' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'count' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'contentUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'perUnitNetWeight' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'perUnitNetWeightUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'totalNetWeight' },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'quantityBreakdown' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'fullPackages' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'looseContentUnits' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'contentUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'totalContentUnits' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'remainingWeight' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'remainingWeightUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PantryItemCore' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'PantryItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pantryId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'itemId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'itemName' } },
          { kind: 'Field', name: { kind: 'Name', value: 'quantity' } },
          { kind: 'Field', name: { kind: 'Name', value: 'version' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'storageState' } },
          { kind: 'Field', name: { kind: 'Name', value: 'expiresAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'lowStockAlert' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isLowStock' } },
          { kind: 'Field', name: { kind: 'Name', value: 'minQuantity' } },
          { kind: 'Field', name: { kind: 'Name', value: 'lastUsedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'netWeight' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'remainingNetWeight' },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'activeBatchCount' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'earliestBatchExpiration' },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useSyncPantryItemMutation__
 *
 * To run a mutation, you first call `useSyncPantryItemMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useSyncPantryItemMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [syncPantryItemMutation, { data, loading, error }] = useSyncPantryItemMutation({
 *   variables: {
 *      clientId: // value for 'clientId'
 *      input: // value for 'input'
 *   },
 * });
 */
export function useSyncPantryItemMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    SyncPantryItemMutation,
    SyncPantryItemMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<
    SyncPantryItemMutation,
    SyncPantryItemMutationVariables
  >(SyncPantryItemDocument, options);
}
export type SyncPantryItemMutationHookResult = ReturnType<
  typeof useSyncPantryItemMutation
>;
export type SyncPantryItemMutationResult =
  ApolloReactCommon.MutationResult<SyncPantryItemMutation>;
export type SyncPantryItemMutationOptions =
  ApolloReactCommon.BaseMutationOptions<
    SyncPantryItemMutation,
    SyncPantryItemMutationVariables
  >;
export const SyncDeletePantryItemDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'SyncDeletePantryItem' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'clientId' },
          },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'version' },
          },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'Int' } },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'syncDeletePantryItem' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'clientId' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'clientId' },
                },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'version' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'version' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'clientId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'serverId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'operation' } },
                { kind: 'Field', name: { kind: 'Name', value: 'wasCreated' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'item' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'itemName' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'conflict' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'clientVersion' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'serverVersion' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'message' },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useSyncDeletePantryItemMutation__
 *
 * To run a mutation, you first call `useSyncDeletePantryItemMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useSyncDeletePantryItemMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [syncDeletePantryItemMutation, { data, loading, error }] = useSyncDeletePantryItemMutation({
 *   variables: {
 *      clientId: // value for 'clientId'
 *      version: // value for 'version'
 *   },
 * });
 */
export function useSyncDeletePantryItemMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    SyncDeletePantryItemMutation,
    SyncDeletePantryItemMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<
    SyncDeletePantryItemMutation,
    SyncDeletePantryItemMutationVariables
  >(SyncDeletePantryItemDocument, options);
}
export type SyncDeletePantryItemMutationHookResult = ReturnType<
  typeof useSyncDeletePantryItemMutation
>;
export type SyncDeletePantryItemMutationResult =
  ApolloReactCommon.MutationResult<SyncDeletePantryItemMutation>;
export type SyncDeletePantryItemMutationOptions =
  ApolloReactCommon.BaseMutationOptions<
    SyncDeletePantryItemMutation,
    SyncDeletePantryItemMutationVariables
  >;
export const PantryChangesDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'subscription',
      name: { kind: 'Name', value: 'PantryChanges' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'pantryId' },
          },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'pantryChanged' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'pantryId' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'pantryId' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'changeType' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'pantry' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'homeId' },
                      },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'description' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'location' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'temperature' },
                      },
                      { kind: 'Field', name: { kind: 'Name', value: 'tags' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'metadata' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'version' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'updatedAt' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'pantryItem' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: { kind: 'Name', value: 'PantryItemDisplay' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'usage' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'quantityUsed' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'usedAt' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'purpose' },
                      },
                      { kind: 'Field', name: { kind: 'Name', value: 'notes' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'pantryItem' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'id' },
                            },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'usedBy' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'id' },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
                { kind: 'Field', name: { kind: 'Name', value: 'mutation' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'updatedFields' },
                },
                { kind: 'Field', name: { kind: 'Name', value: 'timestamp' } },
                { kind: 'Field', name: { kind: 'Name', value: 'userId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'pantryId' } },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PantryItemDisplay' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'PantryItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'FragmentSpread',
            name: { kind: 'Name', value: 'PantryItemCore' },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'item' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'imageUrl' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'images' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'url' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'kind' } },
                    ],
                  },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'unit' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'symbol' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'netWeightUnit' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'symbol' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'storageLocation' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'type' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'packageBreakdown' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'count' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'contentUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'perUnitNetWeight' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'perUnitNetWeightUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'totalNetWeight' },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'quantityBreakdown' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'fullPackages' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'looseContentUnits' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'contentUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'totalContentUnits' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'remainingWeight' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'remainingWeightUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PantryItemCore' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'PantryItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'pantryId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'itemId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'itemName' } },
          { kind: 'Field', name: { kind: 'Name', value: 'quantity' } },
          { kind: 'Field', name: { kind: 'Name', value: 'version' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'storageState' } },
          { kind: 'Field', name: { kind: 'Name', value: 'expiresAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'lowStockAlert' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isLowStock' } },
          { kind: 'Field', name: { kind: 'Name', value: 'minQuantity' } },
          { kind: 'Field', name: { kind: 'Name', value: 'lastUsedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'netWeight' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'remainingNetWeight' },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'activeBatchCount' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'earliestBatchExpiration' },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __usePantryChangesSubscription__
 *
 * To run a query within a React component, call `usePantryChangesSubscription` and pass it any options that fit your needs.
 * When your component renders, `usePantryChangesSubscription` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the subscription, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = usePantryChangesSubscription({
 *   variables: {
 *      pantryId: // value for 'pantryId'
 *   },
 * });
 */
export function usePantryChangesSubscription(
  baseOptions: ApolloReactHooks.SubscriptionHookOptions<
    PantryChangesSubscription,
    PantryChangesSubscriptionVariables
  > &
    (
      | { variables: PantryChangesSubscriptionVariables; skip?: boolean }
      | { skip: boolean }
    ),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useSubscription<
    PantryChangesSubscription,
    PantryChangesSubscriptionVariables
  >(PantryChangesDocument, options);
}
export type PantryChangesSubscriptionHookResult = ReturnType<
  typeof usePantryChangesSubscription
>;
export type PantryChangesSubscriptionResult =
  ApolloReactCommon.SubscriptionResult<PantryChangesSubscription>;
export const PantryAlertsDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'subscription',
      name: { kind: 'Name', value: 'PantryAlerts' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'pantryId' },
          },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'pantryAlert' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'pantryId' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'pantryId' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'alertType' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'pantryItem' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'itemId' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'itemName' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'pantryId' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'quantity' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'unit' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'id' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'name' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'symbol' },
                            },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'item' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'id' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'name' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'imageUrl' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'images' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'url' },
                                  },
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'kind' },
                                  },
                                ],
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'items' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'itemId' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'itemName' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'item' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'id' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'name' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'imageUrl' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'images' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'url' },
                                  },
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'kind' },
                                  },
                                ],
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
                { kind: 'Field', name: { kind: 'Name', value: 'message' } },
                { kind: 'Field', name: { kind: 'Name', value: 'pantryId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'timestamp' } },
                { kind: 'Field', name: { kind: 'Name', value: 'userId' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __usePantryAlertsSubscription__
 *
 * To run a query within a React component, call `usePantryAlertsSubscription` and pass it any options that fit your needs.
 * When your component renders, `usePantryAlertsSubscription` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the subscription, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = usePantryAlertsSubscription({
 *   variables: {
 *      pantryId: // value for 'pantryId'
 *   },
 * });
 */
export function usePantryAlertsSubscription(
  baseOptions: ApolloReactHooks.SubscriptionHookOptions<
    PantryAlertsSubscription,
    PantryAlertsSubscriptionVariables
  > &
    (
      | { variables: PantryAlertsSubscriptionVariables; skip?: boolean }
      | { skip: boolean }
    ),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useSubscription<
    PantryAlertsSubscription,
    PantryAlertsSubscriptionVariables
  >(PantryAlertsDocument, options);
}
export type PantryAlertsSubscriptionHookResult = ReturnType<
  typeof usePantryAlertsSubscription
>;
export type PantryAlertsSubscriptionResult =
  ApolloReactCommon.SubscriptionResult<PantryAlertsSubscription>;
export const ExpirationNotificationChangedDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'subscription',
      name: { kind: 'Name', value: 'ExpirationNotificationChanged' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'pantryId' },
          },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'expirationNotificationChanged' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'pantryId' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'pantryId' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'changeType' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'notification' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: {
                          kind: 'Name',
                          value: 'ExpirationNotificationFragment',
                        },
                      },
                    ],
                  },
                },
                { kind: 'Field', name: { kind: 'Name', value: 'pantryId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'timestamp' } },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'ExpirationNotificationFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'ExpirationNotification' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'notificationType' } },
          { kind: 'Field', name: { kind: 'Name', value: 'daysUntilExpiry' } },
          { kind: 'Field', name: { kind: 'Name', value: 'expiresAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'status' } },
          { kind: 'Field', name: { kind: 'Name', value: 'sentAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'readAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'actionTaken' } },
          { kind: 'Field', name: { kind: 'Name', value: 'actionAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'dismissedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'createdAt' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'genericNotificationId' },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'pantryItemId' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'pantryItem' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'item' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'imageUrl' },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useExpirationNotificationChangedSubscription__
 *
 * To run a query within a React component, call `useExpirationNotificationChangedSubscription` and pass it any options that fit your needs.
 * When your component renders, `useExpirationNotificationChangedSubscription` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the subscription, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useExpirationNotificationChangedSubscription({
 *   variables: {
 *      pantryId: // value for 'pantryId'
 *   },
 * });
 */
export function useExpirationNotificationChangedSubscription(
  baseOptions: ApolloReactHooks.SubscriptionHookOptions<
    ExpirationNotificationChangedSubscription,
    ExpirationNotificationChangedSubscriptionVariables
  > &
    (
      | {
          variables: ExpirationNotificationChangedSubscriptionVariables;
          skip?: boolean;
        }
      | { skip: boolean }
    ),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useSubscription<
    ExpirationNotificationChangedSubscription,
    ExpirationNotificationChangedSubscriptionVariables
  >(ExpirationNotificationChangedDocument, options);
}
export type ExpirationNotificationChangedSubscriptionHookResult = ReturnType<
  typeof useExpirationNotificationChangedSubscription
>;
export type ExpirationNotificationChangedSubscriptionResult =
  ApolloReactCommon.SubscriptionResult<ExpirationNotificationChangedSubscription>;
