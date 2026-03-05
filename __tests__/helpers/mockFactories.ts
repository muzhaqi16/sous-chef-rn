import { DocumentNode, GraphQLError } from 'graphql';
import { MockedResponse } from '@apollo/client/testing/react';
import { MembershipRole, StorageState, StorageType, CollaboratorStatus } from '#generated';

let idCounter = 0;
const nextId = () => `test-id-${++idCounter}`;

export function resetIdCounter() {
  idCounter = 0;
}

// ---------------------------------------------------------------------------
// Mock types — lightweight interfaces matching the shape returned by each
// factory. Using dedicated types (rather than the full GraphQL generated ones)
// keeps the factories usable without dragging in deep nested `Maybe<>` generics
// while still catching typos via `Partial<T>`.
// ---------------------------------------------------------------------------

interface MockUser {
  id: string;
  email: string;
  emailVerified: boolean;
  onBoarded: boolean;
  firstName: string;
  lastName: string;
}

interface MockMember {
  id: string;
  role: MembershipRole;
  status: string;
  userId: string;
  displayName: string | null;
  user: { id: string; email: string; profile: { firstName: string; lastName: string; displayName: string | null } };
}

interface MockPantryItem {
  id: string;
  itemName: string;
  quantity: number;
  storageState: StorageState;
  storageLocation: string | null;
  category: string;
  expirationDate: string | null;
  version: number;
  updatedAt: string;
}

interface MockShoppingListItem {
  id: string;
  itemName: string;
  quantity: number;
  category: string;
  purchased: boolean;
}

interface MockHome {
  id: string;
  name: string;
  type: string;
  description: string | null;
  timezone: string;
  currency: string;
  isPublic: boolean;
  joinCode: string | null;
  allowJoinCode: boolean;
  maxMembers: number;
  tags: string[];
  metadata: unknown;
  version: number;
  createdAt: string;
  updatedAt: string;
  membersConnection: ReturnType<typeof createMockConnection>;
  invitesConnection: ReturnType<typeof createMockConnection>;
  pantriesConnection: ReturnType<typeof createMockConnection>;
}

interface MockRecipe {
  id: string;
  name: string;
  description: string;
}

interface MockNotification {
  id: string;
  type: string;
  category: string;
  priority: string;
  title: string;
  message: string;
  payload: Record<string, unknown>;
  sentAt: string;
  readAt: string | null;
  isRead: boolean;
}

interface MockShoppingList {
  id: string;
  name: string;
  isDefault: boolean;
  homeId: string;
  itemsConnection: ReturnType<typeof createMockConnection>;
  createdAt: string;
  updatedAt: string;
  version: number;
}

interface MockMealPlanDay {
  id: string;
  date: string;
  meals: unknown[];
}

interface MockMealPlan {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  days: MockMealPlanDay[];
  createdAt: string;
  updatedAt: string;
}

interface MockPantry {
  id: string;
  name: string;
  homeId: string;
  itemsConnection: ReturnType<typeof createMockConnection>;
  createdAt: string;
  updatedAt: string;
  version: number;
}

interface MockAuthResponse {
  accessToken: string;
  refreshToken: string;
  user: MockUser;
}

interface MockHomeMembership {
  role: MembershipRole;
  canAddItems: boolean;
  canRemoveItems: boolean;
  canEditPantry: boolean;
}

interface MockCollaborator {
  collaboratorId: string;
  collaborator: { id: string };
  status: CollaboratorStatus;
  canAddItems: boolean;
  canRemoveItems: boolean;
  canEditItems: boolean;
  canMarkPurchased: boolean;
}

interface MockProfile {
  firstName: string;
  lastName: string;
  displayName: string;
  bio: string | null;
  phone: string | null;
  website: string | null;
  dateOfBirth: string | null;
  avatar: string | null;
  coverImage: string | null;
  gender: string | null;
  profileVisibility: string;
}

interface MockMealPlanItem {
  id: string;
  recipeId: string;
  recipeName: string;
  servings: number;
  mealType: string;
}

interface MockQueuedMutation {
  id: string;
  operationName: string;
  variables: Record<string, unknown>;
  timestamp: number;
  retryCount: number;
}

