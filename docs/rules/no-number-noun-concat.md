# `sous-chef/no-number-noun-concat`

A count and its noun are one translated sentence, never a number joined to a string.

## Reports

A number-typed expression (nullish, `false` and `''` members aside), or a number written out by `formatQuantityForDisplay` / `formatQuantityForInput` / `formatQuantityAsFraction` / `formatQuantity` / `formatNumberForInput` / `formatNumber` / `formatDecimal` / `String(n)` / `n.toFixed()` / `toPrecision` / `toLocaleString` / `toString`, when it sits beside a word:

- **after it**, directly or through whitespace only (`{' '}` counts as whitespace): a string-typed expression (`{count} {label}`, `{total} {t('recipes.ingredientsSuffix')}`), or literal text whose first word touches it (`{count} items`, `` `${n} selected` ``);
- **before it**: literal text whose last word touches it (`` `Item ${index}` ``).

Positions checked:

- the children of one JSX element or fragment;
- a template literal or string `+` concatenation that is a JSX child, a copy JSX attribute (`COPY_ATTRIBUTES` in `eslint/i18n.js`), a copy-named object property, a value in a `t(...)` interpolation object, a `toastService` / `alertService` argument, the return of a display-named function (`format*`, `*Label`, `*Text`, …), or a `const` that is copy-named or whose references reach one of those positions.

Conditionals and `??` / `||` on the string side are followed branch by branch, so `firstNonBlank(unit) ?? t('labels.units')` reports for its fallback.

## Use instead

```tsx
<Text>{t('recipes.ingredientCount', { count })}</Text>
// en.json: "ingredientCount_one": "{{count}} ingredient", "ingredientCount_other": "{{count}} ingredients"
```

## Why

`{count} {label}` is wrong three ways: at one it reads "1 ingredients" because a suffix key has no `count` to pick a plural form from; the number-then-noun order is English's, fixed in code where no locale can move it; and the number reaches the screen through string interpolation rather than a formatter. One key holding the whole phrase gives the translation the agreement, the order and the spacing.

## Exempt

- A unit beside a quantity ("1 1/4 cup", "250g", "(5s)"): a string named `unit`, `symbol`, `unitSymbol`, `abbreviation` or `*Unit` / `*Symbol` / `*Abbreviation`; a property of a `unit` / `*Unit` holder (`item.displayUnit.name`); a call named with `Unit` or `Symbol` (`getUnitDisplayText(unit)`) or whose arguments are all unit references; literal text whose touching word is an SI or measurement symbol (`g`, `kg`, `mL`, `L`, `oz`, `lb`, `kcal`, `ms`, `s`, `min`, `h`, `MB`, `x`, …).
- A date, time or money string: a name matching `date|time|month|weekday` or `currency`, or `money` / `formatMoney` / `formatCurrency` / `formatPrice`.
- Separators and symbols: text whose touching character is not a letter (`·`, `/`, `:`, `%`, `×`, `•`).
- A translated prefix before a number (`{t('restockItem.newQuantityPrefix')}{n}`): its key carries its own punctuation, which types cannot see.
- Two numbers, and a `ReactNode` that may be an element.
- Text only a developer reads: logger, telemetry and `Error` arguments, and a `const` whose references reach only those.
- A template in a non-copy position: a `key`, a `testID`, a cache id.
- Files without type information.

Source: [`eslint/plugin/rules/no-number-noun-concat.js`](../../eslint/plugin/rules/no-number-noun-concat.js) · spec: [`__tests__/lint/rules/no-number-noun-concat.test.ts`](../../__tests__/lint/rules/no-number-noun-concat.test.ts)
