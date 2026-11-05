import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '#components/atoms/Text';
import { CollapsingHeroDetail } from '#components/templates/CollapsingHeroDetail';

describe('CollapsingHeroDetail', () => {
  it("reads the item's name once: the bar's copy of the title is hidden", () => {
    render(
      <CollapsingHeroDetail
        title="Sim Cola"
        onBack={jest.fn()}
        actions={[]}
        renderHero={() => null}
      >
        <Text>Sim Cola</Text>
      </CollapsingHeroDetail>,
    );

    expect(
      screen.getAllByText('Sim Cola', { includeHiddenElements: true }),
    ).toHaveLength(2);
    expect(
      screen.getAllByText('Sim Cola', { includeHiddenElements: false }),
    ).toHaveLength(1);
  });

  // It skips the navigator's inset layout so its hero can reach the edge; the
  // content and the bar's buttons still keep clear of a landscape cutout.
  describe('in landscape with a cutout at the left', () => {
    const CUTOUT = 48;
    const NO_INSETS = { top: 0, bottom: 0, left: 0, right: 0 };

    afterEach(() => {
      jest.mocked(useSafeAreaInsets).mockReturnValue(NO_INSETS);
    });

    /** The nearest ancestor whose own style sets `key`. */
    const styleAbove = (
      node: ReturnType<typeof screen.getByText>,
      key: string,
    ): Record<string, unknown> => {
      for (let at = node.parent; at; at = at.parent) {
        const entries: unknown[] = [at.props.style].flat(Infinity);
        const style: Record<string, unknown> = Object.assign(
          {},
          ...entries.filter(Boolean),
        );
        if (key in style) return style;
      }
      return {};
    };

    it('insets the content and the bar, not the hero', () => {
      jest
        .mocked(useSafeAreaInsets)
        .mockReturnValue({ ...NO_INSETS, left: CUTOUT });
      render(
        <CollapsingHeroDetail
          title="Sim Cola"
          onBack={jest.fn()}
          actions={[]}
          renderHero={() => <Text>Hero</Text>}
        >
          <Text>Body</Text>
        </CollapsingHeroDetail>,
      );

      // The cutout side carries the gutter plus the inset; the other, the gutter.
      const content = styleAbove(screen.getByText('Body'), 'paddingLeft');
      expect(Number(content.paddingLeft) - Number(content.paddingRight)).toBe(
        CUTOUT,
      );
      expect(
        styleAbove(screen.getByLabelText('Go Back'), 'left'),
      ).toMatchObject({ left: CUTOUT, right: 0 });
      expect(styleAbove(screen.getByText('Hero'), 'paddingLeft')).toEqual({});
    });
  });
});
