import type { DimensionValue } from 'react-native';
import type { Theme } from '#/theme/themes';

// Typed so the percentage keeps its `DimensionValue` type instead of widening
// to `string` when returned from the factory below.
const FULL_HEIGHT: DimensionValue = '100%';

/**
 * The full-height page / scroll-content / section layout shared by the
 * AddToPantry detail pages (`MainDetailsPage`, `DetailsPage`,
 * `StockSettingsPage`, `StoragePage`). Spread into each page's
 * `StyleSheet.create(theme => …)` so the values stay declared through
 * `StyleSheet.create` and keep their ShadowTree binding.
 */
export const detailsPageBaseStyles = (theme: Theme) => ({
  page: {
    flex: 1,
    minHeight: FULL_HEIGHT,
    flexGrow: 1,
  },
  pageContent: {
    padding: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    flexGrow: 1,
  },
  section: {
    marginBottom: theme.spacing.sm,
  },
});
