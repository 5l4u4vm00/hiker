import {
  Camera,
  type CameraRef,
  type LngLatBounds,
  Map as MapLibreMap,
  UserLocation,
} from '@maplibre/maplibre-react-native';
import { forwardRef, useState } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { DEFAULT_ZOOM, MAP_RASTER_STYLE, TAIWAN_CENTER } from '@/map/mapStyle';

const BOUNDS_PADDING = { top: 40, right: 40, bottom: 40, left: 40 };

/** Midpoint of a `[west, south, east, north]` bounds tuple, for a pre-fit camera center. */
function boundsCenter(bounds: LngLatBounds | undefined): [number, number] | undefined {
  if (!bounds) return undefined;
  const [west, south, east, north] = bounds;
  return [(west + east) / 2, (south + north) / 2];
}

export interface MapCanvasProps {
  centerCoordinate?: [number, number];
  zoomLevel?: number;
  /**
   * When set, the camera fits these bounds (declaratively) instead of using
   * `centerCoordinate`/`zoomLevel`. Reliable for focusing on a route.
   */
  bounds?: LngLatBounds;
  showUser?: boolean;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Base map surface: MapTiler Outdoor raster tiles, a camera, and the user location dot.
 * Overlay sources/layers (track polyline, waypoints) are passed as children.
 * The camera ref is forwarded so callers can recenter or fit bounds.
 */
export const MapCanvas = forwardRef<CameraRef, MapCanvasProps>(function MapCanvas(
  { centerCoordinate, zoomLevel = DEFAULT_ZOOM, bounds, showUser = true, children, style },
  ref,
) {
  // MapLibre throws "padding is greater than map's height or width" if a bounds
  // fit runs before the map view has been measured (e.g. during a tab
  // transition). Gate the bounds camera on the map having finished loading,
  // which only happens once the GL surface — and thus a sized view — exists.
  const [mapReady, setMapReady] = useState(false);
  return (
    <MapLibreMap
      style={[styles.map, style]}
      mapStyle={MAP_RASTER_STYLE}
      onDidFinishLoadingMap={() => setMapReady(true)}>
      {bounds && mapReady ? (
        <Camera ref={ref} bounds={bounds} padding={BOUNDS_PADDING} duration={600} />
      ) : (
        <Camera
          ref={ref}
          center={centerCoordinate ?? boundsCenter(bounds) ?? TAIWAN_CENTER}
          zoom={zoomLevel}
          duration={600}
        />
      )}
      {showUser ? <UserLocation /> : null}
      {children}
    </MapLibreMap>
  );
});

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
});
