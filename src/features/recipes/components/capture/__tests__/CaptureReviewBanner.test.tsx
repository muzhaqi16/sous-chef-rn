import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import {
  recordMock,
  renderWithApollo,
  type MockDataFor,
} from '#/test-utils/apolloMockProvider';
import {
  IngredientMatchConfidence,
  MeasurementRegionBasis,
  RecipeCaptureStatus,
  RecipeCaptureWarningCode,
} from '#/graphql/generated/schemaTypes';
import { RecipeCaptureDocument } from '#features/recipes/hooks/useRecipeCapture.generated';
import { useRecipeCaptureStore } from '#features/recipes/store/recipeCaptureStore';
import { recipesTestIDs } from '#features/recipes/testIDs';
import { CaptureReviewBanner } from '../CaptureReviewBanner';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

type Line = NonNullable<
  NonNullable<
    NonNullable<
      NonNullable<
        MockDataFor<typeof RecipeCaptureDocument>['recipeCapture']
      >['draft']
    >['lines']
  >[number]
>;

const line = (originalText: string, overrides: Partial<Line> = {}): Line => ({
  __typename: 'ParsedIngredientLine',
  originalText,
  name: originalText,
  item: null,
  confidence: IngredientMatchConfidence.Unsure,
  candidates: [],
  ...overrides,
});

const captureMock = () =>
  recordMock(RecipeCaptureDocument, {
    data: {
      recipeCapture: {
        __typename: 'RecipeCapture',
        id: 'capture-1',
        status: RecipeCaptureStatus.Saved,
        measurementRegion: {
          __typename: 'MeasurementRegion',
          region: 'AU',
          basis: MeasurementRegionBasis.PageLanguage,
        },
        warnings: [
          {
            __typename: 'RecipeCaptureWarning',
            code: RecipeCaptureWarningCode.UngroundedLine,
          },
        ],
        draft: {
          __typename: 'RecipeCaptureDraft',
          lines: [
            line('2 scallions', {
              candidates: [
                {
                  __typename: 'IngredientCandidate',
                  score: 0.7,
                  item: {
                    __typename: 'Item',
                    id: 'item-green-onion',
                    name: 'Green onion',
                  },
                },
              ],
            }),
            line('1 cup rice', {
              item: { __typename: 'Item', id: 'item-rice' },
              confidence: IngredientMatchConfidence.Confident,
            }),
          ],
          steps: [],
        },
      },
    },
  });

beforeEach(() => {
  useRecipeCaptureStore.getState().reset();
});

const hold = () => {
  const store = useRecipeCaptureStore.getState();
  store.addReading({
    id: 'capture-1',
    source: 'url',
    label: 'example.com.au',
    createdAt: new Date().toISOString(),
  });
  store.settle('capture-1', 'recipe-1');
};

describe('CaptureReviewBanner', () => {
  it('shows nothing for a recipe no held capture made', () => {
    renderWithApollo(
      <CaptureReviewBanner
        recipeId="recipe-1"
        ingredients={[]}
        onReview={jest.fn()}
      />,
      { operationMocks: [captureMock().mock] },
    );

    expect(screen.queryByTestId(recipesTestIDs.captureReview)).toBeNull();
  });

  it('says how measures were read, what the read warned of, and what is unmatched', async () => {
    hold();
    const onReview = jest.fn();
    renderWithApollo(
      <CaptureReviewBanner
        recipeId="recipe-1"
        ingredients={[
          { originalText: '2 scallions', item: null },
          { originalText: '1 cup rice', item: { id: 'item-rice' } },
        ]}
        onReview={onReview}
      />,
      { operationMocks: [captureMock().mock] },
    );

    await waitFor(() =>
      expect(screen.getByTestId(recipesTestIDs.captureReview)).toBeTruthy(),
    );
    expect(screen.getByText(/from the page's language/)).toBeTruthy();
    expect(
      screen.getByText(/A line the source doesn't contain was left out\./),
    ).toBeTruthy();
    fireEvent.press(
      screen.getByText("1 ingredient isn't matched to an item. Tap to review."),
    );
    expect(onReview).toHaveBeenCalled();
  });

  it('counts a line the user has since matched as matched', async () => {
    hold();
    renderWithApollo(
      <CaptureReviewBanner
        recipeId="recipe-1"
        ingredients={[
          { originalText: '2 scallions', item: { id: 'item-green-onion' } },
        ]}
        onReview={jest.fn()}
      />,
      { operationMocks: [captureMock().mock] },
    );

    await waitFor(() =>
      expect(screen.getByTestId(recipesTestIDs.captureReview)).toBeTruthy(),
    );
    expect(
      screen.queryByTestId(recipesTestIDs.captureReviewUnmatched),
    ).toBeNull();
  });
});
