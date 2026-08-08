import type { TFunction } from 'i18next';

/**
 * The canonical type for a translate function — the `t` returned by
 * `useTranslation()` from `react-i18next`, bound to the app's single
 * `'translation'` namespace (see `src/i18n/config.ts`).
 *
 * Use this anywhere a `t` is passed across a function boundary (schema
 * builders, option-list factories, formatters) instead of hand-writing a
 * signature.
 *
 * **Why not `(key: string, options?: Record<string, unknown>) => string`?**
 * That shape is not equivalent — it is strictly looser in ways that cost
 * real safety:
 *
 * - **It accepts any string as a key.** Every typo and every key the locale
 *   JSON doesn't define type-checks clean and fails only at runtime, where
 *   i18next echoes the raw key back into the UI. `TFunction` derives its key
 *   type from the registered resources, so a missing key is a compile error.
 * - **It drops i18next's return-type narrowing.** `TFunction` accounts for
 *   interpolation, plurals, `defaultValue`, and `returnObjects`; a fixed
 *   `=> string` claims a guarantee the real function doesn't always make.
 * - **`Record<string, unknown>` is not `TOptions`.** It permits arbitrary
 *   option keys while rejecting nothing, so misspelled options (`count` vs
 *   `counts`) pass silently.
 */
export type Translate = TFunction<'translation'>;
