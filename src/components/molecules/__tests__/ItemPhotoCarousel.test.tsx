'use no memo';

import React from 'react';
import { act, screen } from '@testing-library/react-native';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import { ItemPhotoCarousel } from '../ItemPhotoCarousel';
import { CachedImage } from '#components/atoms/CachedImage';
import type { ItemPhotoCarousel_ItemPhotoFragment } from '../ItemPhotoCarousel.generated';
import { ImageKind, ItemImageStatus } from '#/graphql/generated/schemaTypes';

jest.mock('#/utils/iconUtils', () => ({
  Icon: () => null,
}));

const photo = (
  overrides: Partial<ItemPhotoCarousel_ItemPhotoFragment> = {},
): ItemPhotoCarousel_ItemPhotoFragment => ({
  __typename: 'ItemPhoto',
  id: 'photo-1',
  url: 'https://cdn.example.com/front.jpg',
  perspective: 'front',
  isPrimary: true,
  status: ItemImageStatus.Approved,
  variants: [
    {
      __typename: 'ItemImage',
      url: 'https://cdn.example.com/front-512.jpg',
      kind: ImageKind.Size_512,
    },
  ],
  ...overrides,
});

// CachedImage takes `uri`; the host node it renders carries `source.uri`. Both
// match the query, so read whichever the node exposes.
const heroUris = (): string[] =>
  screen
    .UNSAFE_queryAllByProps({ resizeMode: 'cover' })
    .map(node => node.props.uri ?? node.props.source?.uri)
    .filter((uri: unknown): uri is string => typeof uri === 'string');

describe('ItemPhotoCarousel', () => {
  it('renders the SIZE_512 rendition of the first photo', () => {
    renderWithApollo(
      <ItemPhotoCarousel
        photos={[photo()]}
        imageHeight={280}
        resizeMode="cover"
      />,
    );

    expect(heroUris()).toContain('https://cdn.example.com/front-512.jpg');
  });

  // The bug this whole change exists to fix: the hero must be the photo the
  // server ordered first (the primary/front one), not the newest upload.
  it('leads with the first photo the server returned', () => {
    const front = photo({ id: 'front', url: 'https://cdn.example.com/a.jpg' });
    const back = photo({
      id: 'back',
      url: 'https://cdn.example.com/b.jpg',
      perspective: 'back',
      isPrimary: false,
      variants: [],
    });

    renderWithApollo(
      <ItemPhotoCarousel
        photos={[front, back]}
        imageHeight={280}
        resizeMode="cover"
      />,
    );

    expect(heroUris()[0]).toBe('https://cdn.example.com/front-512.jpg');
  });

  // Renditions are generated asynchronously, so a just-uploaded photo has none.
  it('falls back to the original when a photo has no renditions', () => {
    renderWithApollo(
      <ItemPhotoCarousel
        photos={[photo({ variants: [] })]}
        imageHeight={280}
        resizeMode="cover"
      />,
    );

    expect(heroUris()).toContain('https://cdn.example.com/front.jpg');
  });

  it('renders the fallback url when the item has no photos', () => {
    renderWithApollo(
      <ItemPhotoCarousel
        photos={[]}
        fallbackImageUrl="https://cdn.example.com/legacy.jpg"
        imageHeight={280}
        resizeMode="cover"
      />,
    );

    expect(heroUris()).toContain('https://cdn.example.com/legacy.jpg');
  });

  // A PENDING photo is returned only to its submitter; presenting it without a
  // badge would read as though it were already live on a shared catalog item.
  it('badges a pending photo', () => {
    renderWithApollo(
      <ItemPhotoCarousel
        photos={[photo({ status: ItemImageStatus.Pending })]}
        imageHeight={280}
        resizeMode="cover"
      />,
    );

    expect(screen.getByText('Pending review')).toBeTruthy();
  });

  it('does not badge an approved photo', () => {
    renderWithApollo(
      <ItemPhotoCarousel
        photos={[photo()]}
        imageHeight={280}
        resizeMode="cover"
      />,
    );

    expect(screen.queryByText('Pending review')).toBeNull();
  });

  it('renders the capped set for an item with many photos', () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      photo({
        id: `p${i}`,
        url: `https://cdn.example.com/${i}.jpg`,
        variants: [],
      }),
    );

    renderWithApollo(
      <ItemPhotoCarousel photos={many} imageHeight={280} resizeMode="cover" />,
    );

    // Well past MAX_GALLERY_PHOTOS, so it can never be a rendered page.
    expect(heroUris()).not.toContain('https://cdn.example.com/19.jpg');
  });

  // The hero band is a cover crop, so the 512px rendition is the right asset
  // here — the fullscreen viewer is the one that must reach the original.
  it('uses the rendition, not the original, for the hero band', () => {
    renderWithApollo(
      <ItemPhotoCarousel
        photos={[photo()]}
        imageHeight={280}
        resizeMode="cover"
      />,
    );

    expect(heroUris()).not.toContain('https://cdn.example.com/front.jpg');
  });

  // A lone broken photo leaves nothing to show, so the host can collapse its
  // hero rather than reserve 280pt for a placeholder icon.
  it('reports an unrenderable gallery when its only photo fails', () => {
    const onUnrenderable = jest.fn();
    renderWithApollo(
      <ItemPhotoCarousel
        photos={[photo()]}
        imageHeight={280}
        resizeMode="cover"
        onUnrenderable={onUnrenderable}
      />,
    );

    act(() => {
      screen.UNSAFE_getAllByType(CachedImage)[0].props.onError?.();
    });
    expect(onUnrenderable).toHaveBeenCalled();
  });

  // One bad photo among several is not a dead gallery — the rest still render.
  it('does not report unrenderable when other photos remain', () => {
    const onUnrenderable = jest.fn();
    renderWithApollo(
      <ItemPhotoCarousel
        photos={[photo({ id: 'a' }), photo({ id: 'b', variants: [] })]}
        imageHeight={280}
        resizeMode="cover"
        onUnrenderable={onUnrenderable}
      />,
    );

    act(() => {
      screen.UNSAFE_getAllByType(CachedImage)[0].props.onError?.();
    });
    expect(onUnrenderable).not.toHaveBeenCalled();
  });
});
