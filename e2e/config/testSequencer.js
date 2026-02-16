/**
 * Custom Jest test sequencer for Detox E2E tests
 *
 * Controls test execution order:
 * 1. Smoke tests first (fast fail if app is broken)
 * 2. Auth tests (login → signup → password-reset)
 * 3. Core flows
 * 4. Feature tests (pantry → shopping-list → recipe → profile)
 *
 * Unknown test files run last (priority 99).
 */
const Sequencer = require('@jest/test-sequencer').default;

const PRIORITY_MAP = {
  'smoke.e2e': 0,
  'auth/login.e2e': 1,
  'auth/signup.e2e': 2,
  'auth/password-reset.e2e': 3,
  'core-flows.e2e': 4,
  'pantry/pantry-crud.e2e': 10,
  'pantry/pantry-filtering.e2e': 11,
  'shopping-list/shopping-list-crud.e2e': 12,
  'shopping-list/shopping-list-purchase.e2e': 13,
  'recipe/recipe-browse.e2e': 14,
  'recipe/recipe-favorite.e2e': 15,
  'profile/profile-settings.e2e': 20,
  'profile/profile-account.e2e': 21,
};

class DetoxTestSequencer extends Sequencer {
  sort(tests) {
    return [...tests].sort((a, b) => {
      const aPriority = this.getPriority(a.path);
      const bPriority = this.getPriority(b.path);
      return aPriority - bPriority;
    });
  }

  getPriority(testPath) {
    for (const [pattern, priority] of Object.entries(PRIORITY_MAP)) {
      if (testPath.includes(pattern)) {
        return priority;
      }
    }
    return 99;
  }
}

module.exports = DetoxTestSequencer;
