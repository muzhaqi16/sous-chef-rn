import { MembershipRole, StorageState } from '#generated';

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
