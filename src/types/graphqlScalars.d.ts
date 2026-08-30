/**
 * Custom GraphQL scalars, referenced by NAME from `codegen.ts`'s `scalars` map.
 * Global ambient types so generated code needs no import — which sidesteps the
 * `module#Type` codegen syntax colliding with the `#/` path alias. This file is
 * intentionally NOT a module, so the declarations stay global.
 */

/** The primitive (leaf) JSON values. */
type JsonPrimitive = string | number | boolean | null;

/**
 * Any JSON value, deliberately NON-recursive (nested levels stop at `unknown`):
 * a recursive type trips TS2589 through Apollo's deep generic helpers. The arms
 * are deliberately NOT `readonly` either — Immer's `WritableDraft<T>` cannot
 * reconcile a readonly index signature on a store entity holding a JSON field.
 */
type JsonValue = JsonPrimitive | { [key: string]: unknown } | unknown[];

/** A JSON object map — the common case for `metadata` / `payload`-style fields. */
type JsonObject = { [key: string]: unknown };

/**
 * Write-side JSON for INPUT positions. Looser than `JsonValue` on purpose: a
 * named interface cannot satisfy an index signature, so the read-side type
 * would reject an already-typed payload passed straight into a JSON input.
 */
type JsonInput = JsonPrimitive | object;

/**
 * A branded dotted-quad IPv4 string. Unused by the schema today — kept because
 * `codegen.ts` names it in its `scalars` map.
 */
type IPv4 = string & { readonly __brand: 'IPv4' };
