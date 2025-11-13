# CI/CD Pipeline Documentation

**Last Updated:** 2025-10-29
**Status:** ✅ Active

This document describes the Continuous Integration and Continuous Deployment (CI/CD) pipeline for the Sous Chef React Native application.

---

## 📊 Overview

The CI/CD pipeline consists of 4 GitHub Actions workflows that automate testing, building, and quality assurance:

| Workflow | Trigger | Duration | Purpose |
|----------|---------|----------|---------|
| **PR Checks** | Every PR | ~15-20 min | Fast feedback: lint, typecheck, unit tests, smoke tests |
| **E2E Smoke Tests** | PR + Push | ~10-15 min | Quick E2E verification |
| **E2E Tests** | PR + Push to main/develop | ~60 min | Full E2E test suite (iOS + Android) |
| **E2E Nightly** | Daily at 2 AM UTC | ~90 min | Comprehensive nightly regression testing |

---

## 🔄 Workflows

### 1. PR Checks (`pr-checks.yml`)

**Triggers:**
- When a PR is opened
- When commits are pushed to an open PR
- When a PR is reopened

**Jobs:**
1. **TypeScript Check** - Verify no type errors
2. **Lint** - Run ESLint
3. **Unit Tests** - Run Jest unit tests with coverage
4. **E2E Smoke Tests** - Run 5 smoke tests (iOS only)
5. **Build iOS** - Verify iOS build succeeds
6. **Build Android** - Verify Android build succeeds
7. **PR Status** - Summary of all checks

**Concurrency:** Cancels previous runs when new commits are pushed

**Duration:** ~15-20 minutes

**Usage:**
```bash
# Automatically runs on PR creation/update
# No manual trigger needed
```

**Example Output:**
```
✅ All PR checks passed!
- ✅ TypeScript
- ✅ Lint
- ✅ Unit Tests
- ✅ E2E Smoke Tests
- ✅ Build iOS
- ✅ Build Android
```

---

### 2. E2E Smoke Tests (`e2e-smoke-tests.yml`)

**Triggers:**
- Pull requests to main/develop
- Pushes to main/develop

**Jobs:**
1. **Smoke Tests (iOS)** - Run 5 smoke tests on iOS simulator
2. **Smoke Tests (Android)** - Run 5 smoke tests on Android emulator

**Duration:** ~10-15 minutes

**Tests Run:**
- App launches successfully
- Shows login or home screen
- Has bottom navigation
- Can tap buttons without crashing
- Renders text elements

**Artifacts:**
- Screenshots on failure
- Detox logs on failure
- Retention: 3 days

**Usage:**
```bash
# Automatically runs on PR/push
# Or trigger manually:
gh workflow run e2e-smoke-tests.yml
```

---

### 3. E2E Tests (`e2e-tests.yml`)

**Triggers:**
- Pull requests to main/develop
- Pushes to main/develop
- Manual workflow dispatch

**Jobs:**
1. **E2E Tests (iOS)** - Run all 200+ tests on iOS
2. **E2E Tests (Android)** - Run all 200+ tests on Android
3. **E2E Summary** - Report combined results

**Duration:** ~60 minutes

**Test Suites:**
- Authentication (35 tests)
- Shopping List (40+ tests)
- Pantry (35+ tests)
- Recipes (30+ tests)
- Profile/Settings (35+ tests)
- Onboarding (30+ tests)

**Artifacts:**
- Screenshots on failure
- Detox logs (all tests)
- Test results
- Retention: 7 days

**Usage:**
```bash
# Automatically runs on PR/push to main/develop

# Or trigger manually:
gh workflow run e2e-tests.yml
```

---

### 4. E2E Nightly Tests (`e2e-nightly.yml`)

**Triggers:**
- Scheduled: Daily at 2 AM UTC
- Manual workflow dispatch

**Jobs:**
- **Full Suite (iOS)** - 6 parallel jobs (one per test suite)
- **Full Suite (Android)** - 6 parallel jobs (one per test suite)
- **Report Results** - Summary and notifications

**Duration:** ~90 minutes (parallel execution)

**Test Matrix:**
```yaml
matrix:
  suite:
    - auth
    - shoppingList
    - pantry
    - recipe
    - profile
    - onboarding
```

**Artifacts:**
- Screenshots on failure
- Videos on failure (iOS only)
- Detox logs
- Test results
- Retention: 14 days

**Usage:**
```bash
# Automatically runs nightly at 2 AM UTC

# Or trigger manually:
gh workflow run e2e-nightly.yml
```

**Benefits:**
- Catch regressions overnight
- Parallel execution for speed
- Detailed artifacts for debugging
- No impact on PR velocity

---

## 🏗️ Build Configuration

### iOS Build

**Runner:** `macos-14` (Apple Silicon)

**Environment:**
- Node.js 20
- Ruby 3.2
- CocoaPods
- Xcode (latest on runner)
- Detox with applesimutils

**Build Command:**
```bash
npm run test:e2e:build
# Runs: detox build --configuration ios.sim.debug
```

**Simulator:**
- Device: iPhone 15
- iOS: Latest available

### Android Build

**Runner:** `ubuntu-latest`

**Environment:**
- Node.js 20
- Java 17 (Temurin)
- Android SDK API 34
- Android Emulator (Pixel 7)

**Build Command:**
```bash
npm run test:e2e:build:android
# Runs: detox build --configuration android.emu.debug
```

**Emulator:**
- Device: Pixel 7
- API Level: 34
- Target: google_apis
- Architecture: x86_64

