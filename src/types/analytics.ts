/**
 * Analytics Types
 *
 * These types match the backend API for pantry analytics.
 * Once the schema is updated, regenerate via `npm run codegen` and
 * these can be replaced with the generated types.
 */

// Date range filter options
export type DateRange =
  | 'TODAY'
  | 'LAST_WEEK'
  | 'LAST_MONTH'
  | 'LAST_QUARTER'
  | 'LAST_YEAR';

// Filter input for analytics queries
export interface AnalyticsFilterInput {
  dateRange?: DateRange;
  customRange?: {
    start: string;
    end: string;
  };
  topItemsLimit?: number;
}

// Time series data point for trend charts
export interface TimeSeriesDataPoint {
  date: string;
  value: number;
}

// Usage breakdown by purpose
export interface UsageByPurpose {
  purpose: string;
  count: number;
  percentage: number;
}

// Usage breakdown by source
export interface UsageBySource {
  source: string;
  count: number;
  percentage: number;
}

// Top used item data
export interface UsageByItem {
  itemId: string;
  itemName: string;
  imageUrl?: string;
  count: number;
  totalQuantity: number;
}

// Complete usage analytics response
export interface UsageAnalytics {
  totalUsageCount: number;
  totalQuantityUsed: number;
  averageUsagePerDay: number;
  periodStart: string;
  periodEnd: string;
  usageTrend: TimeSeriesDataPoint[];
  usageByPurpose: UsageByPurpose[];
  usageBySource: UsageBySource[];
  topUsedItems: UsageByItem[];
}

// Waste breakdown by reason
export interface WasteByReason {
  reason: string;
  count: number;
  percentage: number;
  estimatedValue?: number;
}

// Top wasted item data
export interface WasteByItem {
  itemId: string;
  itemName: string;
  imageUrl?: string;
  count: number;
  totalQuantity: number;
  estimatedValue?: number;
}

// Complete waste analytics response
export interface WasteAnalytics {
  totalWasteCount: number;
  totalWasteQuantity: number;
  totalWasteValue: number;
  wasteRate: number;
  averageWastePerDay: number;
  composted: number;
  recycled: number;
  periodStart: string;
  periodEnd: string;
  wasteTrend: TimeSeriesDataPoint[];
  wasteByReason: WasteByReason[];
  topWastedItems: WasteByItem[];
}
