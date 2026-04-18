// This file is auto-generated. Do not edit manually.
/* eslint-disable */
// @ts-nocheck
import type * as Types from '../generated/baseTypes';

import type { DocumentNode } from 'graphql';
export type ShoppingListItemCoreFragment = {
  __typename: 'ShoppingListItem';
  id: string;
  itemName: string | null;
  quantity: number | null;
  quantityInput: string | null;
  displayFormat: Types.DisplayFormat;
  version: number;
  updatedAt: string;
  category: string | null;
  notes: string | null;
  unitName: string | null;
  purchaseInfo: {
    __typename: 'ShoppingListItemPurchaseInfo';
    isPurchased: boolean;
  };
  unit: { __typename: 'Unit'; id: string; name: string; symbol: string } | null;
};

export type ShoppingListItemDisplayFragment = {
  __typename: 'ShoppingListItem';
  sortOrder: string;
  item: {
    __typename: 'Item';
    id: string;
    imageUrl: string | null;
    images: Array<{
      __typename: 'ItemImage';
      url: string;
      kind: Types.ImageKind | null;
    }>;
  } | null;
} & ShoppingListItemCoreFragment;

export type ShoppingListItemFragment = {
  __typename: 'ShoppingListItem';
  priority: number;
  sortOrder: string;
  createdAt: string;
  item: {
    __typename: 'Item';
    id: string;
    name: string;
    description: string | null;
    imageUrl: string | null;
    netWeight: number | null;
    nutritions: any | null;
    displayUnit: {
      __typename: 'Unit';
      id: string;
      name: string;
      symbol: string;
    } | null;
    categories: Array<{
      __typename: 'ItemCategory';
      id: string;
      isPrimary: boolean;
      confidence: number;
      source: Types.CategorySource;
      assignedAt: string | null;
      category: { __typename: 'Category'; id: string; name: string };
    }>;
  } | null;
  priceEstimate: {
    __typename: 'PriceEstimate';
    estimated: number | null;
    lastKnown: number | null;
  };
  source: {
    __typename: 'ShoppingListItemSource';
    isAutoAdded: boolean;
    autoAddReason: string | null;
    isFromMealPlan: boolean;
  };
  addedBy: ({ __typename: 'User' } & UserSummaryFragment) | null;
  purchasesConnection: {
    __typename: 'PurchaseConnection';
    totalCount: number | null;
    edges: Array<{
      __typename: 'PurchaseEdge';
      node: { __typename: 'Purchase' } & PurchaseFragment;
    }>;
  };
} & ShoppingListItemDisplayFragment;

export type ShoppingListOwnershipFragment = {
  __typename: 'ShoppingListOwnership';
  id: string;
  userId: string;
  user: {
    __typename: 'User';
    id: string;
    email: string;
    profile: {
      __typename: 'UserProfile';
      id: string;
      displayName: string | null;
      avatar: string | null;
    } | null;
  };
};

export type ShoppingListCollaboratorFragment = {
  __typename: 'ShoppingListCollaborator';
  id: string;
  email: string | null;
  role: Types.CollaboratorRole;
  status: Types.CollaboratorStatus;
  collaboratorId: string | null;
  canAddItems: boolean;
  canRemoveItems: boolean;
  canEditItems: boolean;
  canMarkPurchased: boolean;
  collaborator: {
    __typename: 'User';
    id: string;
    email: string;
    profile: {
      __typename: 'UserProfile';
      id: string;
      displayName: string | null;
      avatar: string | null;
    } | null;
  } | null;
};

export type BasicUserFragment = {
  __typename: 'User';
  id: string;
  email: string;
};

export type UserSummaryFragment = {
  __typename: 'User';
  id: string;
  email: string;
  profile: {
    __typename: 'UserProfile';
    id: string;
    displayName: string | null;
    avatar: string | null;
  } | null;
};

export type AuthUserFragment = {
  __typename: 'User';
  id: string;
  email: string;
  emailVerified: boolean;
  role: Types.UserRole;
  canAccessDevTools: boolean;
  onBoarded: boolean;
  createdAt: string;
  updatedAt: string;
  timezone: string | null;
};

export type LoginUserFragment = {
  __typename: 'User';
  defaultHomeId: string | null;
  defaultShoppingListId: string | null;
  defaultHome: {
    __typename: 'Home';
    id: string;
    name: string;
    isDefault: boolean;
    pantriesConnection: {
      __typename: 'PantryConnection';
      edges: Array<{
        __typename: 'PantryEdge';
        node: { __typename: 'Pantry'; id: string; isDefault: boolean };
      }>;
    };
  } | null;
  profile: {
    __typename: 'UserProfile';
    id: string;
    displayName: string | null;
    avatar: string | null;
  } | null;
  settings: {
    __typename: 'UserSettings';
    id: string;
    theme: Types.AppTheme;
  } | null;
} & AuthUserFragment;

export type PartialUserFragment = {
  __typename: 'User';
  id: string;
  email: string;
  emailVerified: boolean;
  role: Types.UserRole;
  canAccessDevTools: boolean;
  onBoarded: boolean;
  timezone: string | null;
  defaultShoppingListId: string | null;
  defaultHomeId: string | null;
  createdAt: string;
  updatedAt: string;
  profile: {
    __typename: 'UserProfile';
    id: string;
    firstName: string | null;
    lastName: string | null;
    displayName: string | null;
    avatar: string | null;
  } | null;
  settings: {
    __typename: 'UserSettings';
    id: string;
    theme: Types.AppTheme;
  } | null;
};

export type UnitFragment = {
  __typename: 'ItemUnit';
  id: string;
  itemId: string;
  unitId: string;
  isDefault: boolean;
  isPreferred: boolean;
  isCommon: boolean;
  packageSize: number | null;
  packageDescription: string | null;
  retailUnit: boolean;
  usageContext: Array<Types.UnitUsageContext>;
  recommendedFor: Array<Types.UnitRecommendation>;
  minQuantity: number | null;
  maxQuantity: number | null;
  quantityStep: number | null;
  averagePricePerUnit: number | null;
  createdAt: string;
  updatedAt: string;
  version: number;
  displayNameSingular: string | null;
  displayNamePlural: string | null;
  contentUnitId: string | null;
  contentUnit: {
    __typename: 'Unit';
    id: string;
    name: string;
    symbol: string;
  } | null;
};

export type BrandFragment = {
  __typename: 'ItemBrand';
  id: string;
  brand: { __typename: 'Brand'; id: string; name: string };
};

export type ItemCoreFragment = {
  __typename: 'Item';
  id: string;
  name: string;
  version: number;
  updatedAt: string;
};

export type ItemDisplayFragment = {
  __typename: 'Item';
  id: string;
  name: string;
  imageUrl: string | null;
  netWeight: number | null;
  images: Array<{
    __typename: 'ItemImage';
    url: string;
    kind: Types.ImageKind | null;
  }>;
  displayUnit: { __typename: 'Unit'; id: string; symbol: string } | null;
  categories: Array<{
    __typename: 'ItemCategory';
    id: string;
    isPrimary: boolean;
    category: {
      __typename: 'Category';
      id: string;
      name: string;
      color: string | null;
      icon: string | null;
    };
  }>;
};

export type ItemFragment = {
  __typename: 'Item';
  description: string | null;
  dataSource: Types.DataSource;
  type: Types.ItemType;
  storageState: Types.StorageState;
  showInOnboarding: boolean;
  shelfLifeDays: number | null;
  shelfLifeOpenedDays: number | null;
  popularity: number;
  status: Types.ItemStatus;
  visibility: Types.Visibility;
  tags: Array<string>;
  nutritions: any | null;
  ingredients: any | null;
  createdAt: string;
  density: number | null;
  defaultConsumeUnitId: string | null;
  defaultConsumeIncrement: number | null;
  defaultConsumeUnit: {
    __typename: 'Unit';
    id: string;
    name: string;
    symbol: string;
  } | null;
  displayUnit: {
    __typename: 'Unit';
    id: string;
    name: string;
    symbol: string;
  } | null;
  units: Array<{ __typename: 'ItemUnit' } & UnitFragment>;
  brands: Array<{ __typename: 'ItemBrand' } & BrandFragment>;
} & ItemDisplayFragment;

