'use no memo';

const mockUploadUnconfirmed = jest.fn();
jest.mock('#hooks/data/useImageUpload', () => ({
  ...jest.requireActual('#hooks/data/useImageUpload'),
  useImageUpload: () => ({ uploadUnconfirmed: mockUploadUnconfirmed }),
}));

import { act } from '@testing-library/react-native';
import { gql } from '@apollo/client';
import {
  recordMock,
  renderHookWithApollo,
  seedCache,
  type MockDataFor,
} from '#/test-utils/apolloMockProvider';
import {
  DeleteHomeItemPhotoDocument,
  UpdateHomeItemPhotoDocument,
} from '#features/catalog/hooks/useEntryPhoto.generated';
import { useEntryPhoto } from '#features/catalog/hooks/useEntryPhoto';
import { alertService } from '#/services/alertService';
import {
  EntryImageSource,
  ErrorCode,
  ImageUploadPurpose,
} from '#/graphql/generated/schemaTypes';

// Each write answers with every entry of the household for the item, so the
// cache settles from the response: these read the entry back from it.
const ENTRY_IMAGE = gql`
  fragment EntryPhotoTest_pantryItem on PantryItem {
    id
    image {
      url
      source
    }
  }
`;

const FILE = { uri: 'file:///photo.jpg', type: 'image/jpeg' };

type PhotoPayload = MockDataFor<
  typeof UpdateHomeItemPhotoDocument
>['updateHomeItemPhoto'] &
  MockDataFor<typeof DeleteHomeItemPhotoDocument>['deleteHomeItemPhoto'];

const payload = (
  image: { url: string; source: EntryImageSource } | null,
): PhotoPayload => ({
  __typename: 'HomeItemPhotoPayload',
  homeId: 'home-1',
  item: { __typename: 'Item', id: 'item-1' },
  pantryItems: [
    {
      __typename: 'PantryItem',
      id: 'stack-1',
      image: image && { __typename: 'EntryImage', ...image },
    },
  ],
  shoppingListItems: [],
});

const OWN = {
  url: 'https://signed.example.com/own.jpg',
  source: EntryImageSource.Household,
};

const readEntryImage = (cache: ReturnType<typeof seedCache>) =>
  cache.readFragment<{ image: { url: string; source: string } | null }>({
    id: 'PantryItem:stack-1',
    fragment: ENTRY_IMAGE,
  })?.image;

const render = (
  operationMocks: Parameters<typeof renderHookWithApollo>[1] extends infer O
    ? O extends { operationMocks: infer M }
      ? M
      : never
    : never,
  homeId: string | null = 'home-1',
) => {
  const cache = seedCache([]);
  const hook = renderHookWithApollo(() => useEntryPhoto(homeId, 'item-1'), {
    cache,
    operationMocks,
  });
  return { ...hook, cache };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUploadUnconfirmed.mockResolvedValue('uploads/key-1');
});

describe('useEntryPhoto', () => {
  it("shows the household's own photo on its entries, from the response", async () => {
    const write = recordMock(UpdateHomeItemPhotoDocument, {
      data: { updateHomeItemPhoto: payload(OWN) },
    });
    const { result, cache } = render([write.mock]);

    let landed = false;
    await act(async () => {
      landed = await result.current.setOwnPhoto(FILE);
    });

    expect(landed).toBe(true);
    expect(mockUploadUnconfirmed).toHaveBeenCalledWith(
      FILE,
      ImageUploadPurpose.HouseholdItemPhoto,
      { homeId: 'home-1', itemId: 'item-1' },
    );
    expect(write.fired).toEqual([
      {
        input: {
          homeId: 'home-1',
          itemId: 'item-1',
          uploadKey: 'uploads/key-1',
        },
      },
    ]);
    expect(readEntryImage(cache)).toEqual({ __typename: 'EntryImage', ...OWN });
  });

  it("picks one of the item's photos without uploading anything", async () => {
    const write = recordMock(UpdateHomeItemPhotoDocument, {
      data: { updateHomeItemPhoto: payload(OWN) },
    });
    const { result } = render([write.mock]);

    await act(async () => {
      await result.current.pickItemPhoto('photo-2');
    });

    expect(mockUploadUnconfirmed).not.toHaveBeenCalled();
    expect(write.fired).toEqual([
      { input: { homeId: 'home-1', itemId: 'item-1', itemImageId: 'photo-2' } },
    ]);
  });

  it('goes back to the catalog photo', async () => {
    const catalog = {
      url: 'https://cdn.example.com/front.jpg',
      source: EntryImageSource.Catalog,
    };
    const clear = recordMock(DeleteHomeItemPhotoDocument, {
      data: { deleteHomeItemPhoto: payload(catalog) },
    });
    const { result, cache } = render([clear.mock]);

    await act(async () => {
      await result.current.revertToCatalogPhoto();
    });

    expect(clear.fired).toEqual([
      { input: { homeId: 'home-1', itemId: 'item-1' } },
    ]);
    expect(readEntryImage(cache)).toEqual({
      __typename: 'EntryImage',
      ...catalog,
    });
  });

  it('says it needs a connection, and sends nothing, offline', async () => {
    mockUploadUnconfirmed.mockResolvedValue(null);
    const write = recordMock(UpdateHomeItemPhotoDocument, {
      data: { updateHomeItemPhoto: payload(OWN) },
    });
    const { result } = render([write.mock]);

    let landed = true;
    await act(async () => {
      landed = await result.current.setOwnPhoto(FILE);
    });

    expect(landed).toBe(false);
    expect(write.fired).toHaveLength(0);
    expect(alertService.alert).toHaveBeenCalledWith(
      'No Internet Connection',
      expect.stringContaining('internet connection'),
    );
  });

  it('reports a refusal and answers that nothing changed', async () => {
    const write = recordMock(UpdateHomeItemPhotoDocument, {
      data: {
        updateHomeItemPhoto: {
          __typename: 'ForbiddenError',
          code: ErrorCode.HomeAccessDenied,
          message: 'Not a member',
        },
      },
    });
    const { result } = render([write.mock]);

    let landed = true;
    await act(async () => {
      landed = await result.current.pickItemPhoto('photo-2');
    });

    expect(landed).toBe(false);
    expect(alertService.alert).toHaveBeenCalledWith(
      "Couldn't change the photo",
      expect.any(String),
    );
  });

  it('does nothing without a home to set it for', async () => {
    const write = recordMock(UpdateHomeItemPhotoDocument, {
      data: { updateHomeItemPhoto: payload(OWN) },
    });
    const { result } = render([write.mock], null);

    let landed = true;
    await act(async () => {
      landed = await result.current.pickItemPhoto('photo-2');
    });

    expect(landed).toBe(false);
    expect(write.fired).toHaveLength(0);
  });
});
