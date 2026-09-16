# Lint rule catalog

The project's own rules, registered by `eslint/plugin/` as `sous-chef/*` and
configured in `eslint/project.js`. Every rule is `error` or `off`: `npm run
lint` passes `--max-warnings 0`, and `__tests__/lint/ruleCatalog.test.ts`
fails on a rule without a page here, a spec, or a place in the config.

A disable comment is itself an error (`eslint-comments/no-use`). A justified
exemption is a file-scoped override in `eslint/project.js`, where review sees it.

| Rule                                                                                      | Enforces                                                                                        |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| [`sous-chef/no-schema-enum-cast`](no-schema-enum-cast.md)                                 | No casts to a generated schema enum.                                                            |
| [`sous-chef/no-module-level-t`](no-module-level-t.md)                                     | A file that renders translates with the hook's t, not the module-level one.                     |
| [`sous-chef/no-dated-comment`](no-dated-comment.md)                                       | A comment describes the code as it is, so it carries no date.                                   |
| [`sous-chef/no-operation-name-literal`](no-operation-name-literal.md)                     | An operation name comes from its generated document, not a string.                              |
| [`sous-chef/no-unchecked-domain-literal`](no-unchecked-domain-literal.md)                 | A schema enum value or typename is compared and keyed through its generated symbol.             |
| [`sous-chef/no-error-message-branching`](no-error-message-branching.md)                   | An error is classified by its code, never by its message text.                                  |
| [`sous-chef/no-rendered-server-message`](no-rendered-server-message.md)                   | A server error's `message`, or other copy the server writes, never reaches the screen.          |
| [`sous-chef/testid-from-registry`](testid-from-registry.md)                               | A testID comes from its registry; e2e selects by it, never by fixed copy or a screen point.     |
| [`sous-chef/no-raw-color`](no-raw-color.md)                                               | A colour is a theme token, never a hex, rgb() or named literal.                                 |
| [`sous-chef/no-raw-spacing`](no-raw-spacing.md)                                           | Padding, margin and gap are spacing tokens, never a non-zero number.                            |
| [`sous-chef/text-needs-role`](text-needs-role.md)                                         | A `<Text>` outside the kit names its role; error copy is `role="error"` + `tone="error"`.       |
| [`sous-chef/quantity-through-formatter`](quantity-through-formatter.md)                   | A quantity reaches the screen through formatQuantityForDisplay, never as a raw number.          |
| [`sous-chef/no-rendered-enum`](no-rendered-enum.md)                                       | A schema enum value reaches the screen through a translation table, never raw or string-munged. |
| [`sous-chef/no-t-default-value`](no-t-default-value.md)                                   | A translation call carries no inline fallback copy: the key resolves in every locale.           |
| [`sous-chef/no-prose-literal`](no-prose-literal.md)                                       | Copy handed to the UI through a variable, property, setter or return is translated.             |
| [`sous-chef/no-string-keyed-lookup`](no-string-keyed-lookup.md)                           | A closed lookup table is keyed by the real key type, never by string.                           |
| [`sous-chef/no-number-noun-concat`](no-number-noun-concat.md)                             | A count and its noun are one translated sentence, never a number joined to a string.            |
| [`sous-chef/queueable-write-is-local-first`](queueable-write-is-local-first.md)           | A write the offline queue can take writes the cache first and says so.                          |
| [`sous-chef/recycling-list-host-is-bounded`](recycling-list-host-is-bounded.md)           | A recycling list is bounded by the view that hosts it.                                          |
| [`sous-chef/hook-returns-no-library-type`](hook-returns-no-library-type.md)               | A feature hook hands a screen no library type.                                                  |
| [`sous-chef/flashlist-declares-scroll-component`](flashlist-declares-scroll-component.md) | Every FlashList declares which scroll component it renders through.                             |
| [`sous-chef/no-scrollable-in-bottom-sheet-view`](no-scrollable-in-bottom-sheet-view.md)   | A scrollable is never nested inside a BottomSheetView.                                          |
| [`sous-chef/rngh-refresh-control-matches-host`](rngh-refresh-control-matches-host.md)     | A pull-to-refresh control matches its scrollable host.                                          |
| [`sous-chef/on-fill-text-uses-its-token`](on-fill-text-uses-its-token.md)                 | Text on a fill reads that fill's own `on*` token.                                               |

A ban that is one esquery selector and nothing else is an entry of the stock
`no-restricted-syntax` rule instead of a rule of its own — the catalog of those
is [`restricted-syntax.md`](restricted-syntax.md).