export type PantryItemCoreFragment = {
  __typename: 'PantryItem';
  id: string;
  pantryId: string;
  itemId: string;
  itemName: string;
  quantity: number;
  version: number;
  updatedAt: string | null;
  storageState: Types.StorageState;
  expiresAt: string | null;
  lowStockAlert: boolean;
  isLowStock: boolean;
  minQuantity: number | null;
  lastUsedAt: string | null;
  netWeight: number | null;
  remainingNetWeight: number | null;
  activeBatchCount: number;
  earliestBatchExpiration: string | null;
};

export type PantryItemDisplayFragment = {
  __typename: 'PantryItem';
  item: {
    __typename: 'Item';
    id: string;
    imageUrl: string | null;
    images: Array<{
      __typename: 'ItemImage';
      url: string;
      kind: Types.ImageKind | null;
    }>;
  };
  unit: { __typename: 'Unit'; id: string; name: string; symbol: string } | null;
  netWeightUnit: {
    __typename: 'Unit';
    id: string;
    name: string;
    symbol: string;
  } | null;
  storageLocation: {
    __typename: 'StorageLocation';
    id: string;
    name: string;
    type: Types.StorageType;
  } | null;
  packageBreakdown: {
    __typename: 'PackageBreakdown';
    count: number;
    perUnitNetWeight: number | null;
    totalNetWeight: number | null;
    contentUnit: {
      __typename: 'Unit';
      id: string;
      name: string;
      symbol: string;
    };
    perUnitNetWeightUnit: {
      __typename: 'Unit';
      id: string;
      name: string;
      symbol: string;
    } | null;
  } | null;
  quantityBreakdown: {
    __typename: 'QuantityBreakdown';
    fullPackages: number;
    looseContentUnits: number;
    totalContentUnits: number;
    remainingWeight: number | null;
    contentUnit: {
      __typename: 'Unit';
      id: string;
      name: string;
      symbol: string;
    } | null;
    remainingWeightUnit: {
      __typename: 'Unit';
      id: string;
      name: string;
      symbol: string;
    } | null;
  } | null;
} & PantryItemCoreFragment;

export type PantryItemFragment = {
  __typename: 'PantryItem';
  tags: Array<string>;
  storageNotes: string | null;
  createdAt: string;
  restockQuantity: number | null;
  condition: Types.ItemCondition;
  acquisitionMethod: Types.AcquisitionMethod;
  costPerUnit: number | null;
  totalCost: number | null;
  item: {
    __typename: 'Item';
    name: string;
    shelfLifeDays: number | null;
    shelfLifeOpenedDays: number | null;
    nutritions: any | null;
    defaultConsumeIncrement: number | null;
    defaultConsumeUnitId: string | null;
    defaultConsumeUnit: {
      __typename: 'Unit';
      id: string;
      name: string;
      symbol: string;
      type: Types.UnitType;
    } | null;
    displayUnit: { __typename: 'Unit'; id: string; symbol: string } | null;
    categories: Array<{
      __typename: 'ItemCategory';
      isPrimary: boolean;
      category: { __typename: 'Category'; id: string; name: string };
    }>;
    unitConversions: Array<{
      __typename: 'ItemUnitConversion';
      id: string;
      conversionRatio: number;
      confidence: number;
      source: Types.ConversionSource;
      fromUnit: {
        __typename: 'Unit';
        id: string;
        name: string;
        symbol: string;
        type: Types.UnitType;
      };
      toUnit: {
        __typename: 'Unit';
        id: string;
        name: string;
        symbol: string;
        type: Types.UnitType;
      };
    }>;
  };
  unit: {
    __typename: 'Unit';
    type: Types.UnitType;
    isMetric: boolean;
    baseUnitId: string | null;
    conversionFactor: number;
    isCommon: boolean;
    displayAsFraction: boolean;
    minPrecision: number;
    autoConvertThreshold: number | null;
  } | null;
  brand: { __typename: 'Brand'; id: string; name: string } | null;
  store: { __typename: 'Store'; id: string; name: string } | null;
  purchase: {
    __typename: 'Purchase';
    id: string;
    purchaseDate: string;
    unitPrice: number;
    totalPrice: number;
    quantity: number;
  } | null;
  usageRecords: {
    __typename: 'PantryItemUsageConnection';
    edges: Array<{
      __typename: 'PantryItemUsageEdge';
      node: {
        __typename: 'PantryItemUsage';
        id: string;
        quantityUsed: number;
        usedAt: string;
        purpose: Types.UsagePurpose;
        adjustmentReason: string | null;
        usageUnit: { __typename: 'Unit'; symbol: string } | null;
      };
    }>;
  };
  batches: Array<{ __typename: 'PantryItemBatch' } & PantryItemBatchFragment>;
} & PantryItemDisplayFragment;

export type PantryItemBatchFragment = {
  __typename: 'PantryItemBatch';
  id: string;
  batchNumber: number;
  quantity: number;
  status: Types.BatchStatus;
  expiresAt: string | null;
  expiresAtIsManual: boolean;
  costPerUnit: number | null;
  totalCost: number | null;
  notes: string | null;
  isOpened: boolean;
  openedAt: string | null;
  depletedAt: string | null;
  remainingNetWeight: number | null;
  createdAt: string;
  updatedAt: string | null;
  wasteReason: Types.WasteReason | null;
  pantryItemId: string;
  store: { __typename: 'Store'; id: string; name: string } | null;
};

export type HomeInviteFragment = {
  __typename: 'HomeInvite';
  id: string;
  token: string;
  email: string;
  homeId: string;
  invitedUserId: string | null;
  recipientName: string | null;
  role: Types.MembershipRole;
  status: Types.InviteStatus;
  expiresAt: string;
  sentAt: string;
  message: string | null;
  home: { __typename: 'Home'; id: string; name: string };
  inviter: {
    __typename: 'User';
    profile: {
      __typename: 'UserProfile';
      id: string;
      displayName: string | null;
    } | null;
  } & BasicUserFragment;
};

export type HomeInviteDisplayFragment = {
  __typename: 'HomeInvite';
  id: string;
  email: string;
  recipientName: string | null;
  role: Types.MembershipRole;
  status: Types.InviteStatus;
  expiresAt: string;
  message: string | null;
  home: { __typename: 'Home'; id: string; name: string };
  inviter: {
    __typename: 'User';
    profile: {
      __typename: 'UserProfile';
      id: string;
      displayName: string | null;
    } | null;
  } & BasicUserFragment;
};

export type MemberShipFragment = {
  __typename: 'Membership';
  id: string;
  homeId: string;
  userId: string;
  role: Types.MembershipRole;
  status: Types.MembershipStatus;
  displayName: string | null;
  canManageHome: boolean;
  canViewPantry: boolean;
  canEditPantry: boolean;
  canAddItems: boolean;
  canRemoveItems: boolean;
  canInviteOthers: boolean;
  user: { __typename: 'User' } & UserSummaryFragment;
};

export type BasicPantryFragment = {
  __typename: 'Pantry';
  id: string;
  homeId: string;
  name: string;
  isDefault: boolean;
};

