# GitHub Actions Environments Guide

## Overview

GitHub Environments provide isolated configuration for different deployment stages. This project uses three environments (`dev`, `stg`, `prod`) to manage API URLs and secrets for Android builds.

---

## How GitHub Environments Work

### Environment Declaration

Workflows declare which environment they use:

```yaml
jobs:
  build:
    environment: stg  # Uses the 'stg' environment
```

When a workflow runs, GitHub loads variables and secrets from that environment.

### Secret Resolution Order

GitHub resolves secrets in this priority:

1. **Environment-level secret** (if exists in the environment)
2. **Repository-level secret** (fallback if environment secret doesn't exist)

This allows you to:
- Share common secrets across all environments (repository-level)
- Override specific secrets per environment (environment-level)

**Example:**
```
Repository secrets: BUILD_CERTIFICATE_BASE64 (dev keystore)
dev environment: (no override, uses repository-level)
stg environment: (no override, uses repository-level)
prod environment: PROD_KEYSTORE_BASE64 (overrides for production)
```

### Variables vs Secrets

**Variables** (plain text, visible):
- API URLs, endpoint URLs
- Non-sensitive configuration
- Located: Settings → Environments → `<env-name>` → Environment variables

**Secrets** (encrypted, hidden):
- API keys, passwords, keystores
- Authentication credentials
- Located: Settings → Environments → `<env-name>` → Environment secrets

---

## Our Environment Structure

| Environment | Workflow File | Triggered By | Purpose |
|-------------|---------------|--------------|---------|
| `dev` | build-android.yml | `v*` tags | Development testing |
| `stg` | build-android-staging.yml | `stg-v*` tags | Pre-production QA |
| `prod` | build-android-release.yml, playstore-release.yml | `release-v*`, `playstore-v*` tags | Production releases |

### What Each Environment Contains

**dev environment:**
- Variables: Dev API URLs, dev endpoints
- Secrets: Inherits from repository (dev keystore, API keys)

**stg environment:**
- Variables: Staging API URLs (e.g., `https://stg-api.souschef.dev/graphql`)
- Secrets: Inherits from repository (same dev keystore, API keys)

**prod environment:**
- Variables: Production API URLs
- Secrets: Inherits most from repository, overrides keystore with `PROD_KEYSTORE_BASE64`

---

## How Builds Use Environments

### Example Flow: Staging Build

```bash
npm run tag:stg
# Creates tag: stg-v1.7.1
# Pushes to GitHub
```

**What happens:**
1. Tag `stg-v1.7.1` matches pattern `stg-v*`
2. Triggers `build-android-staging.yml` workflow
3. Workflow declares `environment: stg`
4. GitHub loads variables from `stg` environment:
   - `API_URL` → `https://stg-api.souschef.dev/graphql`
   - `WEB_SOCKET_URL` → `wss://stg-api.souschef.dev/graphql`
5. GitHub loads secrets:
   - Checks `stg` environment first → not found
   - Falls back to repository-level → finds `BUILD_CERTIFICATE_BASE64`
6. Workflow generates `.env.staging` with staging API URLs
7. Builds APK signed with dev keystore

### Example Flow: Production Build

```bash
npm run tag:release
# Creates tag: release-v1.7.1
# Pushes to GitHub
```

**What happens:**
1. Tag `release-v1.7.1` matches pattern `release-v*`
2. Triggers `build-android-release.yml` workflow
3. Workflow declares `environment: prod`
4. GitHub loads variables from `prod` environment:
   - `API_URL` → `https://api.souschef.dev/graphql`
5. GitHub loads secrets:
   - `PROD_KEYSTORE_BASE64` (production keystore)
   - Other secrets fall back to repository-level
6. Workflow generates `.env.production` with production API URLs
7. Builds APK signed with production keystore

---

## Setting Up Environments

### Creating an Environment

**Navigate to:** Settings → Environments → New environment

**Name it:** `dev`, `stg`, or `prod` (case-sensitive, lowercase)

### Adding Variables

1. Open environment (e.g., `stg`)
2. Click "Add variable" under "Environment variables"
3. Add each variable:
   - `API_URL` = `https://stg-api.souschef.dev/graphql`
   - `WEB_SOCKET_URL` = `wss://stg-api.souschef.dev/graphql`
   - etc.

Variables are **visible** in the GitHub UI (not encrypted).

### Adding Secrets

1. Open environment (e.g., `prod`)
2. Click "Add secret" under "Environment secrets"
3. Add secrets that differ from repository-level:
   - `PROD_KEYSTORE_BASE64` (only in prod environment)

Secrets are **encrypted** and hidden after creation.

---

## Common Patterns

### Pattern 1: Shared Secrets, Different URLs

Use this when dev/stg/prod use the same API keys but different servers.

**Setup:**
- Repository secrets: `API_KEY`, `SPOONACULAR_API_KEY` (shared)
- Environment variables: `API_URL` (different per environment)

**Result:**
- All environments use same API key
- Each environment connects to different server

### Pattern 2: Environment-Specific Secrets

Use this when environments need different credentials.

**Setup:**
- Repository secrets: Common secrets
- Environment secrets: Override specific ones
  - `dev` → no overrides
  - `stg` → no overrides
  - `prod` → override `PROD_KEYSTORE_BASE64`

**Result:**
- Dev/staging share dev keystore
- Production uses separate keystore

---

## Debugging Environment Issues

### Check What Environment Was Used

In GitHub Actions run:
1. Open workflow run
2. Look for "Building for environment: stg" in logs
3. Verify it matches expected environment

### Verify Variable Values

Add debug step to workflow:

```yaml
- name: Debug environment
  run: |
    echo "API_URL: ${{ vars.API_URL }}"
    echo "Environment: ${{ github.environment }}"
```

**Note:** Never echo secrets! Only echo variables (non-sensitive).

### Common Issues

**"Variable is empty"**
- Environment doesn't exist → Create it
- Variable not set in environment → Add it under "Environment variables"

**"Wrong API URL used"**
- Workflow uses wrong environment name → Check `environment:` declaration
- Environment name mismatch → Ensure exact match (case-sensitive)

**"Build uses dev secrets in production"**
- Missing environment-specific secret → Add to environment
- Workflow not declaring environment → Add `environment: prod`

---

## Security Best Practices

### Never Store in Code

❌ Don't:
```yaml
env:
  API_URL: "https://api.souschef.dev/graphql"  # Hardcoded
```

✅ Do:
```yaml
environment: prod  # Loads from GitHub Environment
env:
  API_URL: ${{ vars.API_URL }}  # References environment variable
```

### Separate Production Credentials

- Dev/Staging: Can share credentials (internal use only)
- Production: Always use separate keystore and sensitive credentials

### Use Environment Protection Rules

**Optional:** Add protection rules to environments:
1. Settings → Environments → `prod` → Configure environment
2. Enable "Required reviewers" for production deployments
3. Only specific users can approve production releases

---

## Quick Reference

### Creating Environment Variables

```
Settings → Environments → <env-name> → Environment variables → Add variable

Name: API_URL
Value: https://stg-api.souschef.dev/graphql
```

### Creating Environment Secrets

```
Settings → Environments → <env-name> → Environment secrets → Add secret

Name: PROD_KEYSTORE_BASE64
Value: <base64-encoded-keystore>
```

### Accessing in Workflows

```yaml
# Access variable
${{ vars.API_URL }}

# Access secret
${{ secrets.API_KEY }}

# Current environment name
${{ github.environment }}
```

---

## Our Build Commands

```bash
# Dev build → uses 'dev' environment
npm run tag:dev

# Staging build → uses 'stg' environment
npm run tag:stg

# Production APK → uses 'prod' environment
npm run tag:release

# Play Store AAB → uses 'prod' environment
npm run tag:playstore
```

Each command creates a tag, GitHub matches it to a workflow, workflow loads the appropriate environment configuration.

---

For keystore setup and detailed build instructions, see `android-build-setup.md`.
