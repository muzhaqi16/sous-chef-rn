import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { t } from '#/i18n';
import {
  DietaryAlertState,
  RestrictionSeverity,
} from '#/graphql/generated/schemaTypes';
import type { HouseholdAlert } from '#domain/dietary';
import type { DisplayIngredient } from '#features/recipes/hooks/useRecipeData';
import { IngredientTile } from '../IngredientTile';
import { asAbbreviation } from '#/test-utils/fixtures/unitLabels';

jest.mock('#components/atoms/CachedImage', () => ({
  CachedImage: ({ uri }: { uri: string }) => {
    const { Text: RNText } = require('react-native');
    return require('react').createElement(RNText, null, `image-${uri}`);
  },
}));

const ingredient = (
  quantity: number,
  symbol: string | null,
  overrides: Partial<DisplayIngredient> = {},
): DisplayIngredient => ({
  __typename: 'RecipeIngredient',
  id: 'ingredient-1',
  name: 'monk fruit extract',
  quantity,
  originalText: null,
  estimatedPrice: null,
  image: null,
  isOptional: false,
  notes: null,
  preparation: null,
  sortOrder: 0,
  section: null,
  item: null,
  unit: symbol
    ? asAbbreviation({
        __typename: 'Unit',
        id: `unit-${symbol}`,
        name: symbol,
        symbol,
      })
    : null,
  convertedQuantity: null,
  ...overrides,
});

const renderRow = (value: DisplayIngredient, showPrice = true) =>
  render(
    <IngredientTile
      showPrice={showPrice}
      ingredient={value}
      isAdded={false}
      alerts={[]}
      onPress={jest.fn()}
      testID="tile"
    />,
  );

const alert = (
  id: string,
  memberName: string,
  severity: RestrictionSeverity,
): HouseholdAlert => ({
  id,
  memberName,
  what: 'Bacon',
  state: DietaryAlertState.Contains,
  severity,
  isDiet: false,
});

describe('IngredientTile', () => {
  it('rounds an amount to three decimals', () => {
    renderRow(ingredient(177.4412, 'ml'));
    expect(screen.getByText('177.441 ml')).toBeTruthy();
  });

  it('shows a cooking fraction where one fits', () => {
    renderRow(ingredient(1.25, 'cup'));
    expect(screen.getByText('1 1/4 cup')).toBeTruthy();
  });

  it('shows only the name for an unmeasured ingredient', () => {
    renderRow(ingredient(0, null));
    expect(screen.getByText('monk fruit extract')).toBeTruthy();
    expect(screen.queryByText('0')).toBeNull();
  });

  it("shows the server's conversion in the reader's own system", () => {
    renderRow(
      ingredient(1, 'cup', {
        convertedQuantity: {
          __typename: 'ConvertedValue',
          value: 236.588,
          unit: asAbbreviation({
            __typename: 'Unit',
            id: 'unit-ml',
            symbol: 'ml',
          }),
        },
      }),
    );
    expect(screen.getByText('236.588 ml')).toBeTruthy();
  });

  it('shows an estimated price under the name once the recipe has one', () => {
    renderRow(ingredient(1, 'cup', { estimatedPrice: 1.5 }));
    expect(screen.getByText(/1\.50/)).toBeTruthy();
    expect(screen.getByTestId('tile').props.accessibilityLabel).toMatch(
      /1\.50/,
    );
  });

  it('shows and reads out no price with Budget & prices off', () => {
    renderRow(ingredient(1, 'cup', { estimatedPrice: 1.5 }), false);
    expect(screen.queryByText(/1\.50/)).toBeNull();
    expect(screen.getByTestId('tile').props.accessibilityLabel).not.toMatch(
      /1\.50/,
    );
  });

  it("shows the catalog item's photo when the ingredient has none", () => {
    renderRow(
      ingredient(1, 'cup', {
        item: {
          __typename: 'Item',
          id: 'item-1',
          name: 'Monk fruit',
          imageUrl: 'https://example.com/item.jpg',
        },
      }),
    );
    expect(screen.getByText('image-https://example.com/item.jpg')).toBeTruthy();
  });

  it('shows no picture without a photo', () => {
    renderRow(ingredient(1, 'cup'));
    expect(screen.queryByText(/^image-/)).toBeNull();
  });

  it('adds a plain ingredient on a tap', () => {
    const onPress = jest.fn();
    render(
      <IngredientTile
        showPrice
        ingredient={ingredient(1, 'cup')}
        isAdded={false}
        alerts={[]}
        onPress={onPress}
        testID="tile"
      />,
    );

    fireEvent.press(screen.getByTestId('tile'));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('tile').props.accessibilityHint).toBe(
      t('labels.addToShoppingList'),
    );
  });

  // "You: contains bacon" in grey said nothing; the badge names how serious.
  it('badges a flagged ingredient by its most serious alert, and opens it', () => {
    const onPress = jest.fn();
    render(
      <IngredientTile
        showPrice
        ingredient={ingredient(8, 'slice')}
        isAdded={false}
        alerts={[
          alert('r-you', 'You', RestrictionSeverity.Preference),
          alert('r-ana', 'Ana', RestrictionSeverity.Allergy),
        ]}
        onPress={onPress}
        testID="tile"
      />,
    );

    const label = t('dietaryAlerts.andMore', {
      label: t('dietaryProfile.avoidSeverity.allergy'),
      count: 1,
    });
    expect(screen.getByText(label)).toBeTruthy();
    const tile = screen.getByTestId('tile');
    expect(tile.props.accessibilityLabel).toContain(label);
    expect(tile.props.accessibilityHint).toBe(
      t('recipes.ingredientAlerts.hint'),
    );

    fireEvent.press(tile);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('says an avoided food is avoided', () => {
    render(
      <IngredientTile
        showPrice
        ingredient={ingredient(8, 'slice')}
        isAdded={false}
        alerts={[alert('r-you', 'You', RestrictionSeverity.Preference)]}
        onPress={jest.fn()}
      />,
    );

    expect(
      screen.getByText(t('dietaryProfile.avoidSeverity.preference')),
    ).toBeTruthy();
  });

  it('stays open once added when flagged, so its sheet can still be read', () => {
    render(
      <IngredientTile
        showPrice
        ingredient={ingredient(8, 'slice')}
        isAdded
        alerts={[alert('r-ana', 'Ana', RestrictionSeverity.Allergy)]}
        onPress={jest.fn()}
        testID="tile"
      />,
    );

    expect(screen.getByTestId('tile')).not.toBeDisabled();
  });
});