export type HomeDisplayFragment = {
  __typename: 'Home';
  id: string;
  name: string;
  version: number;
  updatedAt: string;
  isDefault: boolean;
  membersConnection: {
    __typename: 'MembershipConnection';
    totalCount: number | null;
    edges: Array<{
      __typename: 'MembershipEdge';
      node: {
        __typename: 'Membership';
        id: string;
        role: Types.MembershipRole;
        status: Types.MembershipStatus;
        userId: string;
        displayName: string | null;
      };
    }>;
  };
  invitesConnection: {
    __typename: 'HomeInviteConnection';
    totalCount: number | null;
    edges: Array<{
      __typename: 'HomeInviteEdge';
      node: { __typename: 'HomeInvite' } & HomeInviteDisplayFragment;
    }>;
  };
  pantriesConnection: {
    __typename: 'PantryConnection';
    totalCount: number | null;
    edges: Array<{
      __typename: 'PantryEdge';
      node: { __typename: 'Pantry' } & BasicPantryFragment;
    }>;
  };
  myMembership: {
    __typename: 'Membership';
    id: string;
    role: Types.MembershipRole;
    status: Types.MembershipStatus;
    displayName: string | null;
    canManageHome: boolean;
    canViewPantry: boolean;
    canEditPantry: boolean;
    canAddItems: boolean;
    canRemoveItems: boolean;
    canInviteOthers: boolean;
  } | null;
};

export type HomeListFragment = {
  __typename: 'Home';
  id: string;
  name: string;
  isDefault: boolean;
  version: number;
  membersConnection: {
    __typename: 'MembershipConnection';
    totalCount: number | null;
    edges: Array<{
      __typename: 'MembershipEdge';
      node: {
        __typename: 'Membership';
        id: string;
        role: Types.MembershipRole;
        status: Types.MembershipStatus;
        userId: string;
        displayName: string | null;
      };
    }>;
  };
  invitesConnection: {
    __typename: 'HomeInviteConnection';
    totalCount: number | null;
    edges: Array<{
      __typename: 'HomeInviteEdge';
      node: {
        __typename: 'HomeInvite';
        id: string;
        email: string;
        recipientName: string | null;
        status: Types.InviteStatus;
      };
    }>;
  };
  pantriesConnection: {
    __typename: 'PantryConnection';
    totalCount: number | null;
    edges: Array<{
      __typename: 'PantryEdge';
      node: {
        __typename: 'Pantry';
        id: string;
        name: string;
        isDefault: boolean;
      };
    }>;
  };
  myMembership: {
    __typename: 'Membership';
    id: string;
    role: Types.MembershipRole;
    canManageHome: boolean;
    canViewPantry: boolean;
    canEditPantry: boolean;
    canAddItems: boolean;
    canRemoveItems: boolean;
    canInviteOthers: boolean;
  } | null;
};

export type HomeFragment = {
  __typename: 'Home';
  id: string;
  name: string;
  description: string | null;
  timezone: string | null;
  currency: string | null;
  isPublic: boolean;
  joinCode: string | null;
  allowJoinCode: boolean;
  maxMembers: number | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  invitesConnection: {
    __typename: 'HomeInviteConnection';
    totalCount: number | null;
    edges: Array<{
      __typename: 'HomeInviteEdge';
      node: {
        __typename: 'HomeInvite';
        id: string;
        email: string;
        recipientName: string | null;
        role: Types.MembershipRole;
        status: Types.InviteStatus;
      };
    }>;
  };
  membersConnection: {
    __typename: 'MembershipConnection';
    totalCount: number | null;
    edges: Array<{
      __typename: 'MembershipEdge';
      node: {
        __typename: 'Membership';
        id: string;
        homeId: string;
        userId: string;
        role: Types.MembershipRole;
        status: Types.MembershipStatus;
        displayName: string | null;
        canManageHome: boolean;
        user: { __typename: 'User'; id: string; email: string };
      };
    }>;
  };
  pantriesConnection: {
    __typename: 'PantryConnection';
    totalCount: number | null;
    edges: Array<{
      __typename: 'PantryEdge';
      node: {
        __typename: 'Pantry';
        id: string;
        name: string;
        isDefault: boolean;
      };
    }>;
  };
  myMembership: {
    __typename: 'Membership';
    id: string;
    role: Types.MembershipRole;
    status: Types.MembershipStatus;
    displayName: string | null;
    canManageHome: boolean;
    canViewPantry: boolean;
    canEditPantry: boolean;
    canAddItems: boolean;
    canRemoveItems: boolean;
    canInviteOthers: boolean;
  } | null;
};

export type NotificationFragment = {
  __typename: 'Notification';
  id: string;
  userId: string;
  type: Types.NotificationType;
  status: Types.NotificationStatus;
  priority: Types.Priority;
  title: string | null;
  message: string | null;
  payload: any;
  category: Types.NotificationCategory | null;
  sourceId: string | null;
  sourceType: string | null;
  actionUrl: string | null;
  expiresAt: string | null;
  sentAt: string;
  readAt: string | null;
  createdAt: string;
};

export type ExpirationNotificationFragment = {
  __typename: 'ExpirationNotification';
  id: string;
  notificationType: Types.ExpirationNotificationType;
  daysUntilExpiry: number;
  expiresAt: string;
  status: Types.NotificationDeliveryStatus;
  sentAt: string | null;
  readAt: string | null;
  actionTaken: Types.ExpirationAction | null;
  actionAt: string | null;
  dismissedAt: string | null;
  createdAt: string;
  genericNotificationId: string | null;
  pantryItemId: string;
  pantryItem: {
    __typename: 'PantryItem';
    id: string;
    item: {
      __typename: 'Item';
      id: string;
      name: string;
      imageUrl: string | null;
    };
  };
};

export type PurchaseFragment = {
  __typename: 'Purchase';
  id: string;
  purchaseDate: string;
  quantity: number;
  unitPrice: number;
  unitSymbol: string;
};

export type MealPlanRecipeFragment = {
  __typename: 'Recipe';
  id: string;
  name: string;
  imageUrl: string | null;
  servings: number;
  totalTimeMinutes: number | null;
};

export type MealPlanItemFragment = {
  __typename: 'MealPlanItem';
  id: string;
  date: string;
  mealType: Types.MealType;
  isCompleted: boolean;
  completedAt: string | null;
  customMealName: string | null;
  servings: number | null;
  notes: string | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  estimatedCost: number | null;
  actualCost: number | null;
  nutritionSource: Types.NutritionSource;
  usedPantryItems: any;
  recipe: ({ __typename: 'Recipe' } & MealPlanRecipeFragment) | null;
};

export type MealPlanDisplayFragment = {
  __typename: 'MealPlan';
  id: string;
  name: string;
  description: string | null;
  planType: Types.MealPlanType;
  startDate: string;
  endDate: string;
  servings: number;
  totalCalories: number | null;
  totalProtein: number | null;
  totalCarbs: number | null;
  totalFat: number | null;
  actualCost: number;
  budgetAmount: number | null;
  homeId: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  home: {
    __typename: 'Home';
    id: string;
    name: string;
    myMembership: {
      __typename: 'Membership';
      id: string;
      role: Types.MembershipRole;
    } | null;
  } | null;
  createdBy: {
    __typename: 'User';
    id: string;
    profile: {
      __typename: 'UserProfile';
      id: string;
      displayName: string | null;
    } | null;
  } | null;
};

