import React from 'react';
import { fireEvent, screen, userEvent } from '@testing-library/react-native';
import { t } from '#i18n';
import { WriteReviewSheet } from '#features/recipes/components/WriteReviewSheet';
import { WriteReviewSheet_ReviewFragmentDoc } from '#features/recipes/components/WriteReviewSheet.generated';
import { renderWithApollo, seedCache } from '#/test-utils/apolloMockProvider';

const REVIEW_ID = 'r1';

function makeCache() {
  return seedCache([
    {
      // The production selection the consumer reads, so a thin fixture fails
      // here instead of defining its own idea of complete.
      fragment: WriteReviewSheet_ReviewFragmentDoc,
      data: {
        __typename: 'RecipeReview',
        id: REVIEW_ID,
        rating: 4,
        comment: 'Nice',
      },
    },
  ]);
}

const onSubmit = jest.fn(() => Promise.resolve());
const onClose = jest.fn();

const sheet = (
  props: { visible?: boolean; existingReviewId?: string | null } = {},
) => (
  <WriteReviewSheet
    visible
    existingReviewId={null}
    onSubmit={onSubmit}
    onClose={onClose}
    submitting={false}
    {...props}
  />
);

const star = (count: number) =>
  screen.getByLabelText(t('a11y.rateStars', { count }));
const comment = () =>
  screen.getByPlaceholderText(t('recipes.reviewPlaceholder'));
const confirm = (label: string) =>
  userEvent.setup().press(screen.getByLabelText(label));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('WriteReviewSheet', () => {
  it('asks for a new review', () => {
    renderWithApollo(sheet());
    expect(screen.getByText(t('recipes.writeReview'))).toBeTruthy();
    expect(screen.getByText(t('recipes.rating'))).toBeTruthy();
  });

  it('sends the stars picked and the comment, trimmed, then closes', async () => {
    renderWithApollo(sheet());
    await userEvent.setup().press(star(5));
    fireEvent.changeText(comment(), '  Lovely  ');
    await confirm(t('recipes.submitReview'));
    expect(onSubmit).toHaveBeenCalledWith(5, 'Lovely');
    expect(onClose).toHaveBeenCalled();
  });

  it('asks for a rating on the field when sent without one', async () => {
    renderWithApollo(sheet());
    expect(screen.getByLabelText(t('recipes.submitReview'))).toBeEnabled();
    await confirm(t('recipes.submitReview'));
    expect(screen.getByText(t('recipes.ratingRequired'))).toBeOnTheScreen();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('opens an existing review on what it says', async () => {
    renderWithApollo(sheet({ existingReviewId: REVIEW_ID }), {
      cache: makeCache(),
    });
    expect(screen.getByText(t('recipes.editReview'))).toBeTruthy();
    expect(comment()).toHaveDisplayValue('Nice');
    await confirm(t('recipes.updateReview'));
    expect(onSubmit).toHaveBeenCalledWith(4, 'Nice');
  });

  it('opens fresh: the stars, comment and error go with the closing', async () => {
    const view = renderWithApollo(sheet());
    fireEvent.changeText(comment(), 'Half done');
    await confirm(t('recipes.submitReview'));
    expect(screen.getByText(t('recipes.ratingRequired'))).toBeOnTheScreen();

    view.rerender(sheet({ visible: false }));
    view.rerender(sheet());

    expect(comment()).toHaveDisplayValue('');
    expect(screen.queryByText(t('recipes.ratingRequired'))).toBeNull();
  });
});
