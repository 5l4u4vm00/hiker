import { GeoJSONSource, type CameraRef, Layer } from '@maplibre/maplibre-react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { MapCanvas } from '@/components/map-canvas';
import { StatCard, StatGrid } from '@/components/stat-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { getRoute, getRouteWaypoints } from '@/db/routes';
import type { Route, Waypoint } from '@/db/types';
import { formatDistance, formatElevation } from '@/tracking/stats';

function boundsOfCoords(coords: number[][]): [number, number, number, number] | null {
  if (coords.length === 0) return null;
  let [west, south] = coords[0];
  let [east, north] = coords[0];
  for (const [lon, lat] of coords) {
    west = Math.min(west, lon);
    east = Math.max(east, lon);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }
  return [west, south, east, north];
}

export default function RouteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [route, setRoute] = useState<Route | null>(null);
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const cameraRef = useRef<CameraRef>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setRoute(await getRoute(id));
      setWaypoints(await getRouteWaypoints(id));
    })();
  }, [id]);

  useEffect(() => {
    const bounds = route ? boundsOfCoords(route.geometry.coordinates) : null;
    if (bounds && cameraRef.current) {
      cameraRef.current.fitBounds([bounds[0], bounds[1], bounds[2], bounds[3]], {
        padding: { top: 40, right: 40, bottom: 40, left: 40 },
        duration: 600,
      });
    }
  }, [route]);

  if (!route) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText themeColor="textSecondary">Loading…</ThemedText>
      </ThemedView>
    );
  }

  const lineFeature: GeoJSON.Feature<GeoJSON.LineString> = {
    type: 'Feature',
    properties: {},
    geometry: route.geometry,
  };

  const waypointFeatures: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: waypoints.map((w) => ({
      type: 'Feature',
      properties: { name: w.name, kind: w.type },
      geometry: { type: 'Point', coordinates: [w.lon, w.lat] },
    })),
  };

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: route.name }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.mapWrap}>
          <MapCanvas ref={cameraRef} showUser>
            <GeoJSONSource id="route-line" data={lineFeature}>
              <Layer
                id="route-line-layer"
                type="line"
                layout={{ 'line-join': 'round', 'line-cap': 'round' }}
                paint={{ 'line-color': '#E5484D', 'line-width': 5 }}
              />
            </GeoJSONSource>
            {waypoints.length > 0 ? (
              <GeoJSONSource id="route-waypoints" data={waypointFeatures}>
                <Layer
                  id="route-waypoints-layer"
                  type="circle"
                  paint={{
                    'circle-radius': 6,
                    'circle-color': '#208AEF',
                    'circle-stroke-width': 2,
                    'circle-stroke-color': '#ffffff',
                  }}
                />
              </GeoJSONSource>
            ) : null}
          </MapCanvas>
        </View>

        <View style={styles.body}>
          {route.region ? (
            <ThemedText type="small" themeColor="textSecondary">
              {route.region}
            </ThemedText>
          ) : null}

          <StatGrid>
            <StatCard label="Distance" value={formatDistance(route.distanceM)} />
            <StatCard label="Ascent" value={formatElevation(route.ascentM)} />
            <StatCard label="Difficulty" value={route.difficulty ?? '--'} />
          </StatGrid>

          <ThemedText type="small" themeColor="textSecondary">
            Download this area for offline use from Settings, then record your hike from the Map tab
            to navigate this route.
          </ThemedText>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingBottom: Spacing.six },
  mapWrap: { height: 320 },
  body: { padding: Spacing.four, gap: Spacing.three },
});
