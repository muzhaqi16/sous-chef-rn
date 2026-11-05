import React from 'react';
import { render, screen } from '@testing-library/react-native';
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
});
