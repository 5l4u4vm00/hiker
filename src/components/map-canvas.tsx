import {
  Camera,
  type CameraRef,
  type LngLatBounds,
  Map as MapLibreMap,
  UserLocation,
} from '@maplibre/maplibre-react-native';
import { forwardRef } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { DEFAULT_ZOOM, MAP_RASTER_STYLE, TAIWAN_CENTER } from '@/map/mapStyle';

const BOUNDS_PADDING = { top: 40, right: 40, bottom: 40, left: 40 };

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
  return (
    <MapLibreMap style={[styles.map, style]} mapStyle={MAP_RASTER_STYLE}>
      {bounds ? (
        <Camera ref={ref} bounds={bounds} padding={BOUNDS_PADDING} duration={600} />
      ) : (
        <Camera
          ref={ref}
          center={centerCoordinate ?? TAIWAN_CENTER}
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
