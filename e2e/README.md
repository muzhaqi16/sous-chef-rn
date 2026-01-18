# E2E Testing with Detox

This directory contains end-to-end tests for the Sous Chef React Native app using Detox.

## 📁 Directory Structure

```
e2e/
├── config/
│   └── jest.config.js          # Jest configuration for E2E tests
├── helpers/
│   ├── actions.ts              # Common action helpers (tap, swipe, type)
│   ├── assertions.ts           # Custom assertion matchers
│   ├── auth.ts                 # Authentication helpers (login, logout)
│   ├── data.ts                 # Test data management (seed, clear)
│   ├── flows.ts                # End-to-end flow helpers
│   ├── navigation.ts           # Navigation utilities
│   ├── offline.ts              # Offline testing utilities
│   ├── permissions.ts          # Permission handling helpers
│   ├── waitFor.ts              # Wait utilities
│   └── index.ts                # Centralized exports
├── screens/
│   ├── BaseScreen.ts            # Base class for all screen objects
│   ├── LoginScreen.ts           # Login screen object model
│   ├── SignUpScreen.ts          # Sign up screen object model
│   ├── ForgotPasswordScreen.ts  # Forgot password screen object model
│   ├── LandingAuthScreen.ts     # Landing auth screen object model
│   ├── ShoppingListScreen.ts    # Shopping list screen object model
│   ├── PantryScreen.ts          # Pantry screen object model
│   ├── RecipesScreen.ts         # Recipes screen object model
│   ├── RecipeDetailScreen.ts    # Recipe detail screen object model
│   ├── ProfileScreen.ts         # Profile screen object model
│   ├── SettingsScreen.ts        # Settings screen object model
│   ├── OnboardingScreen.ts      # Onboarding screen object model
│   ├── OnboardingScreens.ts     # Onboarding flow screens
│   └── index.ts                 # Centralized exports
├── fixtures/
│   └── testData.ts             # Test data and fixtures
├── tests/
│   ├── auth/                   # Authentication tests
│   │   ├── login.e2e.ts        # Login flow tests
│   │   ├── signup.e2e.ts       # Sign up tests
│   │   └── password-reset.e2e.ts # Password reset tests
│   ├── pantry/                 # Pantry tests
│   │   ├── pantry-crud.e2e.ts  # CRUD operations
│   │   └── pantry-filtering.e2e.ts # Search/filter tests
│   ├── shopping-list/          # Shopping list tests
│   │   ├── shopping-list-crud.e2e.ts    # CRUD operations
│   │   └── shopping-list-purchase.e2e.ts # Purchase flow tests
│   ├── recipe/                 # Recipe tests
│   │   ├── recipe-browse.e2e.ts    # Browse/filter tests
│   │   └── recipe-favorite.e2e.ts  # Favorite/organize tests
│   ├── profile/                # Profile tests
│   │   ├── profile-settings.e2e.ts # Settings tests
│   │   └── profile-account.e2e.ts  # Account management tests
│   ├── cross-feature/          # Cross-feature tests
│   ├── smoke.e2e.ts            # Smoke tests
│   └── core-flows.e2e.ts       # Core user journeys
├── init.ts                     # Detox initialization
└── README.md                   # This file
```

## 🚀 Getting Started

### Prerequisites

1. **Install Detox CLI globally:**
   ```bash
   npm install -g detox-cli
   ```

2. **For iOS (macOS only):**
   ```bash
   brew tap wix/brew
   brew install applesimutils
   ```

3. **For Android:**
   - Android Studio installed
   - Android SDK configured
   - Emulator running or device connected

### Running Tests

**iOS:**
```bash
# Build the app for testing
npm run test:e2e:build

# Run tests
npm run test:e2e
```

**Android:**
```bash
# Build the app for testing
npm run test:e2e:build:android

# Run tests
npm run test:e2e:android
```

**Run specific test file:**
```bash
detox test e2e/tests/smoke.e2e.ts --configuration ios.sim.debug
```

**Run with different configuration:**
```bash
# iOS Release
detox test --configuration ios.sim.release

# Android Debug on Emulator
detox test --configuration android.emu.debug

# Android Debug on attached device
detox test --configuration android.att.debug
```

## 📝 Writing Tests

### Test strategy

