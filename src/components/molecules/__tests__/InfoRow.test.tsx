import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { InfoRow } from '../InfoRow';

describe('InfoRow', () => {
  it('renders label and string value', () => {
    render(<InfoRow label="Name" value="Milk" />);
    expect(screen.getByText('Name:')).toBeTruthy();
    expect(screen.getByText('Milk')).toBeTruthy();
  });

  it('renders numeric value', () => {
    render(<InfoRow label="Meals per day" value={3} />);
    expect(screen.getByText('Meals per day:')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('renders em dash for null value', () => {
    render(<InfoRow label="Missing" value={null} />);
    expect(screen.getByText('\u2014')).toBeTruthy();
  });

  it('renders em dash for undefined value', () => {
    render(<InfoRow label="Missing" value={undefined} />);
    expect(screen.getByText('\u2014')).toBeTruthy();
  });

  it('appends unit to value', () => {
    render(<InfoRow label="Prep Time" value={30} unit="minutes" />);
    expect(screen.getByText('30 minutes')).toBeTruthy();
  });

  it('uses custom formatter when provided', () => {
    render(
      <InfoRow
        label="Budget"
        value={15.5}
        formatter={(val: string | number) => `$${Number(val).toFixed(2)}`}
      />,
    );
    expect(screen.getByText('$15.50')).toBeTruthy();
  });

  it('renders without bottom border when showBorder is false', () => {
    const { toJSON } = render(
      <InfoRow label="Test" value="val" showBorder={false} />,
    );
    expect(toJSON()).toBeTruthy();
  });

  it('renders label without colon when showColon is false', () => {
    render(<InfoRow label="Quantity" value="2" showColon={false} />);
    expect(screen.getByText('Quantity')).toBeTruthy();
    expect(screen.queryByText('Quantity:')).toBeNull();
  });

  it('renders label with colon by default', () => {
    render(<InfoRow label="Name" value="Test" />);
    expect(screen.getByText('Name:')).toBeTruthy();
  });

  it('renders icon when icon prop is provided', () => {
    const { toJSON } = render(
      <InfoRow label="Qty" value="5" icon="apps-outline" />,
    );
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('apps-outline');
  });

  it('renders children instead of value when children are provided', () => {
    render(
      <InfoRow label="Custom" value="ignored">
        <Text>Custom Content</Text>
      </InfoRow>,
    );
    expect(screen.getByText('Custom Content')).toBeTruthy();
    expect(screen.queryByText('ignored')).toBeNull();
  });
});
