# Android Build & Release Setup

## Overview

A single GitHub Actions workflow (`build-android.yml`) handles every Android build
environment, selected by the tag prefix that triggered it:

| Command | Tag Pattern | Workflow | Environment | Keystore | Output |
|---------|-------------|----------|-------------|----------|--------|
| `npm run tag:dev` | `dev-v*` | build-android.yml | dev | Dev keystore | APK (dev) |
| `npm run tag:stg` | `stg-v*` | build-android.yml | stg | Dev keystore | APK (staging) |
| `npm run tag:prod` | `prod-v*` | build-android.yml | prod | Prod keystore | APK (prod) |
| `npm run tag:playstore` | `playstore-v*` | build-android.yml | prod | Play Store keystore | AAB (prod) |

---

## Keystore Architecture

### 1. Development Keystore (`releases.keystore`)
- **Used by:** Dev builds, Staging builds
- **GitHub Secret:** `BUILD_CERTIFICATE_BASE64`
- **Alias:** `github`
- **Purpose:** Internal testing, QA, staging environments

### 2. Production Keystore (`prod-release.keystore`)
- **Used by:** Production APK builds (direct distribution)
- **GitHub Secret:** `PROD_KEYSTORE_BASE64`
- **Alias:** `prod-release`
- **Purpose:** Production APK distribution outside Play Store

### 3. Play Store Upload Key (`upload-key.keystore`)
- **Used by:** Play Store AAB builds
- **GitHub Secret:** `PLAYSTORE_KEYSTORE_BASE64`
- **Alias:** `upload`
- **Purpose:** Google Play Store releases only

---

## GitHub Secrets Setup

### Existing Secrets (Dev & Staging)

Already configured in your repository:
- `BUILD_CERTIFICATE_BASE64` - Dev keystore file (Base64 encoded)
- `KEYSTORE_PASSWORD` - Dev keystore password
- `KEY_PASSWORD` - Dev key password

### New Secrets Required (Production APK)

You need to add these three new secrets:

#### 1. Generate Production Keystore

```bash
# Generate new production keystore
keytool -genkeypair -v \
  -storetype PKCS12 \
  -keystore prod-release.keystore \
  -alias prod-release \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass YOUR_STORE_PASSWORD \
  -keypass YOUR_KEY_PASSWORD \
  -dname "CN=Your Name, OU=Your Organization Unit, O=Your Organization, L=Your City, ST=Your State, C=Your Country"
```

**Important:** Use a strong, unique password and store it securely!

#### 2. Convert Keystore to Base64

```bash
# Encode the keystore file
base64 -i prod-release.keystore -o prod-release.keystore.base64

# On macOS, use:
base64 -i prod-release.keystore > prod-release.keystore.base64
```

#### 3. Add Secrets to GitHub

Go to: **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add these three secrets:

1. **Name:** `PROD_KEYSTORE_BASE64`
   - **Value:** Contents of `prod-release.keystore.base64` file

2. **Name:** `PROD_KEYSTORE_PASSWORD`
   - **Value:** The store password you used (YOUR_STORE_PASSWORD)

3. **Name:** `PROD_KEY_PASSWORD`
   - **Value:** The key password you used (YOUR_KEY_PASSWORD)

---

## GitHub Environments

### Required Environments

Create three environments in **Settings** → **Environments**:

#### 1. dev
```
Environment variables:
- API_URL: http://localhost:4000/graphql (or your dev API)
- WEB_SOCKET_URL: ws://localhost:4000/graphql
- OTLP_METRICS_ENDPOINT: (your Prometheus / Mimir OTLP endpoint, e.g. https://prometheus-prod-XX.grafana.net/api/prom)
- OTLP_LOGS_ENDPOINT: (your Loki OTLP endpoint, e.g. https://logs-prod-XXX.grafana.net)

Secrets:
- API_KEY
- OTLP_METRICS_AUTH_USERNAME         # Prometheus stack instance ID
- OTLP_METRICS_AUTH_PASSWORD         # Prometheus glc_ token
- OTLP_LOGS_AUTH_USERNAME            # Loki stack instance ID (separate from Prometheus on Grafana Cloud)
- OTLP_LOGS_AUTH_PASSWORD            # Loki glc_ token
- SPOONACULAR_API_KEY
```

#### 2. stg
```
Environment variables:
- API_URL: https://stg-api.souschef.dev/graphql
- WEB_SOCKET_URL: wss://stg-api.souschef.dev/graphql
- OTLP_METRICS_ENDPOINT: (your Prometheus OTLP endpoint)
- OTLP_LOGS_ENDPOINT: (your Loki OTLP endpoint)

Secrets:
- API_KEY
- OTLP_METRICS_AUTH_USERNAME
- OTLP_METRICS_AUTH_PASSWORD
- OTLP_LOGS_AUTH_USERNAME
- OTLP_LOGS_AUTH_PASSWORD
- SPOONACULAR_API_KEY
```

#### 3. prod
```
Environment variables:
- API_URL: https://api.souschef.dev/graphql
- WEB_SOCKET_URL: wss://api.souschef.dev/graphql
- OTLP_METRICS_ENDPOINT: (your Prometheus OTLP endpoint)
- OTLP_LOGS_ENDPOINT: (your Loki OTLP endpoint)

Secrets:
- API_KEY
- OTLP_METRICS_AUTH_USERNAME
- OTLP_METRICS_AUTH_PASSWORD
- OTLP_LOGS_AUTH_USERNAME
- OTLP_LOGS_AUTH_PASSWORD
- SPOONACULAR_API_KEY
```

---