- Keep the suite lean. Focus on the high-traffic, happy-path flows (login, pantry, shopping list, recipes) and avoid duplicating coverage across multiple files.
- Prefer a single core flow file (`e2e/tests/core-flows.e2e.ts`) instead of many narrowly scoped suites. This keeps runtime low and makes failures easier to diagnose.
- Reuse helpers from `e2e/helpers/flows.ts` to log in and bypass onboarding so each spec starts from a consistent state.
- Add new tests only when they validate a distinct user journey or guard against a regression we have seen in production.

### Basic Test Structure

```typescript
describe('Feature Name', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('should do something', async () => {
    // Arrange
    await loginAsTestUser();

    // Act
    await tapByID('some-button');

    // Assert
    await expect(element(by.id('result'))).toBeVisible();
  });
});
```

### Using Helpers

```typescript
import {
  loginAsTestUser,
  navigateToShoppingList,
  tapByID,
  expectScreenLoaded,
} from '../helpers';

it('should navigate to shopping list', async () => {
  await loginAsTestUser();
  await navigateToShoppingList();
  await expectScreenLoaded('shopping-list-screen');
});
```

### Using Test Data

```typescript
import { TEST_USER, TEST_SHOPPING_ITEMS } from '../fixtures/testData';

it('should login with test user', async () => {
  await loginWithCredentials(TEST_USER.email, TEST_USER.password);
});
```

### Using Screen Object Models

Screen object models provide a structured, reusable way to interact with screens in your tests. Each screen has methods that encapsulate common actions and assertions.

**Example: Using LoginScreen**
```typescript
import { LoginScreen, ShoppingListScreen } from '../screens';

describe('Login Flow', () => {
  const loginScreen = new LoginScreen();
  const shoppingListScreen = new ShoppingListScreen();

  it('should login successfully', async () => {
    await loginScreen.waitForScreen();
    await loginScreen.loginAsTestUser();
    await shoppingListScreen.waitForScreen();
  });

  it('should show error for invalid credentials', async () => {
    await loginScreen.waitForScreen();
    await loginScreen.loginWith('invalid@email.com', 'wrongpassword');
    await loginScreen.expectErrorMessage('Invalid credentials');
  });
});
```

**Example: Using ShoppingListScreen**
```typescript
import { ShoppingListScreen } from '../screens';

describe('Shopping List', () => {
  const shoppingListScreen = new ShoppingListScreen();

  beforeEach(async () => {
    await shoppingListScreen.navigateToTab();
  });

  it('should add item to shopping list', async () => {
    await shoppingListScreen.addItem('Milk', 1, 'gallon');
    await shoppingListScreen.expectItemExists(0);
    await shoppingListScreen.expectItemText(0, 'Milk');
  });

  it('should toggle item completion', async () => {
    await shoppingListScreen.toggleItemByIndex(0);
    await shoppingListScreen.expectItemChecked(0);
  });
});
```

**Example: Using PantryScreen**
```typescript
import { PantryScreen } from '../screens';

describe('Pantry Management', () => {
  const pantryScreen = new PantryScreen();

  it('should add item with expiration date', async () => {
    await pantryScreen.navigateToTab();
    await pantryScreen.addItem('Milk', 2, 'cartons', '2025-12-31');
    await pantryScreen.expectItemExists(0);
  });

  it('should navigate to expiring items', async () => {
    await pantryScreen.navigateToTab();
    await pantryScreen.navigateToExpiringItems();
    // Verify expiring items screen is shown
  });
});
```

**Available Screen Objects:**
- `LandingAuthScreen` - Landing page with login/signup options
- `LoginScreen` - Login form interactions
- `SignUpScreen` - Sign up form with validation
- `ForgotPasswordScreen` - Password reset flow
- `ShoppingListScreen` - Add, edit, delete, check items
- `PantryScreen` - Manage pantry inventory, expiration dates
- `RecipesScreen` - Search, filter, browse recipes
- `RecipeDetailScreen` - Recipe details, favoriting, add to list
- `ProfileScreen` - User profile, navigate to settings
- `SettingsScreen` - App settings, theme, notifications
- `OnboardingScreen` - Onboarding flow navigation

**Benefits of Screen Objects:**
- **Maintainability:** Changes to UI only require updates in one place
- **Reusability:** Common actions can be reused across tests
- **Readability:** Tests read like high-level user interactions
- **Type Safety:** TypeScript provides autocomplete and type checking

## 🛠 Helper Functions

