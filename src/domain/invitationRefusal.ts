/**
 * An accept/decline result is a union of a payload and four refusal members,
 * and under `errorPolicy: 'all'` a refusal resolves as DATA — so the absence of
 * an error says nothing. The in-app modal and the deep link both classify here,
 * so the two cannot answer the same response differently.
 */
export type InvitationRefusal =
  /** `ForbiddenError` — the caller may not redeem this invite. */
  | 'inviteeMismatch'
  /** `NotFoundError` — revoked, already redeemed, or gone. */
  | 'unavailable'
  /** `ConflictError` — already resolved, often already a member. */
  | 'alreadyResolved'
  /** `ValidationError` — the token itself is malformed. */
  | 'invalid'
  /** A member this client does not know, or a transport failure. */
  | 'refused';

const BY_TYPENAME: Record<string, InvitationRefusal> = {
  ForbiddenError: 'inviteeMismatch',
  NotFoundError: 'unavailable',
  ConflictError: 'alreadyResolved',
  ValidationError: 'invalid',
};

/**
 * Success is the payload member; every other member is a refusal. A member
 * added to the union later lands on `refused` and is reported, rather than
 * passing as success.
 */
export const isInvitationPayload = (typename: string | undefined): boolean =>
  typeof typename === 'string' && typename.endsWith('Payload');

export const classifyInvitationRefusal = (
  typename: string | undefined,
): InvitationRefusal => (typename && BY_TYPENAME[typename]) || 'refused';
