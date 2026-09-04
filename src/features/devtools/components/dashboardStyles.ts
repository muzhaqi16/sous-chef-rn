import { StyleSheet } from 'react-native-unistyles';

export const styles = StyleSheet.create(theme => ({
  scrollView: {
    flex: 1,
  },
  notAvailableContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  lastUpdated: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    alignItems: 'flex-end',
  },
  metricsSection: {
    marginVertical: theme.spacing.base,
    paddingHorizontal: theme.spacing.md,
  },
  sectionTitle: {
    marginBottom: theme.spacing.xs,
  },
  sectionSubtitle: {
    marginBottom: theme.spacing.base,
  },
  table: {
    borderWidth: theme.borderWidth.hairline,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: theme.colors.backgroundSecondary,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.base,
    borderBottomWidth: theme.borderWidth.hairline,
    borderBottomColor: theme.colors.border,
  },
  tableHeaderName: {
    textTransform: 'uppercase',
    flex: 2,
  },
  tableHeaderAvg: {
    textTransform: 'uppercase',
    flex: 1,
  },
  tableHeaderMax: {
    textTransform: 'uppercase',
    flex: 1,
  },
  tableHeaderTotal: {
    textTransform: 'uppercase',
    flex: 1,
  },
  tableHeaderCount: {
    textTransform: 'uppercase',
    flex: 0.7,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: theme.spacing.base,
    paddingHorizontal: theme.spacing.base,
    borderBottomWidth: theme.borderWidth.hairline,
    borderBottomColor: theme.colors.border,
    variants: {
      alt: {
        true: { backgroundColor: theme.colors.backgroundSecondary },
        false: {},
      },
    },
  },
  tableCellName: {
    flex: 2,
  },
  tableCellAvg: {
    flex: 1,
  },
  tableCellMax: {
    flex: 1,
  },
  tableCellTotal: {
    flex: 1,
  },
  tableCellCount: {
    flex: 0.7,
  },
  memoryHistorySubtitle: {
    marginBottom: theme.spacing.base,
    marginTop: theme.spacing.md,
  },
  memoryList: {
    gap: theme.spacing.base,
  },
  memoryItem: {
    backgroundColor: theme.colors.backgroundSecondary,
    padding: theme.spacing.base,
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
    borderLeftWidth: theme.borderWidth.thick,
    borderLeftColor: theme.colors.primary,
  },
  memoryItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  memoryUsage: {
    color: theme.colors.success,
  },
  clearButton: {
    marginHorizontal: theme.spacing.md,
    marginVertical: theme.spacing.xl,
    backgroundColor: theme.colors.error,
    paddingVertical: theme.spacing.smPlus,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
    alignItems: 'center',
  },
  clearButtonText: {
    color: theme.colors.onError,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
  startupCard: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
    borderWidth: theme.borderWidth.hairline,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  startupRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.base,
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: theme.borderWidth.hairline,
    borderBottomColor: theme.colors.border,
  },
}));
