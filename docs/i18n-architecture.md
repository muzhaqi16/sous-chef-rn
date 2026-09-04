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

## Right-to-left: the cost, recorded

The four shipped locales (en, es, it, sq) are all left-to-right, so nothing in
the app has ever been laid out for RTL. This section records what adding one
would cost, so the decision is made against a number rather than an impression.
**No migration is planned; do not treat this as a worklist.**

| what | count | why it matters |
| --- | --- | --- |
| `marginLeft` / `marginRight` | 124 | a physical edge; RTL wants `marginStart`/`marginEnd` |
| `paddingLeft` / `paddingRight` | 14 | same |
| absolute `left:` / `right:` | 61 | positioned chrome — badges, close buttons, overlay handles |
| `textAlign: 'left' \| 'right'` | 2 | `'auto'` follows the writing direction |
| `marginStart` / `marginEnd` etc. | 0 | nothing uses the logical properties today |
| `I18nManager` references | 0 | the direction is never read, so nothing branches on it |

Two things the numbers do not show, and which dominate the real cost:

- **Icons that encode direction.** A back chevron, a disclosure arrow and a
  progress indicator all have to mirror; a play button and a logo must not.
  Nothing in the tree distinguishes them today.
- **Gestures.** Swipe-to-delete opens from the trailing edge, which flips.
  `SwipeableItem`'s `leftActions`/`rightActions` are named for physical sides,
  so the descriptors themselves would need renaming to leading/trailing —
  and that name reaches `BaseItemCard`, `ItemCard` and `ItemList`.

The honest order if it is ever taken on: rename the swipe descriptors to
leading/trailing first (it is the one API change), then codemod the 138 margin
and padding sites to the logical properties, then audit the 61 absolute
positions by hand, then the icons. The `textAlign` pair and `I18nManager`
plumbing are an afternoon; the icons are not.
