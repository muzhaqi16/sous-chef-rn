'use no memo';

import React from 'react';
import { render } from '@testing-library/react-native';
import { AnalyticsSummaryCard } from '../../../src/components/analytics/AnalyticsSummaryCard';

jest.mock('../../../src/apollo/links/tokenScheduler');
jest.mock('../../../src/apollo/links/refreshToken');

describe('AnalyticsSummaryCard', () => {
  it('renders title and value', () => {
    const { getByText } = render(
      <AnalyticsSummaryCard title="Total Items" value={42} />,
    );
    expect(getByText('Total Items')).toBeTruthy();
    expect(getByText('42')).toBeTruthy();
  });

  it('renders subtitle when provided', () => {
    const { getByText } = render(
      <AnalyticsSummaryCard title="Total Items" value={42} subtitle="in pantry" />,
    );
    expect(getByText('in pantry')).toBeTruthy();
  });

  it('renders string value', () => {
    const { getByText } = render(
      <AnalyticsSummaryCard title="Status" value="Active" />,
    );
    expect(getByText('Active')).toBeTruthy();
  });

  it('renders trend info when provided', () => {
    const { getByText } = render(
      <AnalyticsSummaryCard
        title="Items"
        value={42}
        trend="up"
        trendValue="+5%"
      />,
    );
    expect(getByText('+5%')).toBeTruthy();
  });

  it('renders without optional props', () => {
    const { getByText } = render(
      <AnalyticsSummaryCard title="Count" value={0} />,
    );
    expect(getByText('Count')).toBeTruthy();
    expect(getByText('0')).toBeTruthy();
  });
});
