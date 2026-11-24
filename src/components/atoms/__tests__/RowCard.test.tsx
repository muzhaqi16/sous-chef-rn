import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { lightTheme } from '#/theme/themes';
import { isRecord } from '#/utils/isRecord';
import { Text } from '#components/atoms/Text';
import { RowCard } from '#components/atoms/RowCard';
import { ListItem } from '#components/molecules/ListItem';

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

  // The tint sits between the card's fill and its rows: a row's own fill
  // would hide it.
  it('lets the tint of a card that lights up show through its rows', () => {
    render(
      <>
        <RowCard highlighted>
          <ListItem title="On a lit card" onPress={jest.fn()} />
        </RowCard>
        <RowCard>
          <ListItem title="On a plain card" onPress={jest.fn()} />
        </RowCard>
      </>,
    );
    // The nearest host view above the row's press that sets a background.
    const surfaceOf = (title: string) => {
      let node = screen.getByRole('button', { name: title }).parent;
      while (node) {
        const layers: unknown[] = [node.props.style].flat(Infinity);
        const style = Object.assign({}, ...layers.filter(isRecord));
        if (typeof node.type === 'string' && 'backgroundColor' in style) {
          return node;
        }
        node = node.parent;
      }
      throw new Error(`no surface above ${title}`);
    };

    expect(surfaceOf('On a lit card')).toHaveStyle({
      backgroundColor: 'transparent',
    });
    expect(surfaceOf('On a plain card')).toHaveStyle({
      backgroundColor: lightTheme.colors.surface,
    });
  });
});
