import { useReceiptPhotoConsentStore } from '../store/receiptPhotoConsentStore';

/**
 * Whether this user lets receipt photos go to the server to be read (null until
 * asked), and the answer's setter, for App Settings. The scan reads the stored
 * answer with `storedReceiptPhotoConsent`, which waits for it to load.
 */
export function useReceiptPhotoConsent() {
  const consent = useReceiptPhotoConsentStore(state => state.consent);
  const setConsent = useReceiptPhotoConsentStore(state => state.setConsent);
  return { consent, setConsent };
}