interface MockStorageLocation {
  id: string;
  name: string;
  type: StorageType;
  homeId: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  temperature: StorageState | null;
  isDefault: boolean;
  isActive: boolean;
  isClimateControlled: boolean;
  sortOrder: number;
  currentItemCount: number;
  parentLocationId: string | null;
  capacity: number | null;
  capacityUnit: string | null;
  createdAt: string;
  updatedAt: string;
}

interface MockIngredient {
  id: string;
  name: string;
  quantity: number;
  unit: string | null;
  isOptional: boolean;
  notes: string | null;
  preparation: string | null;
  section: string | null;
  sortOrder: number;
}

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

export function createMockUser(overrides?: Partial<MockUser>): MockUser {
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

export function createMockMember(overrides?: Partial<MockMember>): MockMember {
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

export function createMockPantryItem(overrides?: Partial<MockPantryItem>): MockPantryItem {
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

export function createMockShoppingListItem(overrides?: Partial<MockShoppingListItem>): MockShoppingListItem {
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
  overrides?: { hasNextPage?: boolean; endCursor?: string | null; totalCount?: number },
) {
  return {
    edges: nodes.map((node) => ({ node })),
    totalCount: overrides?.totalCount ?? nodes.length,
    pageInfo: {
      hasNextPage: overrides?.hasNextPage ?? false,
      hasPreviousPage: false,
      startCursor: nodes.length > 0 ? 'start-cursor' : null,
      endCursor: overrides?.endCursor ?? (nodes.length > 0 ? 'end-cursor' : null),
    },
  };
}

export function createMockHome(overrides?: Partial<MockHome>): MockHome {
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

export function createMockRecipe(overrides?: Partial<MockRecipe>): MockRecipe {
  return {
    id: nextId(),
    name: 'Test Recipe',
    description: 'A test recipe',
    ...overrides,
  };
}

export function createMockNotification(overrides?: Partial<MockNotification>): MockNotification {
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

export function createMockShoppingList(overrides?: Partial<MockShoppingList>): MockShoppingList {
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

export function createMockMealPlanDay(overrides?: Partial<MockMealPlanDay>): MockMealPlanDay {
  return {
    id: nextId(),
    date: new Date().toISOString().split('T')[0],
    meals: [],
    ...overrides,
  };
}

export function createMockMealPlan(overrides?: Partial<MockMealPlan>): MockMealPlan {
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

export function createMockPantry(overrides?: Partial<MockPantry>): MockPantry {
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

export function createMockAuthResponse(overrides?: Partial<MockAuthResponse>): MockAuthResponse {
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

export function createMockHomeMembership(overrides?: Partial<MockHomeMembership>): MockHomeMembership {
  return {
    role: MembershipRole.Member,
    canAddItems: true,
    canRemoveItems: true,
    canEditPantry: true,
    ...overrides,
  };
}

export function createMockCollaborator(overrides?: Partial<MockCollaborator>): MockCollaborator {
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

export function createMockProfile(overrides?: Partial<MockProfile>): MockProfile {
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

export function createMockMealPlanItem(overrides?: Partial<MockMealPlanItem>): MockMealPlanItem {
  return {
    id: nextId(),
    recipeId: nextId(),
    recipeName: 'Test Recipe',
    servings: 2,
    mealType: 'DINNER',
    ...overrides,
  };
}

export function createMockQueuedMutation(overrides?: Partial<MockQueuedMutation>): MockQueuedMutation {
  return {
    id: nextId(),
    operationName: 'TestMutation',
    variables: {},
    timestamp: Date.now(),
    retryCount: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// New factories
// ---------------------------------------------------------------------------

export function createMockStorageLocation(overrides?: Partial<MockStorageLocation>): MockStorageLocation {
  return {
    id: nextId(),
    name: 'Test Location',
    type: StorageType.Cabinet,
    homeId: 'test-home-id',
    description: null,
    icon: null,
    color: null,
    temperature: null,
    isDefault: false,
    isActive: true,
    isClimateControlled: false,
    sortOrder: 0,
    currentItemCount: 0,
    parentLocationId: null,
    capacity: null,
    capacityUnit: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockIngredient(overrides?: Partial<MockIngredient>): MockIngredient {
  return {
    id: nextId(),
    name: 'Test Ingredient',
    quantity: 1,
    unit: null,
    isOptional: false,
    notes: null,
    preparation: null,
    section: null,
    sortOrder: 0,
    ...overrides,
  };
}
