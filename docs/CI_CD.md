# CI/CD Pipeline Documentation

**Last Updated:** 2026-02-11
**Status:** ✅ Active

This document describes the Continuous Integration and Continuous Deployment (CI/CD) pipeline for the Sous Chef React Native application.

---

## 📊 Overview

The CI/CD pipeline consists of 7 GitHub Actions workflows that automate testing, building, and deployment:

| Workflow            | Trigger                                   | Duration   | Purpose                                                   |
| ------------------- | ----------------------------------------- | ---------- | --------------------------------------------------------- |
| **PR Checks**       | Every PR                                  | ~15-20 min | Fast feedback: lint, typecheck, unit tests, smoke tests   |
| **E2E Smoke Tests** | PR + Push                                 | ~10-15 min | Quick E2E verification                                    |
| **E2E Tests**       | PR + Push to main/dev                     | ~60 min    | Full E2E test suite (iOS + Android)                       |
| **E2E Nightly**     | Daily at 2 AM UTC                         | ~90 min    | Comprehensive nightly regression testing                  |
| **Build Android**   | Push to main, git tags or manual dispatch | ~30 min    | Build Android APK/AAB; main goes to Play's internal track |
| **Promote Android** | Manual dispatch on main                   | ~5 min     | Send one internal build to production (approval needed)   |
| **Build iOS**       | Git tags (`v*`, `ios-v*`)                 | ~30 min    | Build, sign & upload to App Store Connect                 |

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

## 📱 Build & Deployment Workflows

### 5. Build Android (`build-android.yml`)

**Triggers:**

- Push to `main`: a Play bundle for the internal track (see **Play distribution** below)
- Push tags: `dev-v*`, `stg-v*`, `prod-v*`. A `playstore-v*` tag starts no build: only a promotion writes it.
- Manual workflow dispatch (choose environment + build type)

**Runner:** Self-hosted Linux (ubuntu)

**Environment:** Resolved from tag prefix or manual input

| Ref       | Environment | Build output                           |
| --------- | ----------- | -------------------------------------- |
| `main`    | prod        | AAB, uploaded to Play's internal track |
| `dev-v*`  | dev         | APK                                    |
| `stg-v*`  | stg         | APK (staging variant)                  |
| `prod-v*` | prod        | APK                                    |

**Pipeline steps:**

1. Checkout repository
2. Setup Android SDK, `local.properties`
3. Validate Gradle wrapper
4. Install npm dependencies (`npm ci`)
5. Setup keystore — Play Store upload key or regular release key (from environment secrets)
6. Clean Gradle build
7. Generate `.env` file — Writes environment-specific config from GitHub environment secrets/variables for `react-native-config`
8. Build — `assembleRelease`, `assembleStaging`, or `bundleRelease` (Play Store)
9. Verify 16KB page alignment (APK builds only)
10. Rename APK files with tag name and architecture
11. Create GitHub Release with build artifacts
12. Cleanup sensitive files and Gradle caches

**Usage:**

```bash
# Using npm tag scripts (recommended)
npm run tag:dev                # Dev APK
npm run tag:stg                # Staging APK
npm run tag:android:prod       # Production APK (Android only, skips the iOS tag)

# Or using git tags manually
git tag dev-v1.2.0 && git push origin dev-v1.2.0
git tag stg-v1.2.0 && git push origin stg-v1.2.0
git tag prod-v1.2.0 && git push origin prod-v1.2.0

# Or trigger manually via Actions tab:
# Actions → Build Android → Run workflow → Choose environment + build type
# A prod playstore build dispatched on main goes to the internal track, as a
# merge does; from another branch it only builds. A non-store tag is refused.
```

**A release is held to production.** A job before the build, `.github/actions/release-check`, runs on every push to `main`, on `prod-v*` tags and on a hand-dispatched prod or playstore build, and on every iOS build; `dev-v*` and `stg-v*` skip it and still build. `api-schema-check` reads `/health` ten times, fetches the schema published for each hash, and validates `persisted-query-manifest.json` against each. The job then compiles the app against each, since the check can't see variables. Anything it can't establish fails it, and a failure stops the build. It needs this repo's Actions read access on the `api-schema` package. Up to half the `/health` reads may fail, as a draining replica answers 503. `tsc` narrows a client ahead of production and doesn't close it: it flags an unknown input field only in a fresh object literal.

