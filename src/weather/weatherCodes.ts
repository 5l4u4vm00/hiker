import type { Ionicons } from '@expo/vector-icons';

type IconName = keyof typeof Ionicons.glyphMap;

/**
 * Maps a WMO weather interpretation code (as returned by Open-Meteo) to a human
 * label and an Ionicons glyph. Codes are grouped into the ranges defined by the
 * WMO 4677 table; anything unrecognized falls back to a neutral cloud.
 */
function describe(code: number): { label: string; icon: IconName } {
  if (code === 0) return { label: 'Clear', icon: 'sunny' };
  if (code <= 2) return { label: 'Partly cloudy', icon: 'partly-sunny' };
  if (code === 3) return { label: 'Overcast', icon: 'cloud' };
  if (code === 45 || code === 48) return { label: 'Fog', icon: 'cloud' };
  if (code >= 51 && code <= 57) return { label: 'Drizzle', icon: 'rainy' };
  if (code >= 61 && code <= 67) return { label: 'Rain', icon: 'rainy' };
  if (code >= 71 && code <= 77) return { label: 'Snow', icon: 'snow' };
  if (code >= 80 && code <= 82) return { label: 'Rain showers', icon: 'rainy' };
  if (code === 85 || code === 86) return { label: 'Snow showers', icon: 'snow' };
  if (code >= 95) return { label: 'Thunderstorm', icon: 'thunderstorm' };
  return { label: 'Cloudy', icon: 'cloud' };
}

export function weatherLabel(code: number): string {
  return describe(code).label;
}

export function weatherIcon(code: number): IconName {
  return describe(code).icon;
}
