import { useState } from 'react';
import { useApolloClient, useMutation } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { generateEntityId } from '#/utils/generateEntityId';
import { backoffDelay, sleep } from '#/utils/backoff';
import { getDeviceLocale } from '#/utils/deviceLocale';
import {
  RecipeCaptureReadersFragmentDoc,
  type RecipeCaptureReadersFragment,
} from '#/graphql/readers/recipeCaptureReaders.generated';
import type { CreateRecipeCaptureInput } from '#/graphql/generated/schemaTypes';
import { CreateRecipeCaptureDocument } from './useRecipeCapture.generated';
import { useCaptureOutcomeReporter } from './useCaptureOutcomeReporter';
import {
  classifyCaptureCreate,
  type CaptureCreateResult,
} from '#features/recipes/utils/recipeCaptureOutcome';
import {
  useRecipeCaptureActions,
  type CaptureEntry,
  type CaptureSource,
} from '#features/recipes/store/recipeCaptureStore';

export type CaptureRequest =
  | { source: Extract<CaptureSource, 'url'>; url: string }
  | { source: Extract<CaptureSource, 'text'>; text: string; sourceUrl?: string }
  | { source: Extract<CaptureSource, 'photo'>; photoKeys: string[] };

/** How a send ended for the sheet that made it: started, or why it did not. */
export type CaptureStart =
  | { kind: 'started' }
  | Extract<CaptureCreateResult, { kind: 'refused' | 'limited' }>;

const RESENDS = 3;
const RESEND_BASE_MS = 2000;
const LABEL_LENGTH = 40;

/**
 * What the server is sent, what the pending row names (the page's host, or
 * the text's first line), and the page it reads or the post its text came from.
 */
function describeRequest(request: CaptureRequest): {
  input: Omit<CreateRecipeCaptureInput, 'id' | 'locale'>;
} & Pick<CaptureEntry, 'label' | 'link'> {
  switch (request.source) {
    case 'url': {
      const host = /^https?:\/\/([^/?#]+)/i.exec(request.url)?.[1];
      return {
        input: { url: request.url },
        label: host ? host.replace(/^www\./i, '') : null,
        link: request.url,
      };
    }
    case 'text': {
      const [firstLine = ''] = request.text.trim().split('\n');
      return {
        input: {
          text: request.text,
          ...(request.sourceUrl ? { sourceUrl: request.sourceUrl } : {}),
        },
        label: firstLine.slice(0, LABEL_LENGTH) || null,
        link: request.sourceUrl,
      };
    }
    case 'photo':
      return { input: { photos: request.photoKeys }, label: null };
  }
}

/**
 * Sends a capture under a device-minted id, so a resend after a lost answer is
 * the same capture. It is remembered before it is sent, and polled from the
 * Recipes tab until it ends; a refusal is the sheet's to show.
 */
export function useRecipeCapture() {
  const { t } = useTranslation();
  const client = useApolloClient();
  const [create] = useMutation(CreateRecipeCaptureDocument);
  const { addReading, markAnswered, settle } = useRecipeCaptureActions();
  const report = useCaptureOutcomeReporter();
  const [sending, setSending] = useState(false);

  const sendOnce = async (
    input: CreateRecipeCaptureInput,
  ): Promise<CaptureCreateResult> => {
    const settled = await settleMutation(
      () => create({ variables: { input } }),
      {
        document: CreateRecipeCaptureDocument,
        fallback: t('errors.generic'),
        // The sheet reports a refusal on its field.
        present: 'none',
      },
    );
    // A replay, or a fast worker, may have answered with the outcome.
    const capture = client.cache.readFragment<RecipeCaptureReadersFragment>({
      id: client.cache.identify({ __typename: 'RecipeCapture', id: input.id }),
      fragment: RecipeCaptureReadersFragmentDoc,
      optimistic: true,
    });
    return classifyCaptureCreate({
      accepted: !!appliedPayload(settled.data),
      capture,
      refusedField: settled.failure?.field ?? null,
      error: settled.error,
    });
  };

  const start = async (request: CaptureRequest): Promise<CaptureStart> => {
    const id = generateEntityId();
    const locale = getDeviceLocale();
    const { input: source, label, link } = describeRequest(request);
    const input: CreateRecipeCaptureInput = {
      id,
      ...source,
      ...(locale ? { locale } : {}),
    };
    addReading({
      id,
      source: request.source,
      label,
      link,
      createdAt: new Date().toISOString(),
    });
    setSending(true);
    let result = await sendOnce(input);
    for (
      let resend = 0;
      result.kind === 'resend' && resend < RESENDS;
      resend++
    ) {
      await sleep(backoffDelay(resend, { baseMs: RESEND_BASE_MS }));
      result = await sendOnce(input);
    }
    setSending(false);

    switch (result.kind) {
      // Unanswered after every resend: the poll finds whether it arrived.
      case 'resend':
      case 'poll':
        markAnswered(id);
        return { kind: 'started' };
      case 'settle':
        report(id, result.outcome);
        return { kind: 'started' };
      case 'refused':
      case 'limited':
        settle(id);
        return result;
    }
  };

  return { start, sending };
}
