import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { recordMock, renderWithApollo } from '#/test-utils/apolloMockProvider';
import { drainTimers } from '#/test-utils/drainTimers';
import {
  MeasurementRegionBasis,
  RecipeCaptureWarningCode,
} from '#/graphql/generated/schemaTypes';
import { RecipeCaptureDocument } from '#features/recipes/hooks/useRecipeCapture.generated';
import { useRecipeCaptureStore } from '#features/recipes/store/recipeCaptureStore';
import { recipesTestIDs } from '#features/recipes/testIDs';
import { CaptureReviewBanner } from '../CaptureReviewBanner';

// The read left "2 scallions" unlinked, with one item proposed for it.
const captureMock = () =>
  recordMock(RecipeCaptureDocument, {
    data: {
      recipeCapture: {
        id: 'capture-1',
        measurementRegion: {
          region: 'AU',
          basis: MeasurementRegionBasis.PageLanguage,
        },
        warnings: [{ code: RecipeCaptureWarningCode.UngroundedLine }],
        draft: {
          lines: [
            {
              originalText: '2 scallions',
              item: null,
              candidates: [
                { item: { id: 'item-green-onion', name: 'Green onion' } },
              ],
            },
          ],
        },
      },
    },
  });

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
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

const renderBanner = (
  ingredients: React.ComponentProps<typeof CaptureReviewBanner>['ingredients'],
  onReview = jest.fn(),
) =>
  renderWithApollo(
    <CaptureReviewBanner
      recipeId="recipe-1"
      ingredients={ingredients}
      onReview={onReview}
    />,
    { operationMocks: [captureMock().mock] },
  );

describe('CaptureReviewBanner', () => {
  it('shows nothing for a recipe no held capture made', () => {
    renderBanner([]);

    expect(screen.queryByTestId(recipesTestIDs.captureReview)).toBeNull();
  });

  it('says how measures were read, what the read warned of, and what is unmatched', async () => {
    hold();
    const onReview = jest.fn();
    renderBanner(
      [
        { originalText: '2 scallions', item: null },
        { originalText: '1 cup rice', item: { id: 'item-rice' } },
      ],
      onReview,
    );

    await drainTimers();
    expect(screen.getByTestId(recipesTestIDs.captureReview)).toBeTruthy();
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
    renderBanner([
      { originalText: '2 scallions', item: { id: 'item-green-onion' } },
    ]);

    await drainTimers();
    expect(screen.getByTestId(recipesTestIDs.captureReview)).toBeTruthy();
    expect(
      screen.queryByTestId(recipesTestIDs.captureReviewUnmatched),
    ).toBeNull();
  });
});
