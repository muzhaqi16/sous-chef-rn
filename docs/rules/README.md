# Lint rule catalog

The project's own rules, registered by `eslint/plugin/` as `sous-chef/*` and
configured in `eslint/project.js`. Every rule is `error` or `off`: `npm run
lint` passes `--max-warnings 0`, and `__tests__/lint/ruleCatalog.test.ts`
fails on a rule without a page here, a spec, or a place in the config.

A disable comment is itself an error (`eslint-comments/no-use`). A justified
exemption is a file-scoped override in `eslint/project.js`, where review sees it.

| Rule                                                                        | Enforces                                                                                        |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| [`sous-chef/no-parse-float`](no-parse-float.md)                             | Parse typed numbers with parseDecimalInput, never parseFloat.                                   |
| [`sous-chef/no-inline-import-type`](no-inline-import-type.md)               | Import types at the top of the file, not through inline import() types.                         |
| [`sous-chef/no-imperative-sheet`](no-imperative-sheet.md)                   | Drive a bottom sheet with its visible prop, not present()/dismiss().                            |
| [`sous-chef/no-font-scale-override`](no-font-scale-override.md)             | Never cap or disable font scaling per element.                                                  |
| [`sous-chef/no-hand-rolled-search`](no-hand-rolled-search.md)               | Search a loaded list through filterByTerm, not a hand-rolled toLowerCase().includes().          |
| [`sous-chef/no-border-width-literal`](no-border-width-literal.md)           | Border widths come from theme.borderWidth, never a numeric literal.                             |
| [`sous-chef/no-untranslated-toast`](no-untranslated-toast.md)               | Copy reaching a toast or alert is translated: no literals, templates or server messages.        |
| [`sous-chef/schedule-on-rn-callback`](schedule-on-rn-callback.md)           | scheduleOnRN takes a callback defined in RN scope and at most one primitive argument.           |
| [`sous-chef/no-rn-touchable-in-swipeable`](no-rn-touchable-in-swipeable.md) | Controls inside a Swipeable use RNGH's Pressable, not RN-based touchables.                      |
| [`sous-chef/no-legacy-shadow-props`](no-legacy-shadow-props.md)             | Shadows use boxShadow from a theme.shadows step, not the individual shadow\* properties.        |
| [`sous-chef/no-shared-value-assignment`](no-shared-value-assignment.md)     | Write a SharedValue with .set(), never by assigning .value.                                     |
| [`sous-chef/no-as-const`](no-as-const.md)                                   | Let TypeScript infer literal types instead of asserting as const.                               |
| [`sous-chef/no-unused-use-unistyles`](no-unused-use-unistyles.md)           | useUnistyles() is called for its return value.                                                  |
| [`sous-chef/no-combined-unistyles`](no-combined-unistyles.md)               | One element takes one Unistyles style; combine through variants.                                |
| [`sous-chef/no-modal-props-override`](no-modal-props-override.md)           | Do not override onChange or animatedIndex after spreading useStandardBottomSheet's modalProps.  |
| [`sous-chef/no-apollo-react-mock`](no-apollo-react-mock.md)                 | Tests render through the Apollo mock provider instead of mocking @apollo/client/react.          |
| [`sous-chef/no-optimistic-response-cast`](no-optimistic-response-cast.md)   | An optimisticResponse is built from the cache, not a cast { \_\_typename, … } literal.          |
| [`sous-chef/no-unsafe-cast`](no-unsafe-cast.md)                             | No as any, as any[], as unknown, as never, as Record<…>, keyof or translation-key casts.        |
| [`sous-chef/pressable-needs-label`](pressable-needs-label.md)               | A pressable with no text child carries an accessibilityLabel.                                   |
| [`sous-chef/no-bare-in-memory-cache`](no-bare-in-memory-cache.md)           | A suite using the Apollo mock provider builds its cache with makeCache().                       |
| [`sous-chef/no-module-level-t`](no-module-level-t.md)                       | A file that renders translates with the hook's t, not the module-level one.                     |
| [`sous-chef/no-dated-comment`](no-dated-comment.md)                         | A comment describes the code as it is, so it carries no date.                                   |
| [`sous-chef/no-operation-name-literal`](no-operation-name-literal.md)       | An operation name comes from its generated document, not a string.                              |
| [`sous-chef/no-unchecked-domain-literal`](no-unchecked-domain-literal.md)   | A schema enum value or typename is compared and keyed through its generated symbol.             |
| [`sous-chef/no-error-message-branching`](no-error-message-branching.md)     | An error is classified by its code, never by its message text.                                  |
| [`sous-chef/no-rendered-server-message`](no-rendered-server-message.md)     | A server error's `message`, or other copy the server writes, never reaches the screen.          |
| [`sous-chef/testid-from-registry`](testid-from-registry.md)                 | A testID comes from its registry; e2e selects by it, never by fixed copy or a screen point.     |
| [`sous-chef/no-raw-color`](no-raw-color.md)                                 | A colour is a theme token, never a hex, rgb() or named literal.                                 |
| [`sous-chef/no-raw-spacing`](no-raw-spacing.md)                             | Padding, margin and gap are spacing tokens, never a non-zero number.                            |
| [`sous-chef/text-needs-role`](text-needs-role.md)                           | A `<Text>` outside the kit names its role; error copy is `role="error"` + `tone="error"`.       |
| [`sous-chef/quantity-through-formatter`](quantity-through-formatter.md)     | A quantity reaches the screen through formatQuantityForDisplay, never as a raw number.          |
| [`sous-chef/no-rendered-enum`](no-rendered-enum.md)                         | A schema enum value reaches the screen through a translation table, never raw or string-munged. |
| [`sous-chef/no-t-default-value`](no-t-default-value.md)                     | A translation call carries no inline fallback copy: the key resolves in every locale.           |
| [`sous-chef/no-prose-literal`](no-prose-literal.md)                         | Copy handed to the UI through a variable, property, setter or return is translated.             |