export type MealPlanFullFragment = {
  __typename: 'MealPlan';
  dietaryProfile: {
    __typename: 'DietaryProfile';
    id: string;
    calorieTarget: number | null;
    proteinTarget: number | null;
    carbsTarget: number | null;
    fatTarget: number | null;
  } | null;
  mealPlanItems: Array<{ __typename: 'MealPlanItem' } & MealPlanItemFragment>;
  generatedShoppingLists: Array<{
    __typename: 'ShoppingList';
    id: string;
    name: string;
  }>;
  nutritionSummary: {
    __typename: 'MealPlanNutritionSummary';
    totalCalories: number;
    totalProtein: number;
    totalCarbs: number;
    totalFat: number;
    avgDailyCalories: number;
    avgDailyProtein: number;
    avgDailyCarbs: number;
    avgDailyFat: number;
    totalMeals: number;
    mealsWithNutrition: number;
    coveragePercentage: number;
    mealTypeBreakdown: Array<{
      __typename: 'MealTypeNutrition';
      mealType: Types.MealType;
      totalCalories: number;
      totalProtein: number;
      totalCarbs: number;
      totalFat: number;
      mealCount: number;
    }>;
  };
  nutritionGoalProgress: {
    __typename: 'NutritionGoalProgress';
    overallScore: number;
    caloriesProgress: {
      __typename: 'GoalProgress';
      target: number;
      current: number;
      percentage: number;
      status: Types.GoalStatus;
    } | null;
    proteinProgress: {
      __typename: 'GoalProgress';
      target: number;
      current: number;
      percentage: number;
      status: Types.GoalStatus;
    } | null;
    carbsProgress: {
      __typename: 'GoalProgress';
      target: number;
      current: number;
      percentage: number;
      status: Types.GoalStatus;
    } | null;
    fatProgress: {
      __typename: 'GoalProgress';
      target: number;
      current: number;
      percentage: number;
      status: Types.GoalStatus;
    } | null;
  } | null;
} & MealPlanDisplayFragment;

export type MealTemplateDisplayFragment = {
  __typename: 'MealTemplate';
  id: string;
  name: string;
  description: string | null;
  category: Types.TemplateCategory;
  durationDays: number;
  defaultServings: number;
  tags: Array<string>;
  usageCount: number;
  lastUsedAt: string | null;
  homeId: string | null;
  createdAt: string;
  updatedAt: string;
  home: {
    __typename: 'Home';
    id: string;
    name: string;
    myMembership: {
      __typename: 'Membership';
      id: string;
      role: Types.MembershipRole;
    } | null;
  } | null;
  user: { __typename: 'User'; id: string };
};

export type MealTemplateItemFragment = {
  __typename: 'MealTemplateItem';
  id: string;
  dayOffset: number;
  mealType: Types.MealType;
  customMealName: string | null;
  servings: number | null;
  notes: string | null;
  recipe: ({ __typename: 'Recipe' } & MealPlanRecipeFragment) | null;
};

export type RecipeIngredientFragment = {
  __typename: 'RecipeIngredient';
  id: string;
  name: string;
  quantity: number;
  image: string | null;
  isOptional: boolean;
  notes: string | null;
  preparation: string | null;
  sortOrder: number;
  section: string | null;
  item: {
    __typename: 'Item';
    id: string;
    name: string;
    imageUrl: string | null;
  } | null;
  unit: { __typename: 'Unit'; id: string; name: string; symbol: string } | null;
};

export type RecipeReviewFragment = {
  __typename: 'RecipeReview';
  id: string;
  rating: number;
  comment: string | null;
  helpful: number;
  verified: boolean;
  createdAt: string;
  updatedAt: string;
  user: { __typename: 'User' } & UserSummaryFragment;
  helpfulVotes: Array<{
    __typename: 'ReviewHelpful';
    id: string;
    user: { __typename: 'User'; id: string };
  }>;
};

export type BasicRecipeFragment = {
  __typename: 'Recipe';
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  servings: number;
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  totalTimeMinutes: number | null;
  difficulty: Types.Difficulty;
  category: Types.RecipeCategory;
  cuisine: string | null;
  status: Types.RecipeStatus;
  isExternal: boolean;
  externalSource: Types.ExternalSource | null;
  externalId: string | null;
  primarySource: string | null;
  caloriesPerServing: number | null;
  createdAt: string;
  updatedAt: string;
  savedDetails: {
    __typename: 'SavedRecipe';
    id: string;
    folder: string | null;
    tags: Array<string>;
    notes: string | null;
    personalRating: number | null;
    cookedCount: number;
  } | null;
};

export type RecipeFragment = {
  __typename: 'Recipe';
  instructions: any;
  notes: string | null;
  videoUrl: string | null;
  sourceUrl: string | null;
  source: string | null;
  isPublished: boolean;
  averageRating: number | null;
  totalReviews: number;
  rating1Count: number;
  rating2Count: number;
  rating3Count: number;
  rating4Count: number;
  rating5Count: number;
  createdBy: ({ __typename: 'User' } & BasicUserFragment) | null;
  ingredients: Array<
    { __typename: 'RecipeIngredient' } & RecipeIngredientFragment
  >;
} & BasicRecipeFragment;

