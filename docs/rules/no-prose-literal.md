# `sous-chef/no-prose-literal`

Copy handed to the UI through a variable, property, setter or return is translated, never an English literal.

## Reports

A string literal or template literal that reads as prose — two words with letters (`'Try again'`), or one capitalized word (`'Pending'`) — assigned to a copy-named target. The copy names are `message`, `label`, `title`, `subtitle`, `description`, `error`, `text`, `hint`, `placeholder`, `body` and `caption`, alone or as a camel-case suffix (`emptyMessage`, `errorText`, not `context`):

- an object property or class field (`{ title: 'Delete item' }`);
- a variable, an assignment or a default parameter (`emptyMessage = 'No items yet'`);
- a state setter (`setError('Please enter a value')`);
- a JSX attribute outside the `i18next/no-literal-string` include list (`errorMessage="…"`);
- the return of a function named for copy (`getStatusLabel`, `getLabelForField`, `format*`, `*Name`);
- a yup message argument (`.required('…')`, `.matches(re, '…')`, `.oneOf([…], '…')`).

Either branch of `?:` and both sides of `??` / `||` are checked.

## Options

- `followRendered` (default `false`; on in `eslint/project.js`) — also report copy whose target is not copy-named but is rendered in the same file, where "rendered" is a JSX child or a copy prop (the `i18next/no-literal-string` include list, or a copy name), reached through `?.`, `!`, `?:` branches, `||` / `??`, the right side of `&&`, a template literal or `+`:
  - the initial value of `const [x, setX] = useState('…')` and every `setX('…')`, when `x` is rendered in that component;
  - the return of a function the file declares (`function f` or `const f = () => …`), when a call to it is rendered: `function statusOf(ok) { return ok ? 'Up to date' : 'Pending'; }` then `<Text>{statusOf(ok)}</Text>`.

## Use instead

`t(key)` in a component or hook; the module-level `t` (lazily, `() => t(key)`, for a yup schema) elsewhere; a `Translate` parameter for a pure formatter. A kit component's default copy is `prop ?? t('shared.key')`, not a default parameter.

## Why

`i18next/no-literal-string` sees only JSX, and `no-restricted-syntax`'s toast entries only toast and alert arguments. English that reaches a screen through a hook's state, an options object or a formatter's return passes both; this rule names the targets that carry copy so the check stays precise.

## Exempt

- Developer-facing text: arguments at any depth to a logger, `console`, `errorService`, `Telemetry`, `performance`, a `this.log` / `trackError` method, `new …Error(…)`, `throw`, or a class that extends an `Error`.
- Names read by a developer: `logLabel`, `debugMessage`, `devText`.
- An object literal or assignment target whose declared type names a diagnostic record (`QueueError`, `MemoryWarning`, `SpoonacularApiError`).
- URLs, keys and identifiers (no space, not a capitalized word).
- `eslint/project.js` overrides: `src/i18n/config.ts` (language endonyms ship untranslated), `src/services/performance/**`, `src/services/telemetry/**`, `src/utils/errorSerialization.ts`.
- Test files and `.graphql` documents.

Source: [`eslint/plugin/rules/no-prose-literal.js`](../../eslint/plugin/rules/no-prose-literal.js) · spec: [`__tests__/lint/rules/no-prose-literal.test.ts`](../../__tests__/lint/rules/no-prose-literal.test.ts)
