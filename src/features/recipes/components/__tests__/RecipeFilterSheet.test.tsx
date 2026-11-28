import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import { Diet } from '#graphql/generated/schemaTypes';
import { t } from '#i18n';
import { DEFAULT_FILTERS } from '#features/recipes/utils/recipeFilterOptions';
import { RecipeFilterSheet } from '../RecipeFilterSheet';

const onApplyFilters = jest.fn();

const sheet = (visible: boolean) => (
  <RecipeFilterSheet
    visible={visible}
    onRequestClose={jest.fn()}
    activeFilters={DEFAULT_FILTERS}
    onApplyFilters={onApplyFilters}
    onSheetChange={jest.fn()}
  />
);

const VEGAN = () => t('recipeFilters.diets.vegan');
const snapTo = (index: number) =>
  fireEvent(screen.getByText(t('recipeFilters.title')), 'change', index);

beforeEach(() => jest.clearAllMocks());

describe('RecipeFilterSheet', () => {
  it('keeps the picks through a snap change, and commits them on close', () => {
    renderWithApollo(sheet(true));
    fireEvent.press(screen.getByRole('button', { name: VEGAN() }));

    snapTo(1);

    expect(
      screen.getByRole('button', { name: VEGAN(), selected: true }),
    ).toBeOnTheScreen();
    expect(onApplyFilters).not.toHaveBeenCalled();

    snapTo(-1);

    expect(onApplyFilters).toHaveBeenCalledWith(
      expect.objectContaining({ diet: [Diet.Vegan] }),
    );
  });

  it('opens again on the committed filters', () => {
    const view = renderWithApollo(sheet(true));
    fireEvent.press(screen.getByRole('button', { name: VEGAN() }));

    view.rerender(sheet(false));
    view.rerender(sheet(true));

    expect(
      screen.getByRole('button', { name: VEGAN(), selected: false }),
    ).toBeOnTheScreen();
  });
});
