/**
 * Z-index layer constants for consistent stacking context across the app.
 * Use these values instead of arbitrary z-index numbers.
 */
export const zIndex = {
  hide: -1,
  base: 0,
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
} as const;
