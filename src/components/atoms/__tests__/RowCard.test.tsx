import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { lightTheme } from '#/theme/themes';
import { Text } from '#components/atoms/Text';
import { RowCard } from '#components/atoms/RowCard';

describe('RowCard', () => {
  const renderCard = () => {
    render(
      <RowCard testID="card">
        <Text role="body">Row</Text>
      </RowCard>,
    );
    const card = screen.getByTestId('card');
    // The clip is the card's one child view.
    const clip: unknown = card.props.children;
    return {
      card,
      clipStyle: (clip as React.ReactElement<{ style: object }>).props.style,
    };
  };

  it('rounds every corner and spaces the next row by the row gap', () => {
    const { card } = renderCard();
    expect(card).toHaveStyle({
      borderRadius: lightTheme.radii.xl,
      marginBottom: lightTheme.layout.rowGap,
      backgroundColor: lightTheme.colors.surface,
    });
  });

  it('clips inside the card, so its shadow survives', () => {
    const { card, clipStyle } = renderCard();
    expect(card).not.toHaveStyle({ overflow: 'hidden' });
    expect(clipStyle).toMatchObject({
      overflow: 'hidden',
      borderRadius: lightTheme.radii.xl,
    });
  });
});
