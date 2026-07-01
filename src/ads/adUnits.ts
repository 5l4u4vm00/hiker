import { Platform } from 'react-native';
import { TestIds } from 'react-native-google-mobile-ads';

/**
 * Resolves the AdMob ad-unit id for a given format. In development builds, or
 * whenever the corresponding env var is unset, we fall back to Google's test
 * ad units so we never serve or click live ads (an AdMob policy violation).
 */
function resolve(test: string, android?: string, ios?: string): string {
  if (__DEV__) return test;
  const id = Platform.select({ android, ios });
  return id && id.length > 0 ? id : test;
}

export const bannerUnitId = resolve(
  TestIds.BANNER,
  process.env.EXPO_PUBLIC_ADMOB_BANNER_ANDROID,
  process.env.EXPO_PUBLIC_ADMOB_BANNER_IOS,
);

export const interstitialUnitId = resolve(
  TestIds.INTERSTITIAL,
  process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID,
  process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS,
);

export const rewardedUnitId = resolve(
  TestIds.REWARDED,
  process.env.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID,
  process.env.EXPO_PUBLIC_ADMOB_REWARDED_IOS,
);
