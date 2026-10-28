/** What `currentMealPlan` said: still asking, or the plan covering today (null for none). */
export interface CurrentPlanAnswer {
  waiting: boolean;
  planId: string | null;
}
