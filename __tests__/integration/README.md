# Integration Tests

This layer sits between unit tests (which mock everything around the unit
under test) and Detox e2e tests (which exercise the whole app on a device or
simulator). Each Detox test takes minutes; each unit test runs in
milliseconds but proves only that one slice works in isolation. Integration
tests fill the gap: they run in the same Jest process as unit tests and
finish in milliseconds-to-seconds, but they exercise the seams between
subsystems with real implementations on both sides of the boundary.

## What integration tests cover

Cross-subsystem behavior. Examples:

- **Apollo cache and Zustand auth state on logout.** `client.clearStore()`
  must run alongside `useStore.clearAuth()` and the resulting state must
  be coherent (no auth user with a populated cache, no cached entities
  from the previous session leaking into the next login).
- **Optimistic mutations and the Apollo cache.** A mutation hook with an
  `optimisticResponse` and `update` callback must update the cache
  immediately when called, with the optimistic value visible to subsequent
  reads even before the network request resolves.
- **Persisted preferences across an app restart.** Writing to a Zustand
  slice that flows through the persist middleware must round-trip via
  MMKV: a fresh store created after the write must see the new value
  after rehydration.

The boundary under test is real on **both** sides. We use the real Apollo
client (`@apollo/client/testing/react`'s `MockedProvider`), the real
Zustand store (`createTestStore`, or the persist middleware backed by the
mocked MMKV), and the real cache update / merge logic. Only network calls
and native modules are mocked — everything that participates in the seam
is exercised end-to-end within the Jest process.

## What integration tests do NOT cover

- **UI rendering details.** "The list shows 3 rows" or "the heading reads
  X" belongs in unit tests next to the component (or in a screen-level
  RNTL test). Integration tests assert state transitions, not pixels.
- **Full user journeys.** "Sign in, navigate to pantry, add an item,
  verify it persists across launches" is a Detox concern. Integration
  tests stop at the seam between two subsystems; they don't drive
  navigation or simulate cold-start UX.
- **Native-side behavior.** Anything that requires the actual MMKV C++
  module, Keychain, or Apollo's native links lives in Detox or manual QA.

## When to add an integration test vs a unit test

Add an integration test when:

- A bug crosses a subsystem boundary (Zustand state inconsistent with
  Apollo cache after a mutation, persisted preference not applied at
  rehydration, etc.).
- A new feature wires two existing subsystems together for the first time
  (e.g., a hook that reads from Zustand and writes to Apollo, or a service
  that needs both stores in lockstep).
- A regression keeps slipping past unit tests because each side mocks the
  other away.

Add a unit test when:

- The behavior is contained within a single hook, slice, util, or
  component.
- The seam in question already has integration coverage and the new
  behavior is just additional surface area on one side.

## Naming convention

`<scenario>.integration.test.ts(x)` — for example
`logout.integration.test.ts`, `optimisticMutation.integration.test.ts`.
The `.integration.` suffix lets us run the layer in isolation:

```bash
npm test -- --testPathPattern="integration"
```

Tests are TypeScript and use the same helpers as unit tests
(`__tests__/helpers/`). Do not introduce a parallel infrastructure here.
If a helper is missing a feature, document the gap below and add it to
the existing helper.

## File layout

```
__tests__/integration/
  README.md                                       (this file)
  logout.integration.test.ts                      (Apollo cache <-> Zustand auth)
  optimisticMutation.integration.test.ts          (Apollo mutation <-> Apollo cache)
  preferencePersistence.integration.test.ts       (Zustand persist <-> MMKV)
```

## Helper gaps observed during bootstrap

The example tests cover the common cases without new helpers, but a
couple of rough edges showed up while writing them:

1. **`createTestStore` does not run the persist middleware.** It mirrors
   the real store's `immer + subscribeWithSelector` stack but skips
   `persist`. Tests that need to verify rehydration must build their own
   `create(...)` call with the persist middleware (see
   `preferencePersistence.integration.test.ts`). If we end up writing
   more rehydration tests, consider adding a `createPersistedTestStore`
   helper to `createTestStore.ts`.
2. **`renderWithProviders` only wraps `MockedProvider`.** It does not
   include a Zustand provider because the app uses a singleton store via
   `useStore` (Zustand's recommended pattern). Tests that need to seed
   Zustand state alongside Apollo can call `useStore.setState(...)`
   directly, or use `createTestStore` and pass it as `wrapper={null}` if
   the SUT accepts a store via prop. Most consumer hooks read the
   singleton, so seeding `useStore.setState` is the path of least
   resistance.
3. **`apolloMockProvider` exposes a built-in cache via `link/cache`
   props.** It does not expose the cache directly to the test, so
   verifying `cache.extract()` requires building a wrapper inline that
   captures the client. The Apollo team recommends using a mocked
   `ApolloClient` directly when the test needs cache access; the
   `logout.integration.test.ts` example below shows that pattern.

These are not blockers — the existing helpers cover ~95% of test needs
and the workarounds are short. Promote them to first-class helpers when
the third or fourth test repeats the same pattern.
