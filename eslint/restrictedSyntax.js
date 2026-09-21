/**
 * `no-restricted-syntax`, shared rather than duplicated: a config object that
 * sets the rule replaces its entries, so an override retyping a shorter list
 * silently un-bans the rest. `restrictedSyntax({ allow })` makes an override
 * name what it drops; `__tests__/lint/restrictedSyntaxAreNotDropped.test.ts`
 * holds that. Each entry's `id` is config-only and is stripped before ESLint
 * sees it — the rule's own schema rejects an unknown property.
 */

const PRODUCTION_SYNTAX = [
  {
    id: 'parseFloat',
    selector:
      "CallExpression[callee.name='parseFloat'], CallExpression[callee.property.name='parseFloat']",
    message:
      'Use parseDecimalInput from #/utils/parseDecimalInput instead of parseFloat. parseFloat reads "4,99" as 4 on any device whose keyboard offers a comma, silently saving a wrong number. If this value is machine-generated and never typed, both behave identically — so use parseDecimalInput regardless.',
  },
  {
    id: 'inlineImportType',
    selector: 'TSImportType',
    message:
      'Avoid inline import() types. Import the type at the top of the file instead.',
  },
  {
    id: 'imperativeSheet',
    selector:
      "CallExpression[callee.property.name=/^(present|dismiss)$/][arguments.length=0]:not([callee.object.name='Keyboard'])",
    message:
      'Drive a sheet with the `visible` prop through `Sheet` / `useStandardBottomSheet`, not `present()` / `dismiss()`. Calling `dismiss()` on a modal that was never presented wedges it closed for the rest of the session — the hook guards that, a raw ref does not.',
  },
  {
    id: 'maxFontSizeMultiplier',
    selector: "JSXAttribute[name.name='maxFontSizeMultiplier']",
    message:
      'The font-scale ceiling is global — `MAX_FONT_SCALE` in #/theme/foundations/type, applied in the `Text` atom as `theme.maxFontScaleMultiplier`. A per-element cap bounds the OS scale only, leaving its product with the app preference unbounded.',
  },
  {
    id: 'allowFontScaling',
    selector:
      "JSXAttribute[name.name='allowFontScaling'][value.expression.value=false]",
    message:
      'Never disable font scaling — every role must respond to the OS text-size setting. If the layout cannot take the largest size, give the text room or fewer glyphs; the combined ceiling already bounds how far it grows.',
  },
  {
    id: 'handRolledSearch',
    selector:
      "CallExpression[callee.property.name='filter'] CallExpression[callee.property.name='includes'][callee.object.callee.property.name='toLowerCase']",
    message:
      'Use filterByTerm / matchesTerm from #hooks/search/useLocalSearch for a list search, or searchUtils for the fuzzy variant. A hand-rolled filter re-decides what an empty term, a null field and whitespace mean.',
  },
  {
    id: 'borderWidthLiteral',
    selector:
      "Property[key.name=/^border(Top|Bottom|Left|Right|Start|End)?Width$/][value.type='Literal'][value.raw=/^[0-9]/]",
    message:
      'Use a named step of `theme.borderWidth` (none | hairline | thin | medium | thick | heavy) rather than a literal. A literal is a width the theme cannot change.',
  },
  {
    id: 'toastLiteral',
    selector:
      'CallExpression[callee.object.name=/^(toastService|alertService)$/] > Literal[value=/[A-Za-z]{3}/]',
    message:
      'Untranslated string passed to a user-facing toast/alert. Add a key to src/i18n/locales/en.json and pass t(...) — the module-level `t` from #/i18n works outside components.',
  },
  {
    id: 'toastServerMessage',
    selector:
      "CallExpression[callee.object.name=/^(toastService|alertService)$/] MemberExpression[property.name='message']",
    message:
      "Never display a server `message`. Settle the write with `settleMutation` (`present: 'none'` when you show it yourself) and show `failure.body` — it resolves the refused field, then the error code, then your localized fallback.",
  },
  {
    id: 'toastTemplateLiteral',
    selector:
      'CallExpression[callee.object.name=/^(toastService|alertService)$/] > TemplateLiteral',
    message:
      'Template literal passed to a user-facing toast/alert. Interpolate through i18next instead — t(key, { name }) — so the sentence stays reorderable, and use _one/_other keys for counts rather than appending an "s".',
  },
  {
    id: 'scheduleOnRNInlineCallback',
    selector:
      'CallExpression[callee.name="scheduleOnRN"] > :matches(ArrowFunctionExpression, FunctionExpression)',
    message:
      'Do not pass inline functions to scheduleOnRN — define the callback in RN runtime scope first. Inline functions inside worklets cause native crashes on Android.',
  },
  {
    id: 'scheduleOnRNTooManyArguments',
    selector: 'CallExpression[callee.name="scheduleOnRN"][arguments.2]',
    message:
      'scheduleOnRN should have at most 2 arguments (function + one primitive). Functions cannot be serialized across the worklet boundary — capture them via RN-scope closure instead.',
  },
  {
    id: 'rnTouchableInSwipeable',
    selector:
      'JSXElement[openingElement.name.name=/^(SwipeableItem|ReanimatedSwipeable)$/] JSXElement[openingElement.name.name=/^(AppPressable|PressableScale|TouchableOpacity|TouchableHighlight|TouchableWithoutFeedback|TouchableNativeFeedback)$/]',
    message:
      "Interactive controls inside a Swipeable must use RNGH's Pressable (`import { Pressable } from 'react-native-gesture-handler'`), not AppPressable/PressableScale/Touchable*. RN touchables don't coordinate with RNGH's gesture arena — they block the swipe or double-fire the row's onPress.",
  },
  {
    id: 'legacyShadowProp',
    selector:
      ':matches(Property[key.name="shadowColor"], Property[key.name="shadowOffset"], Property[key.name="shadowOpacity"], Property[key.name="shadowRadius"])',
    message:
      'Use CSS boxShadow syntax instead of individual shadow properties. Elevation is a step of theme.shadows (src/theme/foundations/shadows.ts).',
  },
  {
    id: 'sharedValueAssignment',
    selector:
      'AssignmentExpression[left.type="MemberExpression"][left.property.name="value"]',
    message:
      'Use .set() instead of .value assignment for SharedValues (React Compiler compatibility). If this is not a SharedValue, refactor to avoid .value mutation.',
  },
  {
    id: 'asConst',
    selector:
      'TSAsExpression[typeAnnotation.type="TSTypeReference"][typeAnnotation.typeName.name="const"]',
    message:
      'Avoid `as const` — let TypeScript infer literal types naturally. Use `as const` only for union type derivation or discriminated unions.',
  },
  {
    id: 'unusedUseUnistyles',
    selector:
      'ExpressionStatement > CallExpression[callee.name="useUnistyles"]',
    message:
      'useUnistyles() called without using its return value has no effect. Destructure what you need: `const { theme } = useUnistyles()`.',
  },
  {
    id: 'combinedUnistyles',
    selector:
      'ArrayExpression > MemberExpression[object.name="styles"] ~ MemberExpression[object.name="styles"]',
    message:
      "Avoid combining multiple `styles.*` on the same element — Unistyles v3 proxies break when spread by reanimated's StyleSheet.flatten(). Use `styles.useVariants()` instead.",
  },
  {
    id: 'modalPropsOverride',
    selector:
      "JSXSpreadAttribute[argument.name='modalProps'] ~ JSXAttribute[name.name=/^(onChange|animatedIndex)$/]",
    message:
      "Do not override `onChange` or `animatedIndex` after `{...modalProps}` — useStandardBottomSheet supplies both: a composed onChange (drives the global backdrop claim) and the animatedIndex SharedValue (drives backdrop opacity in lockstep with the sheet). Overriding either silently breaks the dim layer. Forward via the hook's options API: `useStandardBottomSheet({ ..., onChange: handler })`.",
  },
  {
    id: 'optimisticResponseCast',
    selector:
      'Property[key.name="optimisticResponse"] TSAsExpression > ObjectExpression:has(Property[key.name="__typename"])',
    message:
      'Do not hand-roll an optimistic response and assert its shape. Build it from `cache.readFragment` plus a spread, so a field the query reads cannot go missing. (`@typescript-eslint/consistent-type-assertions` reports this too on production source; this entry carries it into __mocks__ and __perf__.)',
  },
  {
    id: 'missingPressableLabel',
    selector:
      'JSXElement[openingElement.name.name=/^(AppPressable|Pressable|PressableScale|TouchableOpacity|TouchableHighlight)$/]:has(JSXOpeningElement > JSXAttribute[name.name="onPress"]):not(:has(JSXOpeningElement > JSXAttribute[name.name=/^(accessibilityLabel|aria-label|accessible)$/])):not(:has(JSXElement > JSXExpressionContainer)):not(:has(JSXElement[openingElement.name.name=/Text$/])):not(:has(JSXElement[openingElement.name.property.name="Text"])):not(:has(JSXText[value=/\\S/]))',
    message:
      'A control with no text child needs an `accessibilityLabel` — a screen reader announces it as "button" and nothing else. Give it a label, put a `<Text>` in it, or mark it `accessible={false}` if it is decorative.',
  },
  {
    id: 'callerFallbackAfterResolver',
    selector:
      'LogicalExpression[operator=/^(\\|\\||\\?\\?)$/] > CallExpression.left[callee.name="localizedErrorMessage"]',
    message:
      "Pass the caller's copy INTO `localizedErrorMessage(err, fallback)`, not after it. The resolver always returns a non-empty string, so copy behind `||` or `??` is unreachable — and the resolver never saw the fallback you meant it to use.",
  },
  {
    id: 'asUnknown',
    selector: 'TSAsExpression[typeAnnotation.type="TSUnknownKeyword"]',
    message:
      'Do not use `as unknown` (typically the `x as unknown as T` double-cast) — it fully defeats type checking. Fix the data flow, or widen the type where it is declared.',
  },
  {
    id: 'asNever',
    selector: 'TSAsExpression[typeAnnotation.type="TSNeverKeyword"]',
    message:
      'Do not cast with `as never` — `never` is assignable to every type, so this switches type checking off exactly like `as any`. Delete the hand-written or `unknown` type that forced it so the real type is inferred, or widen the parameter where it is declared.',
  },
  {
    id: 'asRecord',
    selector:
      'TSAsExpression[typeAnnotation.type="TSTypeReference"][typeAnnotation.typeName.name="Record"]',
    message:
      'Do not cast to `Record<…>` — it asserts a shape instead of proving it. Narrow with a type guard (`typeof x === "object" && x !== null`), infer from the source, or declare the type where the value is declared.',
  },
  {
    id: 'asKeyof',
    selector: [
      'TSAsExpression > TSTypeOperator.typeAnnotation[operator="keyof"]',
      'TSAsExpression > TSArrayType.typeAnnotation > TSTypeOperator[operator="keyof"]',
      'TSAsExpression > TSTypeOperator.typeAnnotation[operator="readonly"] > TSArrayType > TSTypeOperator[operator="keyof"]',
      'TSAsExpression > TSTypeReference.typeAnnotation > TSTypeParameterInstantiation > TSTypeOperator[operator="keyof"]',
    ].join(', '),
    message:
      'Do not cast a string to a key with `as keyof …` — it indexes with a key the object may not have, and the read comes back `undefined` under a type that says it cannot. Narrow the key first (`isOwnKey(obj, key)` from `#utils/isOwnKey`, or `key in obj`), iterate a typed list of the keys, or type the key where it is declared.',
  },
  {
    id: 'asTranslationKey',
    selector:
      'TSAsExpression[typeAnnotation.type="TSTypeReference"][typeAnnotation.typeName.name=/^(TranslationKey|ParseKeys)$/]',
    message:
      'Do not cast a string to a translation key — it compiles a key the copy may not declare, which renders as a raw dot-path. Type the field that stores the key `TranslationKey` where it is declared, or check a key built from runtime data with `isTranslationKey` from `#/i18n`.',
  },
];

