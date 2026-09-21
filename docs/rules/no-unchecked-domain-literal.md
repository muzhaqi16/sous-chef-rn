# `sous-chef/no-unchecked-domain-literal`

A schema enum value or typename is compared and keyed through its generated symbol.

## Reports

- A comparison (`===`, `!==`, `==`, `!=`) or `case` between a schema enum value (`'PENDING'`, `'FORBIDDEN'`) and an operand typed plain `string`.
- The same for a schema typename compared against a plain-string `__typename`.
- A lookup table whose keys are all values of one generated enum while the table is keyed by `string`.

Values are read from the generated code: enum members from `src/graphql/generated/schemaTypes.ts`, typenames from `schema.graphql`.

## Use instead

Type the operand with the generated type where it is declared, and compare against the member:

```ts
interface Invite {
  status: InviteStatus;
}
if (invite.status === InviteStatus.Pending) …
```

Narrow a mutation result to its success member with `appliedPayload`; read a `__typename` from a codegen type, where it is a literal union. Key a table by the enum with computed members: `Record<InviteStatus, string>` with `[InviteStatus.Pending]: …`.

## Why

A plain `string` accepts a renamed or removed enum value and a misspelled one, so the branch silently stops matching. Typed with the enum, all three are compile errors, and `switch-exhaustiveness-check` then asks for the values nobody handled.

## Exempt

- An operand typed as a literal union or the enum itself: tsc checks it.
- An operand that is a call result (`typed.toUpperCase() === 'DELETE'`): transformed input that merely shares an enum value's spelling.
- A typename-spelled string compared to something not named like `__typename` (`route.name === 'Home'`).
- Files without type information.

Source: [`eslint/plugin/rules/no-unchecked-domain-literal.js`](../../eslint/plugin/rules/no-unchecked-domain-literal.js) · spec: [`__tests__/lint/rules/no-unchecked-domain-literal.test.ts`](../../__tests__/lint/rules/no-unchecked-domain-literal.test.ts)
