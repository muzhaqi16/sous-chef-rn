# `sous-chef/no-error-message-branching`

An error is classified by its code, never by its message text.

## Reports

Searching or comparing an error's message against wording: `message.includes(…)`, `startsWith`/`endsWith`/`match`/`indexOf`/`search`, `message === '…'`, `regex.test(message)` or `switch (message)`. The message is followed through `toLowerCase()`/`trim()`, a `?:` or `||`, a variable or destructuring, and a parameter named `message`/`errorMessage`/`msg`.

## Use instead

- A server error or refusal: its `code` (`ErrorCode`, `TopLevelErrorCode`, `extensions.code`) and `field`, through `settleMutation` / `localizedErrorMessage`.
- A transport failure: `isNetworkError(error)` (`#/utils/isNetworkError`). It reads the error's class: whatwg-fetch rejects a failed or timed-out request with a `TypeError`.
- Our own deadline: throw `TimeoutError` (`#/utils/errors/timeoutError`) and check with `instanceof`.
- A library whose signal exists only in the message: a predicate in `src/utils/errors/libraryErrorMessages.ts`, pinned by a test that drives the installed library.

## Why

Message text is not a contract. A server message is unlocalized English that changes without notice; a runtime's wording differs by engine (V8 and Hermes word `JSON.stringify`'s cyclic error differently). A substring match also matches too much: `includes('offline')` reads any refusal mentioning offline as a network failure.

## Exempt

- `src/utils/errors/libraryErrorMessages.ts`, the one module that reads messages.
- Test files and `e2e/`, which match the text of errors they threw themselves.
- `typeof error.message === 'string'`, a nullish check, and one message compared with another.

Source: [`eslint/plugin/rules/no-error-message-branching.js`](../../eslint/plugin/rules/no-error-message-branching.js) · spec: [`__tests__/lint/rules/no-error-message-branching.test.ts`](../../__tests__/lint/rules/no-error-message-branching.test.ts)
