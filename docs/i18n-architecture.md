# i18n — how translation is wired, and what was decided

Measured and decided 2026-08-17. The question that started it: why do hardcoded
strings keep slipping through five separate sweeps.

## How to translate

Two ways, differing only by whether you are in a component:

```ts
import { useTranslation } from '#/i18n';   // components and hooks
const { t } = useTranslation();

import { t } from '#/i18n';                // module scope: services, utilities,
                                           // mutation onError handlers
```

The module-scope `t` does **not** subscribe to language changes. A
`no-restricted-syntax` rule enforces the hook in any `src/**/*.tsx`; a file that
genuinely needs the module-scope one (a class component like `ErrorBoundary`, or
module-level config) imports it aliased as `tGlobal`, which makes a bare `t(...)`
in JSX unambiguously the hook's.

Both are `TranslateFn` (`src/i18n/types.ts`) when passed across a function
boundary. Both take i18next's full options — `t('key', { count })`,
`t('key', 'English fallback')`.

## What changed, and why

**There used to be four idioms**, and nine files used two of them at once
depending on whether the string had a variable in it:

```ts
const { t } = useTranslation()        // react-i18next
t('key')            from '#/i18n/t'   // module scope, no options
getI18n().t('key', { count })         // module scope, when options were needed
import { t as tGlobal }               // components needing module scope
```

The third existed because the second could not pass options — 25 call sites
across 15 files routed around the helper. 370 files were repointed at one entry
point.

**The old `t()` helper is gone.** It reimplemented key-echo, string fallback and
`fallbackLng`, all of which i18next does natively — verified against the
installed `i18next@26` rather than taken from the comment that claimed
otherwise:

```
t('missing.key')                 -> "missing.key"      // key echo is native
t('missing', 'String fallback')  -> "String fallback"  // string fallback is native
t('only.en')                     -> "English only"     // fallbackLng is native
t('greet', { name: 'Ada' })      -> "Hola Ada"         // interpolation
```

Its hand-rolled `fallbackLng` chain existed only to repair a bug its own
resource-peek had introduced. The one behaviour it had that the standard API does
not: for a key naming an object node (`t('errors')`), i18next returns
`"key 'errors (en)' returned an object instead of string."` and `defaultValue`
does not override it. Both render visibly-wrong text for what is a bug at the
call site; i18next's version names the problem.

**A stale-language render was fixed.** `CollaboratorPermissionsBottomSheet`
rendered 8 labels through the module-level `t`, so they kept the old language
until something unrelated re-rendered the sheet. The lint rule above now makes
that shape impossible.

## Why the sweeps kept finding more

`i18next/no-literal-string` runs in `jsx-only` mode and sees a **literal in
JSX**. It cannot see this:

```tsx
const label = isLow ? 'Running low' : 'In stock';
<Text>{label}</Text>
```

Shapes are open-ended; sinks are not. Every `<Text>` child in `src/**/*.tsx`,
parsed with the TypeScript AST (471 files, 1305 children):

| how the child arrives | count | share | visible to a scanner? |
| --- | ---: | ---: | --- |
| `{t('key')}` | 601 | 46.1% | n/a — already correct |
| `{identifier}` | 292 | 22.4% | **no** |
| `{obj.field}` | 141 | 10.8% | **no** |
| `{cond ? a : b}` | 118 | 9.0% | **no** |
| literal | 73 | 5.6% | yes |
| `{fn(x)}` | 62 | 4.8% | **no** |
| template / nested / other | 18 | 1.4% | partly |

**The 73 literals are not the problem** — nearly all are punctuation and
separators (`•`, `×`, `/`, `$`, `{' '}`) plus the product name. The lint rule is
correctly allowing them. It is doing its job; its job is just too small.

**36% of the sink is invisible to it.** And the top identifiers are `{title}` 46,
`{label}` 30, `{subtitle}` 13, `{message}` 11 — component **props**. The string
was decided levels up; the `<Text>` only renders it.

