import { Ionicons } from '@expo/vector-icons';
import { GeoJSONSource, Layer, RasterDEMSource, ViewAnnotation } from '@maplibre/maplibre-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { WAYPOINT_META } from '@/components/waypoint-sheet';
import { getAllPois } from '@/db/pois';
import { getAllWaypoints, listRoutes } from '@/db/routes';
import type { Route, WaypointType } from '@/db/types';
import { boundsOfCoords, buildTerrainDemUrl, TERRAIN_DEM_MAXZOOM } from '@/map/mapStyle';
import { MAPTILER_TOKEN } from '@/state/mapTokenStore';
import { useMapLayerStore } from '@/state/mapLayerStore';
import { kmMarkers } from '@/tracking/stats';

/** A POI to mark on the map (bundled dataset entry or a user's saved waypoint). */
interface PoiMarker {
  id: string;
  lngLat: [number, number];
  category: WaypointType;
}

/** Padding (degrees, ~5 km) added around the reference line when finding nearby routes. */
const NEARBY_PAD_DEG = 0.05;
const NEARBY_COLOR = '#4A5568';

/** True when two `[west, south, east, north]` boxes overlap. */
function boundsIntersect(
  a: [number, number, number, number],
  b: [number, number, number, number],
): boolean {
  return !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]);
}

interface MapOverlayLayersProps {
  /**
   * The active line the helper layers anchor to — the draft points on the Plan
   * screen, or the followed-route coordinates on the Map tab. Distance markers
   * are placed along it and nearby routes are found around its bounds.
   */
  referenceLine?: [number, number][];
  /** A route id to omit from the nearby-routes layer (the one being edited/followed). */
  excludeRouteId?: string;
}

/**
 * Optional hiking layers drawn over the basemap, gated by `useMapLayerStore`:
 * a client-side hillshade relief, faint nearby saved routes, kilometre markers
 * along the active line, and POI markers (bundled + the user's own waypoints)
 * filtered by category. Rendered as MapCanvas children; place it before the
 * active route overlay so the route the user is working on stays on top.
 */
export function MapOverlayLayers({ referenceLine, excludeRouteId }: MapOverlayLayersProps) {
  const hillshade = useMapLayerStore((s) => s.hillshade);
  const distanceMarkers = useMapLayerStore((s) => s.distanceMarkers);
  const nearbyRoutes = useMapLayerStore((s) => s.nearbyRoutes);
  const poiCategories = useMapLayerStore((s) => s.poiCategories);

  const [pois, setPois] = useState<PoiMarker[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);

  // Load POIs (bundled + the user's saved waypoints) and saved routes once. Both
  // are small, on-device reads; the screens remount the map often enough that a
  // mount-time load keeps the layers fresh without polling.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [bundled, waypoints] = await Promise.all([getAllPois(), getAllWaypoints()]);
      if (cancelled) return;
      setPois([
        ...bundled.map((p) => ({ id: `poi-${p.id}`, lngLat: [p.lon, p.lat] as [number, number], category: p.category })),
        ...waypoints.map((w) => ({ id: `wp-${w.id}`, lngLat: [w.lon, w.lat] as [number, number], category: w.type })),
      ]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!nearbyRoutes) return;
    let cancelled = false;
    listRoutes().then((r) => {
      if (!cancelled) setRoutes(r);
    });
    return () => {
      cancelled = true;
    };
  }, [nearbyRoutes]);

  const visiblePois =
    poiCategories.length > 0 ? pois.filter((p) => poiCategories.includes(p.category)) : [];

  const kmFeatures =
    distanceMarkers && referenceLine && referenceLine.length >= 2 ? kmMarkers(referenceLine) : null;

  // Saved routes to draw as faint reference lines, minus the active one. When an
  // active line exists (drawing a route, or following one) only routes near its
  // bounds are kept; otherwise — just browsing the map — every saved route is
  // shown so toggling the layer always surfaces the user's routes.
  const refBounds =
    referenceLine && referenceLine.length > 0 ? boundsOfCoords(referenceLine) : null;
  const paddedRef: [number, number, number, number] | null = refBounds
    ? [
        refBounds[0] - NEARBY_PAD_DEG,
        refBounds[1] - NEARBY_PAD_DEG,
        refBounds[2] + NEARBY_PAD_DEG,
        refBounds[3] + NEARBY_PAD_DEG,
      ]
    : null;
  const nearbyFeature: GeoJSON.Feature<GeoJSON.MultiLineString> | null = nearbyRoutes
    ? {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'MultiLineString',
          coordinates: routes
            .filter((route) => route.id !== excludeRouteId)
            .filter((route) => {
              if (!paddedRef) return true;
              const rb = boundsOfCoords(route.geometry.coordinates);
              return rb && boundsIntersect(paddedRef, rb);
            })
            .map((route) => route.geometry.coordinates),
        },
      }
    : null;

  return (
    <>
      {hillshade ? (
        <RasterDEMSource
          id="terrain-dem"
          tiles={[buildTerrainDemUrl(MAPTILER_TOKEN)]}
          tileSize={256}
          maxzoom={TERRAIN_DEM_MAXZOOM}
          encoding="mapbox">
          <Layer
            id="hillshade-layer"
            type="hillshade"
            // Only `hillshade-exaggeration` is set: the installed MapLibre iOS
            // binding crashes ("-[UIDeviceRGBColor count]") when the hillshade
            // *-color paint properties are applied, so leave them at the native
            // defaults rather than passing colors here.
            paint={{ 'hillshade-exaggeration': 0.45 }}
          />
        </RasterDEMSource>
      ) : null}

      {nearbyFeature && nearbyFeature.geometry.coordinates.length > 0 ? (
        <GeoJSONSource id="nearby-routes" data={nearbyFeature}>
          {/* White casing underneath so the dashed line stays legible over the
              green/brown outdoor basemap. */}
          <Layer
            id="nearby-routes-casing"
            type="line"
            layout={{ 'line-join': 'round', 'line-cap': 'round' }}
            paint={{ 'line-color': '#FFFFFF', 'line-width': 5, 'line-opacity': 0.6 }}
          />
          <Layer
            id="nearby-routes-layer"
            type="line"
            layout={{ 'line-join': 'round', 'line-cap': 'round' }}
            paint={{
              'line-color': NEARBY_COLOR,
              'line-width': 2.5,
              'line-opacity': 0.95,
              'line-dasharray': [2, 2],
            }}
          />
        </GeoJSONSource>
      ) : null}

      {visiblePois.map((poi) => {
        const meta = WAYPOINT_META[poi.category];
        return (
          <ViewAnnotation key={poi.id} id={poi.id} lngLat={poi.lngLat}>
            <View style={[styles.poi, { backgroundColor: meta.color }]}>
              <Ionicons name={meta.icon} size={13} color="#ffffff" />
            </View>
          </ViewAnnotation>
        );
      })}

      {kmFeatures?.features.map((f) => (
        <ViewAnnotation
          key={`km-${f.properties.km}`}
          id={`km-${f.properties.km}`}
          lngLat={f.geometry.coordinates as [number, number]}>
          <View style={styles.kmPill}>
            <ThemedText type="small" style={styles.kmText}>
              {f.properties.km}
            </ThemedText>
          </View>
        </ViewAnnotation>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  poi: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  kmPill: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: 'rgba(17,24,39,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  kmText: { color: '#ffffff', fontWeight: '600' },
});