### Actions (`helpers/actions.ts`)
- `tapByID(testID)` - Tap element by test ID
- `typeIntoField(testID, text)` - Type text into input
- `swipeLeft(testID)` - Swipe element left
- `scrollToBottom(scrollViewID)` - Scroll to bottom

### Assertions (`helpers/assertions.ts`)
- `expectVisibleAndEnabled(testID)` - Assert element is visible and enabled
- `expectToastVisible(message)` - Assert toast message appears
- `expectScreenLoaded(screenTestID)` - Assert screen is loaded

### Authentication (`helpers/auth.ts`)
- `loginAsTestUser()` - Login with test credentials
- `logout()` - Logout from app
- `ensureLoggedIn()` - Ensure user is logged in
- `bootstrapAuthenticatedSession()` - Setup authenticated test session
- `signUpWithCredentials(email, password, name)` - Create new account

### Navigation (`helpers/navigation.ts`)
- `navigateToTab(tabName)` - Navigate to bottom tab
- `navigateToShoppingList()` - Go to shopping list
- `navigateToPantry()` - Go to pantry
- `goBack()` - Navigate back

### Wait Utilities (`helpers/waitFor.ts`)
- `waitForElementToBeVisible(element, timeout)` - Wait for element
- `waitForScreen(screenTestID, timeout)` - Wait for screen to load
- `waitAndTap(element, timeout)` - Wait then tap
- `retry(action, maxAttempts)` - Retry action if it fails

### Offline Testing (`helpers/offline.ts`)
- `simulateOffline()` - Simulate network disconnection
- `simulateOnline()` - Restore network connection
- `waitForSync()` - Wait for data sync to complete
- `testOfflineSync(mutation, verification)` - Test offline sync workflow

### Permissions (`helpers/permissions.ts`)
- `grantCameraPermission()` - Grant camera access
- `denyCameraPermission()` - Deny camera access
- `grantNotificationPermission()` - Grant notification permission
- `setPermissions(permissions)` - Set multiple permissions
- `launchWithTestPermissions()` - Launch app with common test permissions

### Test Data (`helpers/data.ts`)
- `clearPantryItems()` - Clear all pantry items
- `clearShoppingListItems()` - Clear all shopping list items
- `seedPantryItems(items)` - Add test items to pantry
- `seedShoppingListItems(items)` - Add test items to shopping list
- `generateItemName(prefix)` - Generate unique item name
- `generateTestEmail()` - Generate unique test email
- `resetAppData()` - Reset app to initial state

## 🎯 Test IDs

All interactive elements should have `testID` props for E2E testing:

```tsx
<Button testID="login-button" onPress={handleLogin}>
  Login
</Button>

<TextInput testID="email-input" />

<View testID="shopping-list-screen">
  {/* Screen content */}
</View>
```

### Test ID Naming Convention:
- **Screens:** `{screen-name}-screen` (e.g., `login-screen`)
- **Buttons:** `{action}-button` (e.g., `login-button`, `add-item-button`)
- **Inputs:** `{field-name}-input` (e.g., `email-input`, `password-input`)
- **Lists:** `{list-name}-list` (e.g., `shopping-list`)
- **List Items:** `{list-name}-item-{index}` (e.g., `shopping-list-item-0`)
- **Tabs:** `tab-{tab-name}` (e.g., `tab-shopping-list`)

## 📊 Test Categories

### Smoke Tests (`tests/smoke.e2e.ts`)
**Run time:** ~1-2 minutes
**Purpose:** Quick verification that app works
**Run:** On every commit

```bash
npm run test:e2e -- e2e/tests/smoke.e2e.ts
```

### Functional Tests
**Run time:** ~15-20 minutes
**Purpose:** Verify features work correctly
**Run:** On every PR

### Regression Tests
**Run time:** ~30+ minutes
**Purpose:** Comprehensive coverage
**Run:** Before release

## 🧪 Test Suites

### Authentication Tests (`tests/auth/`)

**Files:**
- `login.e2e.ts` - Login flow tests (20 tests)
- `logout.e2e.ts` - Logout flow tests (15 tests)

**Coverage:**
- ✅ Successful login with valid credentials
- ✅ Invalid credentials error handling
- ✅ Field validation (email format, required fields)
- ✅ Error messages and recovery
- ✅ Loading states and UI feedback
- ✅ Navigation to signup/forgot password
- ✅ Logout confirmation and session cleanup
- ✅ Multiple login/logout cycles

**Run:**
```bash
detox test e2e/tests/auth --configuration ios.sim.debug
```

