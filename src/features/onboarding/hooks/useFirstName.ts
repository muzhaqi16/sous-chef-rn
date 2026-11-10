import { firstNonBlank } from '#/utils/firstNonBlank';
import { useUser } from '#store/useAppStore';

/**
 * The name onboarding greets the user by: the first name given at sign-up,
 * else the first word of their name; null with neither.
 */
export function useFirstName(): string | null {
  const user = useUser();
  const [firstWord] = (user?.name ?? '').trim().split(/\s+/);
  return firstNonBlank(user?.firstName, firstWord) ?? null;
}
