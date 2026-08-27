/**
 * Theme colors resolved once by a list and handed down to its rows.
 *
 * A list with many cells reads the theme once and passes the result through
 * context rather than having every cell subscribe: one subscription instead of
 * N, and the row components stay pure. This type is the shape of that hand-off.
 *
 * It lives in the kit because the components that CONSUME it are kit components
 * (`QuantityBadge`, `ListItem`). It used to be declared inside the shopping
 * list's own context module, which made an atom depend on a leaf feature's
 * private file — the dependency pointing exactly the wrong way.
 */
export interface RowThemeColors {
  primary: string;
  textPrimary: string;
  textSecondary: string;
  surfaceVariant: string;
  surface: string;
  border: string;
  screenWidth: number;
}