export const ShoppingListItemCoreFragmentDoc = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'ShoppingListItemCore' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'ShoppingListItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'itemName' } },
          { kind: 'Field', name: { kind: 'Name', value: 'quantity' } },
          { kind: 'Field', name: { kind: 'Name', value: 'quantityInput' } },
          { kind: 'Field', name: { kind: 'Name', value: 'displayFormat' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'purchaseInfo' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'isPurchased' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'version' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'category' } },
          { kind: 'Field', name: { kind: 'Name', value: 'notes' } },
          { kind: 'Field', name: { kind: 'Name', value: 'unitName' } },
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
        ],
      },
    },
  ],
} as unknown as DocumentNode;
export const ShoppingListItemDisplayFragmentDoc = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'ShoppingListItemDisplayFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'ShoppingListItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'FragmentSpread',
            name: { kind: 'Name', value: 'ShoppingListItemCore' },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'sortOrder' } },
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
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'ShoppingListItemCore' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'ShoppingListItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'itemName' } },
          { kind: 'Field', name: { kind: 'Name', value: 'quantity' } },
          { kind: 'Field', name: { kind: 'Name', value: 'quantityInput' } },
          { kind: 'Field', name: { kind: 'Name', value: 'displayFormat' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'purchaseInfo' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'isPurchased' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'version' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'category' } },
          { kind: 'Field', name: { kind: 'Name', value: 'notes' } },
          { kind: 'Field', name: { kind: 'Name', value: 'unitName' } },
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
        ],
      },
    },
  ],
} as unknown as DocumentNode;
export const UserSummaryFragmentDoc = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'UserSummary' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'User' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'email' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'profile' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'displayName' } },
                { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;
export const PurchaseFragmentDoc = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PurchaseFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'Purchase' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'purchaseDate' } },
          { kind: 'Field', name: { kind: 'Name', value: 'quantity' } },
          { kind: 'Field', name: { kind: 'Name', value: 'unitPrice' } },
          { kind: 'Field', name: { kind: 'Name', value: 'unitSymbol' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode;
export const ShoppingListItemFragmentDoc = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'ShoppingListItemFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'ShoppingListItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'FragmentSpread',
            name: { kind: 'Name', value: 'ShoppingListItemDisplayFragment' },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'item' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'description' } },
                { kind: 'Field', name: { kind: 'Name', value: 'imageUrl' } },
                { kind: 'Field', name: { kind: 'Name', value: 'netWeight' } },
                { kind: 'Field', name: { kind: 'Name', value: 'nutritions' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'displayUnit' },
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
                  name: { kind: 'Name', value: 'categories' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'isPrimary' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'confidence' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'source' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'assignedAt' },
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
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'priceEstimate' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'estimated' } },
                { kind: 'Field', name: { kind: 'Name', value: 'lastKnown' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'source' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'isAutoAdded' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'autoAddReason' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'isFromMealPlan' },
                },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'priority' } },
          { kind: 'Field', name: { kind: 'Name', value: 'sortOrder' } },
          { kind: 'Field', name: { kind: 'Name', value: 'createdAt' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'addedBy' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'UserSummary' },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'purchasesConnection' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'first' },
                value: { kind: 'IntValue', value: '10' },
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
                              name: { kind: 'Name', value: 'PurchaseFragment' },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
                { kind: 'Field', name: { kind: 'Name', value: 'totalCount' } },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'ShoppingListItemCore' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'ShoppingListItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'itemName' } },
          { kind: 'Field', name: { kind: 'Name', value: 'quantity' } },
          { kind: 'Field', name: { kind: 'Name', value: 'quantityInput' } },
          { kind: 'Field', name: { kind: 'Name', value: 'displayFormat' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'purchaseInfo' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'isPurchased' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'version' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'category' } },
          { kind: 'Field', name: { kind: 'Name', value: 'notes' } },
          { kind: 'Field', name: { kind: 'Name', value: 'unitName' } },
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
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'ShoppingListItemDisplayFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'ShoppingListItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'FragmentSpread',
            name: { kind: 'Name', value: 'ShoppingListItemCore' },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'sortOrder' } },
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
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'UserSummary' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'User' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'email' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'profile' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'displayName' } },
                { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PurchaseFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'Purchase' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'purchaseDate' } },
          { kind: 'Field', name: { kind: 'Name', value: 'quantity' } },
          { kind: 'Field', name: { kind: 'Name', value: 'unitPrice' } },
          { kind: 'Field', name: { kind: 'Name', value: 'unitSymbol' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode;
export const ShoppingListOwnershipFragmentDoc = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'ShoppingListOwnershipFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'ShoppingListOwnership' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'userId' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'user' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'email' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'profile' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'displayName' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'avatar' },
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
export const ShoppingListCollaboratorFragmentDoc = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'ShoppingListCollaboratorFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'ShoppingListCollaborator' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'email' } },
          { kind: 'Field', name: { kind: 'Name', value: 'role' } },
          { kind: 'Field', name: { kind: 'Name', value: 'status' } },
          { kind: 'Field', name: { kind: 'Name', value: 'collaboratorId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'canAddItems' } },
          { kind: 'Field', name: { kind: 'Name', value: 'canRemoveItems' } },
          { kind: 'Field', name: { kind: 'Name', value: 'canEditItems' } },
          { kind: 'Field', name: { kind: 'Name', value: 'canMarkPurchased' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'collaborator' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'email' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'profile' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'displayName' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'avatar' },
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
export const AuthUserFragmentDoc = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'AuthUser' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'User' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'email' } },
          { kind: 'Field', name: { kind: 'Name', value: 'emailVerified' } },
          { kind: 'Field', name: { kind: 'Name', value: 'role' } },
          { kind: 'Field', name: { kind: 'Name', value: 'canAccessDevTools' } },
          { kind: 'Field', name: { kind: 'Name', value: 'onBoarded' } },
          { kind: 'Field', name: { kind: 'Name', value: 'createdAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'timezone' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode;
export const LoginUserFragmentDoc = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'LoginUser' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'User' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'FragmentSpread', name: { kind: 'Name', value: 'AuthUser' } },
          { kind: 'Field', name: { kind: 'Name', value: 'defaultHomeId' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'defaultShoppingListId' },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'defaultHome' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'isDefault' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'pantriesConnection' },
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
                                    name: { kind: 'Name', value: 'isDefault' },
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
            kind: 'Field',
            name: { kind: 'Name', value: 'profile' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'displayName' } },
                { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'settings' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'theme' } },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'AuthUser' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'User' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'email' } },
          { kind: 'Field', name: { kind: 'Name', value: 'emailVerified' } },
          { kind: 'Field', name: { kind: 'Name', value: 'role' } },
          { kind: 'Field', name: { kind: 'Name', value: 'canAccessDevTools' } },
          { kind: 'Field', name: { kind: 'Name', value: 'onBoarded' } },
          { kind: 'Field', name: { kind: 'Name', value: 'createdAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'timezone' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode;
export const PartialUserFragmentDoc = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PartialUser' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'User' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'email' } },
          { kind: 'Field', name: { kind: 'Name', value: 'emailVerified' } },
          { kind: 'Field', name: { kind: 'Name', value: 'role' } },
          { kind: 'Field', name: { kind: 'Name', value: 'canAccessDevTools' } },
          { kind: 'Field', name: { kind: 'Name', value: 'onBoarded' } },
          { kind: 'Field', name: { kind: 'Name', value: 'timezone' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'defaultShoppingListId' },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'defaultHomeId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'createdAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'profile' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'firstName' } },
                { kind: 'Field', name: { kind: 'Name', value: 'lastName' } },
                { kind: 'Field', name: { kind: 'Name', value: 'displayName' } },
                { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'settings' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'theme' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;
export const ItemCoreFragmentDoc = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'ItemCore' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'Item' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'name' } },
          { kind: 'Field', name: { kind: 'Name', value: 'version' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode;
export const ItemDisplayFragmentDoc = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'ItemDisplay' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'Item' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'name' } },
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
          { kind: 'Field', name: { kind: 'Name', value: 'netWeight' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'displayUnit' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'symbol' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'categories' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'isPrimary' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'category' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'color' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'icon' } },
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
export const UnitFragmentDoc = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'UnitFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'ItemUnit' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'itemId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'unitId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isDefault' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isPreferred' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isCommon' } },
          { kind: 'Field', name: { kind: 'Name', value: 'packageSize' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'packageDescription' },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'retailUnit' } },
          { kind: 'Field', name: { kind: 'Name', value: 'usageContext' } },
          { kind: 'Field', name: { kind: 'Name', value: 'recommendedFor' } },
          { kind: 'Field', name: { kind: 'Name', value: 'minQuantity' } },
          { kind: 'Field', name: { kind: 'Name', value: 'maxQuantity' } },
          { kind: 'Field', name: { kind: 'Name', value: 'quantityStep' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'averagePricePerUnit' },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'createdAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'version' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'displayNameSingular' },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'displayNamePlural' } },
          { kind: 'Field', name: { kind: 'Name', value: 'contentUnitId' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'contentUnit' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'symbol' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;
export const BrandFragmentDoc = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'BrandFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'ItemBrand' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
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
        ],
      },
    },
  ],
} as unknown as DocumentNode;
export const ItemFragmentDoc = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'ItemFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'Item' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'FragmentSpread',
            name: { kind: 'Name', value: 'ItemDisplay' },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'description' } },
          { kind: 'Field', name: { kind: 'Name', value: 'dataSource' } },
          { kind: 'Field', name: { kind: 'Name', value: 'type' } },
          { kind: 'Field', name: { kind: 'Name', value: 'storageState' } },
          { kind: 'Field', name: { kind: 'Name', value: 'showInOnboarding' } },
          { kind: 'Field', name: { kind: 'Name', value: 'shelfLifeDays' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'shelfLifeOpenedDays' },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'popularity' } },
          { kind: 'Field', name: { kind: 'Name', value: 'status' } },
          { kind: 'Field', name: { kind: 'Name', value: 'visibility' } },
          { kind: 'Field', name: { kind: 'Name', value: 'tags' } },
          { kind: 'Field', name: { kind: 'Name', value: 'nutritions' } },
          { kind: 'Field', name: { kind: 'Name', value: 'ingredients' } },
          { kind: 'Field', name: { kind: 'Name', value: 'createdAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'density' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'defaultConsumeUnit' },
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
            name: { kind: 'Name', value: 'defaultConsumeUnitId' },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'defaultConsumeIncrement' },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'displayUnit' },
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
            name: { kind: 'Name', value: 'units' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'UnitFragment' },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'brands' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'BrandFragment' },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'UnitFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'ItemUnit' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'itemId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'unitId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isDefault' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isPreferred' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isCommon' } },
          { kind: 'Field', name: { kind: 'Name', value: 'packageSize' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'packageDescription' },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'retailUnit' } },
          { kind: 'Field', name: { kind: 'Name', value: 'usageContext' } },
          { kind: 'Field', name: { kind: 'Name', value: 'recommendedFor' } },
          { kind: 'Field', name: { kind: 'Name', value: 'minQuantity' } },
          { kind: 'Field', name: { kind: 'Name', value: 'maxQuantity' } },
          { kind: 'Field', name: { kind: 'Name', value: 'quantityStep' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'averagePricePerUnit' },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'createdAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'version' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'displayNameSingular' },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'displayNamePlural' } },
          { kind: 'Field', name: { kind: 'Name', value: 'contentUnitId' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'contentUnit' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'symbol' } },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'BrandFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'ItemBrand' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
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
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'ItemDisplay' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'Item' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'name' } },
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
          { kind: 'Field', name: { kind: 'Name', value: 'netWeight' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'displayUnit' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'symbol' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'categories' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'isPrimary' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'category' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'color' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'icon' } },
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
export const PantryItemCoreFragmentDoc = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
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
export const PantryItemDisplayFragmentDoc = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
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
export const PantryItemBatchFragmentDoc = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
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
export const PantryItemFragmentDoc = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
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
export const BasicUserFragmentDoc = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'BasicUser' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'User' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'email' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode;
export const HomeInviteFragmentDoc = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'HomeInviteFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'HomeInvite' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'token' } },
          { kind: 'Field', name: { kind: 'Name', value: 'email' } },
          { kind: 'Field', name: { kind: 'Name', value: 'homeId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'invitedUserId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'recipientName' } },
          { kind: 'Field', name: { kind: 'Name', value: 'role' } },
          { kind: 'Field', name: { kind: 'Name', value: 'status' } },
          { kind: 'Field', name: { kind: 'Name', value: 'expiresAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'sentAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'message' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'home' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'inviter' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'BasicUser' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'profile' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'displayName' },
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
      name: { kind: 'Name', value: 'BasicUser' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'User' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'email' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode;
export const MemberShipFragmentDoc = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'MemberShipFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'Membership' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'homeId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'userId' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'user' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'UserSummary' },
                },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'role' } },
          { kind: 'Field', name: { kind: 'Name', value: 'status' } },
          { kind: 'Field', name: { kind: 'Name', value: 'displayName' } },
          { kind: 'Field', name: { kind: 'Name', value: 'canManageHome' } },
          { kind: 'Field', name: { kind: 'Name', value: 'canViewPantry' } },
          { kind: 'Field', name: { kind: 'Name', value: 'canEditPantry' } },
          { kind: 'Field', name: { kind: 'Name', value: 'canAddItems' } },
          { kind: 'Field', name: { kind: 'Name', value: 'canRemoveItems' } },
          { kind: 'Field', name: { kind: 'Name', value: 'canInviteOthers' } },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'UserSummary' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'User' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'email' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'profile' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'displayName' } },
                { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;
export const HomeInviteDisplayFragmentDoc = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'HomeInviteDisplay' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'HomeInvite' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'email' } },
          { kind: 'Field', name: { kind: 'Name', value: 'recipientName' } },
          { kind: 'Field', name: { kind: 'Name', value: 'role' } },
          { kind: 'Field', name: { kind: 'Name', value: 'status' } },
          { kind: 'Field', name: { kind: 'Name', value: 'expiresAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'message' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'home' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'inviter' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'BasicUser' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'profile' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'displayName' },
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
      name: { kind: 'Name', value: 'BasicUser' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'User' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'email' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode;
export const BasicPantryFragmentDoc = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'BasicPantryFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'Pantry' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'homeId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'name' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isDefault' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode;
export const HomeDisplayFragmentDoc = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'HomeDisplay' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'Home' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'name' } },
          { kind: 'Field', name: { kind: 'Name', value: 'version' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isDefault' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'membersConnection' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'first' },
                value: { kind: 'IntValue', value: '10' },
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
                              name: { kind: 'Name', value: 'role' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'status' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'userId' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'displayName' },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
                { kind: 'Field', name: { kind: 'Name', value: 'totalCount' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'invitesConnection' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'first' },
                value: { kind: 'IntValue', value: '10' },
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
                                value: 'HomeInviteDisplay',
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
                { kind: 'Field', name: { kind: 'Name', value: 'totalCount' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'pantriesConnection' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'first' },
                value: { kind: 'IntValue', value: '20' },
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
                                value: 'BasicPantryFragment',
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
                { kind: 'Field', name: { kind: 'Name', value: 'totalCount' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'myMembership' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'role' } },
                { kind: 'Field', name: { kind: 'Name', value: 'status' } },
                { kind: 'Field', name: { kind: 'Name', value: 'displayName' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'canManageHome' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'canViewPantry' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'canEditPantry' },
                },
                { kind: 'Field', name: { kind: 'Name', value: 'canAddItems' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'canRemoveItems' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'canInviteOthers' },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'BasicUser' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'User' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'email' } },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'HomeInviteDisplay' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'HomeInvite' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'email' } },
          { kind: 'Field', name: { kind: 'Name', value: 'recipientName' } },
          { kind: 'Field', name: { kind: 'Name', value: 'role' } },
          { kind: 'Field', name: { kind: 'Name', value: 'status' } },
          { kind: 'Field', name: { kind: 'Name', value: 'expiresAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'message' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'home' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'inviter' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'BasicUser' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'profile' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'displayName' },
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
      name: { kind: 'Name', value: 'BasicPantryFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'Pantry' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'homeId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'name' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isDefault' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode;
export const HomeListFragmentDoc = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'HomeListFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'Home' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'name' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isDefault' } },
          { kind: 'Field', name: { kind: 'Name', value: 'version' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'membersConnection' },
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
                              name: { kind: 'Name', value: 'role' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'status' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'userId' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'displayName' },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
                { kind: 'Field', name: { kind: 'Name', value: 'totalCount' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'invitesConnection' },
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
                              name: { kind: 'Name', value: 'email' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'recipientName' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'status' },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
                { kind: 'Field', name: { kind: 'Name', value: 'totalCount' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'pantriesConnection' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'first' },
                value: { kind: 'IntValue', value: '10' },
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
                              name: { kind: 'Name', value: 'isDefault' },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
                { kind: 'Field', name: { kind: 'Name', value: 'totalCount' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'myMembership' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'role' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'canManageHome' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'canViewPantry' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'canEditPantry' },
                },
                { kind: 'Field', name: { kind: 'Name', value: 'canAddItems' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'canRemoveItems' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'canInviteOthers' },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;
export const HomeFragmentDoc = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'HomeFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'Home' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'name' } },
          { kind: 'Field', name: { kind: 'Name', value: 'description' } },
          { kind: 'Field', name: { kind: 'Name', value: 'timezone' } },
          { kind: 'Field', name: { kind: 'Name', value: 'currency' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isPublic' } },
          { kind: 'Field', name: { kind: 'Name', value: 'joinCode' } },
          { kind: 'Field', name: { kind: 'Name', value: 'allowJoinCode' } },
          { kind: 'Field', name: { kind: 'Name', value: 'maxMembers' } },
          { kind: 'Field', name: { kind: 'Name', value: 'version' } },
          { kind: 'Field', name: { kind: 'Name', value: 'createdAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'invitesConnection' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'first' },
                value: { kind: 'IntValue', value: '20' },
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
                              name: { kind: 'Name', value: 'email' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'recipientName' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'role' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'status' },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
                { kind: 'Field', name: { kind: 'Name', value: 'totalCount' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'membersConnection' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'first' },
                value: { kind: 'IntValue', value: '20' },
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
                              name: { kind: 'Name', value: 'userId' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'role' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'status' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'displayName' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'canManageHome' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'user' },
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
                { kind: 'Field', name: { kind: 'Name', value: 'totalCount' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'pantriesConnection' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'first' },
                value: { kind: 'IntValue', value: '20' },
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
                              name: { kind: 'Name', value: 'isDefault' },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
                { kind: 'Field', name: { kind: 'Name', value: 'totalCount' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'myMembership' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'role' } },
                { kind: 'Field', name: { kind: 'Name', value: 'status' } },
                { kind: 'Field', name: { kind: 'Name', value: 'displayName' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'canManageHome' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'canViewPantry' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'canEditPantry' },
                },
                { kind: 'Field', name: { kind: 'Name', value: 'canAddItems' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'canRemoveItems' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'canInviteOthers' },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;
export const NotificationFragmentDoc = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'NotificationFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'Notification' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'userId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'type' } },
          { kind: 'Field', name: { kind: 'Name', value: 'status' } },
          { kind: 'Field', name: { kind: 'Name', value: 'priority' } },
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'message' } },
          { kind: 'Field', name: { kind: 'Name', value: 'payload' } },
          { kind: 'Field', name: { kind: 'Name', value: 'category' } },
          { kind: 'Field', name: { kind: 'Name', value: 'sourceId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'sourceType' } },
          { kind: 'Field', name: { kind: 'Name', value: 'actionUrl' } },
          { kind: 'Field', name: { kind: 'Name', value: 'expiresAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'sentAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'readAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'createdAt' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode;
export const ExpirationNotificationFragmentDoc = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
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
export const MealPlanDisplayFragmentDoc = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'MealPlanDisplay' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'MealPlan' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'name' } },
          { kind: 'Field', name: { kind: 'Name', value: 'description' } },
          { kind: 'Field', name: { kind: 'Name', value: 'planType' } },
          { kind: 'Field', name: { kind: 'Name', value: 'startDate' } },
          { kind: 'Field', name: { kind: 'Name', value: 'endDate' } },
          { kind: 'Field', name: { kind: 'Name', value: 'servings' } },
          { kind: 'Field', name: { kind: 'Name', value: 'totalCalories' } },
          { kind: 'Field', name: { kind: 'Name', value: 'totalProtein' } },
          { kind: 'Field', name: { kind: 'Name', value: 'totalCarbs' } },
          { kind: 'Field', name: { kind: 'Name', value: 'totalFat' } },
          { kind: 'Field', name: { kind: 'Name', value: 'actualCost' } },
          { kind: 'Field', name: { kind: 'Name', value: 'budgetAmount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'homeId' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'home' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'myMembership' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'role' } },
                    ],
                  },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'createdBy' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'profile' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'displayName' },
                      },
                    ],
                  },
                },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'version' } },
          { kind: 'Field', name: { kind: 'Name', value: 'createdAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode;
export const MealPlanRecipeFragmentDoc = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'MealPlanRecipeFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'Recipe' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'name' } },
          { kind: 'Field', name: { kind: 'Name', value: 'imageUrl' } },
          { kind: 'Field', name: { kind: 'Name', value: 'servings' } },
          { kind: 'Field', name: { kind: 'Name', value: 'totalTimeMinutes' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode;
export const MealPlanItemFragmentDoc = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'MealPlanItemFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'MealPlanItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'date' } },
          { kind: 'Field', name: { kind: 'Name', value: 'mealType' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isCompleted' } },
          { kind: 'Field', name: { kind: 'Name', value: 'completedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'customMealName' } },
          { kind: 'Field', name: { kind: 'Name', value: 'servings' } },
          { kind: 'Field', name: { kind: 'Name', value: 'notes' } },
          { kind: 'Field', name: { kind: 'Name', value: 'calories' } },
          { kind: 'Field', name: { kind: 'Name', value: 'protein' } },
          { kind: 'Field', name: { kind: 'Name', value: 'carbs' } },
          { kind: 'Field', name: { kind: 'Name', value: 'fat' } },
          { kind: 'Field', name: { kind: 'Name', value: 'estimatedCost' } },
          { kind: 'Field', name: { kind: 'Name', value: 'actualCost' } },
          { kind: 'Field', name: { kind: 'Name', value: 'nutritionSource' } },
          { kind: 'Field', name: { kind: 'Name', value: 'usedPantryItems' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'recipe' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'MealPlanRecipeFragment' },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'MealPlanRecipeFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'Recipe' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'name' } },
          { kind: 'Field', name: { kind: 'Name', value: 'imageUrl' } },
          { kind: 'Field', name: { kind: 'Name', value: 'servings' } },
          { kind: 'Field', name: { kind: 'Name', value: 'totalTimeMinutes' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode;
export const MealPlanFullFragmentDoc = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'MealPlanFull' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'MealPlan' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'FragmentSpread',
            name: { kind: 'Name', value: 'MealPlanDisplay' },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'dietaryProfile' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'calorieTarget' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'proteinTarget' },
                },
                { kind: 'Field', name: { kind: 'Name', value: 'carbsTarget' } },
                { kind: 'Field', name: { kind: 'Name', value: 'fatTarget' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'mealPlanItems' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'MealPlanItemFragment' },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'generatedShoppingLists' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'nutritionSummary' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'totalCalories' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'totalProtein' },
                },
                { kind: 'Field', name: { kind: 'Name', value: 'totalCarbs' } },
                { kind: 'Field', name: { kind: 'Name', value: 'totalFat' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'avgDailyCalories' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'avgDailyProtein' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'avgDailyCarbs' },
                },
                { kind: 'Field', name: { kind: 'Name', value: 'avgDailyFat' } },
                { kind: 'Field', name: { kind: 'Name', value: 'totalMeals' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'mealsWithNutrition' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'coveragePercentage' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'mealTypeBreakdown' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'mealType' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'totalCalories' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'totalProtein' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'totalCarbs' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'totalFat' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'mealCount' },
                      },
                    ],
                  },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'nutritionGoalProgress' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'overallScore' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'caloriesProgress' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'target' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'current' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'percentage' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'status' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'proteinProgress' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'target' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'current' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'percentage' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'status' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'carbsProgress' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'target' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'current' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'percentage' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'status' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'fatProgress' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'target' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'current' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'percentage' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'status' },
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
      name: { kind: 'Name', value: 'MealPlanRecipeFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'Recipe' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'name' } },
          { kind: 'Field', name: { kind: 'Name', value: 'imageUrl' } },
          { kind: 'Field', name: { kind: 'Name', value: 'servings' } },
          { kind: 'Field', name: { kind: 'Name', value: 'totalTimeMinutes' } },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'MealPlanItemFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'MealPlanItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'date' } },
          { kind: 'Field', name: { kind: 'Name', value: 'mealType' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isCompleted' } },
          { kind: 'Field', name: { kind: 'Name', value: 'completedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'customMealName' } },
          { kind: 'Field', name: { kind: 'Name', value: 'servings' } },
          { kind: 'Field', name: { kind: 'Name', value: 'notes' } },
          { kind: 'Field', name: { kind: 'Name', value: 'calories' } },
          { kind: 'Field', name: { kind: 'Name', value: 'protein' } },
          { kind: 'Field', name: { kind: 'Name', value: 'carbs' } },
          { kind: 'Field', name: { kind: 'Name', value: 'fat' } },
          { kind: 'Field', name: { kind: 'Name', value: 'estimatedCost' } },
          { kind: 'Field', name: { kind: 'Name', value: 'actualCost' } },
          { kind: 'Field', name: { kind: 'Name', value: 'nutritionSource' } },
          { kind: 'Field', name: { kind: 'Name', value: 'usedPantryItems' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'recipe' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'MealPlanRecipeFragment' },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'MealPlanDisplay' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'MealPlan' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'name' } },
          { kind: 'Field', name: { kind: 'Name', value: 'description' } },
          { kind: 'Field', name: { kind: 'Name', value: 'planType' } },
          { kind: 'Field', name: { kind: 'Name', value: 'startDate' } },
          { kind: 'Field', name: { kind: 'Name', value: 'endDate' } },
          { kind: 'Field', name: { kind: 'Name', value: 'servings' } },
          { kind: 'Field', name: { kind: 'Name', value: 'totalCalories' } },
          { kind: 'Field', name: { kind: 'Name', value: 'totalProtein' } },
          { kind: 'Field', name: { kind: 'Name', value: 'totalCarbs' } },
          { kind: 'Field', name: { kind: 'Name', value: 'totalFat' } },
          { kind: 'Field', name: { kind: 'Name', value: 'actualCost' } },
          { kind: 'Field', name: { kind: 'Name', value: 'budgetAmount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'homeId' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'home' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'myMembership' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'role' } },
                    ],
                  },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'createdBy' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'profile' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'displayName' },
                      },
                    ],
                  },
                },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'version' } },
          { kind: 'Field', name: { kind: 'Name', value: 'createdAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode;
export const MealTemplateDisplayFragmentDoc = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'MealTemplateDisplay' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'MealTemplate' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'name' } },
          { kind: 'Field', name: { kind: 'Name', value: 'description' } },
          { kind: 'Field', name: { kind: 'Name', value: 'category' } },
          { kind: 'Field', name: { kind: 'Name', value: 'durationDays' } },
          { kind: 'Field', name: { kind: 'Name', value: 'defaultServings' } },
          { kind: 'Field', name: { kind: 'Name', value: 'tags' } },
          { kind: 'Field', name: { kind: 'Name', value: 'usageCount' } },
          { kind: 'Field', name: { kind: 'Name', value: 'lastUsedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'homeId' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'home' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'myMembership' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'role' } },
                    ],
                  },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'user' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'createdAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode;
export const MealTemplateItemFragmentDoc = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'MealTemplateItemFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'MealTemplateItem' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'dayOffset' } },
          { kind: 'Field', name: { kind: 'Name', value: 'mealType' } },
          { kind: 'Field', name: { kind: 'Name', value: 'customMealName' } },
          { kind: 'Field', name: { kind: 'Name', value: 'servings' } },
          { kind: 'Field', name: { kind: 'Name', value: 'notes' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'recipe' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'MealPlanRecipeFragment' },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'MealPlanRecipeFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'Recipe' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'name' } },
          { kind: 'Field', name: { kind: 'Name', value: 'imageUrl' } },
          { kind: 'Field', name: { kind: 'Name', value: 'servings' } },
          { kind: 'Field', name: { kind: 'Name', value: 'totalTimeMinutes' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode;
export const RecipeReviewFragmentDoc = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'RecipeReviewFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'RecipeReview' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'rating' } },
          { kind: 'Field', name: { kind: 'Name', value: 'comment' } },
          { kind: 'Field', name: { kind: 'Name', value: 'helpful' } },
          { kind: 'Field', name: { kind: 'Name', value: 'verified' } },
          { kind: 'Field', name: { kind: 'Name', value: 'createdAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'user' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'UserSummary' },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'helpfulVotes' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'user' },
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
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'UserSummary' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'User' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'email' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'profile' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'displayName' } },
                { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;
export const BasicRecipeFragmentDoc = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'BasicRecipeFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'Recipe' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'name' } },
          { kind: 'Field', name: { kind: 'Name', value: 'description' } },
          { kind: 'Field', name: { kind: 'Name', value: 'imageUrl' } },
          { kind: 'Field', name: { kind: 'Name', value: 'servings' } },
          { kind: 'Field', name: { kind: 'Name', value: 'prepTimeMinutes' } },
          { kind: 'Field', name: { kind: 'Name', value: 'cookTimeMinutes' } },
          { kind: 'Field', name: { kind: 'Name', value: 'totalTimeMinutes' } },
          { kind: 'Field', name: { kind: 'Name', value: 'difficulty' } },
          { kind: 'Field', name: { kind: 'Name', value: 'category' } },
          { kind: 'Field', name: { kind: 'Name', value: 'cuisine' } },
          { kind: 'Field', name: { kind: 'Name', value: 'status' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isExternal' } },
          { kind: 'Field', name: { kind: 'Name', value: 'externalSource' } },
          { kind: 'Field', name: { kind: 'Name', value: 'externalId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'primarySource' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'caloriesPerServing' },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'createdAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'savedDetails' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'folder' } },
                { kind: 'Field', name: { kind: 'Name', value: 'tags' } },
                { kind: 'Field', name: { kind: 'Name', value: 'notes' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'personalRating' },
                },
                { kind: 'Field', name: { kind: 'Name', value: 'cookedCount' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;
export const RecipeIngredientFragmentDoc = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'RecipeIngredientFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'RecipeIngredient' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'name' } },
          { kind: 'Field', name: { kind: 'Name', value: 'quantity' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'item' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'imageUrl' } },
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
          { kind: 'Field', name: { kind: 'Name', value: 'image' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isOptional' } },
          { kind: 'Field', name: { kind: 'Name', value: 'notes' } },
          { kind: 'Field', name: { kind: 'Name', value: 'preparation' } },
          { kind: 'Field', name: { kind: 'Name', value: 'sortOrder' } },
          { kind: 'Field', name: { kind: 'Name', value: 'section' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode;
export const RecipeFragmentDoc = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'RecipeFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'Recipe' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'FragmentSpread',
            name: { kind: 'Name', value: 'BasicRecipeFragment' },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'instructions' } },
          { kind: 'Field', name: { kind: 'Name', value: 'notes' } },
          { kind: 'Field', name: { kind: 'Name', value: 'videoUrl' } },
          { kind: 'Field', name: { kind: 'Name', value: 'sourceUrl' } },
          { kind: 'Field', name: { kind: 'Name', value: 'source' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isPublished' } },
          { kind: 'Field', name: { kind: 'Name', value: 'averageRating' } },
          { kind: 'Field', name: { kind: 'Name', value: 'totalReviews' } },
          { kind: 'Field', name: { kind: 'Name', value: 'rating1Count' } },
          { kind: 'Field', name: { kind: 'Name', value: 'rating2Count' } },
          { kind: 'Field', name: { kind: 'Name', value: 'rating3Count' } },
          { kind: 'Field', name: { kind: 'Name', value: 'rating4Count' } },
          { kind: 'Field', name: { kind: 'Name', value: 'rating5Count' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'createdBy' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'BasicUser' },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'ingredients' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'RecipeIngredientFragment' },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'BasicUser' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'User' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'email' } },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'RecipeIngredientFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'RecipeIngredient' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'name' } },
          { kind: 'Field', name: { kind: 'Name', value: 'quantity' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'item' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'imageUrl' } },
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
          { kind: 'Field', name: { kind: 'Name', value: 'image' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isOptional' } },
          { kind: 'Field', name: { kind: 'Name', value: 'notes' } },
          { kind: 'Field', name: { kind: 'Name', value: 'preparation' } },
          { kind: 'Field', name: { kind: 'Name', value: 'sortOrder' } },
          { kind: 'Field', name: { kind: 'Name', value: 'section' } },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'BasicRecipeFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'Recipe' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'name' } },
          { kind: 'Field', name: { kind: 'Name', value: 'description' } },
          { kind: 'Field', name: { kind: 'Name', value: 'imageUrl' } },
          { kind: 'Field', name: { kind: 'Name', value: 'servings' } },
          { kind: 'Field', name: { kind: 'Name', value: 'prepTimeMinutes' } },
          { kind: 'Field', name: { kind: 'Name', value: 'cookTimeMinutes' } },
          { kind: 'Field', name: { kind: 'Name', value: 'totalTimeMinutes' } },
          { kind: 'Field', name: { kind: 'Name', value: 'difficulty' } },
          { kind: 'Field', name: { kind: 'Name', value: 'category' } },
          { kind: 'Field', name: { kind: 'Name', value: 'cuisine' } },
          { kind: 'Field', name: { kind: 'Name', value: 'status' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isExternal' } },
          { kind: 'Field', name: { kind: 'Name', value: 'externalSource' } },
          { kind: 'Field', name: { kind: 'Name', value: 'externalId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'primarySource' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'caloriesPerServing' },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'createdAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'savedDetails' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'folder' } },
                { kind: 'Field', name: { kind: 'Name', value: 'tags' } },
                { kind: 'Field', name: { kind: 'Name', value: 'notes' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'personalRating' },
                },
                { kind: 'Field', name: { kind: 'Name', value: 'cookedCount' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;
