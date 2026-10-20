import { useEffect, useRef } from 'react';
import { t } from '#/i18n';
import { alertService } from '#/services/alertService';
import { useTabBarSetters } from '#/context/TabBarActionsContext';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import type { BarcodeSource } from '#features/barcode/types';

export interface ScannerContext {
  source: BarcodeSource;
  pantryId?: string;
  listId?: string;
  shoppingListId?: string;
}

interface UseScannerSetupOptions {
  /** Defaults to true. */
  enabled?: boolean;
  /** Absent means the scanner reports "no home selected" instead of opening. */
  homeId?: string | null;
  context: ScannerContext;
  /** Replaces the default "no home selected" alert. */
  onNoHome?: () => void;
}

/** Registers the tab bar's scanner button and tears it down on unmount. */
export function useScannerSetup(options: UseScannerSetupOptions): void {
  const { enabled = true, homeId, context, onNoHome } = options;

  const { setScannerProps } = useTabBarSetters();
  const { toHomeManagement, toBarcode } = useAppNavigation();

  // Refs so changing values don't re-register the scanner button.
  const homeIdRef = useRef(homeId);
  const contextRef = useRef(context);
  const onNoHomeRef = useRef(onNoHome);

  useEffect(() => {
    homeIdRef.current = homeId;
  }, [homeId]);

  useEffect(() => {
    contextRef.current = context;
  }, [context]);

  useEffect(() => {
    onNoHomeRef.current = onNoHome;
  }, [onNoHome]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleScanPress = () => {
      if (!homeIdRef.current) {
        if (onNoHomeRef.current) {
          onNoHomeRef.current();
        } else {
          alertService.alert(
            t('scanner.noHomeTitle'),
            t('scanner.noHomeBody'),
            [
              { text: t('labels.cancel'), style: 'cancel' },
              {
                text: t('scanner.manageHomes'),
                onPress: () => toHomeManagement(),
                style: 'default',
              },
            ],
          );
        }
        return;
      }

      toBarcode(contextRef.current);
    };

    setScannerProps(handleScanPress, true);

    return () => {
      setScannerProps(undefined, false);
    };
  }, [enabled, setScannerProps, toHomeManagement, toBarcode]);
}
