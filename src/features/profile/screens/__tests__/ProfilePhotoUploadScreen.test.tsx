import React from 'react';
import { act, screen, userEvent, within } from '@testing-library/react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import {
  inputOf,
  recordMock,
  renderWithApollo,
} from '#/test-utils/apolloMockProvider';
import { operationLog } from '#/test-utils/operationLog';
import { useStore } from '#store';
import { t } from '#/i18n';
import { alertService } from '#/services/alertService';
import {
  ConfirmProfileImageUploadDocument,
  CreateImageUploadUrlDocument,
} from '#operations/image/imageUpload.generated';
import { UpdateUserProfileDocument } from '#operations/auth/user.generated';
import { kitTestIDs } from '#components/testIDs';
import { Screen } from '#components/templates/Screen';
import { ProfilePhotoUploadScreen } from '../ProfilePhotoUploadScreen';

jest.mock('#hooks/navigation/useAppNavigation');

const mockNav = jest
  .requireMock('#hooks/navigation/useAppNavigation')
  .useAppNavigation();

let log = operationLog();

const PICKED = {
  uri: 'file:///picked.jpg',
  type: 'image/jpeg',
  fileName: 'picked.jpg',
  fileSize: 120_000,
  width: 800,
  height: 800,
};
// Told apart from the pick by its type, which is what the upload asks a URL for.
const CROPPED = {
  ...PICKED,
  uri: 'file:///cropped.png',
  fileName: 'cropped.png',
  type: 'image/png',
};

/**
 * The object store the file is posted to: the network boundary under the
 * upload. It answers each upload with `status` once sent.
 */
function stubUploads(status: number) {
  class UploadRequest {
    status = 0;
    statusText = '';
    timeout = 0;
    upload = { onprogress: null };
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    ontimeout: (() => void) | null = null;
    open() {}
    setRequestHeader() {}
    abort() {}
    send() {
      this.status = status;
      queueMicrotask(() => this.onload?.());
    }
  }
  const real = globalThis.XMLHttpRequest;
  const install = (value: unknown) => {
    Object.defineProperty(globalThis, 'XMLHttpRequest', {
      value,
      configurable: true,
      writable: true,
    });
  };
  install(UploadRequest);
  return {
    restore: () => {
      install(real);
    },
  };
}

function openUpload(answers: ReturnType<typeof recordMock>[] = []) {
  renderWithApollo(<ProfilePhotoUploadScreen />, {
    links: [log.link],
    operationMocks: answers.map(answer => answer.mock),
  });
}

async function pick(user: ReturnType<typeof userEvent.setup>) {
  jest.mocked(launchImageLibrary).mockResolvedValue({ assets: [PICKED] });
  await user.press(screen.getByText(t('profile.selectPhoto')));
}

const uploadAnswers = () => [
  recordMock(CreateImageUploadUrlDocument, {
    data: {
      createImageUploadUrl: {
        __typename: 'CreateImageUploadUrlPayload',
        url: 'https://store.example/upload',
        key: 'avatars/user-1.jpg',
        fields: [],
      },
    },
  }),
  recordMock(ConfirmProfileImageUploadDocument, {
    data: {
      confirmProfileImageUpload: {
        __typename: 'ConfirmProfileImageUploadPayload',
        url: 'https://cdn.example/avatars/user-1.jpg',
      },
    },
  }),
];

beforeEach(() => {
  jest.clearAllMocks();
  log = operationLog();
  useStore.setState({
    user: {
      id: 'user-1',
      email: 'cook@example.com',
      emailVerified: true,
      onBoarded: true,
    },
    pendingCroppedImage: null,
    isOnline: true,
    apiReachable: true,
  });
});

