import { useReceiptPhotoConsentStore } from '../store/receiptPhotoConsentStore';

/**
 * Whether this user lets receipt photos go to the server to be read (null until
 * asked), and the answer's setter, for the scan's question and App Settings.
 */
export function useReceiptPhotoConsent() {
  const consent = useReceiptPhotoConsentStore(state => state.consent);
  const setConsent = useReceiptPhotoConsentStore(state => state.setConsent);
  return { consent, setConsent };
}
