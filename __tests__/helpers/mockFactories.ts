import { DocumentNode, GraphQLError } from 'graphql';
import { MockedResponse } from '@apollo/client/testing/react';
import { MembershipRole, StorageState, CollaboratorStatus } from '#generated';

let idCounter = 0;
const nextId = () => `test-id-${++idCounter}`;

export function resetIdCounter() {
  idCounter = 0;
}

export function createMockUser(overrides?: Record<string, unknown>) {
  return {
    id: nextId(),
    email: 'test@example.com',
    emailVerified: true,
    onBoarded: true,
    firstName: 'Test',
    lastName: 'User',
    ...overrides,
  };
}

export function createMockMember(overrides?: Record<string, unknown>) {
  const userId = nextId();
  return {
    id: nextId(),
    role: MembershipRole.Member,
    status: 'ACTIVE',
    userId,
    displayName: null,
    user: {
      id: userId,
      email: 'member@example.com',
      profile: {
        firstName: 'Test',
        lastName: 'Member',
        displayName: null,
      },
    },
    ...overrides,
  };
}

export function createMockPantryItem(overrides?: Record<string, unknown>) {
  return {
    id: nextId(),
    itemName: 'Test Item',
    quantity: 1,
    storageState: StorageState.Ambient,
    storageLocation: null,
    category: 'General',
    expirationDate: null,
    version: 1,
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockShoppingListItem(overrides?: Record<string, unknown>) {
  return {
    id: nextId(),
    itemName: 'Shopping Item',
    quantity: 1,
    category: 'Groceries',
    purchased: false,
    ...overrides,
  };
}

export function createMockConnection<T>(
  nodes: T[],
  overrides?: { hasNextPage?: boolean; endCursor?: string | null },
) {
  return {
    edges: nodes.map((node) => ({ node })),
    totalCount: nodes.length,
    pageInfo: {
      hasNextPage: overrides?.hasNextPage ?? false,
      hasPreviousPage: false,
      startCursor: nodes.length > 0 ? 'start-cursor' : null,
      endCursor: overrides?.endCursor ?? (nodes.length > 0 ? 'end-cursor' : null),
    },
  };
}

export function createMockHome(overrides?: Record<string, unknown>) {
  return {
    id: nextId(),
    name: 'Test Home',
    type: 'FAMILY',
    description: null,
    timezone: 'UTC',
    currency: 'USD',
    isPublic: false,
    joinCode: null,
    allowJoinCode: false,
    maxMembers: 10,
    tags: [],
    metadata: null,
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    membersConnection: createMockConnection([]),
    invitesConnection: createMockConnection([]),
    pantriesConnection: createMockConnection([]),
    ...overrides,
  };
}

export function createMockRecipe(overrides?: Record<string, unknown>) {
  return {
    id: nextId(),
    name: 'Test Recipe',
    description: 'A test recipe',
    ...overrides,
  };
}

export function createMockNotification(overrides?: Record<string, unknown>) {
  return {
    id: nextId(),
    type: 'GENERAL',
    category: 'SYSTEM',
    priority: 'MEDIUM',
    title: 'Test Notification',
    message: 'This is a test notification',
    payload: {},
    sentAt: new Date().toISOString(),
    readAt: null,
    isRead: false,
    ...overrides,
  };
}

export function createMockShoppingList(overrides?: Record<string, unknown>) {
  return {
    id: nextId(),
    name: 'Test Shopping List',
    isDefault: false,
    homeId: 'test-home-id',
    itemsConnection: createMockConnection([]),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
    ...overrides,
  };
}

export function createMockMealPlanDay(overrides?: Record<string, unknown>) {
  return {
    id: nextId(),
    date: new Date().toISOString().split('T')[0],
    meals: [],
    ...overrides,
  };
}

export function createMockMealPlan(overrides?: Record<string, unknown>) {
  return {
    id: nextId(),
    name: 'Test Meal Plan',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    days: [createMockMealPlanDay()],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockPantry(overrides?: Record<string, unknown>) {
  return {
    id: nextId(),
    name: 'Test Pantry',
    homeId: 'test-home-id',
    itemsConnection: createMockConnection([]),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
    ...overrides,
  };
}

export function createMockAuthResponse(overrides?: Record<string, unknown>) {
  const user = createMockUser();
  return {
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
    user,
    ...overrides,
  };
}

export function createQueryMock<TData = Record<string, unknown>>(
  document: DocumentNode,
  data: TData,
  variables?: Record<string, unknown>,
): MockedResponse<TData> {
  return {
    request: {
      query: document,
      ...(variables ? { variables } : {}),
    },
    result: { data },
  };
}

export function createMutationMock<TData = Record<string, unknown>>(
  document: DocumentNode,
  data: TData,
  variables?: Record<string, unknown>,
): MockedResponse<TData> {
  return {
    request: {
      query: document,
      ...(variables ? { variables } : {}),
    },
    result: { data },
  };
}

export function createMockHomeMembership(overrides?: Record<string, unknown>) {
  return {
    role: MembershipRole.Member,
    canAddItems: true,
    canRemoveItems: true,
    canEditPantry: true,
    ...overrides,
  };
}

export function createMockCollaborator(overrides?: Record<string, unknown>) {
  const userId = nextId();
  return {
    collaboratorId: userId,
    collaborator: { id: userId },
    status: CollaboratorStatus.Active,
    canAddItems: true,
    canRemoveItems: true,
    canEditItems: true,
    canMarkPurchased: true,
    ...overrides,
  };
}

export function createMockGraphQLError(
  message: string,
  overrides?: { code?: string; extensions?: Record<string, unknown> },
) {
  return new GraphQLError(message, {
    extensions: {
      code: overrides?.code ?? 'INTERNAL_SERVER_ERROR',
      ...overrides?.extensions,
    },
  });
}

export function createMockProfile(overrides?: Record<string, unknown>) {
  return {
    firstName: 'Test',
    lastName: 'User',
    displayName: 'testuser',
    bio: null,
    phone: null,
    website: null,
    dateOfBirth: null,
    avatar: null,
    coverImage: null,
    gender: null,
    profileVisibility: 'PUBLIC',
    ...overrides,
  };
}

export function createMockMealPlanItem(overrides?: Record<string, unknown>) {
  return {
    id: nextId(),
    recipeId: nextId(),
    recipeName: 'Test Recipe',
    servings: 2,
    mealType: 'DINNER',
    ...overrides,
  };
}

export function createMockQueuedMutation(overrides?: Record<string, unknown>) {
  return {
    id: nextId(),
    operationName: 'TestMutation',
    variables: {},
    timestamp: Date.now(),
    retryCount: 0,
    ...overrides,
  };
}