describe('the profile photo screen', () => {
  it('offers a photo taken or picked, and closes from its header', async () => {
    openUpload();

    expect(
      screen.getByText(t('profile.choosePicturePersonalize')),
    ).toBeTruthy();
    expect(screen.getByText(t('labels.takePhoto'))).toBeTruthy();
    await userEvent
      .setup()
      .press(
        within(screen.UNSAFE_getByType(Screen)).getByTestId(
          kitTestIDs.headerCloseButton,
        ),
      );

    expect(mockNav.goBack).toHaveBeenCalledTimes(1);
  });

  it('shows a picked photo, offers its crop, and starts over on request', async () => {
    openUpload();
    const user = userEvent.setup();

    await pick(user);
    expect(screen.getByText(t('profile.tapCropToAdjust'))).toBeTruthy();
    await user.press(screen.getByLabelText(t('a11y.cropPhoto')));
    expect(mockNav.toImageCrop).toHaveBeenCalledWith({
      imageFile: expect.objectContaining({ uri: PICKED.uri }),
    });

    await user.press(screen.getByText(t('profile.chooseDifferentPhoto')));
    expect(
      screen.getByText(t('profile.choosePicturePersonalize')),
    ).toBeTruthy();
  });

  it('takes back a cropped photo, offering no second crop, and uploads that one', async () => {
    const uploads = stubUploads(204);
    const avatar = recordMock(UpdateUserProfileDocument, { held: true });
    const [urlRequest, ...rest] = uploadAnswers();
    if (!urlRequest) throw new Error('no upload URL answer');
    openUpload([urlRequest, ...rest, avatar]);
    const user = userEvent.setup();
    await pick(user);

    // The crop screen hands its result back through the store.
    act(() => {
      useStore.getState().setPendingCroppedImage(CROPPED);
    });
    act(() => {
      jest
        .requireMock('@react-navigation/native')
        .useFocusEffect.mock.calls.at(-1)?.[0]();
    });
    expect(screen.getByText(t('profile.photoReadyToUpload'))).toBeTruthy();
    expect(screen.queryByLabelText(t('a11y.cropPhoto'))).not.toBeOnTheScreen();

    await user.press(screen.getByText(t('profile.uploadPhoto')));
    await log.requested(UpdateUserProfileDocument);
    uploads.restore();

    expect(inputOf(urlRequest.fired[0] ?? {})).toMatchObject({
      mime: CROPPED.type,
    });
    expect(inputOf(avatar.fired[0] ?? {})).toMatchObject({
      avatar: 'https://cdn.example/avatars/user-1.jpg',
    });
  });

  it('drops a crop when another photo is picked', async () => {
    openUpload();
    const user = userEvent.setup();
    await pick(user);
    act(() => {
      useStore.getState().setPendingCroppedImage(CROPPED);
    });
    act(() => {
      jest
        .requireMock('@react-navigation/native')
        .useFocusEffect.mock.calls.at(-1)?.[0]();
    });

    await user.press(screen.getByText(t('profile.chooseDifferentPhoto')));
    await pick(user);

    expect(screen.getByText(t('profile.tapCropToAdjust'))).toBeTruthy();
  });

  it('stays open while the upload is out', async () => {
    openUpload([recordMock(CreateImageUploadUrlDocument, { held: true })]);
    const user = userEvent.setup();
    await pick(user);
    await user.press(screen.getByText(t('profile.uploadPhoto')));
    await log.requested(CreateImageUploadUrlDocument);

    await user.press(
      within(screen.UNSAFE_getByType(Screen)).getByTestId(
        kitTestIDs.headerCloseButton,
      ),
    );

    expect(mockNav.goBack).not.toHaveBeenCalled();
  });

  it('leaves once the avatar is set', async () => {
    const uploads = stubUploads(204);
    openUpload([
      ...uploadAnswers(),
      recordMock(UpdateUserProfileDocument, {
        data: {
          updateProfile: {
            __typename: 'UpdateProfilePayload',
            userProfile: {
              id: 'profile-1',
              avatar: 'https://cdn.example/a.jpg',
            },
          },
        },
      }),
    ]);
    const user = userEvent.setup();
    await pick(user);

    await user.press(screen.getByText(t('profile.uploadPhoto')));
    await log.landed(UpdateUserProfileDocument);
    await act(async () => undefined);
    uploads.restore();

    expect(mockNav.goBack).toHaveBeenCalledTimes(1);
  });

  it('says so when the upload fails, and stays', async () => {
    const uploads = stubUploads(500);
    openUpload(uploadAnswers());
    const user = userEvent.setup();
    await pick(user);

    await user.press(screen.getByText(t('profile.uploadPhoto')));
    await log.landed(CreateImageUploadUrlDocument);
    await act(async () => undefined);
    uploads.restore();

    expect(alertService.alert).toHaveBeenCalled();
    expect(mockNav.goBack).not.toHaveBeenCalled();
  });
});
