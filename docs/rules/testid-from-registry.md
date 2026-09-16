# `sous-chef/testid-from-registry`

A testID comes from its feature registry, never a string, template or regex literal; e2e selects app controls by that id, never by fixed copy or a screen point.

## Reports

- A JSX `testID`, `testIDPrefix` or `*TestID` prop whose value is a string or template literal, looking through `a ? b : c` and `a || b`.
- An object property of the same names (a sheet config's `testIDPrefix`, a swipe action's `testID`).
- A Detox `by.id(…)` argument that is a string, template or regex literal.
- A Detox `by.text(…)` or `by.label(…)` argument that is a fixed string (a string literal or a template with no expressions), looking through `a ? b : c` and `a || b`.
- A tap at a screen point: `.tap({ x, y })` / `.longPress({ x, y })`, `tapAtPoint(…)`, `device.tap(…)` and `device.longPress(…)`.

## Use instead

Each feature declares its ids once in `src/features/<name>/testIDs.ts`; shared components in `src/components/testIDs.ts`. Both the app and the e2e page objects import them:

```ts
// app
<TextInput testID={authTestIDs.emailInput} />
<Row testID={kitTestIDs.swipeAction(shoppingListTestIDs.itemRow(item.id), action.key)} />

// e2e/screens/LoginScreen.ts
import { authTestIDs } from '../../src/features/auth/testIDs';
await element(by.id(authTestIDs.emailInput)).typeText(email);
```

A control that renders copy is tapped by its id, and asserted wording goes through `toHaveText` on an id, resolved with `e2e/helpers/i18n.ts`:

```ts
await element(by.id(kitTestIDs.spotlightSkipButton)).tap(); // not by.text('Skip all')
await waitFor(element(by.id(barcodeTestIDs.productEditActionLabel)))
  .toHaveText(t('labels.suggestEdit'))
  .withTimeout(10000);
```

A composed id is a builder in the registry that owns the pattern (`kitTestIDs.filterTab(prefix, tabId)`); a regex selector is a builder returning a `RegExp`. A registry has **no imports**: Detox's Jest reads it by relative path, outside the app's `#` aliases.

## Why

A spelled id drifts between the app and the page objects, and the mismatch surfaces only as a Detox timeout, minutes into a device run, with no hint the id was wrong. Imported from one file, a renamed or misspelled id fails the typecheck, which compiles e2e too.

Fixed copy fails the same way for a different reason: it matches only the English build, breaks on a rewording, and matches every other element carrying that string. A screen point depends on the layout, the font scale and whether the keyboard is up, and a miss taps something else without an error.

## Exempt

Unit tests (`__tests__`, `*.test.tsx`), which query the rendered tree by the ids they assert. `by.text(variable)`, for data the spec itself entered (an item name it typed). `by.system.label(…)`, which reaches an OS alert outside the app's view tree. A point held in a variable (`.tap(point)`) is not detected.

Source: [`eslint/plugin/rules/testid-from-registry.js`](../../eslint/plugin/rules/testid-from-registry.js) · spec: [`__tests__/lint/rules/testid-from-registry.test.ts`](../../__tests__/lint/rules/testid-from-registry.test.ts)
