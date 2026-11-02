import { useState } from 'react';
import { requirePlatform } from '#/platform/install';

/**
 * Where "Stores near me" stands: `explaining` while the host says what
 * location is for, before the OS asks; `declined` for this visit; `blocked`
 * until the person turns it on in Settings.
 */
export type NearMeState =
  | 'idle'
  | 'explaining'
  | 'locating'
  | 'located'
  | 'declined'
  | 'blocked'
  | 'failed';

// Two decimals is about a kilometre: all a nearby search needs, and no more
// leaves the device.
const rounded = (degrees: number) => Math.round(degrees * 100) / 100;

/**
 * The device's approximate place, asked for only when the person wants
 * stores near them: what it is for is explained first, then the OS asks. A
 * person who declines is not asked again during the visit.
 */
export function useNearMe() {
  const [state, setState] = useState<NearMeState>('idle');
  const [place, setPlace] = useState<{ lat: number; lng: number } | null>(null);

  const locate = async () => {
    setState('locating');
    const found = await requirePlatform('approximateLocation').currentPlace();
    if (!found) {
      setState('failed');
      return;
    }
    setPlace({ lat: rounded(found.lat), lng: rounded(found.lng) });
    setState('located');
  };

  /** "Stores near me": reads at once when allowed, else explains first. */
  const ask = async () => {
    if (state === 'declined') return;
    const access = await requirePlatform('approximateLocation').access();
    if (access === 'granted') return locate();
    setState(access === null ? 'explaining' : 'blocked');
  };

  /** After the explanation: the OS's own prompt. */
  const allow = async () => {
    setState('locating');
    const access = await requirePlatform('approximateLocation').requestAccess();
    if (access === 'granted') return locate();
    setState(access === 'denied' ? 'declined' : 'blocked');
  };

  return {
    state,
    /** Rounded to about a kilometre; null until located. */
    place,
    ask,
    allow,
    decline: () => {
      setState('declined');
    },
    openSettings: () => {
      requirePlatform('approximateLocation').openSettings();
    },
  };
}
