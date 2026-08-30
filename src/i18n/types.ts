import type { TranslateFn } from './index';

/**
 * The canonical type for a translate function — use it wherever a `t` crosses a
 * function boundary rather than hand-writing a signature. A loose
 * `Record<string, unknown>` options type accepts a null `count`, from which
 * i18next picks the plural form. It does not validate keys.
 */
export type Translate = TranslateFn;