## typescript-eslint rules

Type-checked rules the project turns on, each at zero when it was enabled. The
exact options and file scopes are in `eslint/project.js`.

| Rule                                                                          | Scope                                    | What it holds                                                                                                                                                             |
| ----------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `no-explicit-any`                                                             | everywhere                               | No `any`; `sous-chef/no-unsafe-cast` also bans `as any` / `as unknown` / `as never`                                                                                       |
| `no-unsafe-assignment` / `-member-access` / `-call` / `-return` / `-argument` | production `src`                         | No `any` flowing through a value that looks typed                                                                                                                         |
| `no-unnecessary-condition`                                                    | production `src`, minus the ratchet list | A condition the types say cannot matter. The exclusions may only shrink (`scripts/no-unnecessary-condition.*.json`, `__tests__/lint/unnecessaryConditionRatchet.test.ts`) |
| `no-unnecessary-type-assertion`                                               | typed TS                                 | An assertion that changes nothing                                                                                                                                         |
| `consistent-type-assertions`                                                  | production `src`                         | `as` style; object-literal assertions only as a parameter                                                                                                                 |
| `consistent-type-imports` + `no-import-type-side-effects`                     | typed TS                                 | Type-only imports are `import type`                                                                                                                                       |
| `no-floating-promises` / `no-misused-promises`                                | production `src`, tests, e2e             | A promise is awaited, returned, or marked `void`                                                                                                                          |
| `await-thenable`                                                              | production `src`, tests, e2e             | `await` only on a thenable                                                                                                                                                |
| `only-throw-error`                                                            | production `src`                         | Throw an `Error` (Apollo's `ErrorLike` allowed)                                                                                                                           |
| `restrict-template-expressions` / `no-base-to-string`                         | production `src`                         | No `[object Object]` in a string                                                                                                                                          |
| `no-non-null-assertion`                                                       | production `src`                         | No `!`: bind and guard                                                                                                                                                    |
| `switch-exhaustiveness-check`                                                 | production `src`                         | A `switch` over a union handles every member; `default` does not count                                                                                                    |
| `no-unsafe-enum-comparison`                                                   | production `src`                         | An enum is compared with its own members                                                                                                                                  |
| `prefer-nullish-coalescing`                                                   | production `src`                         | `??` over `\|\|` for numbers, booleans and objects (strings exempt: a blank string is a value UI falls back from)                                                         |
| `ban-ts-comment`                                                              | production `src`, tests, e2e             | `@ts-expect-error` only with a description                                                                                                                                |
| `no-deprecated`                                                               | everywhere                               | No deprecated API                                                                                                                                                         |
| `no-shadow` / `no-unused-vars`                                                | everywhere                               | —                                                                                                                                                                         |

## Compiler flags

`strict` (from `@react-native/typescript-config`) plus, in `tsconfig.json`:

| Flag                               | Why                                                                                             |
| ---------------------------------- | ----------------------------------------------------------------------------------------------- |
| `noUncheckedIndexedAccess`         | `arr[0]`, `record[key]` and a regex capture read as `T \| undefined`, so a guard on one is real |
| `noImplicitOverride`               | An overriding method says `override`, so a renamed base method fails the build                  |
| `noFallthroughCasesInSwitch`       | A `case` cannot silently run into the next                                                      |
| `forceConsistentCasingInFileNames` | An import's casing matches the file, as the case-sensitive CI filesystem requires               |

Typed keys and generated symbols carry more than lint does: `t` takes a
`TranslationKey` (`src/i18n/i18next.d.ts`), operation APIs take generated
documents, and testIDs come from `testIDs.ts` registries.
