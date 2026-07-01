import { Platform } from 'react-native';
import mobileAds, { AdsConsent, MaxAdContentRating } from 'react-native-google-mobile-ads';
import {
  requestTrackingPermissionsAsync,
  getTrackingPermissionsAsync,
} from 'expo-tracking-transparency';

let initialized = false;

/**
 * One-time AdMob bootstrap, called from the app's startup effect.
 *
 * Order matters for store-review compliance:
 *   1. UMP (GDPR) consent — request info, then show the consent form if the
 *      user's region requires one.
 *   2. iOS App Tracking Transparency — the system prompt that authorizes use of
 *      the advertising identifier for personalized ads.
 *   3. Initialize the Mobile Ads SDK.
 *
 * Every step is best-effort: ad failures (including being offline, the common
 * case on a hike) must never block app launch, so callers wrap this in their
 * own try/catch and we also swallow non-fatal errors here.
 */
export async function initAds(): Promise<void> {
  if (initialized) return;
  initialized = true;

  try {
    // 1. GDPR / UMP consent. gatherConsent() = requestInfoUpdate + show-if-required.
    await AdsConsent.gatherConsent();
  } catch (err) {
    console.warn('[ads] consent flow failed', err);
  }

  // 2. iOS ATT. Only prompt once; skip if the user already decided.
  if (Platform.OS === 'ios') {
    try {
      const current = await getTrackingPermissionsAsync();
      if (current.canAskAgain && current.status === 'undetermined') {
        await requestTrackingPermissionsAsync();
      }
    } catch (err) {
      console.warn('[ads] tracking permission request failed', err);
    }
  }

  // 3. Initialize the SDK. Keep content rating conservative for a general-audience app.
  try {
    await mobileAds().setRequestConfiguration({
      maxAdContentRating: MaxAdContentRating.PG,
    });
    await mobileAds().initialize();
  } catch (err) {
    console.warn('[ads] initialization failed', err);
  }
}
