import type { AcceptHomeInviteMutation } from '#operations/home/home.generated';
import type { AppliedPayload } from '#/utils/errors/mutationPayload';

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

type RefusalTypename = Exclude<
  AcceptHomeInviteMutation['acceptHomeInvite']['__typename'],
  AppliedPayload<AcceptHomeInviteMutation>['__typename']
>;

// Keys are checked against the generated union; a member added to it later
// lands on `refused` rather than passing as success.
const BY_TYPENAME: { readonly [T in RefusalTypename]?: InvitationRefusal } = {
  ForbiddenError: 'inviteeMismatch',
  NotFoundError: 'unavailable',
  ConflictError: 'alreadyResolved',
  ValidationError: 'invalid',
};

export const classifyInvitationRefusal = (
  typename: string | undefined,
): InvitationRefusal => {
  const refusals: Partial<Record<string, InvitationRefusal>> = BY_TYPENAME;
  return (typename && refusals[typename]) || 'refused';
};