## Approach considered and rejected: branding the sink

A nominal `Translated` type, produced only by `t()` and a few named escape
hatches, required by components that render copy. Prototyped, measured, then
removed.

It works, and it is cheap to typecheck — **+64 type instantiations out of 1.82M
(0.0035%), check time unchanged**. That number matters on its own, because
`src/i18n/types.ts` had recorded branded types as "too costly" by conflating them
with typed *keys* (`ParseKeys`), which builds a giant union from the whole
resource tree and genuinely is expensive. They are different techniques with
opposite cost profiles and must not be rejected together.

**Rejected anyway**, on 2026-08-17, because it is not how this problem is solved
in practice. It requires every component that renders copy to change its prop
types (712 errors across 257 files if applied at once), and it asks every
contributor to reason about a type distinction that most codebases do not have.
The migration would have been incremental — branding a component's props enforces
at its callers without `Text` being branded, so the build stays green throughout —
but the ongoing cost lands on everyone writing code, forever.

**The mainstream answer, for whenever this is picked up again, is
pseudolocalization**: run the app in a locale that visibly mangles every
translated string, so anything still rendering in plain English did not go
through `t()`. It catches the variable case exactly, needs no source changes and
no discipline, and composes with `e2e/tests/ui-tour.e2e.ts`, which already
screenshots every surface. It also catches layout breakage from longer
translations, which nothing here checks today. Not implemented — out of scope as
a new capability.

## Bugs the prototype surfaced before it was removed

Kept, because they are real:

- **`count: location.currentItemCount`** where the value is `number | null |
  undefined` (`StorageLocationCard`). i18next picks the plural form from `count`;
  a non-number silently lands on the wrong one. The prop was declared nullable
  even though the schema has `currentItemCount: Int!`. **Fixed.**

Found and *not* fixed, left as known issues:

- **4 sites rendering `usageError?.message`** directly to the user
  (`PantryAnalyticsTabs`) — a raw Apollo/server error string, in English, in
  every locale.
- **`(x ?? 0).toFixed(1)` reaching the UI** — not locale-aware, so it bypasses
  the locale-aware formatting added under task 2.5 and shows a dot to
  comma-decimal locales.
- **A home's name pushed into an option list beside translated labels**
  (`CreateMealPlanScreen`) — user content and copy in one array, indistinguishable.

## Copy rules, and why each one exists

The one-line versions live in CLAUDE.md; this is the mechanism and history.

**Shared copy has one home.** `errors.*`, `empty.*` and `labels.*` are
canonical; no namespace — feature or canonical — may redeclare a string another
already has. The guard (`__tests__/i18n/canonicalVocabulary.test.ts`) used to
ask whether a string LOOKED like error or empty-state copy, which meant 323 of
329 duplicate groups were never inspected: `Home`, `Item` and `Try Again` match
none of those patterns, and all three had drifted into two translations by the
time anyone looked. It now inspects every string that is more than one
character and contains a letter, with an exemption list where each entry names
its exact key set and must still describe a live duplicate.

Two duplicates are not duplicates, and one is:

- **Runtime-composed keys.** A key under `usagePurpose.*`, `errors.codes.*`,
  `commonValidation.*`, `recipes.diet.*` or `${keyPrefix}.${suffix}` only
  exists once the enum value or prefix is substituted in, so no call site names
  it and nothing can be re-pointed at it. Two of them holding the same string
  is not collapsible — both must exist for their own lookup to resolve.
  `enumKeyCoverage.test.ts` and `composedKeyNamespaces.test.ts` keep those
  namespaces complete. **Adding a suffix to `alertMutationFailure` means adding
  it to `ALERT_SUFFIXES` in both places** — `rateLimitedTitle` was missing from
  one, and a key sweep removed three live keys with nothing failing until a
  hook test did.
