import { ErrorCode } from '#/graphql/generated/schemaTypes';
import type { SettleOptions } from '#/apollo/utils/settleMutation';
import { t } from '#/i18n';

/**
 * The copy for an accept/decline refusal, by the code its member carries. The
 * in-app modal and the deep link both settle with it, so the two cannot answer
 * the same refusal differently.
 */
export const invitationRefusalCopy = (): SettleOptions['copy'] => {
  const unavailable = {
    title: t('labels.error'),
    body: t('errors.invitationUnavailable'),
  };
  return {
    // The invite stays PENDING: the reader is signed in as somebody else.
    [ErrorCode.Forbidden]: {
      title: t('invitationAcceptance.wrongAccountTitle'),
      body: t('invitationAcceptance.wrongAccount'),
    },
    [ErrorCode.NotFound]: unavailable,
    // Already accepted, declined or revoked: the invite is spent.
    [ErrorCode.Conflict]: unavailable,
    // The token is refused: it names no invite, or one that has expired.
    [ErrorCode.ValidationFailed]: {
      title: t('labels.error'),
      body: t('invitationAcceptance.notFound'),
    },
  };
};
