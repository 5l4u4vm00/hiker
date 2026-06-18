import {
  Camera,
  type CameraRef,
  Map as MapLibreMap,
  UserLocation,
} from '@maplibre/maplibre-react-native';
import { forwardRef } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { DEFAULT_ZOOM, OSM_RASTER_STYLE, TAIWAN_CENTER } from '@/map/mapStyle';

export interface MapCanvasProps {
  centerCoordinate?: [number, number];
  zoomLevel?: number;
  showUser?: boolean;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Base map surface: OSM raster tiles, a camera, and the user location dot.
 * Overlay sources/layers (track polyline, waypoints) are passed as children.
 * The camera ref is forwarded so callers can recenter or fit bounds.
 */
export const MapCanvas = forwardRef<CameraRef, MapCanvasProps>(function MapCanvas(
  { centerCoordinate, zoomLevel = DEFAULT_ZOOM, showUser = true, children, style },
  ref,
) {
  return (
    <MapLibreMap style={[styles.map, style]} mapStyle={OSM_RASTER_STYLE}>
      <Camera
        ref={ref}
        center={centerCoordinate ?? TAIWAN_CENTER}
        zoom={zoomLevel}
        duration={600}
      />
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
