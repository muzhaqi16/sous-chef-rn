/**
 * Member interface for type safety
 */
export interface Member {
  id: string;
  role: string;
  status: string;
  userId?: string;
  displayName?: string | null;
  user?: {
    id: string;
    email?: string | null;
    profile?: {
      firstName?: string | null;
      lastName?: string | null;
      displayName?: string | null;
    } | null;
  } | null;
}

/**
 * Get display name for a member with comprehensive fallback logic
 * Handles current user detection and multiple fallback strategies
 *
 * @param member - Member object with user and profile information
 * @param currentUserId - Optional current user ID for "You" detection
 * @returns Display name string
 *
 * Priority order:
 * 1. "You" if current user
 * 2. member.displayName
 * 3. user.profile.displayName
 * 4. user.profile.firstName
 * 5. firstName + lastName combination
 * 6. email username (part before @)
 * 7. full email
 * 8. "Unknown Member"
 */
export function getMemberDisplayName(
  member: Member,
  currentUserId?: string,
): string {
  // Check if this member is the current user
  const isCurrentUser = currentUserId && member.user?.id === currentUserId;

  if (isCurrentUser) {
    return 'You';
  }

  // Try to get display name in order of preference
  const displayName =
    member.displayName ||
    member.user?.profile?.displayName ||
    member.user?.profile?.firstName ||
    (member.user?.profile?.firstName && member.user?.profile?.lastName
      ? `${member.user.profile.firstName} ${member.user.profile.lastName}`
      : null) ||
    member.user?.email?.split('@')[0] || // Use email username part
    member.user?.email ||
    'Unknown Member';

  return displayName;
}
