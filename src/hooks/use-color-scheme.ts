import { useColorScheme as useSystemColorScheme } from 'react-native';

import { useThemeStore } from '@/state/themeStore';

/**
 * Resolves the active color scheme from the user's saved preference, falling
 * back to the system scheme when the preference is 'system'.
 */
export function useColorScheme(): 'light' | 'dark' {
  const system = useSystemColorScheme();
  const preference = useThemeStore((s) => s.preference);
  if (preference === 'system') return system === 'dark' ? 'dark' : 'light';
  return preference;
}