## Library rule sets

Three presets carry rules this project would otherwise hand-write, each with the
entries that do not fit named and switched off in `eslint/project.js`:

| Preset                                          | Scope          | Off, and why                                                                                                                |
| ----------------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `@graphql-eslint` `flat/operations-recommended` | `**/*.graphql` | `naming-convention`'s fragment casing and `Get` prefix; `no-unused-fragments` (a fragment read from TypeScript)             |
| `eslint-plugin-jest` `flat/recommended`         | test files     | `no-done-callback`, `expect-expect`, `no-conditional-expect`, `no-mocks-import`, `no-export` — deliberate patterns here     |
| `eslint-plugin-testing-library`                 | test files     | the preference half (`prefer-screen-queries`, `render-result-naming-convention`, `prefer-find-by`) and `no-debugging-utils` |

Only the bug-class half of testing-library is on: an unawaited async query
asserts on a promise, a `waitFor` holding several assertions retries the ones
that already passed, and a side effect inside one runs on every retry.
`no-debugging-utils` is absent because it matches any `.debug(`, the app's own
logger included.

## typescript-eslint rules

Type-checked rules the project turns on, each at zero when it was enabled. The
exact options and file scopes are in `eslint/project.js`.

| Rule                                                                          | Scope                        | What it holds                                                                                                                                                                  |
| ----------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `no-explicit-any`                                         | everywhere                   | No `any`, including `as any`; `no-restricted-syntax` bans `as unknown` / `as never`                                                                                            |
| --------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `no-unnecessary-condition`                                | production `src`             | A condition the types say cannot matter. No exclusions: widen the over-promising type where it is DECLARED, never delete the guard (`docs/architecture.md` § Type-level gates) |
| `no-unnecessary-type-assertion`                           | typed TS                     | An assertion that changes nothing                                                                                                                                              |
| `consistent-type-assertions`                              | production `src`             | `as` style; never on an object literal                                                                                                                                         |
| `consistent-type-imports` + `no-import-type-side-effects` | typed TS                     | Type-only imports are `import type`                                                                                                                                            |
| `no-floating-promises` / `no-misused-promises`            | production `src`, tests, e2e | A promise is awaited, returned, or marked `void`                                                                                                                               |
| `await-thenable`                                          | production `src`, tests, e2e | `await` only on a thenable                                                                                                                                                     |
| `only-throw-error`                                        | production `src`             | Throw an `Error` (Apollo's `ErrorLike` allowed)                                                                                                                                |
| `restrict-template-expressions` / `no-base-to-string`     | production `src`             | No `[object Object]` in a string                                                                                                                                               |
| `no-non-null-assertion`                                   | production `src`             | No `!`: bind and guard                                                                                                                                                         |
| `switch-exhaustiveness-check`                             | production `src`             | A `switch` over a union handles every member; `default` does not count                                                                                                         |
| `no-unsafe-enum-comparison`                               | production `src`             | An enum is compared with its own members                                                                                                                                       |
| `prefer-nullish-coalescing`                               | production `src`             | `??` over `\|\|`; a blank string falls back through `firstNonBlank`                                                                                                            |
| `ban-ts-comment`                                          | production `src`, tests, e2e | `@ts-expect-error` only with a description                                                                                                                                     |
| `no-deprecated`                                           | everywhere                   | No deprecated API                                                                                                                                                              |
| `no-shadow` / `no-unused-vars`                            | everywhere                   | —                                                                                                                                                                              |

## Compiler flags

`strict` (from `@react-native/typescript-config`) plus, in `tsconfig.json`:

| Flag                               | Why                                                                                             |
| ---------------------------------- | ----------------------------------------------------------------------------------------------- |
| `noUncheckedIndexedAccess`         | `arr[0]`, `record[key]` and a regex capture read as `T \| undefined`, so a guard on one is real |
| `noImplicitOverride`               | An overriding method says `override`, so a renamed base method fails the build                  |
| `noFallthroughCasesInSwitch`       | A `case` cannot silently run into the next                                                      |
| `noUnusedParameters`               | A parameter nothing reads is dead weight or a signature that drifted                            |
| `forceConsistentCasingInFileNames` | An import's casing matches the file, as the case-sensitive CI filesystem requires               |

Typed keys and generated symbols carry more than lint does: `t` takes a
`TranslationKey` (`src/i18n/i18next.d.ts`), operation APIs take generated
documents, and testIDs come from `testIDs.ts` registries.
