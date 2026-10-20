# `sous-chef/no-module-scope-platform-read`

A platform service is read where it is used, never while a module loads.

## Reports

- Read the platform service inside the function that uses it, e.g. `const secureStore = () => requirePlatform('secureStore')`. A read while the module loads depends on the host installing first and on the bundler's evaluation order: Metro's inline requires hide it, an eager bundler throws `PlatformServiceMissing`.

## Use instead

An accessor read at the call (`const secureStore = () => requirePlatform('secureStore')`), a function in place of a constant (`clientVersion()`), or a proxy over the installed service where importers hold an object (`storage` in `src/store/deviceStorage.ts`, `env` in `src/config/env.ts`).

## Why

The host's install module imports its adapters, and they reach core modules (`keychain` → `errorService` → telemetry → `deviceId`) before `installPlatform()` runs. A read at load throws there under any bundler that evaluates imports eagerly; only Metro's `inlineRequires` defers it. `__tests__/core-portability/coreLoadsWithNothingInstalled.test.ts` and `src/app/__tests__/installEvaluatesEagerly.test.ts` hold the runtime side (`openspec` `core-layer-portability`).

## Exempt

Test files and GraphQL documents.

Source: [`eslint/plugin/rules/no-module-scope-platform-read.js`](../../eslint/plugin/rules/no-module-scope-platform-read.js) · spec: [`__tests__/lint/rules/no-module-scope-platform-read.test.ts`](../../__tests__/lint/rules/no-module-scope-platform-read.test.ts)