**Store tags are read by the API.** On every push, the API's CI validates `persisted-query-manifest.json` and checks each variable's input types against `src/graphql/generated/schema.graphql` at every `playstore-vX.Y.Z`, `ios-vX.Y.Z`, `prod-vX.Y.Z` and bare `vX.Y.Z` tag at or above the client floor. So a store tag keeps that exact name, both files stay committed at those paths, and a tag missing either fails the API's CI. Both build workflows refuse anything else: a bundle from a branch is invisible to that check, and a suffixed tag such as `playstore-v1.2.0-rc1` is no store version. `check:manifest`, held by `persistedManifestIsCurrent.test.ts`, keeps the manifest matching the `.graphql` sources. A build from `main` gets its store tag only when it is promoted to production, so the tag always names the commit production runs.

#### Play distribution

Every merge to `main`, and a dispatch on `main` with `build_type: playstore` and `environment: prod`, ends on Play's internal testing track. Internal testers get it as an ordinary Play update. Runs from `main` go one at a time; of several waiting, only the newest runs.

1. `release-check` holds the build to production, as for any store build.
2. `version-code` asks Play for one past the highest version code it has ever accepted: every bundle, every APK and every track, including discarded drafts. The build passes it as `-PversionCode`. `versionName` stays in `android/app/build.gradle`, and a version bump no longer touches `versionCode`; a local build keeps the value written there.
3. The build job builds and checks the bundle as before, archives it in MinIO under `android/main/<code>/`, and hands the bundle and `mapping.txt` to the next job as an artifact. The self-hosted runner never holds Play access.
4. `upload-internal` uploads them with fastlane (`fastlane/Fastfile`, lane `upload_internal`) and tags the commit `play-build/<code>`, which promotion reads. No trigger matches that tag, and the API ignores it.

The fastlane jobs run on ubuntu-latest through `.github/actions/setup-fastlane`: keyless Google sign-in, then fastlane from `fastlane/Gemfile` (its own lockfile, Ruby 4.0, frozen install). No Play key is stored anywhere: the Workload Identity provider issues a short-lived token only to this repository's `main`, and only to `build-android.yml` and `promote-android.yml`. Run lanes locally with `BUNDLE_GEMFILE=fastlane/Gemfile bundle exec fastlane android <lane>`; Play calls need `gcloud auth application-default login --scopes=openid,email,https://www.googleapis.com/auth/androidpublisher` first.

