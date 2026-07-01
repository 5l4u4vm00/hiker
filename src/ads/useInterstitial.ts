import { useCallback, useEffect, useRef } from 'react';
import { useInterstitialAd } from 'react-native-google-mobile-ads';

import { interstitialUnitId } from './adUnits';

/**
 * Preloads an interstitial and keeps one ready, reloading after each close.
 * Returns a ref-stable `show()` that always reflects the latest load state, so
 * callers can safely capture it in a callback without it going stale. It
 * no-ops gracefully when nothing is loaded (e.g. offline on a hike).
 */
export function useInterstitial() {
  const { isLoaded, isClosed, load, show } = useInterstitialAd(interstitialUnitId);

  // Preload on mount and whenever the previous ad finished (isClosed).
  useEffect(() => {
    load();
  }, [load, isClosed]);

  // Mirror the latest {isLoaded, show} so the returned show() never goes stale.
  const latest = useRef({ isLoaded, show });
  useEffect(() => {
    latest.current = { isLoaded, show };
  }, [isLoaded, show]);

  const showIfLoaded = useCallback(() => {
    if (latest.current.isLoaded) latest.current.show();
  }, []);

  return { show: showIfLoaded, isLoaded };
}
