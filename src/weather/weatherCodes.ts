import type { Ionicons } from '@expo/vector-icons';
import type { ParseKeys } from 'i18next';

import i18n from '@/i18n';

type IconName = keyof typeof Ionicons.glyphMap;

/**
 * Maps a WMO weather interpretation code (as returned by Open-Meteo) to a
 * translation key and an Ionicons glyph. Codes are grouped into the ranges
 * defined by the WMO 4677 table; anything unrecognized falls back to a neutral
 * cloud.
 */
function describe(code: number): { labelKey: ParseKeys; icon: IconName } {
  if (code === 0) return { labelKey: 'weather.clear', icon: 'sunny' };
  if (code <= 2) return { labelKey: 'weather.partlyCloudy', icon: 'partly-sunny' };
  if (code === 3) return { labelKey: 'weather.overcast', icon: 'cloud' };
  if (code === 45 || code === 48) return { labelKey: 'weather.fog', icon: 'cloud' };
  if (code >= 51 && code <= 57) return { labelKey: 'weather.drizzle', icon: 'rainy' };
  if (code >= 61 && code <= 67) return { labelKey: 'weather.rain', icon: 'rainy' };
  if (code >= 71 && code <= 77) return { labelKey: 'weather.snow', icon: 'snow' };
  if (code >= 80 && code <= 82) return { labelKey: 'weather.rainShowers', icon: 'rainy' };
  if (code === 85 || code === 86) return { labelKey: 'weather.snowShowers', icon: 'snow' };
  if (code >= 95) return { labelKey: 'weather.thunderstorm', icon: 'thunderstorm' };
  return { labelKey: 'weather.cloudy', icon: 'cloud' };
}

export function weatherLabel(code: number): string {
  return i18n.t(describe(code).labelKey);
}

export function weatherIcon(code: number): IconName {
  return describe(code).icon;
}
