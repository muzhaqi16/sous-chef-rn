// Generic list animation hooks
export { useListExitAnimation } from './useListExitAnimation';
export { useListEntryAnimation } from './useListEntryAnimation';
export { useListItemAnimation } from './useListItemAnimation';

// Re-export types for convenience
export type { AnimationDirection } from '#/types/animations';

// =============================================================================
// Backward Compatibility Aliases (deprecated - use new names)
// =============================================================================

/**
 * @deprecated Use useListExitAnimation instead
 */
export { useItemExitAnimation } from './useListExitAnimation';

/**
 * @deprecated Use useListEntryAnimation instead
 */
export { useItemEntryAnimation } from './useListEntryAnimation';
