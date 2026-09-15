# `sous-chef/quantity-through-formatter`

A quantity reaches the screen through formatQuantityForDisplay, never as a raw number.

## Reports

An expression typed `number` (nullish members aside) whose identifier or property name matches `/quantity|amount|qty/i`, when it lands in:

- a JSX child: `<Text>{item.quantity} {unit}</Text>`;
- a template literal or string concatenation that is a JSX child or a string-typed JSX attribute: `value={`${item.minQuantity} ${unit.name}`}`;
- a value in a `t(...)` interpolation object: `t('remaining', { quantity: item.quantity })`.

Logical, conditional and arithmetic operands are followed, so `{item.minQuantity ?? 0}` and `-{qty * 2}` report too.

## Use instead

```tsx
<QuantityDisplay quantity={item.quantity} displayAsFraction={item.unit.displayAsFraction} unitSymbol={item.unit.symbol} />
<Text>{formatQuantityForDisplay(item.quantity)} {unit.symbol}</Text>
t('remaining', { quantity: formatQuantityForDisplay(item.quantity), unit })
formatQuantityDisplay(unit.totalQuantity, unit.unitSymbol) // g→kg, mL→L
```

All from `#/utils/formatQuantity`; `resolveQuantityNotation(displayFormat, displayAsFraction)` picks the notation where a string is needed and the item or unit carries it.

## Why

A stored quantity is a float: the API echoes 1/3 back as `0.33333334`, and a converted recipe line reads `177.441`. The formatter writes a cooking fraction where one fits ("1 1/4 cup") and at most three decimals otherwise. The import ban on `fraction.js` stops a second formatter; it cannot stop no formatter at all.

## Exempt

- Any call result, the formatter's or not: the rule cannot tell a formatter from another function, so it trusts calls.
- A number-typed JSX attribute (`quantity={item.quantity}`): it is handed to a component, not shown.
- The left side of `&&`: a guard, not text.
- The `count` key of a `t(...)` call: i18next picks the plural form from it, so it stays a number.
- Money (`price`, `cost`) and counts named otherwise: the name decides.
- A quantity that reaches JSX through an intermediate variable or a number-typed prop the child renders raw: review's.
- Test files and files without type information.

Source: [`eslint/plugin/rules/quantity-through-formatter.js`](../../eslint/plugin/rules/quantity-through-formatter.js) · spec: [`__tests__/lint/rules/quantity-through-formatter.test.ts`](../../__tests__/lint/rules/quantity-through-formatter.test.ts)
