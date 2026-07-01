import { useCallback, useEffect, useRef } from 'react';
import { useRewardedAd } from 'react-native-google-mobile-ads';

import { rewardedUnitId } from './adUnits';

/**
 * Preloads a rewarded ad and keeps one ready, reloading after each close.
 * `isEarnedReward` flips true once the user has watched enough to earn the
 * reward — callers should grant the reward in an effect keyed on it. The
 * returned `show()` is ref-stable and no-ops when nothing is loaded (offline).
 */
export function useRewarded() {
  const { isLoaded, isClosed, isEarnedReward, reward, load, show } =
    useRewardedAd(rewardedUnitId);

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

  return { show: showIfLoaded, isLoaded, isEarnedReward, reward };
}