## Build & Release Process

### Development Build

```bash
# 1. Bump version if needed
npm version patch  # or minor, major

# 2. Create and push dev tag
npm run tag:dev

# 3. GitHub Actions automatically:
#    - Builds with dev environment (.env.development)
#    - Signs with dev keystore
#    - Creates GitHub Release (prerelease)
#    - Uploads APK files
```

### Staging Build

```bash
# 1. Create and push staging tag
npm run tag:stg

# 2. GitHub Actions automatically:
#    - Builds with staging environment (.env.staging)
#    - Signs with dev keystore (same as dev)
#    - Uses assembleStaging Gradle task
#    - Creates GitHub Release (prerelease)
#    - Uploads APK files
```

### Production APK Build

```bash
# 1. Create and push production APK tag
npm run tag:prod

# 2. GitHub Actions automatically:
#    - Builds with production environment (.env.production)
#    - Signs with PRODUCTION keystore (prod-release.keystore)
#    - Creates GitHub Release (production release)
#    - Uploads APK files
```

### Play Store AAB Build

```bash
# 1. Create and push Play Store tag
npm run tag:playstore

# 2. GitHub Actions automatically:
#    - Builds with production environment (.env.production)
#    - Signs with Play Store upload key
#    - Creates AAB bundle
#    - Creates GitHub Release
#    - Uploads AAB file
```

---

## Build Outputs

### APK Files (All Non-Play Store Builds)

Each build creates architecture-specific APKs:

```
sous-chef-{env}-{tag}-universal.apk    # Universal (all architectures)
sous-chef-{env}-{tag}-armeabi-v7a.apk  # 32-bit ARM
sous-chef-{env}-{tag}-arm64-v8a.apk    # 64-bit ARM (most common)
sous-chef-{env}-{tag}-x86.apk          # 32-bit x86 (emulators)
sous-chef-{env}-{tag}-x86_64.apk       # 64-bit x86 (emulators)
```

**Recommended for distribution:** `arm64-v8a` (covers 95% of modern devices)

### AAB File (Play Store Only)

```
app-release.aab  # Android App Bundle for Play Store
```

---

## Troubleshooting

### "Signing configuration not found"

**Problem:** Gradle warning about missing signing config

**Solution:** Ensure GitHub secrets are set correctly:
- For dev/staging: `BUILD_CERTIFICATE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_PASSWORD`
- For prod APK: `PROD_KEYSTORE_BASE64`, `PROD_KEYSTORE_PASSWORD`, `PROD_KEY_PASSWORD`
- For Play Store: `PLAYSTORE_KEYSTORE_BASE64`, etc.

### "Environment variables not found"

**Problem:** GitHub Actions can't find environment variables

**Solution:**
1. Go to GitHub → Settings → Environments
2. Ensure environment exists (dev, stg, or prod)
3. Add required variables to that environment
4. Workflow must use correct `environment:` declaration

### "Tag doesn't trigger workflow"

**Problem:** Pushing tag doesn't start build

**Solution:** Check the tag prefix — all four are handled by `build-android.yml`:
- `dev-v1.7.1` → dev
- `stg-v1.7.1` → stg
- `prod-v1.7.1` → prod APK
- `playstore-v1.7.1` → prod AAB

### "APK won't install" or "App not signed"

**Problem:** APK installation fails on device

**Solution:**
1. Ensure keystore file is valid and Base64-encoded correctly
2. Check keystore passwords match in GitHub secrets
3. For production builds, ensure using correct keystore (prod-release, not dev)

---

## Security Best Practices

### Keystore Files

✅ **DO:**
- Store keystore files securely (encrypted backup)
- Use strong, unique passwords for each keystore
- Keep production and Play Store keystores separate from dev
- Back up keystores in secure, encrypted location (NOT in git)
- Document keystore details (alias, location) in secure password manager

❌ **DON'T:**
- Commit keystore files to git repository
- Share keystore files via unsecure channels (email, Slack, etc.)
- Reuse passwords across keystores
- Store keystore passwords in code or config files
- Use same keystore for dev and production

### GitHub Secrets

✅ **DO:**
- Use GitHub Environments for environment-specific secrets
- Rotate secrets periodically
- Use separate secrets for prod vs dev/staging
- Document what each secret is for

❌ **DON'T:**
- Log secret values in workflow output
- Share GitHub secrets with untrusted team members
- Use same secret values across environments (if avoidable)

---

## Workflow File Locations

- All Android builds (dev / staging / prod APK / Play Store AAB):
  `.github/workflows/build-android.yml`
- iOS builds: `.github/workflows/build-ios.yml`

---

## Quick Reference

### Check Build Status

Go to: **Actions** tab in GitHub repository

### Download Build Artifacts

Go to: **Releases** tab in GitHub repository

### Local Testing

```bash
# Dev build locally
cd android && ./gradlew assembleRelease

# Staging build locally
cd android && ./gradlew assembleStaging

# Check build outputs
ls -hal android/app/build/outputs/apk/
```

---

## Next Steps

1. ✅ Generate production keystore (`prod-release.keystore`)
2. ✅ Convert to Base64 and add to GitHub secrets
3. ✅ Create GitHub Environments (dev, stg, prod) with variables
4. ✅ Test each workflow by pushing appropriate tags
5. ✅ Verify APKs install correctly on test devices
6. ✅ Document keystore details in secure password manager

---

## Support

For issues or questions:
1. Check GitHub Actions logs for detailed error messages
2. Review this document for common issues
3. Verify GitHub secrets and environment variables are set correctly
4. Contact DevOps team if persistent issues occur
