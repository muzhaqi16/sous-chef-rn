import type { TranslateFn } from './index';

/**
 * The canonical type for a translate function — what both `useTranslation()`
 * and the module-scope `t` return (see `src/i18n/index.ts`).
 *
 * Use this anywhere a `t` is passed across a function boundary (schema
 * builders, option-list factories, formatters) instead of hand-writing a
 * signature. Several hand-rolled spellings of it made a single concept
 * unreviewable, and the loosest of them — `(key: string, options?:
 * Record<string, unknown>) => string` — hid a real bug: `Record<string,
 * unknown>` accepts `count: number | null | undefined`, and i18next picks the
 * plural form from `count`, so a null silently selected the wrong one.
 *
 * **What this does NOT do: validate keys.** Key existence is enforced by
 * `__tests__/i18n/keysExist.test.ts` rather than by types.
 *
 * An i18next `CustomTypeOptions` augmentation would give compile-time key
 * checking, and was measured and rejected: zero real bugs caught, ~5.4x type
 * instantiations, roughly double the check time. **That verdict is disputed** —
 * `memory/i18n-typed-keys-spike.md` records a separate spike concluding typed
 * keys were viable at zero tsc cost using `ParseKeys`. The two were measuring
 * different things and neither is currently reproducible; re-measure before
 * citing either.
 */
export type Translate = TranslateFn;
