import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';

import { bannerUnitId } from '@/ads/adUnits';
import { useTheme } from '@/hooks/use-theme';

/**
 * Anchored adaptive banner for list screens. Renders nothing until an ad
 * successfully loads (and again if it later fails), so the layout is unaffected
 * when offline — the common case while hiking.
 */
export function AdBanner() {
  const theme = useTheme();
  const [loaded, setLoaded] = useState(false);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }, !loaded && styles.hidden]}>
      <BannerAd
        unitId={bannerUnitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        onAdLoaded={() => setLoaded(true)}
        onAdFailedToLoad={() => setLoaded(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  hidden: { height: 0, overflow: 'hidden' },
});
