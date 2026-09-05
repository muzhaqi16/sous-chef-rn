import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { QuantityDisplay } from '../QuantityDisplay';
import { DisplayFormat } from '#/graphql/generated/schemaTypes';

describe('QuantityDisplay', () => {
  it('renders a dash when quantity is null', () => {
    render(<QuantityDisplay quantity={null} />);
    expect(screen.getByText('-')).toBeTruthy();
  });

  it('renders a dash when quantity is undefined', () => {
    render(<QuantityDisplay quantity={undefined} />);
    expect(screen.getByText('-')).toBeTruthy();
  });

  it('renders integer quantity as whole number', () => {
    render(<QuantityDisplay quantity={3} />);
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('renders a fractional quantity as a cooking fraction', () => {
    render(<QuantityDisplay quantity={1.5} />);
    expect(screen.getByText('1 1/2')).toBeTruthy();
  });

  it('trims a quantity no fraction fits to 2 decimals', () => {
    render(<QuantityDisplay quantity={2.456} />);
    expect(screen.getByText('2.46')).toBeTruthy();
  });

  it('re-formats the float the API echoes back as quantityInput', () => {
    render(
      <QuantityDisplay quantity={0.33333334} quantityInput="0.33333334" />,
    );
    expect(screen.getByText('1/3')).toBeTruthy();
  });

  it('keeps decimals for a unit whose displayAsFraction is false', () => {
    render(<QuantityDisplay quantity={0.5} displayAsFraction={false} />);
    expect(screen.getByText('0.5')).toBeTruthy();
  });

  it('appends unit symbol when showUnit is true', () => {
    render(<QuantityDisplay quantity={2} unitSymbol="kg" />);
    expect(screen.getByText('2 kg')).toBeTruthy();
  });

  it('does not append unit when showUnit is false', () => {
    render(<QuantityDisplay quantity={2} unitSymbol="kg" showUnit={false} />);
    expect(screen.getByText('2')).toBeTruthy();
  });

  it("keeps the user's own notation", () => {
    render(<QuantityDisplay quantity={0.5} quantityInput="1/2" />);
    expect(screen.getByText('1/2')).toBeTruthy();
  });

  it('renders quantityInput with unit', () => {
    render(
      <QuantityDisplay quantity={0.5} quantityInput="1/2" unitSymbol="cup" />,
    );
    expect(screen.getByText('1/2 cup')).toBeTruthy();
  });

  it('renders fraction format for 0.75', () => {
    render(
      <QuantityDisplay
        quantity={0.75}
        displayFormat={DisplayFormat.Fraction}
      />,
    );
    expect(screen.getByText('3/4')).toBeTruthy();
  });

  it('renders mixed number for 1.5', () => {
    render(
      <QuantityDisplay quantity={1.5} displayFormat={DisplayFormat.Mixed} />,
    );
    expect(screen.getByText('1 1/2')).toBeTruthy();
  });

  it('renders decimal format explicitly', () => {
    render(
      <QuantityDisplay quantity={1.5} displayFormat={DisplayFormat.Decimal} />,
    );
    expect(screen.getByText('1.5')).toBeTruthy();
  });

  it('uses displayAsFraction with Auto format for common fractions', () => {
    render(
      <QuantityDisplay
        quantity={0.25}
        displayFormat={DisplayFormat.Auto}
        displayAsFraction={true}
      />,
    );
    expect(screen.getByText('1/4')).toBeTruthy();
  });

  it('renders zero quantity as 0', () => {
    render(
      <QuantityDisplay quantity={0} displayFormat={DisplayFormat.Fraction} />,
    );
    expect(screen.getByText('0')).toBeTruthy();
  });
});