- **One English word, two grammatical roles.** `Default` is *Predeterminado* or
  *Predeterminada* depending on the noun; `Invite` is *Invitación* (the thing)
  or *Invitar* (the button); `Back` is *Atrás* (direction) or *Reverso* (of a
  package). Collapsing those makes one context ungrammatical. They go in
  `INTENTIONAL` with the variants named — a fact about the language belongs in
  the key, never in a runtime parameter.
- **Everything else is drift and collapses.** If two keys hold the same English
  for the same concept, they will eventually hold different Spanish.

**Never concatenate a number with a translated noun.**

```ts
`${count} ${t('recipes.ingredientsSuffix')}`; // ✗ "1 ingredients"
t('recipes.ingredientCount', { count }); // ✓
```

Concatenation loses plural agreement, bakes English word order into code, and
skips locale number formatting. Give each plural form its own whole sentence.
`__tests__/i18n/numberNounConcatenation.test.ts` enforces it, and also bans
appending a literal `'s'` — that shape produced "2 lattinas" in Italian and
"2 kgs" in English.

**Plural categories are derived, not hand-written.** `completePluralCategories`
in `src/i18n/config.ts` fills any CLDR category a locale needs but its JSON
lacks, from `_other`, before `init`. A missing category is not graceful
degradation: i18next falls through to `fallbackLng`, not to the locale's own
`_other` — mechanism and probe in
[verified-library-behaviour.md](verified-library-behaviour.md#i18next-plural-category-fallback).
Spanish and Italian need `many`; nothing this app counts reaches it, so
hand-written `_many` strings would never have rendered.
`__tests__/i18n/pluralCategories.test.ts` asks `Intl.PluralRules` which
categories each locale needs rather than hardcoding one/other, so a locale
added later is checked for whatever IT needs.

**Never inflect copy for the reader's gender.** The app does not know it, does
not ask, and in a two-gender language there is no correct form for a non-binary
person — so a `context` parameter cannot be right, only less often wrong. Use a
construction with no gendered slot; every locale here has one:

```
it  "Sei sicuro di voler X?"   ->  "Vuoi davvero X?"
sq  "Je i sigurt që do ta X?"  ->  "Vërtet dëshiron ta X?"
es  "¡Bienvenido a X!"         ->  "¡Te damos la bienvenida a X!"
```

Enforced by `__tests__/i18n/addresseeGender.test.ts`. This is about the
ADDRESSEE only — an adjective agreeing with a **noun** is correct and lives in
per-context keys (`labels.default` → `Predeterminado`,
`storageLocationCard.default` → `Predeterminada`); that is the
grammatical-role case above.

## Guards that exist today

| guard | catches |
| --- | --- |
| `i18next/no-literal-string` (jsx-only) | literals in JSX text and copy-carrying attributes |
| `no-restricted-syntax` selectors | untranslated text reaching `alertService` / `toastService` |
| `no-restricted-syntax` on `#/i18n` `t` | module-scope `t` used where a component renders |
| `__tests__/i18n/keysExist.test.ts` | keys that do not exist in `en.json` |
| `__tests__/i18n/localeParity.test.ts` | keys missing from a locale |
| `__tests__/i18n/moduleLevelCopyTables.test.ts` | copy held in module-level tables |
| `__tests__/i18n/canonicalVocabulary.test.ts` | the same string declared in two namespaces (drift) |
| `__tests__/i18n/numberNounConcatenation.test.ts` | `${count} ${t('noun')}` shapes and literal `'s'` appends |
| `__tests__/i18n/pluralCategories.test.ts` | a locale missing a CLDR plural category it needs |
| `__tests__/i18n/addresseeGender.test.ts` | copy inflected for the reader's gender |
| `__tests__/i18n/enumKeyCoverage.test.ts` + `composedKeyNamespaces.test.ts` | runtime-composed key namespaces with holes |

None of them proves completeness. A string reaching JSX through a variable is
invisible to all of them — that is the gap pseudolocalization would close.