// Test-suite hygiene. A separate list because the production entries are off
// for tests, and one rule id cannot carry both sets.
const TEST_SYNTAX = [
  {
    id: 'typenameAsConst',
    selector:
      "Property[key.name='__typename'] > TSAsExpression > TSTypeReference[typeName.name='const']",
    message:
      "Do not assert `__typename` with `as const`. Annotate the fixture with its document's type instead — `MockDataFor<typeof XDocument>`, `QueryDataFor<typeof XDocument>` or the generated fragment — which narrows every `__typename` inside it AND fails when the selection gains a field the fixture omits.",
  },
  {
    id: 'apolloReactMock',
    selector:
      'CallExpression[callee.object.name="jest"][callee.property.name="mock"][arguments.0.value="@apollo/client/react"]',
    message:
      'Use renderHookWithApollo / renderWithApollo from __tests__/helpers/apolloMockProvider.tsx instead. Direct jest.mock of @apollo/client/react couples tests to operation names, bypasses the real cache, and breaks under refactors.',
  },
  {
    id: 'bareInMemoryCache',
    selector:
      'Program:has(ImportDeclaration[source.value=/apolloMockProvider$/]) NewExpression[callee.name="InMemoryCache"]',
    message:
      'Use makeCache() from __tests__/helpers/apolloMockProvider (or let renderWithApollo build it). A bare InMemoryCache has no type policies and no possibleTypes, so the suite exercises a cache the app never runs.',
  },
];

const entries = (list, allow, add) => [
  'error',
  ...list
    .filter(entry => !allow.includes(entry.id))
    .map(({ id, ...rest }) => rest),
  ...add,
];

/** `allow`: ids to drop. `add`: extra `{ selector, message }` entries. */
const restrictedSyntax = ({ allow = [], add = [] } = {}) =>
  entries(PRODUCTION_SYNTAX, allow, add);

/** The test-only set; production entries do not apply to test files. */
const restrictedSyntaxForTests = ({ allow = [], add = [] } = {}) =>
  entries(TEST_SYNTAX, allow, add);

module.exports = {
  restrictedSyntax,
  restrictedSyntaxForTests,
  PRODUCTION_SYNTAX,
  TEST_SYNTAX,
};
