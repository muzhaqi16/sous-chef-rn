# `sous-chef/no-operation-name-literal`

An operation name comes from its generated document, not a string.

## Reports

- A string equal to an operation name declared in `src/**/*.graphql`, in a slot named like an operation (`operationName`, `subscriptionName`, `publicOperations`, `query`, …) whose type is plain `string`.

## Use instead

Pass the generated document; the APIs that name an operation take one and read the name off it:

```ts
useApolloErrorLogger(GetPantryDocument, error);
useSubscriptionTransportRecovery(PantryEventsDocument, pantryEvents, skip);
subscriptionService.register({ document: PantryEventsDocument, … });
```

Where only the name will do (a link comparing `operation.operationName`), derive it: `operationNameOf(RefreshTokenDocument)` from `#/apollo/utils/documentOperation`.

## Why

A renamed or deleted operation leaves a string that still compiles and silently matches nothing. Two allowlists named operations the app no longer has (`SignUp` in `authLink`, `Logout` in `logoutCleanup`); a document import fails the build instead.

## Exempt

- A slot typed as a literal union (a route name, a typed `operationName`): tsc checks it.
- A slot not named like an operation: a screen or component label may share an operation's spelling (`useScreenTransition('MyRecipes')`).
- Files without type information (`.js`, `.graphql`).

Source: [`eslint/plugin/rules/no-operation-name-literal.js`](../../eslint/plugin/rules/no-operation-name-literal.js) · spec: [`__tests__/lint/rules/no-operation-name-literal.test.ts`](../../__tests__/lint/rules/no-operation-name-literal.test.ts)
