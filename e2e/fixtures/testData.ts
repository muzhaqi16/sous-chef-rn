/**
 * Test data fixtures for E2E tests
 *
 * Provides reusable test data for consistent testing
 */

/**
 * Test user credentials
 */
export const TEST_USER = {
  email: 'test@souschef.dev',
  password: 'Test123!',
  displayName: 'Test User',
  firstName: 'Test',
  lastName: 'User',
};

/**
 * Alternative test users
 */
export const TEST_USERS = {
  user1: {
    email: 'user1@example.com',
    password: 'User1Pass!@#',
    displayName: 'User One',
  },
  user2: {
    email: 'user2@example.com',
    password: 'User2Pass!@#',
    displayName: 'User Two',
  },
};

/**
 * Sample shopping list items
 */
export const TEST_SHOPPING_ITEMS = [
  {
    name: 'Milk',
    quantity: 1,
    unit: 'gallon',
    category: 'Dairy',
  },
  {
    name: 'Bread',
    quantity: 2,
    unit: 'loaf',
    category: 'Bakery',
  },
  {
    name: 'Apples',
    quantity: 5,
    unit: 'count',
    category: 'Fruits',
  },
  {
    name: 'Chicken Breast',
    quantity: 2,
    unit: 'lb',
    category: 'Meat',
  },
  {
    name: 'Eggs',
    quantity: 12,
    unit: 'count',
    category: 'Dairy',
  },
];

/**
 * Sample pantry items
 */
export const TEST_PANTRY_ITEMS = [
  {
    name: 'Pasta',
    quantity: 3,
    unit: 'box',
    category: 'Grains',
    expirationDate: '2025-12-31',
  },
  {
    name: 'Tomato Sauce',
    quantity: 2,
    unit: 'jar',
    category: 'Canned Goods',
    expirationDate: '2025-06-30',
  },
  {
    name: 'Rice',
    quantity: 5,
    unit: 'lb',
    category: 'Grains',
    expirationDate: '2026-01-01',
  },
];

/**
 * Sample recipe search queries
 */
export const TEST_RECIPES = {
  queries: [
    'chicken pasta',
    'vegetable soup',
    'chocolate cake',
    'caesar salad',
  ],
  filters: {
    vegetarian: true,
    vegan: false,
    glutenFree: false,
    dairyFree: false,
  },
};

/**
 * Sample home/household data
 */
export const TEST_HOME = {
  name: 'Test Family Home',
  members: [
    {
      email: 'member1@example.com',
      role: 'member',
    },
    {
      email: 'member2@example.com',
      role: 'admin',
    },
  ],
};

/**
 * Test barcode data
 */
export const TEST_BARCODES = {
  milk: '012345678901',
  bread: '012345678902',
  apples: '012345678903',
};

/**
 * Common error messages
 */
export const ERROR_MESSAGES = {
  invalidCredentials: 'Invalid credentials',
  emailRequired: 'Email is required',
  passwordRequired: 'Password is required',
  networkError: 'Network error',
  itemNotFound: 'Item not found',
};

/**
 * Success messages
 */
export const SUCCESS_MESSAGES = {
  itemAdded: 'Item added successfully',
  itemDeleted: 'Item deleted',
  itemUpdated: 'Item updated',
  listCreated: 'List created',
  listShared: 'List shared',
};

/**
 * Wait timeouts (ms)
 */
export const TIMEOUTS = {
  short: 2000,
  medium: 5000,
  long: 10000,
  veryLong: 20000,
};

/**
 * Screen test IDs
 */
export const SCREENS = {
  login: 'login-screen',
  signup: 'signup-screen',
  shoppingList: 'shopping-list-screen',
  pantry: 'pantry-screen',
  recipes: 'recipes-screen',
  profile: 'profile-screen',
  settings: 'settings-screen',
  onboarding: 'onboarding-screen',
};

/**
 * Generate random test data
 */
export function generateRandomItem() {
  const categories = ['Dairy', 'Meat', 'Vegetables', 'Fruits', 'Bakery'];
  const randomId = Math.random().toString(36).substring(7);

  return {
    name: `Test Item ${randomId}`,
    quantity: Math.floor(Math.random() * 10) + 1,
    category: categories[Math.floor(Math.random() * categories.length)],
  };
}

/**
 * Generate unique email for testing
 */
export function generateTestEmail() {
  const randomId = Math.random().toString(36).substring(7);
  return `test-${randomId}@example.com`;
}

/**
 * Generate future date for expiration testing
 */
export function generateFutureDate(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().split('T')[0];
}

/**
 * Generate past date for expiration testing
 */
export function generatePastDate(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split('T')[0];
}
