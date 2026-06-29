/**
 * Build-time MapTiler key from the `EXPO_PUBLIC_MAPTILER_KEY` env var, inlined
 * into the JS bundle. `EXPO_PUBLIC_*` vars are not secrets — they ship in the
 * client, so restrict the key by allowed origins / bundle id in the MapTiler
 * dashboard.
 */
export const MAPTILER_TOKEN = process.env.EXPO_PUBLIC_MAPTILER_KEY ?? '';
