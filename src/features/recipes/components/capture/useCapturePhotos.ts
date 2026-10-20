import { useEffect, useRef, useState } from 'react';
import DocumentScanner, {
  ResponseType,
  ScanDocumentResponseStatus,
  type ScanDocumentResponse,
} from 'react-native-document-scanner-plugin';
import { errorService } from '#/services/errorService';
import { ImageUploadPurpose } from '#/graphql/generated/schemaTypes';
import { usePhotoCapture } from '#hooks/device/usePhotoCapture';
import { useImageUpload } from '#hooks/data/useImageUpload';
import { TextRecognition } from '#/native/TextRecognition';
import { uploadTogether } from '#/utils/uploadTogether';
import type { PreparedPhoto } from '#/types/textRecognition';

/** The pages one capture reads, as `createRecipeCapture` takes them. */
export const MAX_CAPTURE_PHOTOS = 3;
/** Past this the upload is abandoned and the pages kept for another try. */
const PHOTO_SEND_LIMIT_MS = 45_000;

const dropPhotos = (uris: readonly string[]) => {
  if (uris.length === 0) return;
  void TextRecognition.deletePhotos(uris).catch((error: unknown) => {
    errorService.reportError(error, { operation: 'Delete recipe photos' });
  });
};

const toUpload = (photo: PreparedPhoto) => ({
  uri: photo.uri,
  fileName: 'recipe.jpg',
  fileSize: photo.fileSize,
  type: 'image/jpeg',
});

/**
 * Up to three pages of one recipe, scanned or picked, then made small, upright
 * and metadata-free on the phone and uploaded as recipe photos. A page the
 * user removes, and every page once sent or abandoned, is deleted.
 */
export function useCapturePhotos() {
  const { uploadUnconfirmed } = useImageUpload();
  const { pickPhoto } = usePhotoCapture({ multiple: true });
  const [pages, setPages] = useState<string[]>([]);
  const [scannerUnavailable, setScannerUnavailable] = useState(false);
  const [uploading, setUploading] = useState(false);
  // Read by the async handlers, which outlive the render that made them.
  const pagesRef = useRef(pages);
  useEffect(() => {
    pagesRef.current = pages;
  });

  const addPages = (uris: readonly string[]) => {
    const room = MAX_CAPTURE_PHOTOS - pagesRef.current.length;
    dropPhotos(uris.slice(room));
    setPages(current => [...current, ...uris.slice(0, room)]);
  };

  const scan = async () => {
    let response: ScanDocumentResponse;
    try {
      response = await DocumentScanner.scanDocument({
        responseType: ResponseType.ImageFilePath,
        maxNumDocuments: MAX_CAPTURE_PHOTOS - pagesRef.current.length,
      });
    } catch {
      // No scanner here (a simulator, a phone without Play services'): photos
      // from the library still work.
      setScannerUnavailable(true);
      return;
    }
    if (response.status !== ScanDocumentResponseStatus.Success) return;
    addPages(response.scannedImages ?? []);
  };

  const choose = async () => {
    const photos = await pickPhoto();
    addPages(photos.map(photo => photo.uri));
  };

  const remove = (uri: string) => {
    setPages(current => current.filter(page => page !== uri));
    dropPhotos([uri]);
  };

  /** The pages' upload keys, or null when one did not go up. */
  const uploadPages = (photos: readonly PreparedPhoto[]) =>
    uploadTogether(
      photos.map(toUpload),
      (file, signal) =>
        uploadUnconfirmed(file, ImageUploadPurpose.RecipePhoto, { signal }),
      { limitMs: PHOTO_SEND_LIMIT_MS, operation: 'Upload recipe photo' },
    );

  /** Prepares and uploads every page; the prepared files go whatever happens. */
  const upload = async (): Promise<string[] | null> => {
    setUploading(true);
    let prepared: PreparedPhoto[] = [];
    try {
      // The originals are kept, so a failed upload can be tried again.
      prepared = await TextRecognition.preparePhotos(pagesRef.current, {
        keepPages: true,
      });
    } catch (error) {
      errorService.reportError(error, { operation: 'Prepare recipe photos' });
    }
    const keys =
      prepared.length === pagesRef.current.length
        ? await uploadPages(prepared)
        : null;
    dropPhotos(prepared.map(photo => photo.uri));
    setUploading(false);
    return keys;
  };

  /** Sent or abandoned: the pages leave the phone. */
  const discard = () => {
    dropPhotos(pagesRef.current);
    setPages([]);
  };

  return {
    pages,
    canAddPage: pages.length < MAX_CAPTURE_PHOTOS,
    scannerUnavailable,
    uploading,
    scan,
    choose,
    remove,
    upload,
    discard,
  };
}