### Shopping List Tests (`tests/shoppingList/`)

**Files:**
- `shoppingList.e2e.ts` - Shopping list functionality (40+ tests)

**Coverage:**
- ✅ Adding single and multiple items
- ✅ Editing item details
- ✅ Deleting items (swipe to delete)
- ✅ Toggling purchase status (checkboxes)
- ✅ Search and filtering
- ✅ Sorting options
- ✅ Pull to refresh
- ✅ Empty state handling
- ✅ Long press actions
- ✅ Performance with many items

**Run:**
```bash
detox test e2e/tests/shoppingList --configuration ios.sim.debug
```

### Pantry Tests (`tests/pantry/`)

**Files:**
- `pantry.e2e.ts` - Pantry inventory management (35+ tests)

**Coverage:**
- ✅ Adding items with expiration dates
- ✅ Editing items (name, quantity, expiration)
- ✅ Deleting items
- ✅ Quantity increment/decrement
- ✅ Expiring items view
- ✅ Low stock items view
- ✅ Barcode scanner integration
- ✅ Search and filtering
- ✅ Expired item handling
- ✅ Performance testing

**Run:**
```bash
detox test e2e/tests/pantry --configuration ios.sim.debug
```

### Recipe Tests (`tests/recipe/`)

**Files:**
- `recipes.e2e.ts` - Recipe search and browsing (30+ tests)

**Coverage:**
- ✅ Recipe search by keyword
- ✅ Filter by cuisine (Italian, Mexican, etc.)
- ✅ Filter by dietary restrictions (vegetarian, vegan, etc.)
- ✅ Sort by relevance, rating, time, popularity
- ✅ Favorite/unfavorite recipes
- ✅ Navigate to favorites view
- ✅ View recipe details
- ✅ Add recipe ingredients to shopping list
- ✅ No results handling
- ✅ Performance and rapid searches

**Run:**
```bash
detox test e2e/tests/recipe --configuration ios.sim.debug
```

### Profile & Settings Tests (`tests/profile/`)

**Files:**
- `settings.e2e.ts` - Profile and settings (35+ tests)

**Coverage:**
- ✅ Display user information (name, email)
- ✅ Navigate to various settings screens
- ✅ Dark mode toggle and persistence
- ✅ Notification settings (enable/disable, alerts)
- ✅ Data management (clear cache, export data)
- ✅ Account management (change password/email, delete account)
- ✅ App information (version, terms, privacy)
- ✅ Settings persistence across sessions
- ✅ UI responsiveness

**Run:**
```bash
detox test e2e/tests/profile --configuration ios.sim.debug
```

### Onboarding Tests (`tests/onboarding/`)

**Files:**
- `onboarding.e2e.ts` - First-time user experience (30+ tests)

**Coverage:**
- ✅ Initial onboarding display
- ✅ Page navigation with Next button
- ✅ Page navigation with swipe gestures
- ✅ Back navigation between pages
- ✅ Skip onboarding flow
- ✅ Complete onboarding (Get Started)
- ✅ Page content verification
- ✅ Page indicators
- ✅ Gesture handling (fast/slow swipes)
- ✅ Edge cases (rapid tapping, back/forth navigation)
- ✅ Onboarding not shown after completion

**Run:**
```bash
detox test e2e/tests/onboarding --configuration ios.sim.debug
```

### Test Coverage Summary

| Test Suite | Tests | Coverage Areas |
|------------|-------|----------------|
| **Authentication** | 35 | Login, logout, validation, session |
| **Shopping List** | 40+ | CRUD operations, search, filters |
| **Pantry** | 35+ | Inventory, expiration, barcode |
| **Recipes** | 30+ | Search, filters, favorites, details |
| **Profile/Settings** | 35+ | Theme, notifications, account |
| **Onboarding** | 30+ | First-time UX, navigation, gestures |
| **TOTAL** | **200+** | Comprehensive E2E coverage |

### Running All Test Suites

**Run all tests:**
```bash
npm run test:e2e
```

**Run specific category:**
```bash
# Authentication tests only
detox test e2e/tests/auth --configuration ios.sim.debug

# Shopping list tests only
detox test e2e/tests/shoppingList --configuration ios.sim.debug
```

**Run with different configuration:**
```bash
# Android
detox test e2e/tests/auth --configuration android.emu.debug

# iOS Release
detox test e2e/tests/auth --configuration ios.sim.release
```

## 🐛 Debugging

