import { useState } from 'react';
import TextRecognition, {
  type TextBlock,
  type TextLine,
} from '@react-native-ml-kit/text-recognition';
import { executeQuery } from '#/utils/compilerSafeWrappers';

export interface OcrCandidate {
  text: string;
  area: number;
}

export interface OcrNetWeight {
  value: number;
  unitName: string;
}

export interface OcrScanResult {
  candidates: OcrCandidate[];
  netWeights: OcrNetWeight[];
}

const frameArea = (frame?: { width: number; height: number }): number =>
  frame ? Math.max(0, frame.width) * Math.max(0, frame.height) : 0;

// Strip lines that are just prices, net weights, percentages, dates — these
// are frequently the largest text on packaging but never what the user wants.
const NOISE_PATTERN =
  /^[\s\d$€£¥.,x×/%:-]+(?:\s*(?:kg|g|mg|lb|lbs|oz|ml|l|cl|ct|pcs?|ea|pack|fl\s*oz))?\s*$/i;

const uppercaseRatio = (text: string): number => {
  const letters = text.replace(/[^A-Za-z]/g, '');
  if (letters.length === 0) return 0;
  const upper = letters.replace(/[^A-Z]/g, '').length;
  return upper / letters.length;
};

// Match a number+unit pair anywhere in OCR output. Negative lookbehind skips
// prices ($12), fractions (1/2), IP-ish sequences (192.168), etc.
const NET_WEIGHT_PATTERN =
  /(?<![$/.\d])(\d+(?:[.,]\d+)?)\s*\.?\s*(fl\s*\.?\s*oz|floz|oz|ml|l|lbs?|kg|g|mg|ct|count|pcs?|ea)\b/gi;

const normalizeUnit = (raw: string): string => {
  const compact = raw.toLowerCase().replace(/[.\s]/g, '');
  if (compact === 'floz' || compact === 'fluidoz') return 'fl oz';
  if (compact === 'lb' || compact === 'lbs') return 'lb';
  if (compact === 'count' || compact === 'ct') return 'ct';
  if (compact === 'pc' || compact === 'pcs') return 'pc';
  return compact; // oz, ml, l, g, kg, mg, ea
};

/**
 * Scan the full OCR text for net-weight phrases like "16 FL OZ", "473 ml",
 * "2.5 LB", "500g". Returns each detected pair in source order so dual-labelled
 * packaging (e.g. "16 FL OZ / 473 ml") yields both entries.
 */
export const extractNetWeights = (text: string): OcrNetWeight[] => {
  const out: OcrNetWeight[] = [];
  const seen = new Set<string>();
  for (const match of text.matchAll(NET_WEIGHT_PATTERN)) {
    const value = parseFloat(match[1].replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) continue;
    const unitName = normalizeUnit(match[2]);
    const key = `${value}|${unitName}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ value, unitName });
  }
  return out;
};

/**
 * Convert MLKit blocks/lines into a short ranked list of candidate strings.
 * Exported for direct unit-testing; consumers should prefer the hook.
 */
export const toCandidates = (blocks: TextBlock[]): OcrCandidate[] => {
  const pool: OcrCandidate[] = [];
  const seen = new Set<string>();

  const push = (text: string, frame?: { width: number; height: number }) => {
    const trimmed = text.trim().replace(/\s+/g, ' ');
    if (trimmed.length < 2) return;
    if (NOISE_PATTERN.test(trimmed)) return;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    pool.push({ text: trimmed, area: frameArea(frame) });
  };

  for (const block of blocks) {
    push(block.text, block.frame);
    for (const line of block.lines as TextLine[]) {
      push(line.text, line.frame);
    }
  }

  return pool
    .sort((a, b) => {
      if (b.area !== a.area) return b.area - a.area;
      return uppercaseRatio(b.text) - uppercaseRatio(a.text);
    })
    .slice(0, 6);
};

export interface UseOcrScannerReturn {
  /** Ranked text candidates from the last successful scan. */
  candidates: OcrCandidate[];
  /** Net weights parsed from the full OCR text, in source order. */
  netWeights: OcrNetWeight[];
  /** True while MLKit is processing a photo. */
  isReading: boolean;
  /** True when the last scan threw (distinct from "no text detected"). */
  failed: boolean;
  /** Run OCR on a photo URI; populates state or flips `failed`. */
  scan: (uri: string) => Promise<OcrScanResult | null>;
  /** Clear all state back to initial. */
  reset: () => void;
}

/**
 * Thin wrapper around `@react-native-ml-kit/text-recognition` that keeps
 * the try-catch outside any hook body (React Compiler requirement) and
 * exposes just the state a camera screen needs.
 */
export function useOcrScanner(): UseOcrScannerReturn {
  const [candidates, setCandidates] = useState<OcrCandidate[]>([]);
  const [netWeights, setNetWeights] = useState<OcrNetWeight[]>([]);
  const [isReading, setIsReading] = useState(false);
  const [failed, setFailed] = useState(false);

  const scan = async (uri: string) => {
    setIsReading(true);
    setFailed(false);
    const result = await executeQuery(
      () => TextRecognition.recognize(uri),
      'useOcrScanner.recognize',
    );
    setIsReading(false);
    if (!result) {
      setFailed(true);
      return null;
    }
    const nextCandidates = toCandidates(result.blocks);
    const nextNetWeights = extractNetWeights(result.text);
    setCandidates(nextCandidates);
    setNetWeights(nextNetWeights);
    return { candidates: nextCandidates, netWeights: nextNetWeights };
  };

  const reset = () => {
    setCandidates([]);
    setNetWeights([]);
    setIsReading(false);
    setFailed(false);
  };

  return { candidates, netWeights, isReading, failed, scan, reset };
}