**One-time setup.** In Google Cloud (any project you own; `<owner>` is this repository's owner):

```bash
PROJECT=<gcp-project-id>
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT" --format 'value(projectNumber)')
REPO_ID=$(gh api repos/<owner>/sous-chef-rn --jq .id)

gcloud services enable androidpublisher.googleapis.com iamcredentials.googleapis.com sts.googleapis.com --project "$PROJECT"
gcloud iam service-accounts create play-publisher --project "$PROJECT" --display-name "Play publisher (GitHub Actions)"
gcloud iam workload-identity-pools create github --project "$PROJECT" --location global --display-name "GitHub Actions"
gcloud iam workload-identity-pools providers create-oidc sous-chef-rn \
  --project "$PROJECT" --location global --workload-identity-pool github \
  --issuer-uri https://token.actions.githubusercontent.com \
  --attribute-mapping 'google.subject=assertion.sub,attribute.repository_id=assertion.repository_id,attribute.ref=assertion.ref,attribute.workflow_ref=assertion.workflow_ref' \
  --attribute-condition "assertion.repository_id == '$REPO_ID' && assertion.ref == 'refs/heads/main' && (assertion.workflow_ref.startsWith('<owner>/sous-chef-rn/.github/workflows/build-android.yml@') || assertion.workflow_ref.startsWith('<owner>/sous-chef-rn/.github/workflows/promote-android.yml@'))"
gcloud iam service-accounts add-iam-policy-binding "play-publisher@$PROJECT.iam.gserviceaccount.com" \
  --project "$PROJECT" --role roles/iam.workloadIdentityUser \
  --member "principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/attribute.repository_id/$REPO_ID"

gh variable set GCP_WORKLOAD_IDENTITY_PROVIDER --body "projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/providers/sous-chef-rn"
gh variable set GCP_PLAY_SERVICE_ACCOUNT --body "play-publisher@$PROJECT.iam.gserviceaccount.com"
```

The condition keys on `repository_id`, which survives a rename, and on `ref` and `workflow_ref`, never on `sub`: a job that names an environment gets a subject of `environment:<name>`.

In Play Console, under Users and permissions, invite `play-publisher@<project>.iam.gserviceaccount.com` with these permissions on Sous Chef only: _Release to production, exclude devices, and use Play App Signing_; _Release apps to testing tracks_; _View app information (read-only)_. Grant no store-listing rights. A new permission can take up to a day to apply, until which Play answers "The caller does not have permission". Keep the internal testers list there; each tester opens its opt-in link once.

In GitHub, create the environments `play-internal` (deployment branch `main`) and `play-production` (deployment branch `main`, the release owner as required reviewer). Until all of this exists, a push to `main` fails at `version-code` and builds nothing.

#### Promoting to production (`promote-android.yml`)

Once a build on the internal track is tested, run **Actions → Promote Android** on `main` with its version code (in the build run's summary and on Play's internal track). The `play-production` environment waits for the release owner's approval, then `fastlane android promote`:

1. Finds the build's commit from `play-build/<code>`. A code with no such tag is no build from `main`.
2. Reads the version name at that commit. If `playstore-v<name>` already names another commit, it stops: one version name ships from one commit, because the cache purge and the minimum-version gate key on it. Bump `versionName`, and promote a build of the new version.
3. Writes the release notes from `scripts/store-listing/listing.json` as it is on `main` (`play-release-notes.mjs`), so notes written after the build need no rebuild. `_playReleaseNotesFor` must equal the version name, and every language Play lists needs `play.releaseNotes` of at most 500 characters (`playReleaseNotes.test.ts` holds the limit at merge). Have es, it and sq reviewed as `_review` asks before setting the stamp.
4. Tags the commit `playstore-v<name>`, then promotes that exact build at full rollout. Managed publishing is off, so it goes live when Google approves it.

If a newer build has replaced it on the internal track, the promotion fails; test that one and promote it instead. If Play refuses the change, for instance because the Console holds changes that must be sent by hand, production is unchanged and the tag this run made is deleted; send those changes in the Console, then promote again.

---

### 6. Build iOS (`build-ios.yml`)

**Triggers:**

- Push tags: `v*`, `ios-v*`

**Runner:** Self-hosted macOS (mac-mini-m1)

**Environment:** Always `prod`

The version number is extracted from the tag (stripping the `v` or `ios-v` prefix) and set as the marketing version, so the workflow refuses any tag that isn't exactly `vX.Y.Z` or `ios-vX.Y.Z`. The GitHub Actions run number is used as the build number.

**Pipeline steps:**

1. Checkout repository
2. Install Apple certificate & provisioning profile — Decodes base64 secrets, creates a temporary keychain, installs the distribution certificate and provisioning profiles
3. Setup Node.js (v20)
4. Clean workspace and npm cache
5. Install npm dependencies
6. Generate `.env` file — Writes config from the `prod` environment secrets/variables for `react-native-config`
7. Install CocoaPods dependencies
8. Set version from git tag (marketing version + build number)
9. Build Xcode archive — Manual code signing with Apple Distribution certificate and `souschef-appstore-dist` provisioning profile
10. Export IPA — App Store distribution method
11. Upload to App Store Connect — Uses App Store Connect API key via `xcrun altool`
12. Upload build artifact to GitHub Actions (3-day retention)

**Usage:**

```bash
# Using npm tag script (recommended)
npm run tag:ios           # Creates ios-v{version} from package.json

# Or using git tags manually
git tag ios-v1.2.0 && git push origin ios-v1.2.0
git tag v1.2.0 && git push origin v1.2.0       # alternate pattern
```

**Required secrets (prod environment):**

| Secret                         | Purpose                                      |
| ------------------------------ | -------------------------------------------- |
| `IOS_API_KEY`                  | Backend API key for iOS builds               |
| `IOS_BUILD_CERTIFICATE_BASE64` | Apple Distribution certificate (p12, base64) |
| `P12_PASSWORD`                 | Certificate password                         |
| `PROVISION_PROFILES_BASE64`    | Provisioning profiles archive (tgz, base64)  |
| `KEYCHAIN_PASSWORD`            | Temporary keychain password                  |
| `ASC_API_KEY_BASE64`           | App Store Connect API key (p8, base64)       |
| `ASC_API_KEY_ID`               | App Store Connect key ID                     |
| `ASC_API_ISSUER_ID`            | App Store Connect issuer ID                  |

---

## 🚀 Quick Reference: Triggering Releases

### Using npm tag scripts (recommended)

The tag scripts read the version from `package.json`, create annotated git tags, and push them to trigger the corresponding build workflows.

```bash
# Both platforms (prod only — iOS is prod-only)
npm run tag:prod          # Creates prod-v{version} (Android) + ios-v{version} (iOS)

# Android only — dev and stg have no iOS equivalent, so these already
# produce an Android-only tag
npm run tag:dev           # Creates dev-v{version}
npm run tag:stg           # Creates stg-v{version}

# prod is the only prefix that tags both platforms
npm run tag:prod          # Creates prod-v{version} + ios-v{version}
npm run tag:android:prod  # Creates prod-v{version} (skips iOS)
npm run tag:ios           # Creates ios-v{version} (always prod)
```

| Command                    | Tag(s) Created                       | Triggers                   |
| -------------------------- | ------------------------------------ | -------------------------- |
| `npm run tag:dev`          | `dev-v{version}`                     | Android dev build          |
| `npm run tag:stg`          | `stg-v{version}`                     | Android staging build      |
| `npm run tag:prod`         | `prod-v{version}` + `ios-v{version}` | Android prod + iOS prod    |
| `npm run tag:android:prod` | `prod-v{version}`                    | Android prod only (no iOS) |
| `npm run tag:ios`          | `ios-v{version}`                     | iOS prod only              |

If a tag already exists locally or on the remote, the script will prompt for confirmation before deleting and recreating it.

There is no Play Store tag script: `playstore-v{version}` is written only by **Promote Android**, on the commit it promotes (see **Play distribution**).

### Using git tags manually

```bash
# Android
git tag dev-v1.2.0 && git push origin dev-v1.2.0        # Dev APK
git tag stg-v1.2.0 && git push origin stg-v1.2.0        # Staging APK
git tag prod-v1.2.0 && git push origin prod-v1.2.0      # Production APK

# iOS
git tag ios-v1.2.0 && git push origin ios-v1.2.0        # App Store
git tag v1.2.0 && git push origin v1.2.0                # App Store (alternate)

# Check build status
gh run list --workflow=build-android.yml
gh run list --workflow=build-ios.yml
```

---

## 🏗️ Build Configuration (E2E Testing)

### iOS E2E

**Runner:** Self-hosted macOS (mac-mini-m1, labels: `self-hosted`, `macOS`)

**Environment:**

- Node.js 20
- Ruby 3.2
- CocoaPods
- Xcode 16.4 (`/Applications/Xcode.app`)
- Detox with applesimutils

**Build Command:**

```bash
npm run test:e2e:build
# Runs: detox build --configuration ios.sim.debug
```

### Android E2E

**Runner:** Self-hosted Linux (ubuntu, labels: `self-hosted`, `Linux`)

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

### Runner Assignment Summary

| Job Type                                             | Runner                          |
| ---------------------------------------------------- | ------------------------------- |
| iOS E2E / smoke / nightly                            | `[self-hosted, macOS]`          |
| Android E2E / smoke / nightly                        | `[self-hosted, Linux]`          |
| iOS production build                                 | `[self-hosted, macOS]`          |
| Android build (all envs)                             | `[self-hosted, Linux]`          |
| Utility (typecheck, lint, unit tests, status checks) | `ubuntu-latest` (GitHub-hosted) |

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

| Workflow        | Status    | Last Run | Pass Rate |
| --------------- | --------- | -------- | --------- |
| PR Checks       | ✅ Active | -        | -         |
| E2E Smoke Tests | ✅ Active | -        | -         |
| E2E Tests       | ✅ Active | -        | -         |
| E2E Nightly     | ✅ Active | -        | -         |

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