### View Detox Logs
```bash
detox test --loglevel trace
```

### Take Screenshots
```typescript
await device.takeScreenshot('test-screenshot');
```

### Record Video (iOS)
```bash
detox test --record-videos all
```

### Inspect Element Hierarchy
```bash
detox test --debug-synchronization
```

### Common Issues

**1. App doesn't launch:**
- Rebuild the app: `npm run test:e2e:build`
- Clean and rebuild: `npm run test:e2e:rebuild`

**2. Element not found:**
- Check if testID is correctly set
- Use `await waitFor(element).toBeVisible()`
- Check element hierarchy with debug logs

**3. Tests are flaky:**
- Add proper wait conditions
- Use `waitFor` instead of delays
- Check for race conditions

**4. Simulator/Emulator issues:**
- Restart simulator/emulator
- Check iOS/Android version compatibility

## 📚 Resources

- [Detox Documentation](https://wix.github.io/Detox/)
- [Detox API Reference](https://wix.github.io/Detox/docs/api/actions)
- [Jest Matchers](https://wix.github.io/Detox/docs/api/expect)
- [Troubleshooting Guide](https://wix.github.io/Detox/docs/troubleshooting/building-the-app)

## 🚀 CI/CD Integration

E2E tests are automatically run in GitHub Actions on every PR and push.

### Workflows

**1. PR Checks** (runs on every PR)
- TypeScript check
- Linting
- Unit tests
- **E2E smoke tests** (iOS)
- Build verification (iOS + Android)
- Duration: ~15-20 minutes

**2. E2E Tests** (runs on PR/push to main/develop)
- Full test suite on iOS
- Full test suite on Android
- 200+ tests
- Duration: ~60 minutes

**3. E2E Nightly** (runs daily at 2 AM UTC)
- All test suites in parallel
- Both iOS and Android
- Video recording on failures (iOS)
- Duration: ~90 minutes

### Running Tests in CI

Tests automatically run on:
- ✅ Pull request creation
- ✅ New commits to PR
- ✅ Push to main/develop
- ✅ Nightly at 2 AM UTC
- ✅ Manual workflow trigger

### Viewing Results

```bash
# Via GitHub CLI
gh run list --workflow=e2e-tests.yml
gh run view <run-id>
gh run download <run-id>  # Download artifacts

# Via GitHub UI
# Navigate to: Actions → E2E Tests → Select run
```

### Artifacts

When tests fail, artifacts are uploaded:
- 📸 Screenshots of failures
- 📹 Videos (iOS nightly only)
- 📋 Detox logs
- 📊 Test results (JSON)

**Retention:**
- PR checks: 3 days
- E2E tests: 7 days
- Nightly: 14 days

### Manual Triggers

```bash
# Trigger E2E tests manually
gh workflow run e2e-tests.yml

# Trigger nightly tests manually
gh workflow run e2e-nightly.yml

# Trigger smoke tests manually
gh workflow run e2e-smoke-tests.yml
```

### Test Matrix

Nightly tests run in parallel across suites:
- Authentication tests
- Shopping list tests
- Pantry tests
- Recipe tests
- Profile/settings tests
- Onboarding tests

Each suite runs on both iOS and Android simultaneously for faster feedback.

### Debugging CI Failures

1. **Check workflow logs:**
   ```bash
   gh run view <run-id> --log
   ```

2. **Download artifacts:**
   ```bash
   gh run download <run-id>
   ```

3. **Reproduce locally:**
   ```bash
   npm run test:e2e:build
   detox test <failing-test> --configuration ios.sim.debug --loglevel trace
   ```

For more details, see [CI/CD Documentation](../docs/CI_CD.md).

---

## ✅ Phase 5 Status

- [x] Phase 5.1: Setup & Configuration (COMPLETE)
- [x] Phase 5.2: Test Infrastructure (COMPLETE)
- [x] Phase 5.3: Core Test Suites (COMPLETE)
- [x] Phase 5.4: CI/CD Integration (COMPLETE)

**Completed:**
- 200+ comprehensive E2E tests across 6 test suites
- Full coverage of authentication, shopping list, pantry, recipes, profile/settings, and onboarding
- Screen object models for all major screens
- Helper utilities and test fixtures
- **GitHub Actions workflows for automated testing**
- **PR checks with smoke tests**
- **Nightly regression testing**
- **Comprehensive CI/CD documentation**

**Phase 5 is now COMPLETE!** 🎉
