import { useState } from 'react';
import { useTranslation, type TranslationKey } from '#/i18n';
import type { TabBarAddAction } from '#/context/TabBarActionsContext';
import { useIsApiUnavailable } from '#hooks/app/useIsApiUnavailable';
import type { CaptureSheetKind } from '#features/recipes/components/capture/CaptureSheet';
import { recipesTestIDs } from '#features/recipes/testIDs';
import { useCaptureSources } from './useCaptureSources';

/** The capture sheet a menu entry opens. */
export type CaptureSheetName = CaptureSheetKind | 'photo';

interface MenuEntry {
  sheet: CaptureSheetName;
  label: TranslationKey;
  icon: string;
  testID: string;
}

const MENU: readonly MenuEntry[] = [
  {
    sheet: 'link',
    label: 'recipes.addFromLink',
    icon: 'link-outline',
    testID: recipesTestIDs.addFromLink,
  },
  {
    sheet: 'photo',
    label: 'recipes.addFromPhotos',
    icon: 'camera-outline',
    testID: recipesTestIDs.addFromPhotos,
  },
  {
    sheet: 'text',
    label: 'recipes.addFromText',
    icon: 'document-text-outline',
    testID: recipesTestIDs.addFromText,
  },
];

/**
 * The Recipes tab's capture entries for its `+`, one per source switched on,
 * and the sheet the last one pressed keeps open.
 */
export function useRecipeCaptureMenu() {
  const { t } = useTranslation();
  const sources = useCaptureSources();
  const apiUnavailable = useIsApiUnavailable();
  const [sheet, setSheet] = useState<CaptureSheetName | null>(null);

  const disabledReason = apiUnavailable
    ? t('recipes.captureNeedsConnection')
    : undefined;
  const offered: Record<CaptureSheetName, boolean> = {
    link: sources.url,
    photo: sources.photo,
    text: sources.text,
  };
  const entries = MENU.filter(entry => offered[entry.sheet]).map(
    (entry): TabBarAddAction => ({
      key: entry.sheet,
      label: t(entry.label),
      icon: entry.icon,
      onPress: () => setSheet(entry.sheet),
      disabledReason,
      testID: entry.testID,
    }),
  );

  return {
    entries,
    /** Off, nothing a capture left behind shows either: no row, poll or sheet. */
    enabled: sources.any,
    host: {
      sheet,
      textAllowed: sources.text,
      onDismiss: () => setSheet(null),
    },
  };
}
