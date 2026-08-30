/**
 * Theme colors a list resolves once and hands to its rows through context — one
 * subscription instead of N, with the row components left pure. It lives in the
 * kit because its consumers (`QuantityBadge`, `ListItem`) are kit components.
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
