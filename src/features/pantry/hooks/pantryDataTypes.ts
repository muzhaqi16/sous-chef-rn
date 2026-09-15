export interface LocationCounts {
  all: number;
  fridge: number;
  freezer: number;
  pantry: number;
  /** Items with no storage state chosen — not the same as shelf-stable. */
  unassigned: number;
  // Custom storage location counts are added dynamically
  [key: string]: number;
}
