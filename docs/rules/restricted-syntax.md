# `no-restricted-syntax` entries

Bans that are a single esquery selector carry no logic beyond matching, so they
are entries of the stock `no-restricted-syntax` rule rather than rules of their
own. They live in [`eslint/restrictedSyntax.js`](../../eslint/restrictedSyntax.js).

Two things follow from that rule being a single id:

- **An override replaces the whole list.** A block that retypes
  `no-restricted-syntax` un-bans everything it leaves out, so overrides call
  `restrictedSyntax({ allow: [...] })` and name what they drop.
  `__tests__/lint/restrictedSyntaxAreNotDropped.test.ts` holds that.
- **Production and test entries are separate lists.** The production set is off
  for tests, and one id cannot carry both; test files get
  `restrictedSyntaxForTests()`.

Each entry's `id` is config-only — the rule's schema rejects an unknown
property, so the helper strips it before ESLint sees the entry.
`__tests__/lint/restrictedSyntaxEntries.test.ts` lints a fixture per id.

## Production entries

| Id                             | Bans                                                                        |
| ------------------------------ | --------------------------------------------------------------------------- |
| `parseFloat`                   | `parseFloat` / `Number.parseFloat`; use `parseDecimalInput`.                |
| `inlineImportType`             | An inline `import('…').T` type.                                             |
| `imperativeSheet`              | Zero-argument `present()` / `dismiss()` on a sheet ref.                     |
| `maxFontSizeMultiplier`        | A per-element font-scale cap.                                               |
| `allowFontScaling`             | `allowFontScaling={false}`.                                                 |
| `handRolledSearch`             | `.filter(… .toLowerCase().includes(…))`.                                    |
| `borderWidthLiteral`           | A numeric literal on any `border*Width`.                                    |
| `toastLiteral`                 | An untranslated string into `toastService` / `alertService`.                |
| `toastServerMessage`           | A server `message` into either service.                                     |
| `toastTemplateLiteral`         | A template literal into either service.                                     |
| `scheduleOnRNInlineCallback`   | An inline function passed to `scheduleOnRN`.                                |
| `scheduleOnRNTooManyArguments` | A third argument to `scheduleOnRN`.                                         |
| `rnTouchableInSwipeable`       | An RN-based touchable inside a `Swipeable`.                                 |
| `legacyShadowProp`             | `shadowColor` / `shadowOffset` / `shadowOpacity` / `shadowRadius`.          |
| `sharedValueAssignment`        | Writing a SharedValue with `.value =` instead of `.set()`.                  |
| `asConst`                      | `as const`.                                                                 |
| `unusedUseUnistyles`           | `useUnistyles()` as a bare statement.                                       |
| `combinedUnistyles`            | Two sibling `styles.*` in one style array.                                  |
| `modalPropsOverride`           | `onChange` / `animatedIndex` after `{...modalProps}`.                       |
| `optimisticResponseCast`       | A hand-rolled, asserted `optimisticResponse` literal.                       |
| `missingPressableLabel`        | A pressable with no text child and no `accessibilityLabel`.                 |
| `asUnknown`                    | `as unknown`, typically the `x as unknown as T` double cast.                |
| `asNever`                      | `as never`.                                                                 |
| `asRecord`                     | `as Record<…>`.                                                             |
| `asKeyof`                      | `as keyof …`, and a key list asserted as `(keyof …)[]` or `Array<keyof …>`. |
| `asTranslationKey`             | `as TranslationKey` / `as ParseKeys`.                                       |

`as any` and `as any[]` are not here: `@typescript-eslint/no-explicit-any`
reports the `any` itself, everywhere. `optimisticResponseCast` overlaps
`@typescript-eslint/consistent-type-assertions` on production source and exists
to carry the ban into `__mocks__` and `__perf__`, which the type-aware block
does not lint.

## Test-only entries

| Id                  | Bans                                                                  |
| ------------------- | --------------------------------------------------------------------- |
| `apolloReactMock`   | `jest.mock('@apollo/client/react')`.                                  |
| `bareInMemoryCache` | `new InMemoryCache()` in a suite that imports the Apollo mock helper. |
| `typenameAsConst`   | `__typename: 'X' as const` in place of typing the fixture.            |

## Exemptions

A file-scoped override in `eslint/project.js`, never a disable comment:

| Files                             | Allows            |
| --------------------------------- | ----------------- |
| `src/utils/parseDecimalInput.ts`  | `parseFloat`      |
| The bottom-sheet hooks and owners | `imperativeSheet` |
