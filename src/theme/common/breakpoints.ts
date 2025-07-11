export const breakpoints = {
  xs: 0,
  sm: 576,
  md: 768,
  lg: 992,
  xl: 1200,
  '2xl': 2000,
  tv: 4000,
} as const;

export type BreakpointKey = keyof typeof breakpoints;
export type Breakpoints = typeof breakpoints;
