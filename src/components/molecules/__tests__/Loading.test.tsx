import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { Loading, LoadingBranded } from '../Loading';

describe('Loading', () => {
  it('renders without a message', () => {
    const { toJSON } = render(<Loading />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders message text when provided', () => {
    render(<Loading message="Loading items..." />);
    expect(screen.getByText('Loading items...')).toBeTruthy();
  });

  it('renders submessage text when provided', () => {
    render(<Loading message="Loading" submessage="Please wait" />);
    expect(screen.getByText('Please wait')).toBeTruthy();
  });
});

describe('LoadingBranded', () => {
  // The brand loader draws the message in its own banner, in caps, so the
  // component must not also render it beneath the spinner.
  it('hands the message to the brand banner and does not repeat it', () => {
    render(<LoadingBranded message="Fetching data" />);
    expect(screen.getByText('FETCHING DATA')).toBeTruthy();
    expect(screen.queryByText('Fetching data')).toBeNull();
  });

  it('renders a submessage under the brand loader', () => {
    render(<LoadingBranded message="Searching" submessage="Barcode: 123" />);
    expect(screen.getByText('Barcode: 123')).toBeTruthy();
  });
});
