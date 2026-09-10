import React from 'react';
import { Text } from '#components/atoms/Text';
import { render, screen } from '@testing-library/react-native';
import { ChartSection } from '../ChartSection';

describe('ChartSection', () => {
  it('keeps a drawn chart on screen while a refetch is in flight', () => {
    render(
      <ChartSection title="Spend" loading isEmpty={false}>
        <Text>chart</Text>
      </ChartSection>,
    );

    expect(screen.getByText('chart')).toBeTruthy();
  });

  it('shows the loading state when there is nothing to draw', () => {
    render(
      <ChartSection title="Spend" loading isEmpty>
        <Text>chart</Text>
      </ChartSection>,
    );

    expect(screen.queryByText('chart')).toBeNull();
  });
});
