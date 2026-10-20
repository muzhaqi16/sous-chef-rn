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
type Created = Parameters<typeof classifyCaptureCreate>[0];

const capture = (overrides: Partial<Capture> = {}): Capture => ({
  status: RecipeCaptureStatus.Pending,
  alreadySaved: false,
  failure: null,
  recipe: null,
  ...overrides,
});

/** A create the server refused, unless `overrides` say it took it. */
const created = (overrides: Partial<Created>): Created => ({
  accepted: false,
  capture: null,
  refusedField: null,
  error: undefined,
  ...overrides,
});

const refusedWith = (code: string, extensions: Record<string, unknown> = {}) =>
  new CombinedGraphQLErrors({
    errors: [{ message: 'refused', extensions: { code, ...extensions } }],
  });

describe('captureOutcomeOf', () => {
  const MISO_SALMON: Capture['recipe'] = {
    __typename: 'Recipe',
    id: 'r-1',
    name: 'Miso salmon',
  };

  it.each([
    {
      name: 'is still reading while pending',
      read: capture(),
      outcome: undefined,
    },
    {
      name: 'opens the recipe a saved capture made or found',
      read: capture({
        status: RecipeCaptureStatus.Saved,
        alreadySaved: true,
        recipe: MISO_SALMON,
      }),
      outcome: { kind: 'saved', recipe: MISO_SALMON, alreadySaved: true },
    },
    {
      name: 'opens the editor for an incomplete read',
      read: capture({ status: RecipeCaptureStatus.Incomplete }),
      outcome: { kind: 'incomplete' },
    },
    {
      name: 'reads a failure code this build does not know as unavailable',
      read: capture({
        status: RecipeCaptureStatus.Unavailable,
        failure: 'A_CODE_FROM_A_NEWER_SERVER' as RecipeCaptureFailure,
      }),
      outcome: { kind: 'failed', copy: 'recipes.captureFailedUnavailable' },
    },
  ])('$name', ({ read, outcome }) => {
    expect(captureOutcomeOf(read)).toEqual(outcome);
  });

  it.each([
    [RecipeCaptureFailure.UnreachableUrl, 'recipes.captureFailedUnreachable'],
    [RecipeCaptureFailure.NoRecipe, 'recipes.captureFailedNoRecipe'],
    [RecipeCaptureFailure.PhotoRefused, 'recipes.captureFailedPhotoRefused'],
    [RecipeCaptureFailure.ServiceTimeout, 'recipes.captureFailedUnavailable'],
  ])('says why %s failed in its own words', (failure, copy) => {
    expect(
      captureOutcomeOf(
        capture({ status: RecipeCaptureStatus.Failed, failure }),
      ),
    ).toEqual({ kind: 'failed', copy });
  });
});

describe('classifyCaptureCreate', () => {
  const premium = refusedWith(TopLevelErrorCode.PremiumRequired, {
    feature: 'RECIPE_CAPTURE_PHOTO',
    plan: 'PREMIUM',
  });

  it.each([
    {
      name: 'polls an accepted capture still reading',
      create: created({ accepted: true, capture: capture() }),
      classified: { kind: 'poll' },
    },
    {
      name: 'settles a replayed capture that already ended',
      create: created({
        accepted: true,
        capture: capture({ status: RecipeCaptureStatus.Incomplete }),
      }),
      classified: { kind: 'settle', outcome: { kind: 'incomplete' } },
    },
    {
      name: 'reports a refusal on the field it names',
      create: created({ refusedField: 'url' }),
      classified: { kind: 'refused', field: 'url' },
    },
    {
      name: 'waits out the daily allowance',
      create: created({
        error: refusedWith(TopLevelErrorCode.RateLimitExceeded, {
          retryAfter: 3600,
        }),
      }),
      classified: { kind: 'limited' },
    },
    {
      name: 'hands over a refusal that names no field with its error',
      create: created({ error: premium }),
      classified: { kind: 'refused', field: null, error: premium },
    },
    {
      name: 'sends again when no answer arrived',
      create: created({ error: new Error('Network request failed') }),
      classified: { kind: 'resend' },
    },
  ])('$name', ({ create, classified }) => {
    expect(classifyCaptureCreate(create)).toEqual(classified);
  });
});