**Optimizations:**
- AVD caching for faster startup
- Snapshot creation on first run
- No window, no audio, no animations

---

## 📦 Artifacts

### Test Artifacts

**On Failure:**
- Screenshots of failures
- Detox logs
- Videos (iOS nightly only)

**Always:**
- Test results (JSON)
- Coverage reports (unit tests)

**Retention:**
- PR checks: 3 days
- E2E tests: 7 days
- Nightly tests: 14 days

### Accessing Artifacts

```bash
# Via GitHub CLI
gh run list --workflow=e2e-tests.yml
gh run view <run-id>
gh run download <run-id>

# Via GitHub UI
# Navigate to Actions → Workflow Run → Artifacts section
```

---

## 🔍 Debugging Failed Tests

### 1. Check Workflow Logs

```bash
# List recent runs
gh run list --workflow=e2e-tests.yml

# View specific run
gh run view 123456789

# Download logs
gh run view 123456789 --log
```

### 2. Download Artifacts

```bash
# Download all artifacts from a run
gh run download 123456789

# Artifacts include:
# - artifacts/ (screenshots, videos)
# - *.log (Detox logs)
# - test-results/ (JSON results)
```

### 3. Reproduce Locally

```bash
# Run the same test that failed in CI
npm run test:e2e:build
detox test e2e/tests/auth/login.e2e.ts --configuration ios.sim.debug

# With debug logging
detox test e2e/tests/auth/login.e2e.ts --configuration ios.sim.debug --loglevel trace
```

### 4. Common Issues

**Issue:** iOS simulator fails to launch
```bash
# Solution: Rebuild framework cache
npm run test:e2e:rebuild
```

**Issue:** Android emulator timeout
```yaml
# Increase timeout in workflow
timeout-minutes: 90
```

**Issue:** Tests flaky in CI but pass locally
```typescript
// Add more robust wait conditions
await waitFor(element).toBeVisible().withTimeout(10000);
```

---

## 🎯 Best Practices

### For Developers

1. **Run tests locally before pushing:**
   ```bash
   npm run typecheck
   npm run lint
   npm test
   npm run test:e2e -- e2e/tests/smoke.e2e.ts
   ```

2. **Keep PRs focused:**
   - Small, focused changes pass checks faster
   - Easier to identify test failures

3. **Fix failing tests immediately:**
   - Don't merge with failing tests
   - Investigate CI failures, don't retry blindly

4. **Use draft PRs for WIP:**
   - Workflows still run
   - Prevents accidental merges

### For Test Writers

1. **Make tests deterministic:**
   - Use proper wait conditions
   - Avoid hardcoded delays
   - Clean up test data

2. **Use descriptive test names:**
   ```typescript
   ✅ it('should show error for invalid email')
   ❌ it('test login')
   ```

3. **Follow AAA pattern:**
   ```typescript
   // Arrange
   await loginScreen.waitForScreen();

   // Act
   await loginScreen.loginWith('invalid@email.com', 'wrong');

   // Assert
   await loginScreen.expectErrorMessage();
   ```

4. **Add screenshots for failures:**
   ```typescript
   try {
     await element(by.id('button')).tap();
   } catch (error) {
     await device.takeScreenshot('failure-screenshot');
     throw error;
   }
   ```

---

## 📈 Monitoring

### GitHub Actions UI

- View workflow runs: `https://github.com/<org>/<repo>/actions`
- Filter by workflow, branch, status
- View logs, artifacts, timings

### Metrics to Track

1. **Test Pass Rate:**
   - Target: >95% on main
   - Monitor weekly trends

2. **Test Duration:**
   - PR checks: <20 minutes
   - Full E2E: <60 minutes
   - Nightly: <90 minutes

3. **Flakiness:**
   - Track tests that fail intermittently
   - Fix or skip flaky tests

4. **Coverage:**
   - Unit test coverage: >70%
   - E2E coverage: All critical paths

---

## 🔧 Maintenance

### Updating Dependencies

```bash
# Update Detox
npm install --save-dev detox@latest

# Update GitHub Actions
# Edit .github/workflows/*.yml
# Update action versions (e.g., actions/checkout@v4 → v5)
```

### Adding New Tests

1. Write test in appropriate suite
2. Run locally to verify
3. Push to PR
4. Verify CI runs successfully
5. Merge to main

### Modifying Workflows

1. Edit workflow file in `.github/workflows/`
2. Test in a PR
3. Monitor first few runs
4. Adjust timeouts/resources as needed

---

## 📚 Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Detox Documentation](https://wix.github.io/Detox/)
- [React Native CI/CD Best Practices](https://reactnative.dev/docs/testing-overview)
- [Android Emulator Runner](https://github.com/ReactiveCircus/android-emulator-runner)

---

## ✅ Workflow Status

| Workflow | Status | Last Run | Pass Rate |
|----------|--------|----------|-----------|
| PR Checks | ✅ Active | - | - |
| E2E Smoke Tests | ✅ Active | - | - |
| E2E Tests | ✅ Active | - | - |
| E2E Nightly | ✅ Active | - | - |

---

## 🆘 Support

**Issues with CI/CD?**
1. Check workflow logs
2. Download and review artifacts
3. Reproduce locally
4. Create GitHub issue with:
   - Workflow run URL
   - Error logs
   - Steps to reproduce

**Need to modify workflows?**
1. Create PR with changes
2. Test thoroughly
3. Document changes in PR description
4. Get review from team lead
