import { CombinedGraphQLErrors } from '@apollo/client/errors';
import {
  RecipeCaptureFailure,
  RecipeCaptureStatus,
  TopLevelErrorCode,
} from '#/graphql/generated/schemaTypes';
import {
  captureOutcomeOf,
  classifyCaptureCreate,
} from '#features/recipes/utils/recipeCaptureOutcome';

type Capture = Parameters<typeof captureOutcomeOf>[0];

const capture = (overrides: Partial<Capture> = {}): Capture => ({
  status: RecipeCaptureStatus.Pending,
  alreadySaved: false,
  failure: null,
  recipe: null,
  ...overrides,
});

const refusedWith = (code: string, extensions: Record<string, unknown> = {}) =>
  new CombinedGraphQLErrors({
    errors: [{ message: 'refused', extensions: { code, ...extensions } }],
  });

describe('captureOutcomeOf', () => {
  it('is still reading while pending', () => {
    expect(captureOutcomeOf(capture())).toBeUndefined();
  });

  it('opens the recipe a saved capture made or found', () => {
    expect(
      captureOutcomeOf(
        capture({
          status: RecipeCaptureStatus.Saved,
          alreadySaved: true,
          recipe: { __typename: 'Recipe', id: 'r-1', name: 'Miso salmon' },
        }),
      ),
    ).toEqual({
      kind: 'saved',
      recipe: { __typename: 'Recipe', id: 'r-1', name: 'Miso salmon' },
      alreadySaved: true,
    });
  });

  it('opens the editor for an incomplete read', () => {
    expect(
      captureOutcomeOf(capture({ status: RecipeCaptureStatus.Incomplete })),
    ).toEqual({ kind: 'incomplete' });
  });

  it.each([
    [RecipeCaptureFailure.UnreachableUrl, 'unreachable'],
    [RecipeCaptureFailure.NoRecipe, 'noRecipe'],
    [RecipeCaptureFailure.PhotoRefused, 'photoRefused'],
    [RecipeCaptureFailure.ServiceTimeout, 'unavailable'],
  ])('says why %s failed in its own words', (failure, copy) => {
    expect(
      captureOutcomeOf(
        capture({ status: RecipeCaptureStatus.Failed, failure }),
      ),
    ).toEqual({ kind: 'failed', copy });
  });

  it('reads a failure code this build does not know as unavailable', () => {
    const newer = 'A_CODE_FROM_A_NEWER_SERVER' as RecipeCaptureFailure;

    expect(
      captureOutcomeOf(
        capture({ status: RecipeCaptureStatus.Unavailable, failure: newer }),
      ),
    ).toEqual({ kind: 'failed', copy: 'unavailable' });
  });
});

describe('classifyCaptureCreate', () => {
  const NOW = Date.parse('2026-10-14T12:00:00.000Z');

  it('polls an accepted capture still reading', () => {
    expect(
      classifyCaptureCreate({
        accepted: true,
        capture: capture(),
        refusedField: null,
        error: undefined,
      }),
    ).toEqual({ kind: 'poll' });
  });

  it('settles a replayed capture that already ended', () => {
    expect(
      classifyCaptureCreate({
        accepted: true,
        capture: capture({ status: RecipeCaptureStatus.Incomplete }),
        refusedField: null,
        error: undefined,
      }),
    ).toEqual({ kind: 'settle', outcome: { kind: 'incomplete' } });
  });

  it('reports a refusal on the field it names', () => {
    expect(
      classifyCaptureCreate({
        accepted: false,
        capture: null,
        refusedField: 'url',
        error: undefined,
      }),
    ).toEqual({ kind: 'refused', field: 'url' });
  });

  it('waits out the daily allowance until the server says', () => {
    expect(
      classifyCaptureCreate(
        {
          accepted: false,
          capture: null,
          refusedField: null,
          error: refusedWith(TopLevelErrorCode.RateLimitExceeded, {
            retryAfter: 3600,
          }),
        },
        NOW,
      ),
    ).toEqual({ kind: 'limited', retryAt: '2026-10-14T13:00:00.000Z' });
  });

  it('asks for an update the API wants', () => {
    expect(
      classifyCaptureCreate({
        accepted: false,
        capture: null,
        refusedField: null,
        error: refusedWith(TopLevelErrorCode.ClientUpgradeRequired),
      }),
    ).toEqual({ kind: 'upgrade' });
  });

  it('stops at a feature switched off for this user', () => {
    expect(
      classifyCaptureCreate({
        accepted: false,
        capture: null,
        refusedField: null,
        error: refusedWith(TopLevelErrorCode.FeatureDisabled, {
          feature: 'RECIPE_CAPTURE',
        }),
      }),
    ).toEqual({ kind: 'disabled' });
  });

  it('stops at a feature that needs a plan this user does not hold', () => {
    expect(
      classifyCaptureCreate({
        accepted: false,
        capture: null,
        refusedField: null,
        error: refusedWith(TopLevelErrorCode.PremiumRequired, {
          feature: 'RECIPE_CAPTURE_PHOTO',
          plan: 'PREMIUM',
        }),
      }),
    ).toEqual({ kind: 'premium' });
  });

  it('sends again when no answer arrived', () => {
    expect(
      classifyCaptureCreate({
        accepted: false,
        capture: null,
        refusedField: null,
        error: new Error('Network request failed'),
      }),
    ).toEqual({ kind: 'resend' });
  });
});
