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
 * That shape is looser, and having several hand-rolled spellings of it made a
 * single concept unreviewable. Two concrete wins:
 *
 * - **`Record<string, unknown>` is not `TOptions`.** It permits arbitrary
 *   option keys while rejecting nothing, so misspelled options pass silently.
 * - **It drops i18next's return-type narrowing** for `defaultValue` and
 *   `returnObjects`; a fixed `=> string` claims a guarantee the real function
 *   does not always make.
 *
 * **What this does NOT do: validate keys.** Without an i18next
 * `CustomTypeOptions` augmentation, `ParseKeys` resolves to plain `string`, so
 * `t('typo.notAKey')` compiles clean here and renders the raw dot-path at
 * runtime. That augmentation was measured and rejected — it caught zero real
 * bugs while costing ~5.4x type instantiations and roughly doubling check time.
 * Key existence is enforced instead by `__tests__/i18n/keysExist.test.ts`.
 */
export type Translate = TFunction<'translation'>;
