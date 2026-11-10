/**
 * Whether an account was made before a day, such as the release that brought
 * a feature. An account with no recorded creation predates anything that
 * records it.
 */
export function accountPredates(
  createdAt: string | undefined,
  introducedOn: string,
): boolean {
  if (!createdAt) return true;
  return Date.parse(createdAt) < Date.parse(introducedOn);
}
