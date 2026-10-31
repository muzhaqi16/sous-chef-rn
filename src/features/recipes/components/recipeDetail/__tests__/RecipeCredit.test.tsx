import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { t } from '#/i18n';
import { RecipeCredit } from '../RecipeCredit';

const SOURCE_URL = 'https://example.com/pie';
const openSource = jest.fn();

const renderCredit = (
  credit: Partial<React.ComponentProps<typeof RecipeCredit>>,
) => render(<RecipeCredit onOpenSource={openSource} {...credit} />);

const byAuthor = (author: string) => t('recipes.byAuthor', { author });
const recipeFrom = (source: string) => t('recipes.recipeFrom', { source });

describe('RecipeCredit', () => {
  beforeEach(() => {
    openSource.mockClear();
  });

  it('names the author, then the source, then links to the original', () => {
    renderCredit({
      author: 'Jen West',
      sourceName: 'Pink When',
      sourceUrl: SOURCE_URL,
    });

    expect(screen.getByText(byAuthor('Jen West'))).toBeTruthy();
    expect(screen.getByText(recipeFrom('Pink When'))).toBeTruthy();

    fireEvent.press(screen.getByText(t('recipes.viewOriginalRecipe')));
    expect(openSource).toHaveBeenCalledTimes(1);
  });

  it('credits an author with no source, and opens nothing', () => {
    renderCredit({ author: 'Nonna' });

    fireEvent.press(screen.getByText(byAuthor('Nonna')));

    expect(openSource).not.toHaveBeenCalled();
    expect(screen.queryByText(t('recipes.viewOriginalRecipe'))).toBeNull();
  });

  it('calls a link with no name an external source when no author is known', () => {
    renderCredit({ sourceUrl: SOURCE_URL });

    expect(
      screen.getByText(recipeFrom(t('recipes.externalSource'))),
    ).toBeTruthy();
  });

  it('lets the author stand for a link with no name', () => {
    renderCredit({ author: 'Nonna', sourceUrl: SOURCE_URL });

    expect(screen.getByText(byAuthor('Nonna'))).toBeTruthy();
    expect(screen.getByText(t('recipes.viewOriginalRecipe'))).toBeTruthy();
    expect(
      screen.queryByText(recipeFrom(t('recipes.externalSource'))),
    ).toBeNull();
  });

  it('shows nothing with nothing to credit', () => {
    renderCredit({ sourceName: ' ', sourceUrl: ' ' });

    expect(screen.toJSON()).toBeNull();
  });
});
