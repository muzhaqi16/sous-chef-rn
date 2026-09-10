/**
 * Z-index layer constants for consistent stacking context across the app.
 * Use these values instead of arbitrary z-index numbers.
 */
export const zIndex = {
  hide: -1,
  base: 0,
  // Ordering WITHIN one parent. RN `zIndex` orders siblings only, so a row that
  // must cover the one after it needs a step of its own rather than a number
  // chosen against layers it cannot see. A chain of form rows takes
  // `DropdownStack`, which computes the descent.
  raised: 1,
  elevated: 2,
  dropdown: 100,
  sticky: 200,
  fixed: 300,
  modalBackdrop: 400,
  modal: 500,
  popover: 600,
  tooltip: 700,
  fab: 800,
  toast: 900,
  overlay: 1000,
};
