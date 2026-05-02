import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { Loading, LoadingInline, LoadingOverlay } from '../Loading';

describe('Loading', () => {
  it('renders inline variant by default', () => {
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

  it('returns null for overlay variant when not visible', () => {
    const { toJSON } = render(<Loading variant="overlay" visible={false} />);
    expect(toJSON()).toBeNull();
  });

  it('returns null for fullscreen variant when not visible', () => {
    const { toJSON } = render(<Loading variant="fullscreen" visible={false} />);
    expect(toJSON()).toBeNull();
  });

  it('renders overlay variant when visible', () => {
    const { toJSON } = render(
      <Loading variant="overlay" visible message="Saving..." />,
    );
    expect(toJSON()).toBeTruthy();
  });

  it('renders fullscreen variant when visible', () => {
    const { toJSON } = render(<Loading variant="fullscreen" visible />);
    expect(toJSON()).toBeTruthy();
  });
});

describe('LoadingInline', () => {
  it('renders without crashing', () => {
    const { toJSON } = render(<LoadingInline />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders message', () => {
    render(<LoadingInline message="Fetching data" />);
    expect(screen.getByText('Fetching data')).toBeTruthy();
  });
});

describe('LoadingOverlay', () => {
  it('renders when visible', () => {
    const { toJSON } = render(<LoadingOverlay visible message="Processing" />);
    expect(toJSON()).toBeTruthy();
  });
});
