import { useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

import { useThemeStore } from '@/state/themeStore';

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web.
 * Layers the user's saved preference on top of the system scheme.
 */
export function useColorScheme(): 'light' | 'dark' {
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    // Intentional one-time hydration flag for static web rendering.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasHydrated(true);
  }, []);

  const system = useRNColorScheme();
  const preference = useThemeStore((s) => s.preference);

  if (!hasHydrated) return 'light';
  if (preference === 'system') return system === 'dark' ? 'dark' : 'light';
  return preference;
}
