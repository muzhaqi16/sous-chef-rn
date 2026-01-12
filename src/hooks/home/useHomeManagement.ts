/**
 * useHomeManagement - DEPRECATED: Re-exports from split hooks
 *
 * This file is maintained for backward compatibility.
 * For new code, import directly from './hooks':
 *
 * @example
 * ```tsx
 * // Individual hooks (preferred)
 * import { useHomeQuery } from '#/hooks/home/hooks';
 * import { useHomeSelection } from '#/hooks/home/hooks';
 *
 * // Composition hook (backward compatible)
 * import { useHomeManagement } from '#/hooks/home/hooks';
 * ```
 */

export {
  useHomeManagement,
  useHomeQuery,
  useHomeSelection,
  useHomeMutations,
  useHomeInvitations,
  MembershipRole,
} from './hooks';
