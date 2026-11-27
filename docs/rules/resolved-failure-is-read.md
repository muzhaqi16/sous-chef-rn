# `sous-chef/resolved-failure-is-read`

A send caught with `try` / `.catch` reads the failure its result resolves with.

## Reports

- **`failureUnread`** — a mutation, lazy query, `client.query` / `client.mutate` or local write `send`, inside a `try` with a `catch` or followed by `.catch`, whose result's `error` (or `status`, for a local write) is never read: the result is discarded, or only its `data` is read.

A result handed on (`settleMutation(result)`, `return result`, a named `.then` handler) counts as read. So does a `useMutation` / `useLazyQuery` whose own state destructures `error`, and a call that sets `errorPolicy: 'none'`, whose failure rejects.

## Why

`errorPolicy: 'all'` is the default, so a failed mutation or query RESOLVES `{ data: undefined, error }`, and a local write resolves `{ status: 'failed' }`. Neither throws. A `catch` around one only catches an abort, and the server's refusal passes for success: a rename that silently did nothing, a preview that stays empty.

## Use instead

```ts
// A write: settle it.
const settled = await settleMutation(() => save({ variables }), options);

// A read awaited: fold a throw into the same shape, then read it.
const result = await client
  .query({ query, variables })
  .catch((error: unknown) => ({ data: undefined, error }));
if (result.error) return failed(result.error);

// A read nothing awaits.
onFailedRead(search({ variables }), error =>
  logger.warn('Search failed', error),
);
```

Source: [`eslint/plugin/rules/resolved-failure-is-read.js`](../../eslint/plugin/rules/resolved-failure-is-read.js) · spec: [`__tests__/lint/rules/resolved-failure-is-read.test.ts`](../../__tests__/lint/rules/resolved-failure-is-read.test.ts)
