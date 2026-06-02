/**
 * Global type-safe representations of custom GraphQL scalars.
 *
 * These are referenced by NAME from `codegen.ts`'s `scalars` map
 * (`JSON: 'JsonValue'`, `IPv4: 'IPv4'`). Declaring them as global ambient types
 * here means every generated operation/fragment type can use them with no
 * import — which sidesteps the `module#Type` codegen syntax colliding with the
 * project's `#/` path alias.
 *
 * This file is intentionally NOT a module (no top-level import/export), so the
 * declarations below are global.
 */

/** The primitive (leaf) JSON values. */
type JsonPrimitive = string | number | boolean | null;

/**
 * Any valid JSON value — type-safe (replaces `any`), but intentionally
 * NON-recursive: nested levels terminate at `unknown` rather than `JsonValue`.
 *
 * A fully recursive JSON type (`… | JsonValue[] | { [k]: JsonValue }`) is more
 * precise, but it trips TypeScript's "excessively deep" guard (TS2589) once
 * Apollo's deep generic helpers (Unmasked / optimisticResponse / MockedResponse)
 * recurse through an entity that contains a JSON field. Terminating at `unknown`
 * keeps full narrowing-at-read-site safety with zero depth cost — the standard
 * pragmatic trade-off for JSON scalars in Apollo codebases.
 */
// NOTE: arms are intentionally NOT `readonly` — Immer's `WritableDraft<T>`
// mapping (used by the Zustand store slices) fails to reconcile readonly index
// signatures, producing spurious "not assignable to WritableNonArrayDraft"
// errors on any store entity that holds a JSON field.
type JsonValue = JsonPrimitive | { [key: string]: unknown } | unknown[];

/** A JSON object map — the common case for `metadata` / `payload`-style fields. */
type JsonObject = { [key: string]: unknown };

/**
 * Write-side JSON type for INPUT positions (mutation variables / input fields).
 *
 * Deliberately looser than `JsonValue`: it accepts any object or array so that
 * callers can pass already-typed payloads (e.g. a third-party API object, or a
 * `{ step, text }[]`) straight into a JSON input field without a cast. A named
 * interface can't satisfy an index signature, so the read-side `JsonValue`
 * (which has one, for narrowing) would reject those writes. Used as the `input`
 * half of the JSON scalar in codegen.ts; reads still use `JsonValue`.
 */
type JsonInput = JsonPrimitive | object;

/**
 * A dotted-quad IPv4 address string, branded for nominal type-safety so a raw
 * `string` can't be passed where an IPv4 is expected without an explicit
 * validation step. Currently unused by the schema (no `IPv4` scalar is
 * declared) — kept for forward-compatibility.
 */
type IPv4 = string & { readonly __brand: 'IPv4' };
